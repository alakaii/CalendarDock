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

# Re-assert chrome-sandbox SUID after every install — package post-install
# isn't reliable on Ubuntu and Electron crashes without it.
if [ -f /opt/CalendarDock/chrome-sandbox ]; then
  chown root:root /opt/CalendarDock/chrome-sandbox
  chmod 4755     /opt/CalendarDock/chrome-sandbox
fi

echo "Cleaning up..."
rm -f "$DEB"

# We can't `systemctl stop calendardock` directly from this script: the app
# spawned us (via sudo), so we live inside calendardock's cgroup. Stopping
# the unit sends SIGTERM to that whole cgroup — including this script —
# which kills us before we can start the service back up. The `|| true`
# trick doesn't help because the shell itself dies on the signal.
#
# Workaround: hand the stop/start dance to a transient systemd unit.
# --no-block returns immediately so this helper exits cleanly and the IPC
# call back in the app resolves; the transient unit lives in its own
# scope, so the subsequent `systemctl stop` doesn't take it out.
#
# Belt-and-suspenders pkill is kept because Electron's main process
# doesn't always exit cleanly on SIGTERM; orphans hold ports 54321/54322
# and the new instance crashes with EADDRINUSE.
echo "Scheduling restart via systemd-run..."
systemd-run \
  --collect \
  --no-block \
  --unit=calendardock-self-restart.service \
  --description='Stop, kill orphans, then start calendardock after self-update' \
  /bin/bash -c '
    set -e
    sleep 1
    systemctl stop calendardock || true
    pkill -9 -f /opt/CalendarDock/calendardock 2>/dev/null || true
    sleep 1
    systemctl start calendardock
  '

echo "Done — restart scheduled."
