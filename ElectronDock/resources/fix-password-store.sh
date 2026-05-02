#!/bin/bash
# CalendarDock — switch to --password-store=basic so safeStorage works
# reliably under GDM autologin (gnome-keyring isn't unlocked at boot).
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: must run as root" >&2
  exit 1
fi

SERVICE_FILE="/etc/systemd/system/calendardock.service"

# Add --password-store=basic if not already present
if grep -q -- '--password-store=' "$SERVICE_FILE"; then
  echo "password-store flag already configured."
else
  sed -i 's|^ExecStart=\(.*\)$|ExecStart=\1 --password-store=basic|' "$SERVICE_FILE"
  echo "Added --password-store=basic to ExecStart."
fi

# Clear stale encrypted tokens so user can re-auth cleanly. The previous
# tokens may have been encrypted with a backend we can no longer read.
SETTINGS=/home/pc/.config/calendardock/settings.json
if [ -f "$SETTINGS" ]; then
  python3 - "$SETTINGS" << 'PY'
import json, sys
path = sys.argv[1]
with open(path) as f: d = json.load(f)
clear = ['dropboxEncryptedAccessToken','dropboxEncryptedRefreshToken',
         'dropboxAccessTokenExpiry','dropboxAccountId','dropboxAccountEmail',
         'dropboxEnabled','ringEncryptedRefreshToken','ringAccountEmail']
for k in clear: d[k] = '' if isinstance(d.get(k), str) else (0 if isinstance(d.get(k), int) else False)
# Google accounts list — clear encrypted refresh tokens, drop the rest of the
# account so the user re-auths and we get a fresh photo URL etc.
d['accounts'] = []
with open(path, 'w') as f: json.dump(d, f, indent=2)
print("Cleared stale encrypted tokens.")
PY
fi

systemctl daemon-reload
systemctl stop calendardock || true
pkill -9 -f /opt/CalendarDock/calendardock 2>/dev/null || true
sleep 1
systemctl start calendardock
sleep 2
echo ""
echo "=== Status ==="
systemctl is-active calendardock
grep ExecStart "$SERVICE_FILE"
echo ""
echo "Now reconnect Dropbox / Add Google account on the kiosk."
