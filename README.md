<div align="center">

# Alif Shohoj Print

### Shop point of sale with a Windows desktop print agent

Manage print-shop orders in the web interface and send authenticated print jobs to installed Windows printers through the desktop app.

</div>

---

## Overview

ALIF SHOHOJ PRINT combines a shop point-of-sale interface with an Electron desktop agent. The desktop app runs in the Windows system tray, receives print jobs over an authenticated WebSocket, stores them in a local SQLite queue, and sends them to installed printers.

## Get started

**Prerequisite:** Node.js

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (by default, `http://127.0.0.1:3000`). To run the web UI and Electron desktop app together during development:

```sh
npm run dev:desktop
```

## Windows desktop app

### Build and install

```sh
npm run app:dist
```

This command runs verification and creates a dual-architecture per-user NSIS installer in `artifacts/releases/`. The single installer automatically selects the x64 or 32-bit (ia32) app for the Windows PC. It lets the user choose a destination and adds Start Menu and desktop shortcuts. Uninstalling preserves local settings and queued-job data.

On first launch, choose whether this PC is the master/shopkeeper PC or a counter/operator PC. A **counter PC** opens a locked **Counter Inbox**: its counter name/code, the master PC's connection state, the pairing key that turns on its live order feed, and the orders that belong to that counter — it has no Printers, Jobs, Reports, Settings or POS revenue pages, and every print still runs on the master PC. Its **Counter Inbox** also builds that counter's QR code with a **Download QR** action, so the operator can save their desk code as a PNG. The **Dashboard** tab combines the shop connection, printer fleet, job summary and recent jobs with the order inbox and existing Shop POS tools (revenue, print count, queue, pricing and auto-print controls). Use its **Overview**, **Orders** and **Shop & POS** sections to switch between these work areas without navigating away. Orders remain actionable cards with printer, price, payment state, preview, Reject (a reason is required), Edit and Approve actions. The Dashboard's **Printer Settings** button opens the **Detected Printers** dialog, which is also reachable from the Settings window and the Windows agent window. **Reports** summarizes Today and This Month from jobs retained in the local queue; it is not an archived accounting report. The **Settings** window groups the available controls and marks options without backend support as coming soon. In **Settings → দোকান ও অর্ডার**, turn on **Business hours** and choose the open days with the open and close times; the master gateway then accepts customer orders only inside that Asia/Dhaka schedule (a close time earlier than the open time spans midnight). In **Settings → সার্ভিস → সার্ভিস পরিচালনা** (master PC only), a shopkeeper adds a service from a default preset — ID card, A4 B/W or colour print, Doc/Docs file print, passport photo (4-in-1 or 8-in-1), 3R/4R and 6R photo, stamp-size photo, legal document — and deletes services they no longer offer; add/delete apply immediately, at least one service must always remain, and the customer app's service list, prices and crop frames follow the live service list. Preset-created services bill their own base price, while the built-in services keep the shared pricing tiers. In **Settings → এজেন্ট**, enable **Start agent when Windows starts** to start the app hidden in the system tray after login. Open it from the tray menu or double-click the tray icon.

The master desktop shell keeps the workflow pages — **Studio** (the first tab and default landing page), **Dashboard**, **Jobs** and **Reports** — in the main window, and opens the two setup-heavy surfaces in their own windows: the **Settings** tab and the shop menu's Settings entry open a separate **Settings** window, and the **Printers** tab, the Help menu's printers/services/server entries and the tray's Printer Settings action open the **Windows Agent & Drivers** window on the matching page. Invoking either entry again focuses the already-open window (the agent window switches pages in place) instead of spawning a second copy, and each window carries its own taskbar title. All three windows stay in sync without a reload: a settings save reaches the other windows immediately, queue changes and new-order toasts appear everywhere, and only the main window polls counter heartbeats, publishes the customer PWA config and plays the new-order chime, so nothing runs three times. These windows open only on a master PC; a counter PC keeps its locked Counter Inbox.

### Counter QR orders and offline alerts

The master PC hosts the customer PWA and its order gateway on port `43822`. Configure `ALIF_SHOHOJ_PRINT_WS_TLS_CERT` and `ALIF_SHOHOJ_PRINT_WS_TLS_KEY` before launching the packaged app; both the customer PWA and gateway use HTTPS, and the certificate must be trusted by customer/counter devices and include the master host/IP in its SAN. Allow TCP port `43822` through Windows Firewall for the shop LAN. Without TLS, the packaged gateway listens on loopback and the app does not generate a LAN QR URL.

