# CalendarDock

A custom digital kiosk for the kitchen wall — calendar, meals, lists, photos, security cameras, sprinklers, water heater, and weather, all on one 32" touchscreen.

Built as an Electron + React + TypeScript app. Designed to run 24/7 on an Ubuntu-based mini-PC with a fanless build, but it also runs fine on macOS and Windows for development.

> **Status:** Personal project, used daily on the wall in my kitchen. Each module is a real integration (no stubs), and modules are independently swappable — you can delete any one of them without breaking the others.

---

## What's in it

| Module          | Purpose                                                             | Backend                                                         |
| --------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Calendar**    | Multi-account Google Calendar with per-calendar colors & visibility | Google Calendar API (OAuth 2.0 desktop flow)                    |
| **Chores**      | Daily chore tracker, local or synced                                | Local store or Google Tasks                                     |
| **Meals**       | Weekly meal grid + fridge/grocery task list                         | Local store + Google Tasks                                      |
| **Photos**      | Rolling slideshow from a local folder or Dropbox                    | Local file watcher *or* Dropbox PKCE OAuth + 500-photo disk cache |
| **Lists**       | Generic shared lists (groceries, todo, etc.)                        | Local store or Google Tasks                                     |
| **Cameras**     | Live MJPEG view of Wyze cameras                                     | [mrlt8/docker-wyze-bridge](https://github.com/mrlt8/docker-wyze-bridge) + ffmpeg transcode |
| **Sprinklers**  | Zone control + schedules                                            | Rachio public REST API                                          |
| **Water Heater**| Tankless temp + recirculation control                               | Rinnai Control-R (Cognito SRP + AppSync GraphQL + IoT Shadow)   |
| **Ring**        | Doorbell/cam snapshots, used for camera-wake                        | `ring-client-api` (refresh-token auth)                          |
| **Weather**     | Current + 6-day forecast                                            | OpenWeatherMap                                                  |

Plus kiosk plumbing: touchscreen virtual keyboard, capacitive-touch tuning, configurable standby/sleep, camera-wake (motion on a USB webcam wakes the screen), seasonal background gradients, sidebar/header image upload, light/dark/auto theming.

---

## Hardware

The deploy target is a 32" Ubuntu touchscreen kiosk:

- Intel Core i3-1215U, 8 GB RAM, 256 GB SSD
- 1920×1080, 10-point capacitive touch, fanless 24/7
- Mounted on a wall in landscape

But you don't need that hardware to run it. On macOS or Windows, `npm run dev` boots a fullscreen window you can use as a digital second-monitor dashboard.

---

## Architecture (and how to add or remove a module)

Every "module" is **four files plus four registrations**, all named consistently. Removing a module is a 6-line delete.

```
ElectronDock/src/
├── main/                          # Electron main process (Node)
│   ├── services/<name>.service.ts # The integration itself — talks to APIs/devices
│   └── ipc/<name>.handler.ts      # Wraps the service in ipcMain.handle('<name>:…')
├── preload/
│   ├── index.ts                   # Exposes window.api.<name>.* to the renderer
│   └── types.ts                   # Shared TypeScript types
└── renderer/src/components/
    ├── pages/<Name>Page.tsx       # The full-screen page (if it has one)
    └── settings/<Name>Settings.tsx # The settings panel
```

The four registration points:

1. **`main/ipc/index.ts`** — one line: `register<Name>Handlers()`
2. **`preload/index.ts`** — one namespace: `<name>: { … }`
3. **`renderer/components/shell/Sidebar.tsx`** — one entry in `navItems` (only if it has a top-level page)
4. **`renderer/components/pages/SettingsPage.tsx`** — one entry in `navItems` + one switch case (only if it has a settings panel)

That's it. There's no central plugin manifest, no DI container — modules are wired by import. The trade-off: you do edit a couple files when adding a module, but you also know exactly what's connected by reading those files.

### To remove a module (e.g. you don't have a Rinnai water heater)

1. Delete `src/main/services/rinnai.service.ts` and `src/main/ipc/rinnai.handler.ts`
2. Delete `src/renderer/src/components/pages/WaterHeaterPage.tsx` and `src/renderer/src/components/settings/WaterHeaterSettings.tsx`
3. Remove the import + `registerRinnaiHandlers()` line from `src/main/ipc/index.ts`
4. Remove the `rinnai` namespace from `src/preload/index.ts` (and the type from `src/preload/types.ts` if you want it strict)
5. Remove the `waterheater` nav item + page case from `Sidebar.tsx` and `AppShell.tsx`
6. Remove the `'waterheater'` entry from the `Section` type and `navItems` in `SettingsPage.tsx`

Old settings keys in electron-store will sit unused — that's fine, they don't crash anything.

### To add a new module

Mirror an existing one. The simplest reference is `weather` (single-file service, one settings panel, no dedicated page) or `rachio` (full module with page + settings + remote API). Copy the four files, rename, register in the four wiring points.

---

## Setup

### Prerequisites

- **Node.js 20 or newer** (Electron 33 requires it). Node 22 LTS is what I run.
- **Git**
- For camera support: **Docker** (the Wyze bridge runs as a container) and **ffmpeg** on `PATH`
- For deploying to a Linux kiosk: standard build tools (`build-essential`)

### Clone and install

```bash
git clone https://github.com/alakaii/CalendarDock.git
cd CalendarDock/ElectronDock
npm install
```

### Environment variables

Create a `.env` file in `ElectronDock/` (dev) or `~/.config/calendardock/credentials.env` (kiosk) with:

```
# Required — Google OAuth (used for the Calendar / Tasks integrations)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Optional — bootstrapped into settings on first run when the field is empty.
# Once set via the in-app Settings UI, the UI value wins on subsequent boots.
# Anything not listed here can only be entered through Settings.

# Wyze Bridge (Wyze deprecated plain login; API_ID + API_KEY come from
# https://developer-api-console.wyze.com/)
WYZE_EMAIL=...
WYZE_PASSWORD=...
WYZE_API_ID=...
WYZE_API_KEY=...

# Dropbox app key (browser-based OAuth still required to grant access)
DROPBOX_APP_KEY=...

# Rachio
RACHIO_API_KEY=...

# Rinnai (water heater) — bootstrapped only as a pair
RINNAI_EMAIL=...
RINNAI_PASSWORD=...

# OpenWeatherMap
WEATHER_API_KEY=...
WEATHER_LOCATION="City, State"

# Ring (in-app 2FA flow still required to actually connect)
RING_EMAIL=...
```

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` come from a **Desktop app** OAuth client at <https://console.cloud.google.com> → APIs & Services → Credentials. Enable the **Google Calendar API** and **Google Tasks API** for the project.

The credentials file is loaded from outside the package on purpose — the `.deb` is published to a public GitHub Release, so secrets must never be bundled.

Everything bootstrapped from env can also be entered (or changed) from the in-app Settings UI; the UI value always wins after first boot. Settings are persisted by `electron-store`, with OAuth refresh tokens encrypted via Electron `safeStorage`.

### Run in development

```bash
npm run dev
```

Hot reload for both main and renderer. The window opens fullscreen — press `Esc` (or `F11`) to drop out.

For UI-only iteration without Electron:

```bash
npm run preview:web
```

This serves the renderer on `http://127.0.0.1:5174` with mocked IPC. Some features (calendar create, photos, cameras) are stubbed in this mode — it's just for UI work.

### Type-check

```bash
npm run typecheck
```

Runs `tsc --noEmit` against both the main and renderer tsconfigs.

---

## Per-module setup

You only need to set up the modules you want to use. Each is independent — leaving one unconfigured doesn't affect the others.

### Calendar / Tasks (Google)

1. Create OAuth credentials as above and put them in `.env`.
2. Run the app, go to **Settings → Accounts**, click **Add Google account**.
3. The app starts a localhost listener and opens your browser for OAuth; the loopback redirect lands the refresh token back in the app.
4. Refresh tokens are encrypted with `safeStorage` before being written to `electron-store`.

### Photos

Two modes, picked in **Settings → Photos**:

- **Local folder** — point at a directory; `chokidar` watches it for adds/removes.
- **Dropbox** — connect via PKCE OAuth (no client secret needed). The app pulls a random 500-photo working set into a local cache and refills it as the slideshow advances. A fresh index is fetched at dawn (06:05) each day.

### Cameras (Wyze)

CalendarDock doesn't talk to Wyze directly — it talks to a local [`mrlt8/docker-wyze-bridge`](https://github.com/mrlt8/docker-wyze-bridge) container, then transcodes the RTSP stream to MJPEG with `ffmpeg` for embedding as a plain `<img src="…">` (no WebRTC dance, no media-source-extensions).

1. Install Docker.
2. In **Settings → Cameras**, enter your Wyze account email + password and a hostname (defaults to `localhost`).
3. The app will pull and start the `mrlt8/wyze-bridge` container automatically and stop it on app exit.

### Sprinklers (Rachio)

1. Get an API key from <https://app.rach.io> → Account Settings → API.
2. Paste it into **Settings → Accounts → Rachio API key**.

### Water Heater (Rinnai Control-R)

If you have a Rinnai tankless with the Control-R WiFi module:

1. **Settings → Accounts → Rinnai** — enter your Control-R app email + password.

The integration uses the same Cognito user pool, AppSync GraphQL endpoint, and IoT Shadow that the Rinnai mobile app uses. Those constants are public (baked into the mobile app and documented at [explosivo22/rinnaicontrolr](https://github.com/explosivo22/rinnaicontrolr)) — your password authenticates via Cognito SRP and never leaves the device in plaintext.

### Ring

1. **Settings → Ring** — enter your Ring account email + password.
2. Approve the 2FA prompt in the app; the resulting **refresh token** is what gets stored (encrypted). Email/password are not retained.
3. Snapshots are polled at a configurable interval (default 30s) and served from a tiny local HTTP server so the renderer can use plain `<img>` tags with cache-busting.

### Weather (OpenWeatherMap)

1. Get a free API key at <https://openweathermap.org/api>.
2. **Settings → Accounts → Weather API key**, plus a city name in **Settings → Weather**.

---

## Building

```bash
npm run package
```

Produces:

- `dist/CalendarDock-<version>.exe` (NSIS, Windows x64)
- `dist/calendardock_<version>_amd64.deb` (Debian/Ubuntu x64)
- `dist/CalendarDock-<version>.AppImage` (portable Linux x64)

App icon comes from `build/icon.ico` (Windows) and `build/icon.png` (Linux).

## Deploying to the kiosk

CalendarDock has a self-contained update pipeline — once a kiosk is bootstrapped, you push to `main` and the kiosk picks up the update with one tap.

### One-time bootstrap

The kiosk targets Ubuntu 24.04 with GDM autologin to a Wayland session. From a fresh install:

```bash
# On the kiosk (or via SSH from your dev machine)
curl -fsSL https://raw.githubusercontent.com/alakaii/CalendarDock/main/ElectronDock/resources/kiosk-bootstrap.sh -o /tmp/cd-setup.sh
sudo bash /tmp/cd-setup.sh
```

`kiosk-bootstrap.sh` is idempotent. It auto-detects the autologin user, installs ffmpeg + the systemd service, downloads the latest `.deb` from GitHub Releases, fixes the chrome-sandbox SUID bit, and starts the app.

After bootstrap, copy your `.env` to the kiosk so OAuth flows work:

```bash
scp ElectronDock/.env <kiosk-user>@<kiosk>:~/.config/calendardock/credentials.env
```

### Ongoing updates

Every push to `main` triggers `.github/workflows/build-release.yml`, which builds an `.amd64.deb` and publishes it as a GitHub Release tagged `v{version}-build.{run_number}`.

On the kiosk, **Settings → Updates → Check Now → Install** does the rest:

1. Downloads the latest `.deb` from GitHub Releases
2. Calls `sudo /usr/local/bin/calendardock-self-update <deb>` (allowed via a NOPASSWD sudoers rule scoped to that exact command + `/tmp/*.deb`)
3. The helper runs `dpkg -i`, re-asserts chrome-sandbox SUID, kills any orphaned processes, and restarts the systemd service

Settings → Updates also has an optional daily "auto-check" toggle.

### Why this exists (and what to know if you're reproducing it)

A few things in `kiosk-bootstrap.sh` and `calendardock.service` look strange at first; they're load-bearing on Ubuntu 24 + Wayland + autologin:

- The systemd service runs as the **autologin user** (the one who owns the active Wayland session), not a dedicated `kiosk` user. Without an active session you have no display.
- `--ozone-platform=wayland --enable-features=UseOzonePlatform` is required, otherwise Electron picks X11 and dies (no `DISPLAY` for systemd-launched processes).
- `--password-store=basic` is required for `safeStorage` to behave consistently — the default gnome_libsecret backend is unreliable when no keyring is unlocked.
- Snap-confined Firefox can't be reliably launched via `xdg-open` from a systemd service, so OAuth flows spawn `/snap/bin/firefox` (or other browser paths) directly.

The original `ElectronDock/deploy.sh` (build-on-dev, scp-to-kiosk) is preserved for one-off or air-gapped installs but isn't the recommended path anymore.

---

## Tech stack

- **Electron 33** + **electron-vite** for the main/preload/renderer split
- **React 18** + **TypeScript** in the renderer
- **Tailwind CSS** + CSS variables for light/dark theming
- **Zustand** for renderer state, **TanStack Query** for cached fetches
- **FullCalendar** for the calendar view
- **electron-store** + Electron `safeStorage` for encrypted-at-rest settings
- **dnd-kit** for drag-and-drop, **chokidar** for file watching
- **react-simple-keyboard** for the on-screen virtual keyboard

---

## Acknowledgments

CalendarDock stitches together other people's hard work. Credit where it's due:

### Reverse-engineering & community protocol work

These projects figured out vendor APIs that aren't officially published. CalendarDock would not exist without them.

- **[explosivo22/rinnaicontrolr](https://github.com/explosivo22/rinnaicontrolr)** — reverse-engineered the Rinnai Control-R WiFi protocol (Cognito user pool, AppSync GraphQL schema, IoT Shadow shape). The Cognito IDs and AppSync API key in `rinnai.service.ts` are the same public values from this project.
- **[mrlt8/docker-wyze-bridge](https://github.com/mrlt8/docker-wyze-bridge)** — pulls Wyze camera streams without the cloud round-trip and exposes them as RTSP/HLS. CalendarDock's cameras module orchestrates this container and transcodes its RTSP output to MJPEG.
- **[dgreif/ring](https://github.com/dgreif/ring)** (`ring-client-api`) — community Ring API client. Handles the email/password + 2FA → refresh-token flow and snapshot polling.
- **[hjdhjd/homebridge-rachio](https://github.com/hjdhjd/homebridge-rachio)** and the broader Rachio community — useful references for the public Rachio API endpoints used in `rachio.service.ts`.

### Official APIs

- **[Google Calendar API](https://developers.google.com/calendar)** + **[Google Tasks API](https://developers.google.com/tasks)** — calendar events, task lists for chores/lists/meals/fridge.
- **[Dropbox API](https://www.dropbox.com/developers/documentation)** — OAuth 2.0 PKCE flow, `files/list_folder`, `files/download` for the photo cache.
- **[OpenWeatherMap API](https://openweathermap.org/api)** — current conditions + 5-day forecast.
- **[Rachio Public API](https://rachio.readme.io/)** — sprinkler zones, schedules, run/skip control.

### Major open-source libraries

The renderer is built on **[React](https://react.dev)**, **[TypeScript](https://www.typescriptlang.org)**, **[Tailwind CSS](https://tailwindcss.com)**, **[Zustand](https://github.com/pmndrs/zustand)**, **[TanStack Query](https://tanstack.com/query)**, and **[FullCalendar](https://fullcalendar.io)**. The Electron side uses **[electron-vite](https://electron-vite.org)**, **[electron-builder](https://www.electron.build)**, **[electron-store](https://github.com/sindresorhus/electron-store)**, **[chokidar](https://github.com/paulmillr/chokidar)**, **[googleapis](https://github.com/googleapis/google-api-nodejs-client)**, and **[amazon-cognito-identity-js](https://github.com/aws-amplify/amplify-js/tree/main/packages/amazon-cognito-identity-js)**. The on-screen keyboard is **[react-simple-keyboard](https://github.com/hodgef/react-simple-keyboard)**, drag-and-drop is **[dnd-kit](https://dndkit.com)**, dates are **[date-fns](https://date-fns.org)**.

See [`ElectronDock/package.json`](ElectronDock/package.json) for the full dependency list with versions.

### A note on unofficial integrations

The Rinnai, Wyze, and Ring integrations rely on community reverse-engineering — they aren't endorsed by those vendors and could break if a vendor changes their APIs. Use at your own risk and with your own credentials.
