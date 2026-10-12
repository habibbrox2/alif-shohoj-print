# Agent Updates and Offline Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure GitHub Releases update checks/install flow, configurable local offline-order behavior, and customer-facing shop customization.

**Architecture:** Use the approved `electron-updater` dependency and GitHub Releases as the update source; updates are opt-in/configurable and retain Electron code-signature verification. The local gateway enforces the offline-order preference; customization uses an allowlisted subset of shop settings published to the PWA.

**Tech Stack:** Electron, `electron-updater` (approved by user), GitHub Releases, React, TypeScript, Node tests.

**Spec:** `docs/design/specs.md` Settings Panel; user selected GitHub Releases and approved adding `electron-updater`.

## Global Constraints

- Do not publish releases, sign installers, deploy, or alter secrets/certificates.
- Require signed Windows update artifacts and verify the packaged update configuration before enabling production installation.
- Never accept renderer-provided update URLs or arbitrary installer paths.
- Local print queue remains usable offline; internet availability does not imply local gateway availability.
- Publish only public shop display fields; never publish tokens, owner details, staff data, or internal settings.

## Review Focus

- Unsigned or wrong-identity update packages are rejected.
- Network timeout/offline update check leaves the installed app usable and reports the failure.
- Offline-order mode only affects new customer submissions; existing queue/printing remains usable.
- Disable/enable settings are persistent and default to current behavior.
- Customer custom message/branding values are escaped and length-limited before display.

---

### Task 1: Add GitHub Releases update service

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`
- Modify: `electron/main.ts`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/desktop-api.ts`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Create: `electron/services/update-service.ts`
- Create: `electron/services/__tests__/update-service.test.ts`

**Interfaces:**
- `UpdateService` exposes `check(): Promise<UpdateCheckResult>` and `downloadAndInstall(): Promise<void>`.
- Update source is fixed to this app's GitHub Releases; verify publisher identity and preserve Windows signature validation.

- [ ] **Step 1: Test update result mapping, network failures, disabled preference, and rejected unsigned/wrong-identity artifact metadata.**
- [ ] **Step 2: Add the approved `electron-updater` dependency and fixed GitHub publish configuration; do not create/publish a release.**
- [ ] **Step 3: Add narrow validated IPC for check/install and Settings toggle/status UI.**
- [ ] **Step 4: Keep update installation disabled in packaged builds until signing identity/configuration is verified; run `npm run verify`.**

### Task 2: Add local offline order policy

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `electron/services/local-gateway.ts`
- Modify: `electron/main.ts`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `electron/services/__tests__/local-gateway-settings.test.ts`

**Interfaces:**
- `offlineOrdersEnabled` defaults true and means new orders may be queued by the LAN gateway when internet connectivity is unavailable.
- Turning it off requires online connectivity before accepting a new customer order; it does not stop existing printing or tray operation.

- [ ] **Step 1: Test the on/off policy against injected connectivity state and verify existing jobs remain processable.**
- [ ] **Step 2: Wire gateway checks and publish current customer-facing availability; avoid relying on renderer-only network state.**
- [ ] **Step 3: Add Settings control and run focused tests/lint.**

### Task 3: Finish shop customization controls

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `src/shared/context/StudioContext.tsx`
- Modify: `src/shared/desktop-api.ts`
- Modify: `electron/services/local-gateway.ts`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Modify: `src/features/customer-pwa/CustomerPwaView.tsx`
- Modify: renderer tests

**Interfaces:**
- Public shop customization contains customer display name, short message, and logo selection restricted to app-managed local assets; price-list display derives from the existing service pricing table.

- [ ] **Step 1: Test maximum lengths, unsafe markup handling, and private-field exclusion from published PWA config.**
- [ ] **Step 2: Add editable Settings controls and render escaped public customization in the PWA.**
- [ ] **Step 3: Run renderer tests and `npm run verify`; document signing/hosting requirements for release deployment.**

