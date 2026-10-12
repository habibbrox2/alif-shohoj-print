# Reports and Settings UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Reports placeholder metrics with truthful local Today/This Month summaries and replace the Settings placeholder with the specified 11-group panel, wiring existing settings and explicitly marking unsupported controls.

**Architecture:** Reports derive period-bounded summaries from the current `StudioContext.jobs` snapshot through a pure, tested selector; no sample totals or new backend are introduced. Settings uses the existing `StudioContext` and desktop API for supported preferences, with a Bengali 11-group navigation and explicit “শীঘ্রই আসছে” labels for settings without a working persistence/API path.

**Tech Stack:** React, TypeScript, Tailwind CSS utilities, lucide-react, existing i18n dictionary and `node:test` renderer tests.

**Spec:** `docs/design/plan.md` §§6 and 9; `docs/design/specs.md` §5.

## Global Constraints

- Use the existing app state, SQLite-backed desktop queue, service/printer APIs and persisted settings; do not introduce demo report totals.
- Settings must contain the 11 groups in the specified order and keep their group names in Bengali.
- Settings without an implemented backend must be visibly marked “শীঘ্রই আসছে”; do not present them as working controls.
- Do not add a control that disables Audit Log.
- Do not add dependencies or alter the database schema/WebSocket protocol for this UI task.
- Preserve English/Bengali locale support, the light-theme teal palette, and existing dark/light theme tokens.
- Update `CHANGELOG.md` for the user-visible Reports and Settings changes.

## Review Focus

- Jobs on local-day and local-month boundaries: use local calendar periods as `[start, end)`, count completed jobs by `completedAt`, and count in-queue work by `createdAt`.
- Failed or rejected jobs: exclude from printed totals and earnings; for parity with `StudioContext.pendingJobsCount`, include failed jobs in the in-queue total and exclude rejected jobs.
- Payment states: follow the existing POS metric and sum `priceBDT` for completed jobs regardless of payment status; do not label this as collected cash.
- Empty or unavailable local queue: show zero only when the queue loaded successfully; surface the existing queue error instead of masking it as valid report data.
- Historical records removed by queue retention: disclose that summaries cover records currently available locally; do not imply an archival reporting backend exists.
- Unsupported settings, including attempts to disable Audit Log: present as unavailable without saving or implying a backend change.

---

### Task 1: Build period-correct Reports summaries

