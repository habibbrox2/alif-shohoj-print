# Studio Image Editor Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a modern, organized, desktop-first Studio workspace for counter operators to edit customer order images and local computer images, preview print output, and continue into the existing print-job workflow without switching applications for common tasks.

**Architecture:** Preserve the existing React + TypeScript + Vite renderer and Electron security architecture. Refactor `StudioEditorCanvas` into a focused tool-rail + canvas + properties-panel layout, extract pure image/dimension helpers into a testable module, and keep the `onSave` contract with `StudioPage` intact. Non-destructive edits use a snapshot-based history model; canvas rendering stays in one effect driven by typed state.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind tokens (existing `--color-*` design system), Lucide icons, Electron preload bridge (`window.alifShohojPrintDesktop`), Node test runner for renderer tests.

**Spec:** `docs/superpowers/plans/2026-10-11-studio-image-editor-ui.md` (this document's design sections below argue from the product requirements captured in Workspace Layout, Print-Shop Features, and Visual Design System).

## Global Constraints

- Renderer must not access Node.js or Electron APIs directly; use the typed desktop bridge in `src/shared/desktop-api.ts` and `electron/preload.cjs`.
- Keep `onSave(editedImageUrl: string, adjustments: StudioCanvasAdjustments)` signature unchanged so `StudioPage` keeps working; `StudioCanvasAdjustments` = `{ rotation, zoom, brightness, contrast, grayscale, cropPreset }`.
- Use existing Tailwind/CSS tokens (`--color-brand`, `--color-surface`, `--color-bg-*`, `--color-text-*`) and Lucide icons; do not add a competing design system or new dependencies.
- Package manager is npm; do not regenerate or delete lockfiles.
- Show only controls that are functional; never display a capability that does not work.
- Do not overwrite original order uploads or local files; edits produce a separate in-memory output.
- Validate file type/size at the boundary: only `image/jpeg|png|webp|bmp|tiff`, max 50 MB.
- Default crop preset IDs are `free | passport | stamp | nid | 4r | a4` with sizes free=auto, passport=413×531, stamp=250×300, nid=590×375, 4r=600×400, a4=496×701.
- Bengali is the default UI language; use the existing i18n system where labels already exist, keep new tool labels short.
- `npm run test:renderer` currently runs only `src/shared/services/__tests__/renderer.test.ts` (not a glob). Any new test file must be appended to that script's file list in `package.json`, or it will never run.
- Renderer typecheck is `npm run lint` (`tsc --noEmit -p tsconfig.json`).
- Do not claim real-printer validation unless tested on physical hardware.

## Review Focus

These are the failure modes most likely to bite a user; each has a owning task with a test that pins it.

- **Stale-closure erasing strokes:** mutating a stroke's points in place then committing a stale `strokes` array silently erases the mark. Expect drawing to persist after pointerup. → Task 3 test.
- **Undo/redo restoring wrong state:** commit/undo must restore exact snapshots including strokes, not drop or duplicate them. → Task 4 test.
- **Crop preset dimension drift:** preset IDs must map to the exact pixel sizes above and drive canvas dimensions. → Task 1 test.
- **File validation bypass:** wrong MIME type or oversized file must be rejected before decode. → Task 2 test.
- **Eraser hitting wrong strokes:** eraser radius must remove only strokes within range and be undoable. → Task 3 test.

---

### Task 1: Crop preset + dimension helpers (pure module)

**Files:**
- Create: `src/features/studio-editor/cropPresets.ts`
- Create: `src/shared/services/__tests__/studio-crop.test.ts`
- Modify: `package.json` (append the new test file to `scripts.test:renderer`)

**Interfaces:**
- Produces: `type CropPreset = 'free' | 'passport' | 'stamp' | 'nid' | '4r' | 'a4'`; `const CROP_PRESETS: ReadonlyArray<{ id: CropPreset; label: string; note: string }>`; `const CROP_SIZE: Record<CropPreset, { w: number; h: number } | null>` (null = auto from image); `function resolveCanvasSize(preset: CropPreset, naturalW: number, naturalH: number): { w: number; h: number }`; `function getInitialCropPreset(aspectRatio?: string): CropPreset`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { CROP_SIZE, getInitialCropPreset, resolveCanvasSize } from '../../../features/studio-editor/cropPresets.js';

test('crop presets map to exact pixel sizes', () => {
  assert.deepEqual(CROP_SIZE.passport, { w: 413, h: 531 });
  assert.deepEqual(CROP_SIZE.stamp, { w: 250, h: 300 });
  assert.deepEqual(CROP_SIZE.nid, { w: 590, h: 375 });
  assert.deepEqual(CROP_SIZE['4r'], { w: 600, h: 400 });
  assert.deepEqual(CROP_SIZE.a4, { w: 496, h: 701 });
  assert.equal(CROP_SIZE.free, null);
});

test('resolveCanvasSize clamps auto size to 800 and honours presets', () => {
  assert.deepEqual(resolveCanvasSize('passport', 1000, 1000), { w: 413, h: 531 });
  assert.deepEqual(resolveCanvasSize('free', 1200, 900), { w: 800, h: 800 });
  assert.deepEqual(resolveCanvasSize('free', 0, 0), { w: 600, h: 600 });
});

test('getInitialCropPreset matches known aspect ratios and defaults to free', () => {
  assert.equal(getInitialCropPreset('passport'), 'passport');
  assert.equal(getInitialCropPreset('NID'), 'nid');
  assert.equal(getInitialCropPreset('4r'), '4r');
  assert.equal(getInitialCropPreset('unknown'), 'free');
  assert.equal(getInitialCropPreset(undefined), 'free');
});
```

- [ ] **Step 2: Register the test file in `package.json`**

Append `src/shared/services/__tests__/studio-crop.test.ts` to the `scripts.test:renderer` file list (space-separated after `tsx --test`). Without this the file is never executed.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:renderer`
Expected: FAIL — module `cropPresets` not found.

- [ ] **Step 4: Implement helpers in `src/features/studio-editor/cropPresets.ts`**

Export the exact types/constants/signatures above. `resolveCanvasSize` returns `CROP_SIZE[preset]` when non-null; otherwise clamps `naturalW/naturalH` to max 800 with 600×600 fallback when either is 0.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:renderer`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/studio-editor/cropPresets.ts src/shared/services/__tests__/studio-crop.test.ts package.json
git commit -m "feat(studio): add crop preset dimension helpers with tests"
```

---

### Task 2: File validation helper

**Files:**
- Create: `src/features/studio-editor/validateImageFile.ts`
- Create: `src/shared/services/__tests__/studio-file-validation.test.ts`
- Modify: `package.json` (append to `scripts.test:renderer`)

**Interfaces:**
- Produces: `const ACCEPTED_IMAGE_TYPES: readonly string[]`; `const MAX_IMAGE_BYTES = 50 * 1024 * 1024`; `function validateImageFile(file: { type: string; size: number }): { ok: true } | { ok: false; reason: string }` (Bengali `reason` strings matching current UI copy: invalid type → `অবৈধ ফাইল টাইপ। শুধু ছবি ফাইল (JPG, PNG, WebP, BMP, TIFF) গ্রহণযোগ্য।`, too large → `ফাইল আকার খুব বড়। সর্বোচ্চ ৫০ MB অনুমোদিত।`).

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_IMAGE_BYTES, validateImageFile } from '../../../features/studio-editor/validateImageFile.js';

