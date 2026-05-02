#!/bin/bash
# Patch installed self-update helper to force-kill orphan processes before
# starting the new version, avoiding EADDRINUSE on update.
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: must run as root" >&2
  exit 1
fi

cat > /usr/local/bin/calendardock-self-update << 'HELPER'
#!/bin/bash
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

echo "Helper patched."