In Shop POS, print each counter's QR poster. The QR opens the customer app at `/resources/pwa.html` on the master gateway, so a customer phone never loads the shopkeeper shell. A previously printed `/pwa.html` poster still reaches the same app, because the gateway serves the customer PWA for unknown paths. Customers on the same LAN scan it and submit orders through the master PC, which stores them in its SQLite queue for the shopkeeper to review, edit, confirm, or reject. Payment is **counter cash only** today: the customer app submits every order as unpaid and the gateway rejects an order that claims a bKash/Nagad or already-collected payment, so nothing is shown as paid before staff confirm the cash at the counter. bKash/Nagad and automatic refunds are planned for a future version. The master speaks the counter number for new orders. Configure each counter PC as a counter and enter the master gateway base URL (use the same host and port as the QR, without its `?shop=...` query; for example, `https://192.168.1.105:43822`); the counter app sends a heartbeat every 10 seconds. If no heartbeat arrives for 30 seconds, the counter is marked offline and new orders remain queued for master review. Counter PCs need network access to the master gateway while running.

#### Counter order feed and pairing

A counter PC reads its own orders from the master PC every 15 seconds, so its Counter Inbox is not limited to whatever that PC already holds. The master PC issues one **counter pairing key** per counter: open the counter's QR poster in Shop POS, copy that key, and enter it once on the counter PC — either during first-run setup or later in the Counter Inbox itself. A counter PC's key is stored by the Windows app, not in the browser, and is encrypted with the Windows account (DPAPI) when the OS supports it; the key is never shown back to the counter's screen after it is saved. Keys can be rotated or removed per counter from the same poster dialog, and a rotated key stops working immediately.

A counter PC also builds its own counter QR in the Counter Inbox and offers **Download QR** to save it as a PNG, so the operator can print or re-print their desk code without the master PC. The code points at the master gateway's `/resources/pwa.html` entry and selects that counter by ID, so it keeps working even if the master renames the counter. The image downloads through the normal browser/Electron download flow into the PC's download folder.

The feed is served at `GET /api/counter-orders` on the master gateway and requires the `x-counter-feed-key` header. A request with a missing, wrong or revoked key is refused with `401`, and repeated failures from one counter are throttled. The feed is scoped to the counter that owns the key, and it carries only the order fields a counter operator needs: token code, service, paper size, copies, status, payment state, price and timestamps. Customer names and phone numbers, the uploaded document (`fileUrl`), the upload file name and the audit log stay on the master PC. If a counter PC has no key, or the master PC is unreachable, its inbox falls back to the orders that PC already holds and shows the feed state (`Live`, `Connecting`, `Feed problem`, `Not paired`) so the operator knows what they are looking at. A counter PC with no master URL configured cannot build its own QR and says so instead of showing a code that would not work.

#### Code signing

For a signed build, set `CSC_LINK` to a trusted certificate file or supported electron-builder certificate URL. If the certificate has a password, set `CSC_KEY_PASSWORD`, then run:

```powershell
$env:CSC_LINK = 'C:\secure\path\publisher-certificate.pfx'
$securePassword = Read-Host 'Certificate password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:CSC_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
npm run app:dist:signed
```

Replace the example path with the actual `.pfx`/`.p12` path. Omit the password commands if the certificate has no password. These environment variables apply to the current PowerShell session. Keep certificate files and passwords out of source control.

#### GitHub Actions signing

The **Signed Windows installer** workflow can be started manually from the repository's **Actions** tab. Before running it, add these repository **Actions secrets** under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `WINDOWS_CERTIFICATE_BASE64` | Base64-encoded contents of your `.pfx`/`.p12` certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password, if it has one |

Create the base64 value locally in PowerShell; treat its output as a private key and never commit or share it:

```powershell
$certificatePath = 'C:\secure\path\publisher-certificate.pfx'
[Convert]::ToBase64String([IO.File]::ReadAllBytes($certificatePath))
```

The workflow restores the certificate to the temporary GitHub Actions runner, runs `npm run app:dist:signed`, and uploads the installer as a workflow artifact. The runner is Windows-based and the signing secrets are used only by this manually triggered workflow. Builds without a certificate are unsigned and can trigger Windows SmartScreen warnings. This project does not include an OV/EV certificate or an Azure Trusted Signing account.

## Print agent setup

### Authentication

The print agent authenticates WebSocket clients with a shared **bearer token**. It does not provide operator accounts, passwords, per-counter identities, or per-user permissions. Anyone with the token can submit print jobs accepted by the agent.

On startup, the app uses `ALIF_SHOHOJ_PRINT_WS_TOKEN` if set. Otherwise, it reads `websocket.token` from Electron's user-data directory, generating and saving a random 32-byte token if the file does not exist. The token is available in Shop POS settings, where an operator can reveal it for client configuration.

