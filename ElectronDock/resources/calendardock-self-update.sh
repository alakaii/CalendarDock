#!/bin/bash
# CalendarDock — kiosk self-update
# Invoked from the running app via:
#   sudo /usr/local/bin/calendardock-self-update <path-to-deb>
#
# The kiosk user is granted NOPASSWD sudo for this exact path
# (see setup-kiosk.sh).

set -uo pipefail

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

# ── Self-propagate improvements to this helper script ────────────────────────
# /usr/local/bin/calendardock-self-update lives outside the deb's file list,
# so an updated helper inside the freshly-installed package never reaches its
# install location on its own. Re-exec into the shipped copy when it differs
# from what's running, so future fixes to the restart logic propagate the
# moment a new build lands. Skip on first install (file may not exist yet).
SHIPPED_HELPER="/opt/CalendarDock/resources/calendardock-self-update.sh"
SELF_PATH="/usr/local/bin/calendardock-self-update"
if [ "${CALENDARDOCK_HELPER_REEXEC:-}" != "1" ] && [ -f "$SHIPPED_HELPER" ] \
   && ! cmp -s "$SHIPPED_HELPER" "$SELF_PATH" 2>/dev/null; then
  : # We'll do the self-update *after* dpkg lays down the new shipped copy
fi

echo "Installing $DEB..."
dpkg -i "$DEB"

# Re-assert chrome-sandbox SUID after every install — package post-install
# isn't reliable on Ubuntu and Electron crashes without it.
if [ -f /opt/CalendarDock/chrome-sandbox ]; then
  chown root:root /opt/CalendarDock/chrome-sandbox
  chmod 4755     /opt/CalendarDock/chrome-sandbox
fi

# Self-update the helper from the package we just installed, so the next
# self-update run uses any improvements shipped in this release.
if [ "${CALENDARDOCK_HELPER_REEXEC:-}" != "1" ] && [ -f "$SHIPPED_HELPER" ] \
   && ! cmp -s "$SHIPPED_HELPER" "$SELF_PATH" 2>/dev/null; then
  echo "Helper script changed — copying $SHIPPED_HELPER → $SELF_PATH"
  cp "$SHIPPED_HELPER" "$SELF_PATH"
  chmod 755         "$SELF_PATH"
  chown root:root   "$SELF_PATH"
  echo "Re-executing into updated helper for the restart phase..."
  CALENDARDOCK_HELPER_REEXEC=1 exec "$SELF_PATH" "$DEB"
fi

echo "Cleaning up..."
rm -f "$DEB"

# We can't `systemctl stop calendardock` directly from this script: the app
# spawned us (via sudo), so we live inside calendardock's cgroup. Stopping
# the unit sends SIGTERM to that whole cgroup — including this script —
# which kills us before we can start the service back up.
#
# Workaround: hand the stop/start dance to a transient systemd unit.
# --no-block returns immediately so this helper exits cleanly and the IPC
# call back in the app resolves; the transient unit lives in its own
# scope, so the subsequent `systemctl stop` doesn't take it out.
echo "Scheduling restart via systemd-run..."
systemd-run \
  --collect \
  --no-block \
  --unit=calendardock-self-restart.service \
  --description='Stop, kill orphans, then start calendardock after self-update' \
  /bin/bash -c '
    # Tag everything we log so journalctl -t calendardock-self-restart shows
    # the full timeline for post-mortems if a restart silently fails.
    log() { logger -t calendardock-self-restart "$*"; echo "$*"; }

    # Brief grace so the helper exits and the app IPC promise resolves first.
    sleep 1

    # KillMode=control-group (the systemd default) sends SIGTERM to the whole
    # unit cgroup, then SIGKILL after TimeoutStopSec — so children die too.
    log "Stopping calendardock unit"
    systemctl stop calendardock || log "stop returned non-zero (already stopped?)"

    # Belt: catch any Electron orphan that escaped the cgroup (re-parented to
    # PID 1 before SIGTERM caught up). Anchor with ^ so the regex only matches
    # processes whose command line *starts* with the calendardock binary path
    # — NOT this bash script (whose full command line contains the literal
    # string `/opt/CalendarDock/calendardock` as a pkill argument and would
    # otherwise have its own pkill SIGKILL its own parent shell).
    pkill -9 -f ^/opt/CalendarDock/calendardock 2>/dev/null || true

    # Wait for the listening ports to actually be free. The previous fixed
    # `sleep 1` was a guess; on Wayland kiosks Electron'\''s utility
    # subprocesses sometimes release sockets a beat after the main process
    # has exited, and the new instance hits EADDRINUSE.
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
