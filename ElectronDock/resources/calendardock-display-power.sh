#!/bin/bash
# CalendarDock — Wayland-friendly display power helper.
#
# Invoked from the running app (which is non-root) via:
#   sudo /usr/local/bin/calendardock-display-power on
#   sudo /usr/local/bin/calendardock-display-power off
#
# The kiosk user is granted NOPASSWD sudo for this exact path
# (see /etc/sudoers.d/calendardock-kiosk-update). Wayland sessions can't
# use `xset dpms force off` (no DISPLAY auth), so we drive the panel's
# brightness file directly. This works for laptop-style kiosks where the
# panel is connected as eDP and exposes /sys/class/backlight/.

set -uo pipefail

ARG="${1:-}"

case "$ARG" in
  on|off) ;;
  *)
    echo "Usage: $(basename "$0") on|off" >&2
    exit 1
    ;;
esac

# Pick the first available backlight device. Most laptops expose
# `intel_backlight`; some show `acpi_video0`. We don't enumerate every
# possibility — just the two we expect.
BL_DIR=""
for cand in /sys/class/backlight/intel_backlight /sys/class/backlight/acpi_video0; do
  if [ -d "$cand" ]; then BL_DIR="$cand"; break; fi
done
if [ -z "$BL_DIR" ]; then
  # No software backlight available — best effort, exit successfully so
  # the calling code doesn't treat it as an error on hardware where
  # there's nothing to control.
  echo "no backlight device found; nothing to do" >&2
  exit 0
fi

BR_FILE="$BL_DIR/brightness"
MAX_FILE="$BL_DIR/max_brightness"
SAVE_FILE="/var/run/calendardock-saved-brightness"

if [ ! -w "$BR_FILE" ]; then
  echo "ERROR: $BR_FILE not writable (running as $(id -un))" >&2
  exit 2
fi

if [ "$ARG" = "off" ]; then
  CUR="$(cat "$BR_FILE" 2>/dev/null || echo 0)"
  # Only save if the screen is currently on; otherwise don't overwrite a
  # previously-saved value with 0 (would cause "wake" to do nothing).
  if [ "$CUR" -gt 0 ]; then
    echo "$CUR" > "$SAVE_FILE"
  fi
  echo 0 > "$BR_FILE"
  exit 0
fi

# ARG == on: restore the saved brightness, or pick max if we have nothing
# saved (first boot, or a previous off without a save).
if [ -s "$SAVE_FILE" ]; then
  RESTORE="$(cat "$SAVE_FILE")"
else
  RESTORE="$(cat "$MAX_FILE" 2>/dev/null || echo 65535)"
fi
echo "$RESTORE" > "$BR_FILE"
