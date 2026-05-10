#!/bin/bash
# CalendarDock — minimal kiosk bootstrap (run as root via sudo)
#
# Does the bare minimum to get the kiosk running with the in-app
# updater. Skips the deploy-user / SSH-hardening pieces from the
# original setup-kiosk.sh — those are obsolete now that the kiosk
# pulls its own updates from GitHub Releases.
#
# Usage:
#   sudo bash kiosk-bootstrap.sh

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: must run as root (sudo bash $0)" >&2
  exit 1
fi

APP_PATH="/opt/CalendarDock/calendardock"
GH_REPO="alakaii/CalendarDock"

# App runs as the autologin user — defaults to the lowest-UID human user (>=1000)
# Override with KIOSK_USER=<name> if you want a different account.
KIOSK_USER="${KIOSK_USER:-$(getent passwd | awk -F: '$3 >= 1000 && $3 < 65534 { print $1; exit }')}"
if [ -z "$KIOSK_USER" ]; then
  echo "ERROR: could not detect a kiosk user. Set KIOSK_USER=<name> and re-run." >&2
  exit 1
fi
KIOSK_UID=$(id -u "$KIOSK_USER")

echo "==> Installing system dependencies..."
apt-get update -qq
apt-get install -y --no-install-recommends ffmpeg curl ca-certificates jq

echo "==> Using kiosk user: $KIOSK_USER (uid $KIOSK_UID)"

# ── Docker access for the Wyze bridge ─────────────────────────────────────────
# The Wyze Bridge runs in a Docker container the app launches via the docker
# CLI. The CLI talks to /var/run/docker.sock which is owned by root:docker, so
# the kiosk user has to be in the `docker` group to issue any commands. We
# only add to a group that already exists — installing Docker itself is left
# to the operator, since not every kiosk needs Wyze.
if getent group docker >/dev/null && ! id -nG "$KIOSK_USER" | grep -qw docker; then
  echo "==> Adding $KIOSK_USER to docker group (Wyze bridge access)..."
  usermod -aG docker "$KIOSK_USER"
fi

# ── Disable screensaver / DPMS for kiosk user ─────────────────────────────────
echo "==> Disabling screensaver / DPMS for $KIOSK_USER..."
sudo -u "$KIOSK_USER" mkdir -p "/home/$KIOSK_USER/.config/autostart"
cat > "/home/$KIOSK_USER/.config/autostart/disable-screensaver.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Disable Screensaver
Exec=bash -c 'xset s off && xset -dpms && xset s noblank'
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
chown -R "$KIOSK_USER:$KIOSK_USER" "/home/$KIOSK_USER/.config"

# ── Self-update helper ────────────────────────────────────────────────────────
echo "==> Installing self-update helper..."
cat > /usr/local/bin/calendardock-self-update << 'HELPER'
#!/bin/bash
# Invoked from the running app via:
#   sudo /usr/local/bin/calendardock-self-update <path-to-deb>
set -uo pipefail
DEB="${1:-}"
if [ -z "$DEB" ] || [ ! -f "$DEB" ]; then
  echo "ERROR: missing or invalid .deb path: '$DEB'" >&2
  exit 1
