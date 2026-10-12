# Changelog

## 2026-10-12 — Studio-first shell; Settings and Windows agent in their own windows

- Make **Studio** the first tab of the master desktop shell and its default landing page, so the shop's workspace is what opens first.
- Open **Settings** in its own desktop window instead of switching the main window's tab: the Settings tab, the shop menu's Settings entry and the tray's Shop Settings action all open or focus that single Settings window.
- Open the **Windows Agent & Driver Layer** in a fully separate window: the Printers tab, the Help menu's printers/services/server entries and the tray's Printer Settings action open the agent window on the matching page; a second request focuses the existing window and switches its page in place instead of spawning a duplicate.
- Keep the three windows consistent without a reload: queue changes and new-order toasts reach every window, a settings save broadcasts the new application settings to the other windows, and localStorage-backed state (shop profile, prices, services, printers, counters, interface language) is re-read on the `storage` event and on window focus. Only the main window polls counter heartbeats, publishes the customer PWA gateway config and plays the new-order chime, so a three-window session never runs any of them three times.
- Restrict the new IPC surface: only the main window can open auxiliary windows; the auxiliary windows run with context isolation, sandboxing, blocked popups and app-shell-only navigation, mirror the same trusted-sender checks, and render only on a master PC (a crafted `?window=` URL on a counter PC falls through to the locked Counter Inbox shell).
- Give each auxiliary window its own taskbar title (Settings / Windows Agent & Drivers) so the three windows are distinguishable.
- Fix pre-existing TypeScript errors in the counter-feed WebSocket work that blocked `npm run build:electron`: define the loopback-by-default gateway host, guard the optional counter id before `pushUpdate`, and close the optional TLS server defensively.
- Extend renderer tests: Studio leads the master tab bar, the tab order is locked, and Settings/Printers map to their auxiliary windows.

## 2026-10-12 — Service presets and service management

- Add a default service preset catalog (ID card, A4 B/W, A4 colour, Doc/Docs file print, passport photo 4-in-1 and 8-in-1, 3R/4R photo, 6R photo, stamp-size photo, legal document) so each shopkeeper can create a new service from a preset instead of configuring paper size, DPI and colour from scratch.
- Turn **Settings → সার্ভিস → সার্ভিস পরিচালনা** into a working control (master PC only): add a service from a preset and delete services no longer offered. Add/delete apply immediately, deleting asks for confirmation, and the last remaining service cannot be deleted so the POS and customer app always have a service to route orders to.
- Make the customer app's service grid follow the live service list instead of four hard-coded services, so shopkeeper-created services appear to customers (with enabled/disabled state and base price) and deleted ones disappear.
- Price orders from the live service definition: preset-created services bill their own base price while built-ins keep the shared pricing tiers (passport grids, A4 colour). The order-edit dialog uses the same rule when recalculating a bill.
- Preset-created services derive their crop frame and paper size from the service's own preferences instead of a hard-coded branch.
- Extend the renderer tests: preset catalog uniqueness and built-in code isolation, `createServiceFromPreset` validity and copy semantics, and `priceForServiceOrder` behaviour.

## 2026-10-11 — Live counter order feed and pairing

- Give every counter PC a live feed of its own orders from the master PC: the master gateway serves `GET /api/counter-orders`, the counter app polls it every 15 seconds in the main process, and the Counter Inbox merges those rows over whatever that PC already holds. The feed state (`Live`, `Connecting`, `Feed problem`, `Not paired`) and the last update time are shown on the counter PC.
- Pair each counter with its own **counter pairing key** instead of sharing one shop-wide secret: issue, reveal, copy, rotate and revoke keys per counter from the counter QR poster dialog, and enter a key once on the counter PC — during first-run setup or later in the Counter Inbox.
- Keep the master PC's customer data on the master: the feed carries only token code, service, paper size, copies, status, payment state, price and timestamps. Customer names and phone numbers, the uploaded document, the upload file name and the audit log never cross the LAN, and a key only ever returns the orders of the counter that owns it.
- Store the counter PC's key in the main process — encrypted with the Windows account when available, otherwise in a `0600` file that the UI reports as unprotected — and never expose it to the renderer after saving. The master's key file is written with `0600` file permissions and atomic replace.
- Refuse missing, wrong and revoked keys with `401`, throttle repeated failures per counter with `429`, and require HTTPS for the feed on installed Windows PCs.
- Extend coverage: key-store tests (issue, rotate, revoke, damaged file, cross-counter isolation), gateway tests (auth, scoping, sanitization, `since`, throttling), and an end-to-end test that pairs a counter against a real gateway; renderer tests cover the feed payload validation and the inbox merge.

