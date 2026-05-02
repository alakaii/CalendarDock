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
set -euo pipefail
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
echo "Installing $DEB..."
dpkg -i "$DEB"
if [ -f /opt/CalendarDock/chrome-sandbox ]; then
  chown root:root /opt/CalendarDock/chrome-sandbox
  chmod 4755     /opt/CalendarDock/chrome-sandbox
fi
rm -f "$DEB"
echo "Stopping calendardock..."
systemctl stop calendardock || true
pkill -9 -f /opt/CalendarDock/calendardock 2>/dev/null || true
sleep 1
echo "Starting calendardock..."
systemctl start calendardock
echo "Done."
HELPER
chmod 755 /usr/local/bin/calendardock-self-update
chown root:root /usr/local/bin/calendardock-self-update

# ── Sudoers rule: kiosk user can run ONLY the helper, no password ─────────────
SUDOERS_KIOSK="/etc/sudoers.d/calendardock-kiosk-update"
cat > "$SUDOERS_KIOSK" << EOF
$KIOSK_USER ALL=(root) NOPASSWD: /usr/local/bin/calendardock-self-update /tmp/*.deb
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
ExecStart=$APP_PATH --ozone-platform=wayland --enable-features=UseOzonePlatform
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