test('accepts a valid image within the size limit', () => {
  assert.deepEqual(validateImageFile({ type: 'image/png', size: 1024 }), { ok: true });
});

test('rejects an unsupported type', () => {
  const result = validateImageFile({ type: 'application/pdf', size: 1024 });
  assert.equal(result.ok, false);
});

test('rejects an oversized image', () => {
  const result = validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 });
  assert.equal(result.ok, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:renderer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `validateImageFile` in `src/features/studio-editor/validateImageFile.ts`**

Check `ACCEPTED_IMAGE_TYPES.includes(file.type)` first, then `file.size <= MAX_IMAGE_BYTES`. Return the exact Bengali reason strings pinned above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/studio-editor/validateImageFile.ts src/shared/services/__tests__/studio-file-validation.test.ts
git commit -m "feat(studio): extract image file validation with tests"
```

---

### Task 3: Stroke model + history core (pure functions)

**Files:**
- Create: `src/features/studio-editor/strokeModel.ts`
- Create: `src/shared/services/__tests__/studio-stroke-model.test.ts`
- Modify: `package.json` (append to `scripts.test:renderer`)

**Interfaces:**
- Produces: `interface Stroke { id: string; kind: 'brush' | 'shape'; shape?: 'rect' | 'ellipse'; points: Array<{ x: number; y: number }>; color: string; size: number; opacity: number }`; `function createStroke(input: Omit<Stroke, 'id'> & { id?: string }): Stroke`; `function addPoint(stroke: Stroke, point: { x: number; y: number }): Stroke` (returns a NEW stroke, never mutates); `function eraseStrokes(strokes: readonly Stroke[], point: { x: number; y: number }, radius: number): Stroke[]`; `function distanceToStroke(stroke: Stroke, point: { x: number; y: number }): number`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { addPoint, createStroke, distanceToStroke, eraseStrokes } from '../../../features/studio-editor/strokeModel.js';

const stroke = (points: Array<{ x: number; y: number }>) =>
  createStroke({ kind: 'brush', points, color: '#14b8a6', size: 8, opacity: 100 });

test('addPoint returns a new stroke and never mutates the input', () => {
  const original = stroke([{ x: 0, y: 0 }]);
  const updated = addPoint(original, { x: 1, y: 1 });
  assert.equal(original.points.length, 1, 'original must stay untouched');
  assert.equal(updated.points.length, 2);
  assert.notEqual(updated, original);
});

test('eraseStrokes removes only strokes within the radius', () => {
  const near = stroke([{ x: 0.5, y: 0.5 }]);
  const far = stroke([{ x: 0.1, y: 0.1 }]);
  const remaining = eraseStrokes([near, far], { x: 0.5, y: 0.5 }, 0.05);
  assert.deepEqual(remaining, [far]);
});

test('distanceToStroke reports the closest point distance', () => {
  assert.equal(distanceToStroke(stroke([{ x: 0.2, y: 0.2 }]), { x: 0.2, y: 0.3 }), 0.1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:renderer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/features/studio-editor/strokeModel.ts`**

`addPoint` spreads `points` into a new array and returns a new object — this is the fix for the stale-closure erasure bug (Review Focus #1). `eraseStrokes` filters strokes whose `distanceToStroke` is `<= radius`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/studio-editor/strokeModel.ts src/shared/services/__tests__/studio-stroke-model.test.ts
git commit -m "feat(studio): add immutable stroke model with erase + distance helpers"
```

---

### Task 4: History snapshot store (pure functions)

**Files:**
- Create: `src/features/studio-editor/editorHistory.ts`
- Create: `src/shared/services/__tests__/studio-editor-history.test.ts`
- Modify: `package.json` (append to `scripts.test:renderer`)

**Interfaces:**
- Consumes: `Stroke` from Task 3.
- Produces: `interface EditorSnapshot { rotation: number; zoom: number; brightness: number; contrast: number; grayscale: boolean; activeFilter: 'none' | 'clean_white' | 'passport_blue' | 'high_sharp' | 'bw_doc'; cropPreset: CropPreset; annotationText: string; showWatermark: boolean; textColor: string; strokes: Stroke[]; showBgRemoved: boolean }` (imports `CropPreset` from Task 1); `function pushHistory(history: readonly EditorSnapshot[], index: number, next: EditorSnapshot, limit?: number): { history: EditorSnapshot[]; index: number }`; `function undo(history: readonly EditorSnapshot[], index: number): { history: EditorSnapshot[]; index: number } | null`; `function redo(history: readonly EditorSnapshot[], index: number): { history: EditorSnapshot[]; index: number } | null`; `const HISTORY_LIMIT = 50`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { HISTORY_LIMIT, pushHistory, redo, undo } from '../../../features/studio-editor/editorHistory.js';

const snap = (n: number) => ({
  rotation: n, zoom: 1, brightness: 100, contrast: 100, grayscale: false,
  activeFilter: 'none', cropPreset: 'free', annotationText: '', showWatermark: false,
  textColor: '#fff', strokes: [], showBgRemoved: false,
});

test('pushHistory truncates any redo tail before appending', () => {
  const { history, index } = pushHistory([snap(0), snap(1), snap(2)], 1, snap(9));
  assert.equal(index, 2);
  assert.equal(history.length, 3);
  assert.equal(history[2].rotation, 9);
});

test('undo and redo move the index and are null at the ends', () => {
  const seeded = pushHistory([snap(0)], 0, snap(1));
  assert.equal(undo(seeded.history, 1)?.index, 0);
  assert.equal(undo(seeded.history, 0), null);
  assert.equal(redo(seeded.history, 0)?.index, 1);
  assert.equal(redo(seeded.history, 1), null);
});

test('history never exceeds HISTORY_LIMIT', () => {
  let state = { history: [snap(0)], index: 0 };
  for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) state = pushHistory(state.history, state.index, snap(i));
  assert.equal(state.history.length, HISTORY_LIMIT);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:renderer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/features/studio-editor/editorHistory.ts`**

`pushHistory` slices `history.slice(0, index + 1)`, appends `next`, then caps to `HISTORY_LIMIT` and recomputes `index` as `min(appendedLength - 1, HISTORY_LIMIT - 1)`. `undo`/`redo` return `null` when out of range.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/studio-editor/editorHistory.ts src/shared/services/__tests__/studio-editor-history.test.ts
git commit -m "feat(studio): add snapshot history store with undo/redo and size cap"
```

---

### Task 5: Rewire `StudioEditorCanvas` to the new workspace layout + pure helpers

**Files:**
- Modify: `src/features/studio-editor/StudioEditorCanvas.tsx` (full component rewrite of the render section and state wiring; keep props and `onSave` call site identical)
- Modify: `src/index.css` (append `.studio-range` slider styling)

**Interfaces:**
- Consumes: `cropPresets` (Task 1), `validateImageFile` (Task 2), `strokeModel` (Task 3), `editorHistory` (Task 4).
- Produces: unchanged `StudioEditorCanvas` props `{ initialImageUrl?, job?, onSave?, onClose? }`.

- [ ] **Step 1: Replace the render body with the four-region layout**

Top action bar (`Open`, `Undo`, `Redo`, title, `Export`, `Reset`, settings, `Save`), left tool rail (`move|crop|brush|text|shape|eraser` + zoom), center canvas stage with bottom-right zoom pill and quiet status strip, right panel with collapsible `Properties` / `Adjustments` / `Background` / `Layers` / `History` sections. Each section owns its own `useState` open flag (do not share one flag across sections).

- [ ] **Step 2: Wire stroke/erase through `strokeModel` — never mutate in place**

In `handlePointerMove`, call `addPoint` and `setStrokes` with the returned array. In `eraseAt`, call `eraseStrokes` and set the result. Keep a `strokesRef` synced by effect so `snapshot()` reads current strokes, and commit with `commit({})` on pointerup rather than a stale closure array.

- [ ] **Step 3: Wire history through `editorHistory`**

Back `commit`/`undo`/`redo` with `pushHistory`/`undo`/`redo` from Task 4 instead of inline array slicing.

- [ ] **Step 4: Route file-open validation through `validateImageFile`**

Use its Bengali reason strings for the error state.

- [ ] **Step 5: Append `.studio-range` styles to `src/index.css`**

Thumb styled with `var(--color-brand)`, track `var(--color-bg-tertiary)`, hover scale, plus `-moz-range-thumb` equivalent.

- [ ] **Step 6: Run typecheck and renderer tests**

Run: `npm run lint && npm run test:renderer`
Expected: both PASS; no new TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/studio-editor/StudioEditorCanvas.tsx src/index.css
git commit -m "feat(studio): rework editor into tool-rail workspace using pure helpers"
```

---

### Task 6: Verify in the running app and update README

**Files:**
- Modify: `README.md` (Studio editor feature note, only if current text is now inaccurate)

- [ ] **Step 1: Build and manually verify the editor in the desktop shell**

Run: `npm run build`, then `npm run dev`, open Studio, load an order image. Confirm: tool switching updates Properties; brush/shape draw and persist; eraser removes marks; undo/redo restore exactly; crop presets resize the canvas; zoom pill and pan work; Save returns to the picker with a job created only on explicit confirm.

- [ ] **Step 2: Update README if the documented Studio behavior is now incomplete**

Keep the edit focused on the verified current behavior; do not document planned features.

- [ ] **Step 3: Run the full verification suite**

Run: `npm run verify`
Expected: PASS, or report any failure truthfully.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: reflect Studio editor workspace behavior"
```

---

## Validation Checklist

- [ ] `npm run lint`
- [ ] `npm run test:renderer` (includes new studio-crop, studio-file-validation, studio-stroke-model, studio-editor-history tests)
- [ ] `npm run build`
- [ ] Electron file dialog and export paths verified through the approved bridge
- [ ] Desktop layout inspected at typical and narrow window sizes
- [ ] Unsaved edits are not silently discarded
- [ ] Original order/local files remain unchanged
- [ ] Print preview dimensions and printer capability checks
- [ ] No real-printer claim unless tested on physical hardware

## Out of Scope

- Replacing the app architecture or adding a second editing engine.
- Unrestricted filesystem access from the renderer.
- Automatic background removal or AI features beyond the existing `@imgly/background-removal` integration.
- Installer signing, packaging, release, commit, push, or deployment.

## Definition of Done

The workspace is visually organized, all visible primary controls are functional, original files remain safe, print dimensions are explicit, order/walk-in behavior is predictable, the new focused tests pass, relevant checks pass, and the final report lists changed files and actual validation results.

---

## Addendum (2026-10-12): Photoshop-style workspace layout v2

This addendum expands Task 5 into the fuller desktop-editor layout requested by the shop owner. It was implemented after the original five tasks.

**Goal:** Give the operator a familiar photo-editor workspace — a menu bar, a context-sensitive options bar, a grouped left tool palette with foreground/background colors, a centre canvas with view aids, a tabbed right panel (Layers / Adjust / History) with a Navigator, and a bottom status bar — while remaining responsive on narrow windows.

**Delivered files:**
- Create `src/features/studio-editor/studioTypes.ts` — shared `ToolId`, `EditorFilter`, `TextAlign`, `OverlayLayerId`, `StudioCanvasAdjustments` types.
- Create `src/features/studio-editor/studioAdjustments.ts` — `ADJUSTMENT_RANGES`, `clampAdjustment`, `buildPhotoFilter`, `editorHistorySummary`, `buildRulerTicks`.
- Create `src/features/studio-editor/StudioWorkspaceChrome.tsx` — `StudioMenuBar`, `StudioToolRail` (+ `STUDIO_TOOL_GROUPS`), `StudioStatusBar`.
- Modify `src/features/studio-editor/StudioEditorCanvas.tsx` — full layout rewrite.
- Modify `src/features/studio-editor/strokeModel.ts` — `EditorSnapshot` gains `saturation`, `textSize`, `textAlign`, `backgroundColor`; `activeFilter` now uses the shared `EditorFilter` type.
- Create `src/shared/services/__tests__/studio-adjustments.test.ts`; modify `package.json` to run it.
- Modify `README.md` — Studio workspace description.

**Layout regions (verified in code):**
- Menu bar: File, Edit, Image, Layer, Filter, View, Help — every item maps to an existing action.
- Options bar: context-sensitive per tool (crop presets + rotate, brush size/opacity/colour, shape kind, eraser size, watermark text/size/align/colour).
- Left tool palette: grouped (Navigate, Transform, Paint, Draw) with shortcut badges, plus foreground/background colour control (foreground = brush/stroke colour, background = canvas fill, swap supported).
- Canvas: zoom/pan, transparency checkerboard, toggleable pixel grid and rulers, Navigator preview, zoom pill / fit controls.
- Right panel: Layers (with Navigator), Adjust (brightness, contrast, saturation, scale, filters, grayscale, background removal), History (clickable list + undo/redo).
- Status bar: tool, zoom %, canvas size, cursor X/Y, rotation, file size, document label.
- Responsive: below `lg`, the tool palette becomes a bottom toolbar and the right panel becomes a slide-in drawer; a first-open tips card is stored in `localStorage`.

**Not implemented (deliberately):** a Channels panel (no channel data model exists) — showing a non-functional Channels tab would violate the "no dead controls" constraint.

- [x] Pure helpers + tests (`buildPhotoFilter`, `clampAdjustment`, `buildRulerTicks`, `editorHistorySummary`)
- [x] `npm run lint` (tsc) passes
- [x] `npm run test:renderer` passes (86 tests, +6 new)
- [x] `npm run build` passes
- [ ] Manual desktop + narrow-window inspection in the running shell (not performed in this session)
- [ ] Electron file-dialog / export path re-check (unchanged code path)

