# Studio Editor Left Tool Bar + Right Sidebar Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Studio Image Editor's left tool palette (56 px grouped strip) and right sidebar (tabbed Layers / Props / History, 280 px) to the supplied design spec, and add real layer creation so the spec's "+ New Layer" button is functional.

**Architecture:** Pure-renderer refactor of `StudioWorkspaceChrome.tsx` + `StudioEditorCanvas.tsx` plus one data-model extension in `strokeModel.ts`: the single flat `strokes: Stroke[]` state becomes an ordered `ContentLayer[]` stack (paint layers + the existing text overlay), carried through the existing `EditorSnapshot` history. Tool behaviour, canvas rendering, adjustments and export paths are unchanged apart from reading per-layer strokes.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind v4 utility classes backed by CSS custom-property theme tokens in `resources/assets/index.css`, `node:test` unit tests via `npm run test:renderer`.

**Spec:** Left Tool Bar and Right Sidebar specifications supplied verbatim in the task prompt (reproduced in Appendix A). User decisions recorded in Appendix B.

## Global Constraints

- Renderer only: no Node/Electron APIs; no new dependencies; npm is the package manager.
- Never hardcode pure black/white panel backgrounds; use theme tokens (`bg-[var(--color-studio-panel)]`, `border-border-primary`, `bg-surface-hover`, `text-text-*`, `bg-brand`, `text-brand`).
- Do not add tools that do not exist: only `move, crop, brush, eraser, text, shape` are rendered; unimplemented spec entries (Select, Clone Stamp, Healing, Gradient, Eyedropper, Hand, Zoom) stay omitted.
- Keyboard shortcuts that exist today must keep working: `V, C, B, T, S, E` (+ `F7`, `F8`, Ctrl combos).
- Tool logic, image processing (`buildPhotoFilter`), export (`canvas.toDataURL`) and the `onSave` contract with `StudioPage` / `OrderCardModal` must not change.
- Adjustment ranges stay as implemented (`brightness/contrast 50–180 %`, `saturation 0–200 %`, `exposure −2..+2 EV`); the spec's `−100..+100` is not wired to this engine (Appendix B).
- No commits, pushes, packaging or signing — AGENTS.md §7 requires explicit authorisation. Only `git status`/`git diff` for review.
- Pre-existing uncommitted work in the tree must be preserved, never reverted.
- README.md must be updated for user-visible behaviour changes (AGENTS.md §16).

## Review Focus

- Painting/erasing still lands on the layer the operator sees selected, and undo/redo restores strokes per layer rather than flattening them — pinned by `updatePaintLayerStrokes` tests and a manual paint → create layer → undo check.
- Collapsing either panel leaves an operable thin handle on the correct canvas edge, and `F7`/`F8` work at every window width (previously gated to ≥1024 px) — pinned by manual check at 900 px window width.
- The 56 px rail never clips its right-side tooltip or the colour pair, and the active tool still reads as accent-on-25 %-opacity in both themes — visual check in light and dark.
- Layer rows keep visibility, lock and reorder working after the row gains selection and a meta line; clicking an action icon must not change the active layer — visual + click check.
- The editor still fits its 900 px minimum window inside `OrderCardModal` (max-w-6xl) with both panels open — layout check.

---

### Task 1: Content-layer stack model + history

**Files:**
- Modify: `src/features/studio-editor/strokeModel.ts`
- Modify: `src/features/studio-editor/studioAdjustments.ts` (`editorHistorySummary`)
- Modify: `src/shared/services/__tests__/studio-stroke-model.test.ts`
- Modify: `src/shared/services/__tests__/studio-editor-history.test.ts`
- Modify: `src/shared/services/__tests__/studio-adjustments.test.ts`

**Interfaces:**
- Consumes: existing `Stroke`, `EditorSnapshot`.
- Produces (used by Task 2):
  - `type ContentLayer = { id: string; kind: 'paint'; name: string; strokes: Stroke[] } | { id: 'text'; kind: 'text'; name: string }`
  - `const DEFAULT_PAINT_LAYER_ID = 'marks'`, `const TEXT_LAYER_ID = 'text'`
  - `createPaintLayer(id: string, name: string): ContentLayer`
  - `defaultContentLayerStack(): ContentLayer[]` → `[paint 'marks'/'Marks', text 'Watermark']`
  - `insertContentLayer(stack: ContentLayer[], index: number, layer: ContentLayer): ContentLayer[]`
  - `moveContentLayer(stack: ContentLayer[], id: string, direction: -1 | 1): ContentLayer[]`
  - `updatePaintLayerStrokes(stack: ContentLayer[], layerId: string, update: (strokes: Stroke[]) => Stroke[]): ContentLayer[]`
  - `nextPaintLayerName(stack: ContentLayer[]): string` → `Layer N` where N = paint-layer count + 1
  - `EditorSnapshot.strokes: Stroke[]` → `EditorSnapshot.contentLayers: ContentLayer[]`