The token file is plaintext and relies on the Windows account's access controls for protection. On Windows, the user-data path is `%APPDATA%\ALIF SHOHOJ PRINT`. When upgrading, the app moves existing settings, logs, and queued jobs into this renamed data directory. Setting `ALIF_SHOHOJ_PRINT_WS_TOKEN` overrides the file value but does not update or remove the saved file. The app has no token rotation or revocation screen. To change the token, configure a new `ALIF_SHOHOJ_PRINT_WS_TOKEN` for the desktop app and all connecting clients, then restart the app.

Treat the token like a password and share it only with trusted clients.

### Listener and TLS

By default, the WebSocket listener binds to `127.0.0.1:43821` and accepts connections from the same computer. Set `ALIF_SHOHOJ_PRINT_WS_HOST` and `ALIF_SHOHOJ_PRINT_WS_PORT` before launching to configure another listener.

Binding beyond loopback requires both `ALIF_SHOHOJ_PRINT_WS_TLS_CERT` and `ALIF_SHOHOJ_PRINT_WS_TLS_KEY`. Use a certificate trusted by client PCs and matching the host or IP address they use. With both variables set, clients connect using `wss://`. Without TLS, the bearer token and job data travel without transport encryption. For a LAN listener, restrict the configured port with the firewall to the shop LAN and share the token only with trusted client devices.

### WebSocket protocol

Clients must authenticate after connecting and before sending a job:

```json
{"type":"auth","token":"<shared-token>"}
```

The server closes connections that do not authenticate within five seconds or provide the wrong token. After successful authentication, it replies:

```json
{"type":"authenticated"}
```

The client can then submit a print job:

```json
{"type":"job","job":<PrintJob>}
```

The server validates the job and its file data, stores it in the SQLite queue, and then replies with an `accepted` message. Supported file formats are PDF, JPEG, and PNG, with file data up to 40 MiB. **Acceptance means the job is queued; it does not mean printing has completed.**

Master/counter setup is a local app mode stored in browser `localStorage`, not an authentication mechanism. `tokenCode` is a customer pickup code, not a credential. The mock agent generator in the source tree has its own example `DEVICE_TOKEN`; it is separate from the Electron WebSocket token and protocol.

### Queue and printing

- Jobs are stored in SQLite before the agent acknowledges them.
- The print service stages temporary PDFs and sends them silently to the selected installed Windows printer through SumatraPDF, then removes the staged file.
- After a successful print, the source data URL is removed from the SQLite record and the WAL is checkpointed. Failed jobs retain their source so an operator can retry.
- Service preferences retain paper type, quality, DPI, borderless, color, and copy defaults. The current silent Sumatra path applies color, paper size, copies, and fit. Configure paper type, quality, DPI, and borderless settings in the Windows printer driver because Sumatra's silent-print interface does not expose those fields generically.
- Logs rotate at 5 MiB and retain five rotated files. The queue database, logs, WebSocket token, and local crash dumps are stored under Electron's per-user `userData` directory. Crash reporting is local-only; dumps are not uploaded.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite web UI on `127.0.0.1:3000` |
| `npm run dev:web` | Open the shopkeeper/master/counter shell (`desktop.html`) in a browser |
| `npm run dev:web:pwa` | Open the customer PWA (`pwa.html`, the QR-scan target) on port 3001 |
| `npm run dev:desktop` | Run the web UI and Electron app together |
| `npm run lint` | Type-check the renderer TypeScript project |
| `npm run test:desktop` | Run Electron service tests |
| `npm run test:renderer` | Run renderer service tests |
| `npm run test:electron-runtime` | Run the Electron SQLite runtime smoke check |
| `npm run build` | Build the renderer |
| `npm run build:electron` | Type-check and build the Electron main process |
| `npm run verify` | Run lint, tests, runtime smoke check, and both builds |
| `npm run voice:clips` | Generate Bengali + English voice-guide MP3 clips (needs internet) |
| `npm run app:dist` | Verify and create the Windows NSIS installer |

## Voice guide clips

The customer voice guide plays pre-recorded MP3 clips (`public/audio/bn|en/`,
`public/sounds/`) and falls back to on-device TTS when a clip is missing, so the
app works with or without them. Clip texts live in `voice-manifest.json` (the
single source of truth, Bengali + English).

- `npm run voice:clips` synthesises every missing clip with free Google TTS and
  regenerates `public/audio/manifest.json` from the spec. The provider model
  follows the `create-voice-agent` skill: `-- --provider elevenlabs` uses
  ElevenLabs `eleven_multilingual_v2` instead (needs `ELEVENLABS_API_KEY` and
  `--eleven-voice-bn` / `--eleven-voice-en` voice ids). `-- --provider sarvam`
  uses Sarvam `bulbul:v3` (`bn-IN`, needs `SARVAM_API_KEY`, WAV output,
  `-- --sarvam-speaker` to change voice, default `kavya`). Delivery follows
  the voice-quality guide: serious clips at pace 0.85 / pitch -0.3, success
  clips at 0.97 / +0.2, rest at 0.92 / 0 (`-- --pace X --pitch Y` overrides).
