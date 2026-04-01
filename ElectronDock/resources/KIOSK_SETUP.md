# CalendarDock — Kiosk Setup Instructions

## What you need
- The 32" Ubuntu kiosk (plugged in, keyboard + mouse attached for first-time setup)
- Your dev machine on the same network

---

## Step 1 — First boot: Ubuntu initial setup

1. Boot the kiosk. If Ubuntu isn't installed yet, install **Ubuntu 22.04 LTS Desktop**.
2. During setup, create a user called **`kiosk`** (or whatever you prefer — update `setup-kiosk.sh` if different).
3. Set it to **auto-login** (Settings → Users → Automatic Login).
4. Connect to your WiFi / ethernet.
5. Note the IP address: open Terminal and run:
   ```bash
   hostname -I
   ```
   Write it down — you'll need it for `deploy.sh`.

---

## Step 2 — Generate an SSH key on your dev machine (if you don't have one)

In WSL or Git Bash on your Windows machine:
```bash
ssh-keygen -t ed25519 -C "calendardock-deploy"
# Press Enter for all prompts (no passphrase needed for deploy key)
```

Your public key is now at `~/.ssh/id_ed25519.pub`. Print it:
```bash
cat ~/.ssh/id_ed25519.pub
```
Copy the output — you'll paste it on the kiosk in Step 4.

---

## Step 3 — Install CalendarDock on the kiosk

On your **dev machine**, build the installer:
```bash
cd ElectronDock
npm run package
```
This produces `dist/CalendarDock-1.0.0.deb` (or similar).

Copy it to a USB drive or transfer it to the kiosk via the network.

On the **kiosk**, open Terminal:
```bash
sudo dpkg -i ~/Downloads/CalendarDock-1.0.0.deb
# (adjust path to wherever you put the .deb)
```

---

## Step 4 — Run the kiosk setup script

On the **kiosk**, in Terminal:
```bash
sudo bash /opt/CalendarDock/resources/setup-kiosk.sh
```

When prompted to paste your public key, paste the output from Step 2 and press **Enter then Ctrl+D**.

The script will:
- Install `ffmpeg`
- Set up SSH with key-only access
- Disable the screensaver
- Set CalendarDock to start on boot
- Disable automatic OS updates

At the end it prints your kiosk IP — confirm it matches what you noted in Step 1.

---

## Step 5 — Update `deploy.sh` on your dev machine

Open `ElectronDock/deploy.sh` and set your kiosk's IP:
```bash
KIOSK_HOST="192.168.1.XXX"   # ← replace with your kiosk IP
```

Test the SSH connection:
```bash
ssh -i ~/.ssh/id_ed25519 deploy@192.168.1.XXX
# Should connect, run the update script (finding no .deb), and exit cleanly
```

---

## Step 6 — Start the app

On the kiosk:
```bash
sudo systemctl start calendardock
```

CalendarDock will now start automatically on every boot.

---

## Pushing updates (from now on)

From your **dev machine** — this is all you ever need to run:
```bash
cd ElectronDock
bash deploy.sh
```

This will:
1. Build the app (`npm run package`)
2. SCP the `.deb` to the kiosk
3. SSH in, install it, and restart the service automatically

The kiosk doesn't need a keyboard/mouse or monitor interaction for any future update.

---

## Useful commands (run from dev machine via SSH)

```bash
# View live app logs
ssh -i ~/.ssh/id_ed25519 kiosk@192.168.1.XXX "journalctl -u calendardock -f"

# Restart the app
ssh -i ~/.ssh/id_ed25519 kiosk@192.168.1.XXX "sudo systemctl restart calendardock"

# Check app status
ssh -i ~/.ssh/id_ed25519 kiosk@192.168.1.XXX "sudo systemctl status calendardock"
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| App doesn't start on boot | `sudo systemctl enable calendardock` on kiosk |
| Screen goes blank | Re-run the screensaver disable section of `setup-kiosk.sh` |
| Touch not working | Verify `DISPLAY=:0` is set in the systemd service |
| deploy.sh can't connect | Check kiosk IP hasn't changed (set a static IP in router) |
| Camera streams fail | `sudo apt install ffmpeg` on kiosk |
