# Windows POS and Studio Service Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing React prototype open on Shop POS, configure master-PC or counter mode, provide POS access to both shopkeepers and counter operators, and add master-controlled studio service management and document/photo editing.

**Architecture:** Keep the app as a single Vite/React prototype. Store the selected installation mode and service definitions in the existing Studio context, enforce master-only service mutations in shared actions and UI, and reuse the existing `StudioEditorCanvas` within the POS.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS.

**Spec:** User request in the conversation (no separate specification file).

## Global Constraints

- After setup, the default view is `shop_pos`.
- Setup distinguishes a master PC/shopkeeper from a counter PC/operator.
- Both modes can access Shop POS / Web Admin.
- Only master mode can create, delete, enable/disable, or change service print preferences.
- Per-service preferences include paper type, print quality, color mode, paper size, DPI, copies, and borderless printing, using the existing `ServicePrintingPreferences` type.
- Keep the change scoped to the existing React prototype; do not claim to build a real Windows installer, backend, or physical printing integration.
- Do not introduce dependencies or a test framework solely for this work.

## Review Focus

- Counter mode must not mutate service definitions through either visible controls or context actions; cover with role-aware UI and action checks.
- A counter installation must retain its selected counter and mode across reloads; cover setup persistence and invalid stored values.
- Deleting or disabling a service must not make existing jobs or settings crash; cover an order referring to a removed service.
- Print preferences must be retained when edited and used as the service's configured values; cover every preference field.
- Canvas image loading or export failures must not be represented as successful edits; cover failed image load and canvas export behavior.

---

### Task 1: Make the prototype runnable and establish installation mode

**Files:**
- Create: `src/main.tsx`
- Modify: `src/context/StudioContext.tsx`
- Modify: `src/types.ts`
- Modify: `src/components/AppInstallationSetup.tsx`
- Modify: `src/App.tsx`
- Test: Run the project TypeScript check and Vite build.

**Interfaces:**
- Produce `InstallationMode = 'master' | 'counter'` and the installation mode/counter selection in the `StudioContext` API.
- `AppInstallationSetup` is shown until a valid mode is selected; counter mode also selects one of the configured counters.
- Store the prototype setup in `localStorage`; reject malformed or stale selections and show setup again.

- [ ] Add `src/main.tsx` to mount `<App />` within the existing CSS entry and React strict-mode convention.
- [ ] Make Shop POS the initial view and show a one-time master/counter setup before entering the app.
- [ ] Persist and restore validated setup; verify `npm run lint` and `npm run build`.

### Task 2: Add role-aware Studio Service Management

**Files:**
- Modify: `src/types.ts`
- Modify: `src/context/StudioContext.tsx`
- Modify: `src/components/WindowsAgentView.tsx`
- Test: Run `npm run lint` and manually verify service actions in both installation modes.

**Interfaces:**
- Use the existing `StudioService` and `ServicePrintingPreferences` types in `src/types.ts`.
- Add context actions to create, delete, toggle, and update a service's printing preferences.
- Keep the section in the existing Agent management view but name it “Studio Service Management”; expose mutation controls only in master mode.

- [ ] Move/define the initial studio-service catalogue in the shared context, preserving the existing default service options and prices.
- [ ] Implement create, delete, enable/disable, and preference updates (paper type, quality, color, paper size, DPI, copies, and borderless).
- [ ] Replace the current service activation/auto-approve manager UI with Studio Service Management and master-only controls.
- [ ] Verify every preference can be edited and retained; verify counter mode cannot invoke mutations and `npm run lint` passes.

### Task 3: Connect service configuration to customer ordering

**Files:**
- Modify: `src/context/StudioContext.tsx`
- Modify: `src/components/CustomerPwaView.tsx`
- Modify: `src/components/WindowsAgentView.tsx`
- Test: Run `npm run lint` and manually verify enabled services and configured preferences.

**Interfaces:**
- Customer choices consume the shared service catalogue and selected service's preferences.
- Job creation keeps the current `PrintJob` contract and routes using the chosen service and configured paper/color values.

- [ ] Show only enabled services in customer ordering, using their configured title and price.
- [ ] Apply configured service printing preferences when creating a job without overwriting explicit customer choices that the current flow supports.
- [ ] Verify disabled/deleted services cannot be newly ordered and existing jobs remain displayable; verify `npm run lint` passes.

### Task 4: Provide shared POS access and integrate the editor canvas

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ShopPosView.tsx`
- Modify: `src/components/StudioEditorCanvas.tsx`
- Modify: `src/context/StudioContext.tsx`
- Test: Run `npm run lint` and `npm run build`; manually verify POS and editor in master and counter modes.

**Interfaces:**
- Both installation modes enter the same Shop POS / Web Admin; master-only service management remains protected.
- Reuse `StudioEditorCanvas` for selected order files, saving the edited image and crop adjustments back to that order.

- [ ] Make the POS the app's default landing view while retaining navigation to the Agent and Customer views.
- [ ] Add an order-edit action in POS that opens the existing canvas editor for that job and saves changes through the context's order-edit action.
- [ ] Surface image-load and canvas-export failures instead of indicating a successful edit.
- [ ] Verify both modes can open POS and edit a supported image, and run `npm run lint` and `npm run build`.