- Useful flags: `-- --lang bn` (one language), `-- --only C01,VC04` (subset),
  `-- --force` (rebuild all), `-- --dry-run` (list only).
- The `VC01–VC12` clips are spoken confirmations for the 12 voice commands
  (copies, colour, help, approve/reject, …) and play through VoiceGuideService.
- `npm run voice:mp3` converts the WAV clips to 64 kbps mono MP3 (needs
  `ffmpeg` on PATH) and repoints the manifest — run it in a fresh terminal
  after installing ffmpeg.
- After editing clip texts, re-run with `--force` for the changed ids.
- Generated MP3s total ~2 MB and are committed so installers work offline.

## Studio — Image Editing & Walk-in Printing

The desktop app now includes a **Studio** tab for image editing and walk-in printing:

### Studio tab
- A dedicated **Studio** tab is available in the desktop shell (master/shopkeeper PC); it is the first tab and the shell's default landing page.
- Operators can open existing customer order images **or** import local image files from the computer.
- Supported formats: JPEG, PNG, WebP. Maximum file size: 40 MiB (aligned with the print agent limit).
- The original order image is **never overwritten**; edited output is saved as a new version linked to the order.

### Counter operator permissions
- Authorized counter operators can edit order images immediately after order creation/acceptance — no separate admin approval required.
- Role/permission is validated **server-side** before any edit action is allowed.
- The UI clearly shows which order/file is being edited to avoid mistakes.
- Edit history with undo/redo/reset is available in the editor.

### Image editing workspace
- The editor follows a desktop photo-editor layout: a **menu bar** (File, Edit, Image, Layer, Filter, View, Help), a context-sensitive **options bar** for the active tool, a left **tool palette** with foreground/background colors, the centre **canvas**, a right **panel** with **Layers / Adjust / History** tabs, and a bottom **status bar** (zoom, size, cursor position, rotation, document).
- **Tools**: move/pan, crop & rotate, brush, eraser, shapes, and text, with keyboard shortcuts (`V`, `C`, `B`, `E`, `S`, `T`). Tooltips show each shortcut.
- **Adjustments**: brightness, contrast, saturation, scale, grayscale, and quick filters (passport blue, clean white, sharpen, B/W document).
- **View aids**: transparency checkerboard, canvas pixel grid, rulers, zoom/pan controls, and a Navigator preview thumbnail.
- **Collapsible panels** with a first-open tips card; on narrow windows the right panel becomes a slide-in drawer and the tool palette moves to a bottom toolbar.
- **Undo / Redo / Reset** to original, with a clickable history list.
- Output dimensions and print size are validated before sending to the print queue.
- Edited output is exported safely and linked to the originating order.

### AI Background Removal
- Built-in **Background Removal** tool using local inference via `@imgly/background-removal` (runs on-device, no cloud dependency).
- Original image remains intact; a transparent PNG is produced on success.
- Background preview and replacement (solid color / another image) are available.
- On failure, the original image is preserved and an actionable error is shown.
- Model and dependency licenses have been verified for production use.

### Walk-in printing (local file → print, no payment)
- Import a local image, edit it, and create a **walk-in print job** directly.
- Walk-in jobs have **no payment option** — no payment UI, checkout, or online payment flow is shown.
- Walk-in jobs are a distinct job type, separate from customer orders, so order payment logic is never triggered.
- Print queue integration: job status, copies, paper/size settings, and success/failure feedback.
- Local file paths and sensitive metadata are never sent to the server.

## Project layout

```text
src/                  React renderer, features, shared UI and services
electron/             Electron main process and desktop services
resources/            Renderer entry documents (desktop, customer PWA, dev harness)
scripts/              Runtime and signing verification helpers
artifacts/releases/   Packaged installers
```

The renderer has three entry documents in `resources/`: `resources/desktop.html`
is the shopkeeper shell the Electron app loads, `resources/pwa.html` is the
customer phone flow served by the LAN gateway at `/resources/pwa.html`, and
`resources/index.html` stays the Vite dev harness and the browser POS that counter
PCs open on the master PC (the gateway serves it as the default document at `/`).
Vite emits the entries under `dist/resources/`; in development the root `/` request
is rewritten to the harness so `npm run dev` and `npm run dev:desktop` keep working.

## Data and privacy

The queue database, logs, WebSocket token, and crash dumps stay in the local Electron user-data directory. Crash dumps are not uploaded. Protect access to the Windows account and share the WebSocket token only with trusted clients.