- [ ] **Step 1: Write failing tests** in `studio-stroke-model.test.ts` (names below), plus fixture updates:
  - `createPaintLayer builds an empty paint layer with the given id and name`
  - `defaultContentLayerStack seeds Marks below the Watermark text layer`
  - `insertContentLayer splices without mutating the input stack`
  - `moveContentLayer swaps adjacent layers and no-ops at the ends or for unknown ids`
  - `updatePaintLayerStrokes rewrites only the addressed paint layer`
  - `nextPaintLayerName counts existing paint layers`
  - `studio-editor-history.test.ts` fixture: `strokes: []` → `contentLayers: defaultContentLayerStack()`
  - `studio-adjustments.test.ts` fixture: same replacement; `editorHistorySummary` "Marks" case passes `contentLayers: [createPaintLayer('marks', 'Marks') with one stroke]`
- [ ] **Step 2: Run tests, expect failure**
  Run: `npm run test:renderer` → FAIL (`ContentLayer` not exported / missing field).
- [ ] **Step 3: Implement** the type, constants and five helpers in `strokeModel.ts`; swap `EditorSnapshot.strokes` for `contentLayers`; update `editorHistorySummary` strokes check to `entry.contentLayers.some(l => l.kind === 'paint' && l.strokes.length > 0)`.
- [ ] **Step 4: Run tests, expect pass**
  Run: `npm run test:renderer` → PASS.

### Task 2: Wire `StudioEditorCanvas` to the layer stack

**Files:**
- Modify: `src/features/studio-editor/StudioEditorCanvas.tsx`

**Interfaces:**
- Consumes: Task 1 helpers; existing `commit`, `applySnapshot`, `eraseStrokes`, `addPoint`.
- Produces (used by Task 4): `contentLayers` state, `activeLayerId` state, `handleCreateLayer()`, `layerMeta` rows including `reorderable` flag.

- [ ] **Step 1: Replace strokes state** — `strokes`/`strokesRef` → `contentLayers` (ref + sync effect), `activeLayerId` (default `DEFAULT_PAINT_LAYER_ID`); delete `overlayOrder`; type `layerVisible`/`layerLocked` as `Record<string, boolean>` with unchanged initial keys, add `isLayerVisible(id)` (default `true`) / `isLayerLocked(id)` (default `false`).
- [ ] **Step 2: Update read/write paths**
  - `makeSeed`/`snapshot`/`applySnapshot` carry `contentLayers`; `applySnapshot` also keeps `activeLayerId` valid (fall back to first paint layer).
  - `canPaint(toolId)` = existing tool check **and** active layer is `'paint'` **and** `!isLayerLocked(activeLayerId)`.
  - `writeActiveLayer(update)` helper for pointer-down/move/erase; `handleReset`/`loadImage` drop their manual stroke resets (seed handles it).
  - Render loop: `for (const layer of contentLayers) { if (!isLayerVisible(layer.id)) continue; layer.kind === 'paint' ? drawStrokes(layer.strokes) : drawText(); }`; effect deps swap `strokes` → `contentLayers`.
  - `moveLayer` → `moveContentLayer`; `layerMeta` → built from `contentLayers` + photo/adjust rows with `reorderable`.
- [ ] **Step 3: Add selection + creation**
  - `handleCreateLayer()` = `createPaintLayer` → `insertContentLayer` at `activeLayerIndex + 1` → `commit({ contentLayers }, 'New layer')` → `setActiveLayerId`.
  - Row click sets `activeLayerId`.
- [ ] **Step 4: Verify**
  Run: `npm run lint` → PASS (type-level proof the old `strokes` references are gone).

### Task 3: Left tool bar per spec

**Files:**
- Modify: `src/features/studio-editor/StudioWorkspaceChrome.tsx`
- Modify: `src/features/studio-editor/StudioEditorCanvas.tsx` (single rail call site + left edge handle)

**Interfaces:**
- Produces: `StudioToolRail` without `orientation`/`className` props beyond `className` (always vertical, `w-14`, `py-2`, `border-r`, `bg-[var(--color-studio-panel)]`); `STUDIO_TOOL_GROUPS` order: Selection / Transform (`move` V, `crop` C) → Painting (`brush` B, `eraser` E) → Objects (`text` T, `shape` S); Utility group omitted (no tools exist).

