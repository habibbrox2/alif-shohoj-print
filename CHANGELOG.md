# Changelog

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
