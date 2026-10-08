# Windows Tray Print Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the existing TypeScript/build configuration issues and ship the React POS prototype as a Windows 10/11 Electron tray app with persistent print queue, silent printing, notifications, startup control, installer, signing support, rotating logs, and local crash reports.

**Architecture:** Keep the React/Vite POS usable in a browser and add an Electron main process for privileged Windows operations. Expose only typed, narrow IPC methods through a context-isolated preload; keep SQLite, WebSocket, filesystem, printing, logging, notifications, and auto-start in the main process. Persist incoming jobs in SQLite before acknowledging them, and drive renderer queue state from explicit native job events.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Electron, better-sqlite3, ws, pdf-to-printer, electron-builder/NSIS, Node test runner or the existing project test tooling if present.

**Spec:** User request in the conversation (no separate specification file).

## Global Constraints

- Windows 10/11 is the supported packaged desktop target.
- The app must remain usable in browser mode; Electron-only controls must degrade explicitly and safely.
- The renderer must not receive Node.js access; use `contextIsolation: true`, `nodeIntegration: false`, and a narrow typed preload API.
- Persist print jobs locally in SQLite before reporting intake success; never report printing success before the spooler confirms it.
- Bind the local WebSocket listener to loopback by default; remote/LAN intake must require authentication and explicit configuration.
- Code-signing credentials must come from environment/CI secrets and must not be committed. An installer without credentials is an unsigned development artifact, not a SmartScreen-trusted release.
- Keep crash reports local and do not upload customer files, credentials, or crash data automatically.
- Preserve browser-only `npm run dev` and Vite production build.

## Review Focus

- Malformed, unauthenticated, duplicate, or oversized WebSocket jobs must be rejected without entering the queue; test invalid authentication and duplicate job IDs.
- A process crash between queue insertion and printing must not lose the job or falsely complete it; test SQLite reopen/recovery from `queued` and `printing` states.
- Printer absence, unsupported input, and spooler errors must preserve an actionable failed state and must not emit a success notification; test spool errors and unsupported files.
- Renderer calls must not be able to invoke arbitrary filesystem, shell, or printer commands; test allowed IPC methods and deny arbitrary channels.
- Missing signing credentials must still produce an unsigned local installer with explicit output labeling; test packaging configuration without certificate secrets.

---

### Task 1: Restore project configuration and resolve current type errors

**Files:**
- Modify: `src/components/CustomerPwaView.tsx`
- Modify: `src/components/ShopPosView.tsx`
- Modify: `src/context/StudioContext.tsx`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Modify: `package.json`
- Test: TypeScript check and Vite build

**Interfaces:**
- `npm run lint` must invoke `tsc --noEmit -p tsconfig.json`.
- Tailwind v4 must be processed by `@tailwindcss/vite`; Vite config must retain React support.
- Customer service visibility must consume `services` from `useStudio()`.
- The legacy `shopProfile.autoApproveDocs` UI must be removed or read/write the canonical `doc_a4` `StudioService.autoApprove`; do not add a duplicate shop-profile field.
- `updatePricing(updates: Partial<ServicePricing>)` must keep the index signature values numeric and synchronize service prices only from numeric pricing values.

- [ ] Add a strict root TS config for `src` and `vite.config.ts`, including `vite/client` types for CSS modules/side-effect imports.
- [ ] Configure Vite with React and Tailwind CSS v4 plugins.
- [ ] Add `services` to the customer-view context destructuring, replace stale `autoApproveDocs`, and fix the `updatePricing` inferred partial-value mismatch without weakening types.
- [ ] Run `npm run lint` and `npm run build`; both must pass without the previous `services`, `autoApproveDocs`, pricing-index, or CSS declaration errors.

### Task 2: Add the secure Electron shell, tray, and startup setting

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/electron.d.ts`
- Modify: `src/main.tsx`
- Modify: `src/context/StudioContext.tsx`
- Modify: `src/components/ShopPosView.tsx`
- Modify: `package.json`
- Test: Electron bridge unit tests and development launch

**Interfaces:**
- `window.broxprintDesktop` exposes only:
  - `isDesktop: boolean`
  - `getAutoLaunch(): Promise<boolean>`
  - `setAutoLaunch(enabled: boolean): Promise<boolean>`
  - `getQueue(): Promise<DesktopQueueJob[]>`
  - `onQueueChanged(callback): () => void`
  - `onIncomingJob(callback): () => void`
  - `printJob(jobId: string): Promise<PrintResult>`
- Electron BrowserWindow uses `contextIsolation: true`, `nodeIntegration: false`, and a packaged preload path.
- Closing the window hides to the tray; explicit tray Exit performs orderly queue/database shutdown.
- Auto-start preference is read and written through `app.getLoginItemSettings` / `app.setLoginItemSettings`; browser mode shows a clear unavailable state.

- [ ] Add the typed bridge and test that renderer APIs expose only approved operations.
- [ ] Implement single-instance startup, tray icon/menu, hide-on-close, orderly shutdown, and `crashReporter` initialization.
- [ ] Add a Windows-with-startup toggle to Shop POS settings backed by the bridge.
- [ ] Add development scripts to start Vite and Electron together while retaining browser scripts; verify the app launches with secure WebContents preferences.

### Task 3: Implement the authenticated WebSocket and SQLite queue

**Files:**
- Create: `electron/services/job-store.ts`
- Create: `electron/services/job-websocket.ts`
- Create: `electron/services/job-types.ts`
- Create: `electron/services/__tests__/job-store.test.ts`
- Create: `electron/services/__tests__/job-websocket.test.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `package.json`
- Test: Focused `node --test` suite

