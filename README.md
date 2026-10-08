# ALIF SHOHOJ PRINT

ALIF SHOHOJ PRINT is a shop point-of-sale interface with a Windows desktop print agent. The desktop app runs in the system tray, accepts print jobs over an authenticated WebSocket, persists them in SQLite, and sends them to installed Windows printers.

## Run locally

**Prerequisite:** Node.js

1. Install dependencies:

   ```sh
   npm install
   ```

2. Run the web UI:

   ```sh
   npm run dev
   ```

3. Run the Electron desktop app during development:

   ```sh
   npm run dev:desktop
   ```

## Windows desktop app

### Build and install

- Run `npm run app:dist` to type-check, run desktop service tests, build the renderer and main process, and create a per-user x64 NSIS installer in `artifacts/releases/`.
- The installer offers a destination directory and adds Start Menu and desktop shortcuts. Uninstall preserves local settings and queued-job data.
- On first launch, choose whether this PC is the master/shopkeeper PC or a counter/operator PC. The app opens in Shop POS by default.
- For a signed build, set `CSC_LINK` to a trusted certificate file or supported electron-builder certificate URL. If the certificate has a password, set `CSC_KEY_PASSWORD`. Then run `npm run app:dist:signed`. Keep certificate files and passwords out of source control.
- An installer built without a certificate is unsigned and can trigger Windows SmartScreen warnings. This project does not include an OV/EV certificate or Azure Trusted Signing account.

### Authentication and network setup

The print agent uses a shared **bearer token** to authenticate WebSocket clients. It does not provide operator accounts, passwords, per-counter identities, or per-user permissions. Anyone who has the token can submit print jobs accepted by the agent.

#### Token lifecycle

- On startup, the app uses `BROXPRINT_WS_TOKEN` if it is set. Otherwise, it reads the token from `websocket.token` in Electron's user-data directory. If that file does not exist, the app generates a random 32-byte token and saves it there.
- The token file is plaintext and is protected by the Windows account's access to the user-data folder; the app does not encrypt the token. On Windows, the user-data path is `%APPDATA%\BroxPrint Studio`. This legacy path is retained for upgrade compatibility.
- The token is available in Shop POS settings, where an operator can reveal it for client configuration. Treat it like a password and share it only with trusted clients. Setting `BROXPRINT_WS_TOKEN` overrides the file value; it does not update or remove the saved token file.
- The app has no token rotation or revocation screen. To change the token, configure a new `BROXPRINT_WS_TOKEN` for the desktop app and all clients that connect to it, then restart the app. Keep the value consistent across those systems.

#### Listener and TLS

- By default, the WebSocket listens on `127.0.0.1:43821`, so it accepts connections from the same computer. Set `BROXPRINT_WS_HOST` and `BROXPRINT_WS_PORT` before launching to configure another listener.
- Binding beyond loopback requires both `BROXPRINT_WS_TLS_CERT` and `BROXPRINT_WS_TLS_KEY`. Configure a certificate trusted by client PCs and matching the host or IP they use. With both variables set, clients connect using `wss://`; without TLS, the bearer token and job data travel without transport encryption.
- When using a LAN listener, firewall the configured port to the shop LAN and share the token only with trusted client devices.

#### WebSocket protocol

Each client must authenticate after connecting and before sending a job:

```json
{"type":"auth","token":"<shared-token>"}
```

The server closes connections that do not authenticate within five seconds or provide the wrong token. After successful authentication, the server replies:

```json
{"type":"authenticated"}
```

The client can then submit a print job:

```json
{"type":"job","job":<PrintJob>}
```

The server validates the job and supported file data, stores it in the SQLite queue, and only then replies with an `accepted` message. The supported file formats are PDF, JPEG, and PNG, with file data up to 40 MiB. The acknowledgement means the job is queued; it does not mean printing has completed.

Master/counter setup is a local app mode stored in browser `localStorage`, not an authentication mechanism. Likewise, `tokenCode` is a customer pickup code, not a credential. A separate mock agent generator in the source tree has its own example `DEVICE_TOKEN`; it is not the Electron WebSocket token or protocol.

### Startup, queue, and printing

- In Shop POS settings, enable **Start with Windows** to start the app hidden in the tray after login. Use the tray menu or double-click the tray icon to reopen Shop POS.
- Jobs are persisted in SQLite before acknowledgement. The print service stages temporary PDFs, sends them silently to the selected installed Windows printer through SumatraPDF, then removes the staged file. After a successful print, the source data URL is removed from the SQLite record and the WAL is checkpointed. Failed jobs retain their source so an operator can retry.
- Service preferences retain paper type, quality, DPI, borderless, color, and copy defaults. The current silent Sumatra path applies color, paper size, copies, and fit. Configure paper type, quality, DPI, and borderless settings in the Windows printer driver because Sumatra's silent-print interface does not expose those fields generically.
- Logs rotate at 5 MiB and retain five rotated files. The queue database, logs, WebSocket token, and local crash dumps are stored under Electron's per-user `userData` directory. Crash reporting is local-only; dumps are not uploaded.
