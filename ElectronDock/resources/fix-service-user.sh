#!/bin/bash
# CalendarDock — configure systemd service for Wayland session (Ubuntu 24.04 + GDM autologin)
# Run via: sudo bash fix-service-user.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: must run as root (sudo bash $0)" >&2
  exit 1
fi

APP_USER="pc"
APP_UID=$(id -u "$APP_USER")

cat > /etc/systemd/system/calendardock.service << EOF
[Unit]
Description=CalendarDock Kiosk
After=graphical.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
# Wayland-native — Electron 28+ uses Ozone with the --ozone-platform-hint=auto
# flag to pick Wayland when WAYLAND_DISPLAY is present, X11 otherwise.
# WAYLAND_DISPLAY socket lives in XDG_RUNTIME_DIR.
Environment=XDG_RUNTIME_DIR=/run/user/$APP_UID
Environment=WAYLAND_DISPLAY=wayland-0
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$APP_UID/bus
Environment=HOME=/home/$APP_USER
WorkingDirectory=/home/$APP_USER
ExecStart=/opt/CalendarDock/calendardock --ozone-platform=wayland --enable-features=UseOzonePlatform
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

cat > /etc/sudoers.d/calendardock-kiosk-update << EOF
$APP_USER ALL=(root) NOPASSWD: /usr/local/bin/calendardock-self-update /tmp/*.deb
EOF
chmod 440 /etc/sudoers.d/calendardock-kiosk-update

systemctl daemon-reload
systemctl restart calendardock
sleep 4
echo ""
echo "=== Service status ==="
systemctl is-active calendardock
systemctl --no-pager --lines=15 status calendardock || true
echo ""
echo "=== Recent logs ==="
journalctl -u calendardock --no-pager --lines=20 | tail -20
