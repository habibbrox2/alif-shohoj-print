# Studio Tools — Adobe Photoshop 7 Behavior Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (no subagent tool in this session — execute inline, per task, verifying each).

**Goal:** Add Photoshop-7-style selection, navigation, and tonal tools to the Studio
editor **without changing the existing tool rail, its icons, or its shortcut
bindings**. New tools live in a hidden "extended palette" surfaced by the existing
`More (⋯)` overflow menu and by keyboard shortcuts that do not collide with the
existing `V/C/B/T/S/E` single-key bindings.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind tokens, `@imgly/background-removal`
(existing), no new npm dependencies.

**Spec:** `docs/superpowers/plans/2026-10-11-studio-image-editor-ui.md`
Global Constraints, plus the shop owner's request: control and behavior must match
Adobe Photoshop 7.

## Global Constraints

- Renderer never touches Node/Electron directly; use `window.alifShohojPrintDesktop`.
- npm is canonical; do not add dependencies without reason.
- Do not modify `StudioWorkspaceChrome.tsx` tool groups, `ToolId`, or shortcut keys.
- Show only functional controls; no dead buttons.
- Original order/local files are never overwritten.
- Bengali is the default UI language; new labels short.
- `npm run test:renderer` runs a fixed file list — append new tests to `package.json`.

## Review Focus

- **Selection persistence:** a marquee survives tool switches and is rendered.
- **Magic Wand:** connected-component flood fill, tolerance in 0–100.
- **Clone Stamp:** sampled pixel offset, no drift across strokes.
- **History integrity:** new tools participate in undo/redo; no stale closures.
- **Zoom-aware cursors:** brush/eraser/clone diameter follows view zoom.

---

### Task 1: Selection model + Marquee tool

**Files:** create `src/features/studio-editor/selectionModel.ts`,
`src/shared/services/__tests__/studio-selection.test.ts`; modify `package.json`.

**Interfaces:** `type SelectionMode = 'rect' | 'ellipse' | 'single'`;
`interface Selection { id; mode; start; end; feather; antiAlias }`;
`function normalizeSelection(s)`; `function selectionBounds(s)`; `function hitTestSelection(s, point)`; `function rasterizeSelectionToCanvas(ctx, s, fill)`.

- [x] Write failing test.
- [x] Implement `selectionModel.ts`.
- [x] Register test in `package.json`.
- [x] Run `npm run test:renderer`.

---

### Task 2: Magic Wand (flood fill)

**Files:** create `src/features/studio-editor/magicWand.ts`,
`src/shared/services/__tests__/studio-magicwand.test.ts`; modify `package.json`.

**Interfaces:** `function floodFill(canvas, seed, tolerance)` returning `Uint8Array` mask;
`function maskToSelection(mask, w, h)`.

- [x] Write failing test (tolerance 0 exact, 50 range, 100 all).
- [x] Implement.
- [x] Register test.
- [x] Run tests.

---

### Task 3: Clone Stamp + Healing Brush

**Files:** create `src/features/studio-editor/cloneStamp.ts`,
`src/shared/services/__tests__/studio-clonestamp.test.ts`; modify `package.json`.

**Interfaces:** `function sampleOffset(stroke, samplePoint)`; `function drawClonedStroke(ctx, srcCanvas, stroke, offset, opacity)`.

- [x] Write failing test (offset stability).
- [x] Implement.
- [x] Register test.
- [x] Run tests.

---

### Task 4: Dodge / Burn / Sponge

**Files:** create `src/features/studio-editor/tonalTools.ts`,
`src/shared/services/__tests__/studio-tonal.test.ts`; modify `package.json`.

**Interfaces:** `function applyTonalAdjustment(canvas, mode, exposure, range, midtone)`.

- [x] Write failing test.
- [x] Implement.
- [x] Register test.
- [x] Run tests.

---

### Task 5: Wire extended tools into `StudioEditorCanvas`

**Files:** modify `src/features/studio-editor/StudioEditorCanvas.tsx`.

- [x] Add hidden state for extended tools; render nothing in the tool rail.
- [x] Add `More (⋯)` menu items: Marquee, Magic Wand, Clone Stamp, Healing Brush,
      Dodge, Burn, Sponge.
- [x] Add non-colliding shortcuts: `Shift+M`, `Shift+W`, `Alt`-sample for Clone.
- [x] Wire `commit` so extended-tool edits are undoable.
- [x] Run `npm run lint` + `npm run test:renderer`.

---

### Task 6: Verify + README

- [x] `npm run verify`.
- [x] Update `README.md` if Studio behavior changed.