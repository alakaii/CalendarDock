#!/bin/bash
# CalendarDock — Ubuntu kiosk setup script
# Run once as root on the kiosk after installing the .deb package
# Usage: sudo bash setup-kiosk.sh
#
# What this does:
#   1. Installs ffmpeg + openssh-server
#   2. Configures SSH for key-based access (deploy user)
#   3. Disables X11 screensaver / DPMS
#   4. Installs + enables the CalendarDock systemd service
#   5. Disables unattended-upgrades (no surprise reboots)

set -e

KIOSK_USER="kiosk"
DEPLOY_USER="deploy"
APP_PATH="/opt/CalendarDock/calendardock"

# ── 1. Dependencies ────────────────────────────────────────────────────────────
echo "==> Installing dependencies..."
apt-get update -qq
apt-get install -y ffmpeg openssh-server

# ── 2. SSH setup ───────────────────────────────────────────────────────────────
echo "==> Configuring SSH..."

# Create a dedicated deploy user with no login shell (deploy-only, no interactive access)
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$DEPLOY_USER"
  echo "    Created user: $DEPLOY_USER"
fi

# Authorized keys directory for deploy user
DEPLOY_SSH_DIR="/etc/ssh/authorized_keys.d/$DEPLOY_USER"
mkdir -p "$DEPLOY_SSH_DIR"
chmod 700 "$DEPLOY_SSH_DIR"

# Prompt for the dev machine's public key
echo ""
echo "  Paste your dev machine's public key (~/.ssh/id_ed25519.pub or id_rsa.pub),"
echo "  then press Enter followed by Ctrl+D:"
cat > "$DEPLOY_SSH_DIR/authorized_keys"
chmod 600 "$DEPLOY_SSH_DIR/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_SSH_DIR" "$DEPLOY_SSH_DIR/authorized_keys" 2>/dev/null || true
echo "    Public key saved."

# Harden sshd: key-only auth, no root login, deploy user can only run the update script
SSHD_CONF="/etc/ssh/sshd_config.d/calendardock.conf"
cat > "$SSHD_CONF" << 'EOF'
# CalendarDock kiosk SSH hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile /etc/ssh/authorized_keys.d/%u/authorized_keys

# Restrict the deploy user to only running the update script
Match User deploy
    ForceCommand /usr/local/bin/calendardock-update
    AllowTcpForwarding no
    X11Forwarding no
EOF

# The command the deploy user is forced to run (SCP + install + restart)
cat > /usr/local/bin/calendardock-update << 'SCRIPT'
#!/bin/bash
# Called automatically when deploy user SSH's in.
# Expects a .deb to have been SCP'd to /tmp/calendardock-update.deb first.
DEB="/tmp/calendardock-update.deb"
if [ ! -f "$DEB" ]; then
  echo "ERROR: No update package found at $DEB"
  exit 1
fi
echo "Installing CalendarDock update..."
dpkg -i "$DEB"
rm -f "$DEB"
echo "Restarting CalendarDock service..."
systemctl restart calendardock
echo "Done! CalendarDock updated and restarted."
SCRIPT
chmod +x /usr/local/bin/calendardock-update

# Allow deploy user to run dpkg and systemctl without password
SUDOERS_FILE="/etc/sudoers.d/calendardock-deploy"
cat > "$SUDOERS_FILE" << 'EOF'
deploy ALL=(root) NOPASSWD: /usr/bin/dpkg -i /tmp/calendardock-update.deb
deploy ALL=(root) NOPASSWD: /bin/systemctl restart calendardock
deploy ALL=(root) NOPASSWD: /bin/rm -f /tmp/calendardock-update.deb
EOF
chmod 440 "$SUDOERS_FILE"

# Enable and start SSH
systemctl enable --now ssh
echo "    SSH ready. Port 22."

# ── 3. Screensaver / DPMS ──────────────────────────────────────────────────────
echo "==> Disabling screensaver / display power management..."
sudo -u "$KIOSK_USER" bash -c "
  mkdir -p /home/$KIOSK_USER/.config/autostart
  cat > /home/$KIOSK_USER/.config/autostart/disable-screensaver.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Disable Screensaver
Exec=bash -c 'xset s off && xset -dpms && xset s noblank'
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
"

# ── 4. Systemd service ─────────────────────────────────────────────────────────
echo "==> Installing CalendarDock systemd service..."
cp "$(dirname "$0")/calendardock.service" /etc/systemd/system/
sed -i "s|ExecStart=.*|ExecStart=$APP_PATH|" /etc/systemd/system/calendardock.service
systemctl daemon-reload
systemctl enable calendardock.service

# ── 5. No surprise reboots ─────────────────────────────────────────────────────
echo "==> Disabling unattended-upgrades..."
systemctl disable --now unattended-upgrades 2>/dev/null || true

# ── Done ───────────────────────────────────────────────────────────────────────
KIOSK_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  CalendarDock kiosk setup complete!                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Kiosk IP:    $KIOSK_IP"
echo "║  Start app:   sudo systemctl start calendardock      ║"
echo "║  View logs:   journalctl -u calendardock -f          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  From your dev machine, to deploy an update:         ║"
echo "║    bash deploy.sh                                    ║"
echo "╚══════════════════════════════════════════════════════╝"
