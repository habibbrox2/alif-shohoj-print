# Remaining Settings Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings controls functional wherever the current renderer, Electron agent, and local customer gateway can enforce the behavior; accurately label unsupported controls.

**Architecture:** Reuse `ShopProfile.isDndMode` to stop new customer orders at the master gateway, expose existing per-service auto-approval in the Approval group, and persist the close-to-tray preference with Electron window state. Keep provider-, account-, scheduling-, and update-dependent controls marked Coming soon.

**Tech Stack:** React, TypeScript, Electron IPC, Node HTTP gateway, `node:test`, existing npm scripts.

**Spec:** `docs/design/specs.md` (Settings groups and controls); user-approved scope: implement behavior supported safely by the current architecture and mark unsupported controls Coming soon.

## Global Constraints

- Preserve the 11 Settings groups and their order.
- Keep Audit Log always enabled; do not add a disable control.
- Do not add dependencies or expose unrestricted Electron APIs.
- Validate customer orders at the master gateway; renderer-only enforcement is insufficient.
- Preserve existing per-service approval policy and tray behavior by default.
- Keep unsupported features visibly marked Coming soon; do not imply they work.

## Review Focus

- Remote order submission while Break Mode is enabled must be rejected by the master gateway.
- Existing per-service auto-approval values must remain unchanged until explicitly saved.
- A malformed or absent saved window preference must safely default to closing to tray.
- A non-desktop browser must not claim to persist Electron-only settings.
- Audit Log must remain required and un-toggleable.

---

### Task 1: Enforce order acceptance policy

**Files:**
- Modify: `src/shared/desktop-api.ts`
- Modify: `src/shared/context/StudioContext.tsx`
- Modify: `electron/services/local-gateway.ts`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Test: `electron/services/__tests__/local-gateway-settings.test.ts` (new)

**Interfaces:**
- `CustomerAppConfig.shopProfile` publishes the existing `isDndMode` policy.
- `LocalGatewayOptions.getPendingOrderCount` is not introduced; this task enforces only the existing Break Mode policy.

- [x] **Step 1: Test gateway rejection of customer orders while Break Mode is on**, asserting HTTP 503 and that `onCustomerOrder` is not called; assert accepted behavior remains unchanged when it is off.
- [x] **Step 2: Run the focused gateway test and confirm it fails before implementation.**
- [x] **Step 3: Publish `isDndMode` in the customer config and reject `/api/customer-orders` when it is true.** Mark the existing Accepting Orders row supported and make it edit the same draft policy as Break Mode; preserve the DND message in PWA UI.
- [x] **Step 4: Run the focused gateway test and renderer checks.**

### Task 2: Expose existing approval controls in Settings

**Files:**
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/shared/i18n/strings.ts`
- Test: `src/shared/services/__tests__/renderer.test.ts`

**Interfaces:**
- Read/write `StudioService.autoApprove` through the existing `updateStudioService(serviceId, updates)` context method.

- [x] **Step 1: Add a settings metadata test** asserting Auto Approval is supported and Audit Log remains required.
- [x] **Step 2: Add an Approval-group draft keyed by service ID and render per-service approval switches.** Retain offline-counter manual review behavior and leave configurable timeout/edit/consent controls Coming soon unless already configurable.
- [x] **Step 3: Save and reset per-service auto-approval settings without changing values in other groups.**
- [x] **Step 4: Run renderer tests and lint.**

### Task 3: Make close-to-tray configurable

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/desktop-api.ts`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Test: `electron/services/__tests__/window-settings.test.ts` (new if the window preference is extracted to a testable helper)

**Interfaces:**
- Add `getCloseToTray(): Promise<boolean>` and `setCloseToTray(enabled: boolean): Promise<boolean>` to the narrow desktop bridge.
- Store `closeToTray` in the existing `window-state.json`; default missing or invalid legacy values to `true`.

- [x] **Step 1: Add tests for legacy/malformed preference defaulting and valid boolean round-trip using a pure window-state helper.**
- [x] **Step 2: Add validated Electron IPC and preload methods; validate the sender for writes.**
- [x] **Step 3: Make the window close handler hide only when the persisted preference is enabled; mark the Settings control supported and save/reset it through the bridge.**
- [x] **Step 4: Run desktop tests, renderer tests, lint, and `npm run verify`.**

### Task 4: Document supported scope and remaining limitations

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md` only if user-facing Settings behavior requires setup guidance.

- [x] **Step 1: Record the newly supported policies and list the still-Coming-Soon controls accurately.**
- [x] **Step 2: Review the final diff and run `git status --short`; preserve all unrelated work and do not commit without explicit authorization.**
