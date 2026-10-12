# Operational Settings Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and enforce shop-hours, order limits, approval, notification, printer, retention, preview-watermark, and customer-customization settings.

**Architecture:** Add a versioned SQLite settings store in Electron's user-data directory and expose only validated typed settings operations over the preload bridge. The Electron master gateway remains authoritative for incoming customer orders; the renderer/PWA mirrors published settings for immediate feedback.

**Tech Stack:** TypeScript, React, Electron IPC, existing `better-sqlite3`, Node HTTP gateway, `node:test`.

**Spec:** `docs/design/specs.md` Settings Panel and Customer PWA design; user decisions: preserve pending orders on approval timeout and use Bangladesh local time for shop hours.

## Global Constraints

- Keep the existing 11 Settings groups and Audit Log always enabled.
- No new dependency for these controls.
- Defaults preserve current behavior: all-day order intake, 20 pending orders maximum, 50 copies, 20 MB customer upload, capability routing, 15-minute completed-job retention, 2-minute rejected-job retention.
- Store shop hours in `Asia/Dhaka`; schedule disabled by default.
- Approval timeout only triggers a reminder; it never changes an order's status.
- Preview watermark is a display overlay only; do not alter submitted or printed source files.
- Validate at the Electron/gateway boundary; never trust only the renderer.

## Review Focus

- Concurrent submissions at the pending-order limit must not exceed the configured limit.
- Orders around midnight, daylight changes, and overnight opening intervals follow `Asia/Dhaka` schedule semantics.
- Invalid order copies, file size, and config values are rejected explicitly.
- Disabling edit or price-consent controls must not bypass unrelated approval or role checks.
- Retention does not delete active queue jobs or lose a file needed for retry/printing.

---

### Task 1: Create typed persistent settings backend

**Files:**
- Create: `src/shared/settings.ts`
- Create: `electron/services/settings-store.ts`
- Create: `electron/services/__tests__/settings-store.test.ts`
- Modify: `src/shared/desktop-api.ts`
- Modify: `electron/preload.cjs`
- Modify: `electron/main.ts`
- Modify: `package.json`

**Interfaces:**
- Export `AppSettings`, `DEFAULT_APP_SETTINGS`, and `isAppSettings(value: unknown): value is AppSettings` from `src/shared/settings.ts`.
- Add `getAppSettings(): Promise<AppSettings>` and `saveAppSettings(settings: AppSettings): Promise<AppSettings>` to `DesktopBridge`.
- `SettingsStore(databasePath: string)` exposes `get(): AppSettings`, `save(settings: AppSettings): AppSettings`, and `close(): void`.

- [ ] **Step 1: Test default settings, valid round-trip, partial/invalid payload rejection, and schema-version migration behavior.**
- [ ] **Step 2: Implement a versioned SQLite store using existing `better-sqlite3`; never return a success-shaped fallback for failed writes.**
- [ ] **Step 3: Wire sender-validated IPC/preload methods; validate full settings objects before persistence.**
- [ ] **Step 4: Add the new test file to `test:desktop`; run its tests and `npm run lint`.**

### Task 2: Enforce hours and order limits end to end

**Files:**
- Modify: `electron/services/local-gateway.ts`
- Modify: `electron/services/__tests__/local-gateway-settings.test.ts`
- Modify: `src/shared/desktop-api.ts`
- Modify: `src/shared/context/StudioContext.tsx`
- Modify: `src/features/customer-pwa/CustomerPwaView.tsx`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/shared/services/__tests__/renderer.test.ts`

**Interfaces:**
- Add customer-policy settings to `CustomerAppConfig`; the gateway receives current pending-order count through a synchronous callback.
- Add pure `isWithinShopHours(now: number, schedule: BusinessHoursSettings): boolean` and `validateCustomerOrderLimits(job: PrintJob, limits: OrderLimitsSettings): string | null` helpers under `src/shared/services/`.

- [ ] **Step 1: Test disabled schedule, open/closed intervals, overnight intervals, timezone boundary, pending limit, copy limit 50, and 20 MB data-URL byte limit.**
- [ ] **Step 2: Publish current policy and reject orders in the master gateway before `onCustomerOrder`; reserve capacity synchronously to prevent concurrent oversubmission.**
- [ ] **Step 3: Replace the fixed PWA 40 MB validation with the published 20 MB configurable policy and expose daily hours/order-limit controls in Settings.**
- [ ] **Step 4: Run focused gateway/renderer tests and lint.**

### Task 3: Complete approval and notification settings

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `electron/main.ts`
- Modify: `electron/services/sound-service.ts`
- Modify: `src/shared/context/StudioContext.tsx`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/shared/i18n/strings.ts`
- Modify: focused renderer/Electron tests

**Interfaces:**
- Approval settings: global `manualApprovalRequired` defaults false, `allowOrderEditing` defaults true, `requirePriceChangeConsent` defaults true, `reminderAfterMinutes` defaults 15.
- Notification settings include Windows toast enablement, sound volume 0–100, order-reminder enablement/interval, and an optional weekly DND schedule.
- Existing per-service `autoApprove` remains the per-service opt-in; offline counters always require manual review.

- [ ] **Step 1: Test approval precedence, editable/consent policy, reminder timing, DND schedule behavior, and volume bounds.**
- [ ] **Step 2: Wire Settings drafts/save/reset to the persistent store without overwriting edits from unrelated groups.**
- [ ] **Step 3: Wire reminders to pending orders and honor toast/sound/DND settings; approval reminders never auto-reject or auto-approve.**
- [ ] **Step 4: Replace the fixed-volume system beep with a generated 16-bit mono PCM WAV tone whose sample amplitude scales with the saved 0–100 volume; play it with `System.Media.SoundPlayer` and remove its temporary file on process close/error.**
- [ ] **Step 5: Run focused tests and lint.**

### Task 4: Complete printer, retention, watermark, and shop customization controls

**Files:**
- Modify: `src/features/printers/printerRouting.ts`
- Modify: `src/shared/context/StudioContext.tsx`
- Modify: `src/shared/services/jobLifecycle.ts`
- Modify: `src/features/desktop/pages/DashboardPage.tsx`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: focused tests

**Interfaces:**
- Printer policy selects an optional configured fallback printer; routing must still require compatible media/color capabilities.
- Security settings configure completed/rejected retention durations and a preview-only watermark toggle.

- [ ] **Step 1: Test fallback routing for online compatible, offline, and incompatible fallback devices; test duration bounds and public-config field allowlist.**
- [ ] **Step 2: Apply routing/fallback and alert preferences through existing capability matching and printer events.**
- [ ] **Step 3: Apply configurable retention only after completion/rejection; retain active queue data for retry and printing.**
- [ ] **Step 4: Add preview-only watermark to customer/order preview surfaces without changing source files or print output.**
- [ ] **Step 5: Update the Settings metadata so only behavior fully wired and tested is marked supported; update CHANGELOG and run `npm run verify`.**