## 2026-10-11 — Counter Mode desktop shell

- Counter PCs now open a locked **Counter Inbox** in the desktop app instead of the master tabs: counter name/code, operator, master PC URL, the heartbeat connection state, and the orders that belong to that counter only.
- Hide the master-only surfaces on a counter PC — Printers, Jobs, Reports, Settings, POS revenue, the printer-settings dialog, the counter poster, the agent package dialog and the Help/Shop menus; the tray menu can no longer open a master page on a counter PC.
- Show the counter's role and connection state in the shell header with a compact language switch, and keep the role-aware tab list in one place so a counter can never render a master page.
- Known limitation: this lock is a UI restriction for the tab set. Per-counter pairing now exists for the order feed (see the entry above), but counter PCs still have no per-counter session or permission model of their own, and the master PC continues to perform every print.

## 2026-10-11 — Editable business hours

- Add the **Business hours** controls in Settings → দোকান ও অর্ডার: enforcement toggle, open/close times, and per-weekday open-day toggles backed by the persisted operational settings.
- Validate before saving: clock times must be `HH:MM` and at least one open day must stay selected while enforcement is on, so a mis-click cannot silently close the shop to customer orders.
- Document the Asia/Dhaka policy and the overnight interpretation (a close time earlier than the open time spans midnight) in the row itself.
- Verified the saved schedule reaches the customer gateway policy, so the edit actually changes when orders are accepted.

## 2026-10-11 — Renderer entries moved to `resources/`

- Move `desktop.html`, `pwa.html`, and `index.html` into `resources/` so the repository root stays readable; Vite now emits them as `dist/resources/*.html`.
- Update the Electron desktop loader, the LAN customer-app URL, and the gateway's default and fallback documents to the new paths; a `/pwa.html` request from a poster printed earlier still resolves to the customer app.
- Rewrite the dev-server root request to `resources/index.html` so `npm run dev` and the `wait-on` step of `npm run dev:desktop` keep working without a root entry document.
- README project-layout and counter-QR sections document the new entry paths.

## 2026-10-11 — Counter-cash-only payments

- Keep counter cash as the only settled payment method: the payment store records a pending counter-cash transaction that staff confirm at the counter, and the deferred bKash/Nagad methods are rejected instead of being stored as paid.
- Reject customer orders at the master gateway when they claim a bKash/Nagad or already-collected payment, so a phone-submitted order is shown as unpaid until the counter collects the cash.
- Disable the bKash/Nagad choice in the customer PWA and label it as a future version; the token slip always reports “কাউন্টারে প্রদেয় (ক্যাশ)”.
- Mark **Pay at counter (cash)** as always on in Settings → পেমেন্ট, keep payment methods and automatic refunds marked Coming soon with a future-version note, and register the payment-service tests with `npm run test:desktop`.
- Known gap: the payment service is not yet wired to Electron IPC or to an operator confirmation action, so the current UI continues to mark cash as collected when printing completes.

## 2026-10-11 — Functional Settings controls

- Enforce Break Mode at the master customer-order gateway; the Accepting new orders toggle controls the same policy.
- Add per-service Auto Approval and persistent Close to system tray settings. Existing supported controls for service availability and pricing, notification sound, printer selection, voice-guide preferences, Windows auto-launch, and interface language remain available; the Audit Log remains required.
- Keep business hours and order limits; service management; manual-approval settings, order editing, price-change confirmation, and approval timeout; Windows notifications, sound volume, order reminders, and do-not-disturb scheduling; printer routing, fallback, and alerts; custom voice and voice commands; payment methods and automatic refunds; automatic file deletion, preview watermark, and staff PIN; staff accounts, roles, and job lock; automatic updates and offline mode; and shop branding, customer price list, and customer message marked Coming soon.

## 2026-10-11 — Dashboard workspace redesign

- Restructure the combined dashboard into a shop identity/connection header, clear printer and job summary, and three in-page views: Overview, Orders, and Shop & POS.
- Replace the long scroll between status, order inbox, and POS with direct section navigation; retain existing live data, filters, printer actions, order controls, and POS features.
- Add English and Bengali labels for the in-page navigation.

