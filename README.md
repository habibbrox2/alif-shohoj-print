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

On first launch, choose whether this PC is the master/shopkeeper PC or a counter/operator PC. The app opens on the **Dashboard** tab — the order inbox, where each incoming order is a card with its printer, price, payment state and preview, plus Reject (a reason is required), Edit and Approve actions. The **Status** tab summarises the connection, shop identity, printer fleet, job counts and recent jobs, and its **Printer Settings** button opens the **Detected Printers** dialog, which is also reachable from the right side of the Printers tab. Pages switch with the tab bar below the Windows title bar. In Shop POS settings, enable **Start with Windows** to start the app hidden in the system tray after login. Open it from the tray menu or double-click the tray icon.

### Counter QR orders and offline alerts

The master PC hosts the customer PWA and its order gateway on port `43822`. Configure `ALIF_SHOHOJ_PRINT_WS_TLS_CERT` and `ALIF_SHOHOJ_PRINT_WS_TLS_KEY` before launching the packaged app; both the customer PWA and gateway use HTTPS, and the certificate must be trusted by customer/counter devices and include the master host/IP in its SAN. Allow TCP port `43822` through Windows Firewall for the shop LAN. Without TLS, the packaged gateway listens on loopback and the app does not generate a LAN QR URL.

In Shop POS, print each counter's QR poster. The QR opens the customer app at `/pwa.html` on the master gateway, so a customer phone never loads the shopkeeper shell. Customers on the same LAN scan it and submit orders through the master PC, which stores them in its SQLite queue for the shopkeeper to review, edit, confirm, or reject. The master speaks the counter number for new orders. Configure each counter PC as a counter and enter the master gateway base URL (use the same host and port as the QR, without its `?shop=...` query; for example, `https://192.168.1.105:43822`); the counter app sends a heartbeat every 10 seconds. If no heartbeat arrives for 30 seconds, the counter is marked offline and new orders remain queued for master review. Counter PCs need network access to the master gateway while running.

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
| `npm run dev:desktop` | Run the web UI and Electron app together |
| `npm run lint` | Type-check the renderer TypeScript project |
| `npm run test:desktop` | Run Electron service tests |
| `npm run test:renderer` | Run renderer service tests |
| `npm run test:electron-runtime` | Run the Electron SQLite runtime smoke check |
| `npm run build` | Build the renderer |
| `npm run build:electron` | Type-check and build the Electron main process |
| `npm run verify` | Run lint, tests, runtime smoke check, and both builds |
| `npm run app:dist` | Verify and create the Windows NSIS installer |

## Project layout

```text
src/                  React renderer, features, shared UI and services
electron/             Electron main process and desktop services
scripts/              Runtime and signing verification helpers
artifacts/releases/   Packaged installers
```

The renderer has three entry documents: `desktop.html` is the shopkeeper shell the
Electron app loads, `pwa.html` is the customer phone flow served by the LAN
gateway, and `index.html` stays the Vite dev harness and the browser POS that
counter PCs open on the master PC.

## Data and privacy

The queue database, logs, WebSocket token, and crash dumps stay in the local Electron user-data directory. Crash dumps are not uploaded. Protect access to the Windows account and share the WebSocket token only with trusted clients.