**Interfaces:**
- `DesktopQueueJob` includes `id`, `payloadJson`, `status: 'queued' | 'printing' | 'completed' | 'failed'`, `attempts`, `createdAt`, `updatedAt`, and optional `error`.
- `JobStore` provides `enqueue(job): DesktopQueueJob`, `getById(id)`, `list()`, `markPrinting(id)`, `markCompleted(id)`, `markFailed(id, error)`, and `close()`.
- WebSocket protocol requires first frame `{ "type": "auth", "token": "..." }`; job frames use `{ "type": "job", "job": PrintJob }`.
- Default listener address is `127.0.0.1`; bind to another interface only when an explicit host and non-empty token are configured.
- Queue insertion is transactional and idempotent by job ID; persist `queued` before sending an accepted response.

- [ ] Implement SQLite schema, migration/version marker, transactional/idempotent insertion, queue recovery, and store unit tests.
- [ ] Implement authentication, schema validation, message-size limit, duplicate acknowledgement, explicit rejected/accepted responses, and WebSocket tests.
- [ ] Wire native queue events to the preload bridge and verify the database can close/reopen with all states preserved.

### Task 4: Add silent print execution and POS queue synchronization

**Files:**
- Create: `electron/services/print-service.ts`
- Create: `electron/services/__tests__/print-service.test.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/context/StudioContext.tsx`
- Modify: `src/components/ShopPosView.tsx`
- Modify: `src/components/WindowsToast.tsx`
- Modify: `package.json`
- Test: Focused mocked spooler tests and browser production build

**Interfaces:**
- `PrintService.print(job: PrintJob, printerName: string): Promise<PrintResult>`.
- PDF input is submitted to the Windows spooler silently through `pdf-to-printer`/SumatraPDF with an explicitly selected printer; file input is validated and staged under the app's user-data directory before printing.
- Supported non-PDF file types must be explicit and converted to a print-ready PDF before silent printing; reject unsupported or malformed content with a persisted actionable error.
- Renderer approval in Electron calls `printJob(jobId)`; browser mode keeps existing prototype/mock behavior.
- Queue state events synchronize `PrintJob.status` and toast/notification state; only successful spooler completion can become `completed`.

- [ ] Add validated, isolated print execution with injectable spooler dependency and tests for success, missing printer, bad PDF, and spooler failure.
- [ ] Connect job approval and queue events to the existing Studio context without breaking browser mode.
- [ ] Show OS notifications for incoming jobs and print outcomes; verify failures remain visible and are not presented as success.

### Task 5: Add rotating logs and local crash reports

**Files:**
- Create: `electron/services/app-logger.ts`
- Create: `electron/services/__tests__/app-logger.test.ts`
- Modify: `electron/main.ts`
- Modify: `package.json`
- Test: Logger rotation and crash-path smoke test

**Interfaces:**
- Logger writes structured timestamped records to an app-user-data `logs` directory, rotates at 5 MiB per file, and retains at most five rotated files.
- Electron crash dumps and metadata remain under user-data `crashes`; no network upload or customer-file content in logs.
- Startup, queue state changes, spooler outcomes, and uncaught main-process errors are logged with IDs/error summaries but without auth tokens or image/PDF contents.

- [ ] Implement bounded-size log rotation and tests for rotation/retention.
- [ ] Register uncaught-exception, unhandled-rejection, and renderer-gone handlers; write crash metadata and verify no secrets/file bytes are logged.

### Task 6: Package a Windows installer and configure signing

**Files:**
- Modify: `package.json`
- Create: `electron-builder.yml`
- Create: `build/installer.nsh`
- Modify: `.gitignore`
- Modify: `README.md`
- Test: Windows x64 NSIS package build with signing disabled and signing configuration validation

**Interfaces:**
- Package format: NSIS installer targeting Windows 10/11 x64, per-user install by default, with Start Menu shortcut, optional desktop shortcut, and standard uninstaller.
- `npm run app:dist` builds renderer, Electron main/preload, and installer; `npm run app:dir` produces an unpacked app for smoke testing.
- Signing uses electron-builder certificate inputs via environment variables (for example `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`); never bake credentials into config or logs.
- If no certificate variables are present, local packaging is unsigned and reports that limitation; do not label it officially signed or SmartScreen trusted.

- [ ] Add Electron compilation/build scripts, NSIS resources and shortcuts, Windows target metadata, and ignore generated installers/certificates/logs.
- [ ] Add certificate-backed signing configuration and a preflight check that reports missing/incomplete credentials without exposing values.
- [ ] Document Windows 10/11 prerequisites, install/uninstall behavior, startup toggle, local WebSocket protocol/configuration, printer support, code-signing setup, and the unsigned-development limitation.
- [ ] Run lint, focused tests, Vite build, and unsigned NSIS packaging; verify installer contents include tray app, uninstaller, and Start Menu entry.
