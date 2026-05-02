#!/bin/bash
# CalendarDock — kiosk self-update
# Invoked from the running app via:
#   sudo /usr/local/bin/calendardock-self-update <path-to-deb>
#
# The kiosk user is granted NOPASSWD sudo for this exact path
# (see setup-kiosk.sh).

set -euo pipefail

DEB="${1:-}"

if [ -z "$DEB" ] || [ ! -f "$DEB" ]; then
  echo "ERROR: missing or invalid .deb path: '$DEB'" >&2
  exit 1
fi

# Refuse anything outside /tmp — the app always downloads to /tmp.
case "$DEB" in
  /tmp/*) ;;
  *)
    echo "ERROR: refusing to install .deb outside /tmp: $DEB" >&2
    exit 2
    ;;
esac

echo "Installing $DEB..."
dpkg -i "$DEB"

echo "Cleaning up..."
rm -f "$DEB"

echo "Restarting calendardock..."
systemctl restart calendardock

echo "Done."
