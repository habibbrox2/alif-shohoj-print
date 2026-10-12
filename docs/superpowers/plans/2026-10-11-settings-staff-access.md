# Staff Accounts and Role Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local staff authentication and enforce Owner, Manager, and Operator permissions across privileged desktop operations.

**Architecture:** Bootstrap the first Owner through a PIN setup screen; store only salted `scrypt` hashes in a local SQLite staff store. Keep active session and authorization checks in Electron main, expose a narrow session-aware preload bridge, and gate renderer routes/actions to match backend permissions.

**Tech Stack:** TypeScript, React, Electron IPC, Node `crypto.scrypt`, existing `better-sqlite3`, `node:test`.

**Spec:** `docs/design/specs.md` Settings Panel; user approved local Owner PIN bootstrap and Owner/Manager/Operator roles.

## Global Constraints

- Never store or log plaintext PINs; compare hashes with constant-time equality.
- Owner is the only role allowed to create/disable users or grant roles.
- Default recovery must not silently bypass authentication or disable audit logging.
- Customer orders from PWA are not staff actions and must continue without a staff session.
- Role enforcement belongs in Electron main, not only in disabled renderer buttons.

## Review Focus

- First-run setup cannot create a second Owner after bootstrap.
- Invalid PIN, brute-force attempts, and expired sessions are throttled/denied.
- Renderer direct IPC calls cannot bypass role checks.
- Last enabled Owner cannot be deleted or demoted.
- Customer-originated orders remain accepted according to shop policy while desktop UI is locked.

---

### Task 1: Implement staff store and auth service

**Files:**
- Create: `electron/services/staff-store.ts`
- Create: `electron/services/staff-auth.ts`
- Create: `electron/services/__tests__/staff-auth.test.ts`
- Consume: `SettingsStore` from `2026-10-11-settings-operations.md`

**Interfaces:**
- `StaffRole = 'owner' | 'manager' | 'operator'`.
- `StaffAuthService` exposes `isBootstrapped(): boolean`, `createOwner(pin: string): StaffUser`, `login(pin: string): StaffSession`, `authorize(sessionId: string, permission: StaffPermission): StaffUser`, and `logout(sessionId: string): void`.
- PIN hashes use Node `scrypt`; sessions expire after 15 minutes of inactivity.

- [ ] **Step 1: Test first-owner-only bootstrap, role permissions, expired/invalid sessions, constant-time hash verification path, and last-owner protection.**
- [ ] **Step 2: Implement SQLite user store, PIN hashing, failed-attempt throttling, and session expiry.**
- [ ] **Step 3: Run focused auth tests and lint.**

### Task 2: Enforce access in Electron UI and IPC

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.cjs`
- Modify: `src/shared/desktop-api.ts`
- Modify: `src/features/desktop/DesktopApp.tsx`
- Modify: `src/features/desktop/pages/SettingsPage.tsx`
- Modify: `src/features/desktop/pages/settingsGroups.ts`
- Create: `src/features/desktop/pages/StaffAccessPage.tsx`
- Modify: Electron IPC and renderer tests

**Interfaces:**
- Permissions: Owner all; Manager shop settings/orders/printers/reports but not staff role grants; Operator jobs/POS only.
- `DesktopBridge` exposes bootstrap status, login, logout, current session role, and owner-only staff CRUD; no direct database/API access.

- [ ] **Step 1: Add IPC tests proving unauthorized senders/roles cannot save settings, print, delete queue jobs, or manage staff.**
- [ ] **Step 2: Add first-run Owner PIN setup and locked desktop login flow.**
- [ ] **Step 3: Add Owner-only staff list/create/disable/role assignment UI; protect last enabled Owner.**
- [ ] **Step 4: Run focused suites and `npm run verify`; document local recovery limitations without creating a bypass.**