## 2026-10-10 — Combined Status workspace

- Merge the order inbox and Shop POS tools into the desktop workspace and remove their separate top-level tabs; rename the combined Status tab to Dashboard.
- Keep the order-card actions, counter filter, POS queue and settings available in the combined scrollable workspace; Dashboard shortcuts scroll to the corresponding section.

## 2026-10-10 — Reports and Settings pages

- Replace the Reports placeholder with Today and This Month summaries calculated from retained local jobs, including printed jobs, active queue work, completed value, empty state, and a queue-read error state.
- Add the 11-group Settings panel with staged changes, save/reset actions, working controls for shop break mode, service availability and pricing, notification sound, voice-guide preferences, Windows auto-launch, printer selection, and interface language.
- Keep settings without backend support explicitly marked as “Coming soon”; the Audit Log remains required and cannot be disabled.
- Add English/Bengali translations for the new Reports and Settings UI.
- Report limitation: completed-job records are removed from the current queue after retention, so these summaries are not durable historical or accounting reports.

## 2026-10-10 — Desktop UI parity, tray actions, and Bengali locale polish

- Open the desktop shell on Status by default and route the Status-page “View jobs” and “Shop” actions to the Jobs and POS tabs.
- Load `desktop.html` in the Electron development window so `npm run dev:desktop` exercises the same desktop renderer entry as packaged Windows builds.
- Widen the detected-printers dialog to accommodate its capability, default-service, and printer-placeholder columns.
- Replace the minimal tray menu with the specified native Electron menu, live shop and queue counts, navigation actions, restart/quit actions, and a new-order icon badge.
- Align in-app and Windows order notifications with the Alif Shohoj Print title and safe order summary, printer, price, payment, View, and Approve labels; do not expose customer names or uploaded filenames.
- Add a persistent English/Bengali selector to the desktop shop menu and translate printer capability and service labels; the existing Bengali font fallback remains in place.
- Validation: `npm run verify` passed, including lint, 9 desktop tests, 22 renderer tests, the Electron SQLite runtime smoke test, and both builds.

## 2026-10-10 — Desktop shell and design-plan implementation

Implements the desktop-shell refactor and app-identity update described in [docs/design/plan.md](docs/design/plan.md): separate desktop/PWA entry points, a Windows-native shell with tabbed desktop navigation, status/dashboard-oriented desktop pages, centralized branding metadata, tray/name updates, and a compatibility-safe path for the existing Studio logic and queue services.

### Included changes

- Desktop shell refactor kept the real Electron frame and used the existing desktop app route instead of a fake in-window window chrome.
- Added/updated desktop route views for the status shell, dashboard flow, and related pages without rewriting the live queue/Studio logic.
- Centralized `Alif Shohoj Print` branding and app identity in `src/shared/config/brand.ts`, with matching Electron and installer metadata updates.
- Kept the desktop app aligned with the current queue, WebSocket, print-service, and printer-routing logic so the existing app behavior remains intact.
- Preserved the existing light-theme palette and app structure while aligning labels and shell surfaces to the reference design.

### Verification

- `npm run verify` — passed (`lint`, desktop tests, renderer tests, runtime smoke test, Vite build, Electron build all succeeded).

## 2026-10-09 — Audit fixes, part 2 (bugs #5–#7, security hardening, all improvements)

Implements the rest of the remediation plan from [docs/audit-2026-10-09.md](docs/audit-2026-10-09.md): BUG-005–007, the three security hardening items, and all nine Improvements from §5, plus the §4 quick UI wins.

### Fixed — remaining bugs

- **BUG-005 — stale-closure printer decrement.** `executePrint`'s 3.5 s completion timeout now reads the job through a `jobsRef` that always holds current state, so copies/paper decrements can't use outdated values if the job was edited meanwhile.
- **BUG-006 — dead countdown on pending jobs.** The 1 s retention ticker only ticks jobs eligible for deletion (`completed`/`rejected`) and returns the same array reference when nothing eligible is on screen — pending orders no longer show a frightening `00:00 auto-delete` countdown, and idle ticks cause zero re-renders. Logic extracted to `tickJobRetention()` in `src/shared/services/jobLifecycle.ts`.
- **BUG-007 — counter stats counted at creation.** `todayOrdersCount`/`todayEarningsBDT` are no longer incremented when an order is *created*. A completion-counting effect increments each counter exactly once when a job actually finishes, skipping jobs that completed before the session started so stats persisted to localStorage are never double-counted across restarts. Rejected/failed orders never inflate the stats.