- [ ] **Step 1: Restyle group data** — group labels per spec; objects order `text, shape`; icon size `h-[17px] w-[17px]`; `h-1`/`w-7` divider between groups (`aria-hidden`).
- [ ] **Step 2: Restyle button** — `h-10 w-10 rounded-lg`; default `text-text-tertiary`; hover `bg-surface-hover text-text-primary`; active `bg-brand/25 text-brand`; drop corner shortcut badge; replace `title` with right-side tooltip span rendering `` `${label} (${shortcut})` `` (`group/btn`, `opacity-0 group-hover/btn:opacity-100`, `left-full ml-2`, panel bg + border + shadow), keep `aria-label` = `Label (Shortcut)`.
- [ ] **Step 3: Colour pair** — `mt-auto` block: relative 32 px box with two `h-5 w-5` squares (foreground `left-0 top-0 z-10`, background `bottom-0 right-0`, existing `<input type="color">` labels) + existing swap button beneath.
- [ ] **Step 4: Collapse + handle in canvas** — render the rail whenever `showToolRail` (all widths; horizontal rail call site deleted); when collapsed render a thin left-edge handle in the canvas `<section>` (`absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-20 rounded-r-md border border-l-0 …`, `ChevronRight`, label "Show tool palette (F8)").
- [ ] **Step 5: Verify visually** — `npm run dev`, check rail geometry/tooltip/active state in light + dark; screenshot to `tmp/`.
  Run: `npm run lint` → PASS.

### Task 4: Right sidebar per spec

**Files:**
- Modify: `src/features/studio-editor/StudioEditorCanvas.tsx`
- Modify: `README.md`

- [ ] **Step 1: Tab bar** — `h-10`, three `flex-1` tabs, active `text-brand` + `absolute inset-x-3 bottom-0 h-0.5 bg-brand` underline, inactive `text-text-tertiary hover:bg-surface-hover`; single `<aside w-[280px] border-l bg-[var(--color-studio-panel)]>` rendered whenever `showRightPanel` (drawer, `useIsDesktop`, `mobilePanelOpen`, `isDesktop` gates and the options-bar "Show panels" button removed); thin right-edge handle when collapsed (`ChevronLeft`); `F7`/`F8` no longer gated by width.
- [ ] **Step 2: Layers tab** — flex column: scrollable rows + fixed footer. Row = 36×36 icon thumbnail, name + `Normal • 100%` meta, reorder arrows (existing behaviour, kept per Appendix B), eye, lock; active row `bg-brand/15 border-brand/40`, hover `bg-surface-hover`; action clicks `stopPropagation`. Footer = full-width dashed "+ New Layer" (`border-dashed border-border-primary text-text-tertiary`, hover `border-brand text-brand`) calling `handleCreateLayer`. Navigator section and `navigatorRef` effect deleted.
- [ ] **Step 3: Props tab** — order: **Adjustments** (new `AdjustmentRow`: label | range | live value), **Text Options** only when `tool === 'text'` (font select, font-size `<input type="number">` committing on blur, `ColorPickerRow` also reused by the options bar, alignment buttons), then existing Background section; `PanelSection` titles `Adjustments` / `Text Options`, heading colour muted (`text-text-tertiary`).
- [ ] **Step 4: History tab** — drop the section wrapper; `ol` of steps (muted step number + action name), current step `bg-brand/15 text-brand`, click = existing jump; keep Undo/Redo footer.
- [ ] **Step 5: README** — update the Studio section: grouped 56 px palette, tabbed 280 px sidebar with edge handles, real "+ New Layer"; delete the narrow-window drawer/bottom-toolbar sentence.
- [ ] **Step 6: Verify**
  Run: `npm run lint`, `npm run test:renderer`, `npm run build` → all PASS; visual pass (light + dark, 900 px width) with screenshots in `tmp/`.

---

## Appendix A — Spec (verbatim)

See the task prompt: "Refactor Left Tool Bar (Tool Palette)" (56 px strip, four groups with 28 px dividers, 40×40 buttons, right-side `Tool (Shortcut)` tooltip, FG/BG swatch pair, collapse behaviour, theme tokens) and "Refactor Right Sidebar" (280 px, Layers/Props/History tabs with 2 px accent underline, layer rows with 36×36 thumbnail + meta + eye/lock, dashed "+ New Layer", ADJUSTMENTS/TEXT OPTIONS sections, numbered history list, edge handle when collapsed).

## Appendix B — Recorded decisions

1. **"+ New Layer" is real** (user choice): a `ContentLayer` paint-layer stack replaces the flat strokes array; the button inserts and activates a new layer, and creation is undoable.
2. **Keep extras, drop Navigator** (user choice): reorder arrows, Scale slider, filters, Background removal stay; Navigator preview removed.
3. **Omitted spec entries with no data model:** Select marquee, Clone Stamp, Healing Brush, Gradient, Eyedropper, Hand, Zoom tools; layer blend modes/opacity (meta line renders the always-true `Normal • 100%`); adjustment ranges stay engine-bound.
4. **Responsive split removed:** the mobile bottom rail and right-panel drawer are replaced by the always-present collapsible rails, because the spec mandates the vertical strip and edge handles at every width (minimum supported window is 900 px).
