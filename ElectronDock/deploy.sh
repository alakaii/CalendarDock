#!/bin/bash
# CalendarDock — deploy update to kiosk
# Run from your dev machine (WSL, Git Bash, or Linux):
#   bash deploy.sh
#
# First time: copy your SSH public key to the kiosk via setup-kiosk.sh
# Requires: ssh, scp, npm

set -e

# ── Config — edit these ────────────────────────────────────────────────────────
KIOSK_HOST="192.168.1.XXX"   # kiosk IP or hostname
KIOSK_SSH_KEY="$HOME/.ssh/id_ed25519"
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSH_OPTS="-i $KIOSK_SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

echo "▶ CalendarDock deploy to $KIOSK_HOST"
echo ""

# 1. Build
echo "==> Building..."
cd "$SCRIPT_DIR"
npm run package
echo "    Build complete."

# 2. Find the .deb
DEB=$(ls dist/*.deb 2>/dev/null | head -1)
if [ -z "$DEB" ]; then
  echo "ERROR: No .deb found in dist/. Build may have failed."
  exit 1
fi
echo "    Package: $DEB"

# 3. Copy to kiosk
echo "==> Copying to kiosk..."
scp $SSH_OPTS "$DEB" "deploy@$KIOSK_HOST:/tmp/calendardock-update.deb"
echo "    Uploaded."

# 4. SSH in — the deploy user's ForceCommand installs it and restarts the service
echo "==> Installing on kiosk..."
ssh $SSH_OPTS "deploy@$KIOSK_HOST"
echo ""
echo "✓ Deploy complete!"