### Security hardening

- **Navigation lockdown (`electron/main.ts`).** `setWindowOpenHandler` denies every new-window request, and a `will-navigate` guard blocks navigation away from the app shell (dev server origin in dev; the packaged `dist/` file tree only in production). Blocked attempts are logged.
- **IPC validation parity.** `desktop:queue:save-job` now runs the same exported `isPrintJob()` shape/type guard as the WebSocket path (data-URL MIME allowlist, 40 MB cap, copies 1–100, finite numbers) instead of checking only `id`.
- **Sandboxed preview iframes.** `OrderCardModal` and `CustomerPwaView` previews now render `job.fileUrl` with `sandbox=""` (no scripts, no same-origin, no popups) — verified visually that file previews still render.
- The LAN scanner mock now generates its sample as a **local canvas JPEG data URL** instead of a remote Unsplash URL, so it passes the desktop pipeline's data-URL requirement and works offline.

### Improvements (audit §5)

1. **Code splitting** — the three views (`WindowsAgentView`, `CustomerPwaView`, `ShopPosView`) load via `React.lazy` + `Suspense`. Entry chunk dropped from >500 kB to **392.6 kB** (gzip 116.6 kB); view chunks split out (62.5/40.8/25.4 kB). The >500 kB build warning is gone.
2. **Unused dependencies removed** — `@google/genai`, `express`, `@types/express`, `dotenv`, `motion`, `autoprefixer` (zero imports anywhere) uninstalled.
3. **Shared pricing** — new `src/shared/services/pricing.ts` exports `priceForService()` / `unitPriceForService()` / `PRICING_KEY_BY_SERVICE`; the three duplicated formulas (`CustomerPwaView.calculatePrice`, `OrderCardModal.calculateRecalculatedPrice`, `StudioContext.updatePricing`) now call it.
4. **Real printer scan** — `scanLocalPrinters()` diffs Electron's `desktop.listPrinters()` spooler names against the registry instead of fabricating a Brother after 1.2 s; unknown-brand devices get a widened `PrinterDevice.brand` union (`+Pantum/Samsung/Ricoh/…/Other`), virtual destinations (PDF writers, fax, XPS) are skipped, and the UI reports the real added count or the error.
5. **Renderer state persistence** — counters, printers, pricing, and the shop profile persist to `localStorage` (new `src/shared/services/persistedState.ts` with structural validators; corrupt data falls back to defaults, empty arrays respected). Jobs intentionally stay SQLite-only — payloads exceed the localStorage quota.
6. **Renderer tests** — new suite `src/shared/services/__tests__/renderer.test.ts` (**19 tests**): job-ID uniqueness, token monotonicity, pricing matrix, approve/reject/countdown/retention lifecycle, completion counting, printer routing (incl. offline fallback), and persistence validators. Runs via `npm run test:renderer`.
7. **StudioContext decomposition (scoped)** — the job lifecycle (approve/reject transitions, retention tick, completion collection) is extracted into pure, tested functions in `src/shared/services/jobLifecycle.ts`; the provider now wires them instead of inlining the state machine. The full `PricingProvider`/`CounterProvider` split is **not** done and remains future work.
8. **CI gate** — single `npm run verify` (lint → desktop tests → renderer tests → runtime smoke → build → electron build) now backs **both** `app:dir` and `app:dist`, so packaging can't skip checks.
9. **TLS shutdown** — the WebSocket service closes its external HTTPS server when `wss` closes, so `before-quit` releases the TLS port instead of leaking it to `app.exit`.

### UI polish (audit §4)

- Favicon added (inline SVG matching the tray icon) — no more default blank icon.
- Order table shows the **full printer name** (was truncated to two words — "Epson EcoTank" without "L805").
- Shop settings auto-approve list iterates `services` from context, so owner-created **custom services can be toggled** (was hard-coded to 5 built-ins).
- PWA upload **blob object URLs are revoked** when replaced or on unmount (was a slow memory leak on repeat uploads).
- Footer claims honesty: "Driver Abstraction Layer Active" replaced by "Windows Agent Connected" / "Web Preview Mode".