**Files:**
- Create: `src/shared/services/reportMetrics.ts`
- Modify: `src/features/desktop/pages/ReportsPage.tsx`
- Modify: `src/shared/i18n/strings.ts`
- Test: `src/shared/services/__tests__/renderer.test.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `PrintJob` from `src/shared/types.ts`; `jobs` and `desktopQueueError` from `useStudio()`.
- Produces: `buildReportSummary(jobs: readonly PrintJob[], now: Date): ReportSummary`, with `today` and `thisMonth` metrics for printed jobs, in-queue jobs, and completed-job value in BDT.

- [x] **Step 1: Add renderer tests** for local day/month boundaries, completed-at timestamps, pending-job creation timestamps, exclusion of rejected/failed jobs from printed totals and earnings, and zero-valued summaries for an empty jobs array.
- [x] **Step 2: Run `npm run test:renderer`** and confirm the new report-summary assertions fail before the helper exists.
- [x] **Step 3: Implement `buildReportSummary`** as a pure function using local calendar-day and calendar-month boundaries; count completed jobs by `completedAt`, sum their `priceBDT` regardless of payment status, and count queued/approved/routing/printing/failed jobs by `createdAt` in the relevant period.
- [x] **Step 4: Replace hard-coded `0` values and inert report tabs** in `ReportsPage.tsx` with the calculated Today and This Month summaries. Use `desktopQueueError` for an explicit error state, and add a localized notice that summaries use locally available jobs and are not archived history.
- [x] **Step 5: Add/adjust English and Bengali i18n keys** for report labels, period tabs, queue errors, empty state, and the local-history limitation.
- [x] **Step 6: Run `npm run test:renderer`, `npm run lint`, and `npm run build`**; all must pass.
- [x] **Step 7: Update the Reports entry in `CHANGELOG.md`** to describe the actual calculated fields and historical-data limitation.

### Task 2: Replace the Settings placeholder with the 11-group panel

**Files:**
- Create: `src/features/desktop/pages/SettingsPage.tsx`
- Create: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/features/desktop/DesktopApp.tsx`
- Modify: `src/shared/i18n/strings.ts`
- Test: `src/shared/services/__tests__/renderer.test.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `shopProfile`, `updateShopProfile`, `services`, `toggleStudioService`, `pricing`, and `updatePricing` from `useStudio()`; `getAutoLaunch`/`setAutoLaunch` from `window.alifShohojPrintDesktop`.
- Produces: ordered `SETTINGS_GROUPS` metadata for the Bengali groups: দোকান ও অর্ডার, সার্ভিস, অ্যাপ্রুভাল, নোটিফিকেশন, প্রিন্টার, ভয়েস গাইড, পেমেন্ট, নিরাপত্তা, স্টাফ, Agent, কাস্টমাইজ. `SettingsPage` accepts `onOpenPrinterSettings: () => void` from `DesktopApp`.

- [x] **Step 1: Add settings-group tests** that assert the exact 11-group order, that unsupported entries carry the “coming soon” state, and that no group defines an Audit Log off toggle.
- [x] **Step 2: Run `npm run test:renderer`** and confirm the new group metadata assertions fail before the metadata exists.
- [x] **Step 3: Implement `settingsGroups.ts`** with typed group/entry identifiers and the 11 Bengali group names; tag settings unsupported by current state or APIs rather than exposing inert controls. Do not define an Audit Log disable entry.
- [x] **Step 4: Implement `SettingsPage.tsx`** with left-side group navigation, right-side form, and responsive scrolling. Stage supported changes locally until Save Changes; Reset to Default resets supported rows in the selected group to declared initial values. Wire only existing safe behavior: Break Mode (`shopProfile.isDndMode`), service enabled flags, existing price fields, notification sound (`shopProfile.soundAlertEnabled`), voice-guide preferences (`shopProfile.voiceGuide`), printer-settings dialog, and auto-start where the desktop bridge is available. Mark auto-approval/Edit as “শীঘ্রই আসছে” because the service model has no sensitive-service classification for enforcing the specified exception; leave the POS screen's current behavior unchanged. Leave other unsupported rows visibly “শীঘ্রই আসছে”.
- [x] **Step 5: Wire SettingsPage into `DesktopApp.tsx`** in place of the Step 7 `UpcomingPage`; keep native shop/profile state and existing navigation intact.
- [x] **Step 6: Add English/Bengali translations** for all new labels, supported settings, button actions, and the coming-soon state.
- [x] **Step 7: Run `npm run test:renderer`, `npm run lint`, and `npm run build`**; confirm saving supported values updates existing state, resetting restores the selected group's declared defaults, and unsupported controls cannot mutate state.
- [x] **Step 8: Update `CHANGELOG.md`** with the 11-group Settings UI, the subset wired to existing state, and the settings still awaiting backend support.

### Task 3: Verify the integrated Reports and Settings pages

**Files:**
- Verify: `src/features/desktop/pages/ReportsPage.tsx`
- Verify: `src/features/desktop/pages/SettingsPage.tsx`
- Verify: `src/features/desktop/DesktopApp.tsx`
- Verify: `CHANGELOG.md`

**Interfaces:**
- Consumes: completed report summaries and the Settings page from Tasks 1 and 2.
- Produces: validated renderer build with no unintended changes to the existing queue, POS, printer-routing, or locale behavior.

- [x] **Step 1: Run `npm run verify`** and record the actual results for lint, desktop tests, renderer tests, Electron runtime smoke test, Vite build, and Electron build.
- [ ] **Step 2: Run `npm run dev:desktop`** and visually inspect Reports and Settings in the Windows Electron app in both English and Bengali. Confirm the 11 group order, explicit unsupported markers, and local-data notice.
- [ ] **Step 3: Verify report queue-error rendering** by making the existing desktop queue unavailable in a test/runtime session; confirm the page displays the error instead of presenting zero-valued totals as a successful report.
- [x] **Step 4: Review `git diff` and `git status --short`**; retain unrelated pre-existing worktree changes and confirm only the intended Reports, Settings, tests, translations, changelog, and plan files were added or edited.
- [ ] **Step 5: Commit the Reports and Settings phase separately** only after the diff is reviewed and the existing worktree changes can be kept out of the commit.

## Coverage and Known Limits

- This phase supplies Today and This Month summaries from records currently loaded by the desktop queue. Durable historical reporting needs an archival/aggregate source that does not currently exist and is out of scope.
- This phase builds the Settings structure and wires only controls already backed by the current renderer context or desktop bridge. The other settings remain clearly marked as coming soon until their persistence/API work is implemented.
- The current service model has no sensitive-service classification; the Settings page must not present auto-approval as supported until that safety rule can be enforced. The existing POS auto-approval control is intentionally outside this page-only scope.
- On this Windows session, `npm run dev:desktop` started Vite and built Electron successfully, but the Electron subprocess exited with code 0 and stopped the paired dev server before a window could be inspected; final native-window parity remains unverified.