fi
case "$DEB" in
  /tmp/*) ;;
  *)
    echo "ERROR: refusing to install .deb outside /tmp: $DEB" >&2
    exit 2
    ;;
esac
SHIPPED_HELPER="/opt/CalendarDock/resources/calendardock-self-update.sh"
SELF_PATH="/usr/local/bin/calendardock-self-update"
echo "Installing $DEB..."
dpkg -i "$DEB"
if [ -f /opt/CalendarDock/chrome-sandbox ]; then
  chown root:root /opt/CalendarDock/chrome-sandbox
  chmod 4755     /opt/CalendarDock/chrome-sandbox
fi
# Self-update this helper from the freshly-installed package, then re-exec
# into the new version for the restart phase. Lets future fixes to the
# restart logic propagate without needing a fresh kiosk-bootstrap run.
if [ "${CALENDARDOCK_HELPER_REEXEC:-}" != "1" ] && [ -f "$SHIPPED_HELPER" ] \
   && ! cmp -s "$SHIPPED_HELPER" "$SELF_PATH" 2>/dev/null; then
  cp "$SHIPPED_HELPER" "$SELF_PATH"
  chmod 755         "$SELF_PATH"
  chown root:root   "$SELF_PATH"
  echo "Re-executing into updated helper for the restart phase..."
  CALENDARDOCK_HELPER_REEXEC=1 exec "$SELF_PATH" "$DEB"
fi
rm -f "$DEB"
# Hand the stop/start dance to a transient systemd unit so it can't get
# self-killed: when the app spawned us via sudo, we live inside the
# calendardock cgroup, so a direct `systemctl stop` would SIGTERM this
# script before we could call `systemctl start`. systemd-run --no-block
# returns immediately so this helper exits cleanly and the IPC call back
# in the app resolves.
echo "Scheduling restart via systemd-run..."
systemd-run \
  --collect \
  --no-block \
  --unit=calendardock-self-restart.service \
  --description='Stop, kill orphans, then start calendardock after self-update' \
  /bin/bash -c '
    log() { logger -t calendardock-self-restart "$*"; echo "$*"; }
    sleep 1
    log "Stopping calendardock unit"
    systemctl stop calendardock || log "stop returned non-zero (already stopped?)"
    pkill -9 -f ^/opt/CalendarDock/calendardock 2>/dev/null || true
    log "Waiting for ports 54321/54322 to drain"
    for i in $(seq 1 40); do
      if ! ss -tln 2>/dev/null | grep -qE ":(54321|54322)[[:space:]]"; then
        log "Ports clear after ${i} polls (~$((i * 250))ms)"
        break
      fi
      sleep 0.25
      [ "$i" = 40 ] && log "WARN ports still bound after 10s; starting anyway"
    done
    log "Starting calendardock unit"
    if systemctl start calendardock; then
      log "First start succeeded"
    else
      log "First start failed; retrying once after 2s"
      sleep 2
      if systemctl start calendardock; then
        log "Retry start succeeded"
      else
        log "ERROR Both start attempts failed; relying on RestartSec=5"
      fi
    fi
  '
echo "Done — restart scheduled (logs: journalctl -t calendardock-self-restart)."
HELPER
chmod 755 /usr/local/bin/calendardock-self-update
chown root:root /usr/local/bin/calendardock-self-update

# ── Sudoers rule: kiosk user can run ONLY the helpers, no password ────────────
SUDOERS_KIOSK="/etc/sudoers.d/calendardock-kiosk-update"
cat > "$SUDOERS_KIOSK" << EOF
$KIOSK_USER ALL=(root) NOPASSWD: /usr/local/bin/calendardock-self-update /tmp/*.deb, /usr/local/bin/calendardock-display-power on, /usr/local/bin/calendardock-display-power off
EOF
chmod 440 "$SUDOERS_KIOSK"

# ── Systemd service ───────────────────────────────────────────────────────────
echo "==> Installing systemd service..."
cat > /etc/systemd/system/calendardock.service << EOF
[Unit]
Description=CalendarDock Kiosk
After=graphical.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$KIOSK_USER
Environment=XDG_RUNTIME_DIR=/run/user/$KIOSK_UID
Environment=WAYLAND_DISPLAY=wayland-0
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$KIOSK_UID/bus
Environment=HOME=/home/$KIOSK_USER
WorkingDirectory=/home/$KIOSK_USER
ExecStart=$APP_PATH --ozone-platform=wayland --enable-features=UseOzonePlatform --password-store=basic
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
EOF
systemctl daemon-reload
systemctl enable calendardock.service

# ── Disable unattended-upgrades (no surprise reboots) ─────────────────────────
echo "==> Disabling unattended-upgrades..."
systemctl disable --now unattended-upgrades 2>/dev/null || true

# ── Download + install latest .deb from GitHub Releases ───────────────────────
# Use /releases (not /releases/latest) so pre-release tags are included.
echo "==> Fetching latest CalendarDock release..."
RELEASES_JSON=$(curl -fsSL "https://api.github.com/repos/$GH_REPO/releases?per_page=10")
DEB_URL=$(echo "$RELEASES_JSON" | jq -r '[.[] | select(.draft==false) | .assets[] | select(.name | endswith(".deb"))][0].browser_download_url')
TAG=$(echo "$RELEASES_JSON" | jq -r '[.[] | select(.draft==false and (.assets | map(.name | endswith(".deb")) | any))][0].tag_name')

if [ -z "$DEB_URL" ] || [ "$DEB_URL" = "null" ]; then
  echo "ERROR: no .deb asset found in latest release" >&2
  exit 1
fi

echo "    Latest: $TAG"
echo "    URL:    $DEB_URL"
echo "==> Downloading..."
curl -fsSL -o /tmp/calendardock-bootstrap.deb "$DEB_URL"

echo "==> Installing..."
dpkg -i /tmp/calendardock-bootstrap.deb || apt-get install -f -y
rm -f /tmp/calendardock-bootstrap.deb

# Electron's chrome-sandbox needs SUID root or the app crashes with
# "FATAL:setuid_sandbox_host.cc". electron-builder usually sets this in
# its post-install script, but it doesn't always stick on Ubuntu — fix it
# defensively here.
if [ -f /opt/CalendarDock/chrome-sandbox ]; then
  chown root:root /opt/CalendarDock/chrome-sandbox
  chmod 4755     /opt/CalendarDock/chrome-sandbox
fi

# ── Verify install path ───────────────────────────────────────────────────────
if [ ! -x "$APP_PATH" ]; then
  echo "WARNING: expected $APP_PATH not found. Searching..."
  ACTUAL=$(find /opt -maxdepth 3 -type f -name calendardock -executable 2>/dev/null | head -1)
  if [ -n "$ACTUAL" ] && [ "$ACTUAL" != "$APP_PATH" ]; then
    echo "    Found at: $ACTUAL — patching service ExecStart"
    sed -i "s|^ExecStart=.*|ExecStart=$ACTUAL|" /etc/systemd/system/calendardock.service
    systemctl daemon-reload
  fi
fi

# ── Start the service ─────────────────────────────────────────────────────────
echo "==> Starting CalendarDock..."
systemctl restart calendardock
sleep 2
systemctl --no-pager --lines=10 status calendardock || true

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  CalendarDock bootstrap complete!                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Installed: $TAG"
echo "║  Logs:      journalctl -u calendardock -f            ║"
echo "║  Restart:   sudo systemctl restart calendardock      ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Future updates: Settings → Updates → Check Now      ║"
echo "╚══════════════════════════════════════════════════════╝"