### Verification

- `npm run verify` — **exit 0** (lint, 9/9 desktop tests, 19/19 renderer tests, Electron runtime smoke, renderer build, electron build).
- Visual verification in the browser (dev server): zero `slate-750/850` rules and 9/9 `hover:` classes with emitted rules; modal `ap-fade-in 0.2s` running; `prefers-reduced-motion` present; retention ticker visibly auto-deleted a completed demo job while pending jobs stayed; all three lazy views load on demand with **zero console errors**; sandboxed iframe preview renders content; footer shows "Web Preview Mode".

### Known limitations (out of this batch)

- Accessibility items (dialog roles/Escape/focus trap, keyboard rows, `aria-live`, contrast) remain open.
- Google Fonts self-hosting (security note 4) remains open.
- `updatePricing` still maps only the five built-in pricing keys; custom services keep their own `basePriceBDT` (no pricing-screen field exists for them yet).
- `bun.lock` still lists the removed dependencies (bun is not installed here; the next `bun install` will reconcile it).

---

## 2026-10-09 — Audit fixes (bugs #1–#4 + dead Tailwind classes)

Implements the first remediation batch from [docs/audit-2026-10-09.md](docs/audit-2026-10-09.md).

### Fixed — high-severity bugs

- **BUG-001 — demo data in production POS.** `INITIAL_JOBS` (3 demo orders) now only seeds in Vite dev mode (`import.meta.env.DEV`); packaged builds start with an empty queue. Removed the fabricated metric offsets — `todayPrintedCount` / `todayEarningsBDT` are computed purely from real completed jobs. Demo counters (`CTR-01/02/03`) now start with `0` orders and `৳0` earnings instead of 68/39/20 phantom orders.
- **BUG-002 — job ID / token-code collisions.** Job IDs are now collision-proof (`JOB-YYYYMMDD-<12-char random>` via `crypto.randomUUID()`), so auto-deleted jobs can never cause an ID to be reused against the SQLite queue. Customer pickup codes come from a monotonic sequence seeded with the highest existing numeric token — never reused within a session or across reloads. Test-print IDs no longer use a 4-digit timestamp slice.
- **BUG-003 — duplicate counter IDs.** `handleCreateCounter` scans for the first unused `CTR-NN` slot instead of deriving the ID from `counters.length + 1`, which duplicated existing IDs after a deletion.
- **BUG-004 — rejected jobs resurrecting from SQLite.** Added `JobStore.remove()` + a `desktop:queue:remove-job` IPC channel + `removeJob()` on the preload bridge. Rejecting an order now deletes its queue row (guarded: not while it is printing/completed), so a restart can no longer bring it back as approvable. `editJob` no longer re-inserts rejected jobs. Re-enqueueing a `failed` job now resets it to `queued` with a cleared error so retries work. The renderer gained a distinct `failed` job status (badge "ব্যর্থ", Retry action in the POS table, included in pending counts).

### Fixed — dead Tailwind classes

- Replaced all nonexistent `slate-750` / `slate-850` utilities with real shades (`slate-700` / `slate-800`) across `ShopPosView`, `CounterPosterModal`, and `WindowsAgentView` — hover states now actually render.
- Restored the enter animations that were silently no-ops (Tailwind v4 has no `animate-in` and the plugin was never installed): `animate-in`, `fade-in`, `slide-in-from-bottom-5`, and `zoom-in-95` are now defined in `src/index.css` with keyframes, a 200 ms default duration, and a `prefers-reduced-motion` opt-out. Modals, the order toast, and step panels animate again.

### Changed

- `electron/services/job-store.ts` — `enqueue()` conflict update now also resets `status` to `queued` and clears `error` (retry semantics); new `remove()` method with WAL checkpoint.
- `electron/main.ts` — new `desktop:queue:remove-job` handler; refuses to remove a job currently printing.
- `src/shared/types.ts` — `JobStatus` union gains `'failed'`.

### Tests

- New store test: `removes rejected jobs permanently and resets failed jobs to queued on re-enqueue` (9/9 passing).

### Verification

- `npm run lint` — pass
- `npm run test:desktop` — 9/9 pass
- `npm run test:electron-runtime` — pass
- `npm run build`, `npm run build:electron` — pass
- Built CSS confirmed: zero `slate-750/850` rules; all animation utilities and keyframes emitted.
