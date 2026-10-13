# Studio Editor Left Tool Bar + Right Sidebar Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Studio Image Editor's left tool palette (56 px grouped strip) and right sidebar (tabbed Layers / Props / History, 280 px) to the supplied design spec, and add real layer creation so the spec's "+ New Layer" button is functional.

**Architecture:** Pure-renderer refactor of `StudioWorkspaceChrome.tsx` + `StudioEditorCanvas.tsx` plus one data-model extension in `strokeModel.ts`: the single flat `strokes: Stroke[]` state becomes an ordered `ContentLayer[]` stack (paint layers + the existing text overlay), carried through the existing `EditorSnapshot` history. Tool behaviour, canvas rendering, adjustments and export paths are unchanged apart from reading per-layer strokes.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind v4 utility classes backed by CSS custom-property theme tokens in `resources/assets/index.css`, `node:test` unit tests via `npm run test:renderer`.

**Extension (2026-10-12):** Tasks 5–6 add the Print Settings sub-window per the follow-up "Add Print Dialog / Print Settings Sub-Window" spec, in this same workspace so both features' edits to `StudioEditorCanvas.tsx` stay serialized. Research findings that shape them: the only print backend is the desktop PrintJob queue (`StudioContext.approveJob` → `desktop.saveJob` + `desktop.printJob` → `electron/services/print-service.ts`, pdf-to-printer, `scale: 'fit'`); `PrintService` honours `job.paperSize` but never orientation or margins; Electron exposes no native OS page-setup dialog; `StudioEditorCanvasProps.onPrint`/`onPrintPreview` are dead props no caller passes; `cropPresets.ts` establishes 300 DPI as the repo's document-resolution convention; paper dimensions come from `STANDARD_PAPER_SPECS`.

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
  - **Remove the Scale slider (user directive, 2026-10-12):** delete the `<Slider label="Scale" …onChange={value => commit({ zoom: value }, 'Scale')} />` line currently at `StudioEditorCanvas.tsx:1434` — the Adjustments section must contain exactly the four spec sliders (Brightness, Contrast, Saturation, Exposure) plus the filter chips. **Keep** the `scale`/`setScale` state and `ADJUSTMENT_RANGES.scale`: `scale` still drives rendering (`ctx.scale(scale, scale)` ~`:524`), the adjustments/history object (`zoom: scale` ~`:378`) and the `onSave` contract (`zoom: scale` ~`:851`); only the UI control disappears. Do not remove the now-unreachable `'Scale'` history label handling (generic).
- [ ] **Step 4: History tab** — drop the section wrapper; `ol` of steps (muted step number + action name), current step `bg-brand/15 text-brand`, click = existing jump; keep Undo/Redo footer.
- [ ] **Step 5: README** — update the Studio section: grouped 56 px palette, tabbed 280 px sidebar with edge handles, real "+ New Layer"; delete the narrow-window drawer/bottom-toolbar sentence.
- [ ] **Step 6: Verify**
  Run: `npm run lint`, `npm run test:renderer`, `npm run build` → all PASS; visual pass (light + dark, 900 px width) with screenshots in `tmp/`.

---

### Task 5: Print settings model + layout math (pure)

Create the tested, UI-free foundation for the Print Settings dialog. No visual work in this task.

**Files:**
- Create: `src/features/studio-editor/printSettings.ts`
- Create: `src/shared/services/__tests__/studio-print-settings.test.ts`
- Modify: `package.json` — append the new test file to the `test:renderer` script list (deliberate, task-related, reported; no dependency changes)

**Interfaces:**
- Consumes: `PaperSize` union (`src/shared/types.ts`); paper dimensions from `STANDARD_PAPER_SPECS` (`src/features/printers/drivers/PrinterCapabilitiesRegistry.ts`) — verify the exact export shape first; derive inches as `mm ÷ 25.4` if inch fields are absent; exclude `'Custom'` from any paper-choice list (the print service throws on it).
- Produces (Task 6 consumes verbatim):
  - `interface PrintSettings { paperSize: PaperSize; orientation: 'portrait' | 'landscape'; marginIn: number; centerImage: boolean; topIn: number; leftIn: number; scalePercent: number; scaleToFit: boolean; showBoundingBox: boolean }`
  - `DEFAULT_PRINT_SETTINGS = { paperSize: 'A4', orientation: 'portrait', marginIn: 0.25, centerImage: true, topIn: 0, leftIn: 0, scalePercent: 100, scaleToFit: false, showBoundingBox: true }`
  - `PRINT_SETTINGS_STORAGE_KEY = 'alif-shohoj-print-studio-print-settings'`
  - `loadPrintSettings(): PrintSettings` — merge stored JSON over defaults, clamp every numeric field, return defaults when storage is unavailable or corrupt; must be node-test safe (guard on `globalThis.localStorage`, no DOM import)
  - `savePrintSettings(settings): void` — best-effort, try/catch, never throws
  - `getPaperDimensions(paperSize, orientation): { widthIn: number; heightIn: number }` — A4 portrait = `8.268 × 11.693` in; landscape swaps the two
  - `computePrintLayout(settings, docPx: { w: number; h: number }): PrintLayout` where `interface PrintLayout { paper: { widthIn: number; heightIn: number }; printable: { widthIn: number; heightIn: number }; docWidthIn: number; docHeightIn: number; scalePercent: number; topIn: number; leftIn: number }`
    - natural document size at 100 % = `docPx ÷ 300 DPI` (repo's 300-DPI convention, `cropPresets.ts`); displayed size = natural × effectiveScale / 100
    - `printable = paper − 2 × marginIn` per axis
    - `scaleToFit: true` → effective scale = `min(printableW / naturalW, printableH / naturalH) × 100` (derived, overrides stored `scalePercent`)
    - `centerImage: true` → effective `topIn`/`leftIn` = `(paper − displayed) ÷ 2`; otherwise the stored values
  - `settingsFromScale(settings, percent): PrintSettings`, `settingsFromHeight(settings, docPx, inches): PrintSettings`, `settingsFromWidth(settings, docPx, inches): PrintSettings` — each sets `scalePercent = clamp(value, 1, 640)` (Height/Width are never stored, so aspect ratio is preserved structurally); soft-clamp only, no hard rejections
- Ruling: the spec's example values (Top/Left `-0.117`, Height `11.692`, Width `8.267`) are illustrative — defaults are the values above (centered image, 100 %, A4).

**Step 1 — Write the failing tests first.** File `src/shared/services/__tests__/studio-print-settings.test.ts` with exactly these test names:
- `getPaperDimensions returns A4 portrait inches and swaps for landscape`
- `computePrintLayout derives document size from 300 DPI pixels and scale`
- `computePrintLayout centers the document when centerImage is set`
- `computePrintLayout honors explicit top and left when not centered`
- `computePrintLayout fits to the printable area when scaleToFit is set`
- `settingsFromHeight and settingsFromWidth rescale keeping aspect ratio`
- `loadPrintSettings falls back to defaults for missing or invalid stored values`

**Step 2 — Confirm RED:** `npx tsx --test src/shared/services/__tests__/studio-print-settings.test.ts` fails (module does not exist).

**Step 3 — Implement** `printSettings.ts` per the interface, and append the test path to the `test:renderer` script in `package.json`.

**Step 4 — Confirm GREEN:** `npm run test:renderer` passes (previous 94 + new tests).

**Commit:** `feat(studio): add print settings model and layout math` — stage only the three files.

**Quality Checklist:**
- [ ] Every `PrintSettings` field with defaults as specified; Task 6 can consume them verbatim
- [ ] `computePrintLayout` honors all three sync rules (scale→size, center→position, fit→scale)
- [ ] No DOM-only APIs at module top level (node test must not crash)
- [ ] No UI, no new dependencies, no changes to other components (pre-existing lint debt elsewhere is out of scope — do not "fix" it here)

---

### Task 6: Print dialog UI, entry point and backend seam

Build the dialog itself and wire it to the Options Bar. Runs after Task 4 so it edits the post-refactor `StudioEditorCanvas.tsx`.

**Files:**
- Create: `src/features/studio-editor/PrintDialog.tsx`
- Create: `src/features/studio-editor/printBackend.ts`
- Modify: `src/features/studio-editor/StudioEditorCanvas.tsx`
- Modify: `resources/assets/index.css` — add only the paper-colour token
- Modify: `README.md`

**Interfaces:**
- Consumes (Task 5): `PrintSettings`, `DEFAULT_PRINT_SETTINGS`, `loadPrintSettings`, `savePrintSettings`, `getPaperDimensions`, `computePrintLayout`, `settingsFromScale/Height/Width`.
- Consumes (existing): `PrintJob` type; `desktop.saveJob` / `desktop.printJob` via `src/shared/desktop-api.ts` / `window.alifShohojPrintDesktop` (renderer bridge use only — no Node/Electron imports); `Printer`, `X` from `lucide-react`.
- Produces: `PrintDialogProps = { job?: PrintJob; docPx: { w: number; h: number }; docDataUrl: string; onClose: () => void }`.

**Dialog shell:** modal overlay `fixed inset-0 z-50 grid place-items-center bg-black/60 p-4` (same pattern as the keyboard-shortcuts dialog); panel `w-[780px] max-w-[95vw] h-[520px] max-h-[92vh] rounded-xl border border-border-primary bg-surface shadow-2xl flex flex-col`; header row with title **Print** and a lucide `X` close button (discard semantics); body `flex min-h-0 flex-1`.

**Left — preview (`w-[57%]`, `bg-[var(--color-studio-canvas)]`, `tabIndex={0}` and first in DOM so tab order starts here):**
- Paper sheet: div with `aspect-ratio` from `layout.paper`, `background: var(--color-studio-paper)`, `shadow-xl`, centred with padding; token added in `resources/assets/index.css`: `.studio-shell { --color-studio-paper: #fdfdfc; }` and `.theme-dark .studio-shell { --color-studio-paper: #c9c9c3; }` (realistic paper-white in light, off-white in dark — component must not hardcode colours).
- Document: `<img src={docDataUrl}>` (captured once by the parent when the dialog opens) positioned absolutely with `left/top/width/height` percentages derived from `layout` (`topIn ÷ paper.heightIn`, `docWidthIn ÷ paper.widthIn`, …) so every settings change refreshes the preview live via a single `useMemo` over `settings`.
- `showBoundingBox` → dashed `border border-dashed border-brand/70` wrapper around the image; unchecked → none. `centerImage` handled entirely by the layout math.
- Preview background one step different from the panel (canvas token satisfies this in both themes).

**Right — controls (`w-[300px] shrink-0 border-l border-border-primary overflow-y-auto p-3 space-y-3`), DOM order = required tab order (action buttons → Position → Scaled Print Size):**
1. Action buttons, stacked, full-width: **Print…** (primary `bg-brand text-on-brand`, most prominent), **Cancel** (closes, discards), **Done** (saves via `savePrintSettings` then closes), **Page Setup…** (toggles the PAGE SETUP section below). Match the editor's existing quick-action button classes.
2. Divider `border-t border-border-primary`, then optional **PAGE SETUP** section (visible when toggled): Paper Size `<select>` (all `PaperSize` values except `'Custom'`), Orientation `<select>` (portrait/landscape), Margins number input (in). Changing paper re-derives the preview and re-runs fit-to-media automatically. Comment: native OS page-setup is unavailable in Electron; orientation/margins are preview-only today.
3. **POSITION** section: `text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary`; rows label + `type="number"` input (`step="0.001"`, `text-right`, `w-20`, suffix label `in`) for **Top** and **Left**; checkbox **Center Image** — when checked, Top/Left get `disabled` + `opacity-60` (`cursor-not-allowed`) and are forced from layout math.
4. **SCALED PRINT SIZE** section: **Scale** number input + `%` suffix; checkbox **Scale to Fit Media** — when checked, Scale/Height/Width are `disabled` + `opacity-60` and show derived values; **Height** and **Width** number inputs (in) — when unchecked, each edit calls `settingsFromHeight/Width` and the other two fields follow; checkbox **Show Bounding Box**. Soft clamping only (1–640 %).

Input styling: `border border-border-primary bg-bg-secondary text-text-primary focus:border-brand focus:outline-none`, `title` tooltips on each control, `aria-label`s on the numeric inputs, native keyboard accessibility (no custom focus traps).

**State:** local `const [settings, setSettings] = useState(loadPrintSettings())` inside `Dialog`; parent captures the preview image once at open: `openPrintDialog = () => { setPrintPreviewDataUrl(canvasRef.current?.toDataURL('image/jpeg', 0.92) ?? ''); setShowPrintDialog(true); }`. Done persists; Cancel/`×`/Escape discard. Print… does **not** persist (Done is the save action).

**Backend seam — `src/features/studio-editor/printBackend.ts`:**
- `interface PrintResult { ok: boolean; message: string }`; `async function printWithSettings(request: { settings: PrintSettings; dataUrl: string; job?: PrintJob }): Promise<PrintResult>`.
- No `job` or bridge unavailable → `{ ok: false, message: 'Print backend not yet connected' }` with `// TODO` comments (standalone canvas printing has no queue job to attach to).
- Job path (mirrors `StudioContext.approveJob`): `await desktop.saveJob({ ...job, fileUrl: dataUrl, paperSize: settings.paperSize })`, then `await desktop.printJob(job.id)`; catch → `{ ok: false, message }`. Surface the message in the dialog's `role="status"` line; disable Print… while pending.
- `// TODO` comment block in this file: `electron/services/print-service.ts` does not consume position/scale/center/fit/orientation/margins yet (`scale: 'fit'`, no orientation, no margin handling) — wire these settings there later. Never log job payloads, tokens, or data URLs.

**StudioEditorCanvas wiring:** `showPrintDialog` state; **Print…** quick-action button (lucide `Printer`) in the Options Bar cluster after Export JPG with `title="Print (Ctrl+P)"`; keyboard handler: before `if (isCtrl) return`, add `Ctrl/Cmd+P` → `event.preventDefault()` + open dialog; Escape closes it (place in the existing Escape chain alongside `showShortcuts`); add the state to the effect dependency array. Render `<PrintDialog job={job} docPx={canvasSize} docDataUrl={…} onClose={…} />` conditionally. Do not touch `onSave`, export, or the dead `onPrint`/`onPrintPreview` props.

**README:** add a bullet in the Studio section: Print button / `Ctrl+P` opens the Print dialog (live paper preview, position, scale, page setup, persisted on Done) and note the backend gap (position/scale not yet honoured by the print service).

**Verification:** `npm run lint`, `npm run test:renderer`, `npm run build` all pass. Visual: `npm run dev` → Studio tab → open the Print dialog; toggle every checkbox, edit Top/Left/Scale/Height/Width, switch paper size; confirm light and dark themes; save a screenshot to `tmp/` (create it if absent); close with Cancel and reopen to confirm values discarded.

**Known deviations to note in the report:** no native OS page-setup (in-dialog PAGE SETUP section instead); `Print…` on a non-job image reports "Print backend not yet connected"; position/scale/fit settings are preview-only until `print-service.ts` consumes them (TODO comments in code).

**Commit:** `feat(studio): add studio print settings dialog` — stage only the files above.

**Quality Checklist:**
- [ ] Dialog matches the spec layout (57 % preview left; stacked Print/Cancel/Done/Page Setup…; POSITION and SCALED PRINT SIZE sections with the exact checkboxes)
- [ ] Live preview: every setting change moves the document on the paper immediately; bounding box and centering obey their checkboxes
- [ ] Sync rules: Scale↔Height↔Width keep aspect; Center Image locks Top/Left; Scale to Fit Media locks and derives Scale/Height/Width
- [ ] Done persists, Cancel/×/Escape discard, Print… calls `printWithSettings` and shows its message
- [ ] Entry points: Options Bar **Print…** button + `Ctrl+P` (browser print suppressed)
- [ ] Theme tokens only, paper token in `index.css`, works in both light and dark
- [ ] `npm run lint` + `npm run test:renderer` + `npm run build` pass; README updated

---

## Appendix A — Spec (verbatim)

See the task prompt: "Refactor Left Tool Bar (Tool Palette)" (56 px strip, four groups with 28 px dividers, 40×40 buttons, right-side `Tool (Shortcut)` tooltip, FG/BG swatch pair, collapse behaviour, theme tokens) and "Refactor Right Sidebar" (280 px, Layers/Props/History tabs with 2 px accent underline, layer rows with 36×36 thumbnail + meta + eye/lock, dashed "+ New Layer", ADJUSTMENTS/TEXT OPTIONS sections, numbered history list, edge handle when collapsed).

## Appendix B — Recorded decisions

1. **"+ New Layer" is real** (user choice): a `ContentLayer` paint-layer stack replaces the flat strokes array; the button inserts and activates a new layer, and creation is undoable.
2. **Keep extras, drop Navigator** (user choice): reorder arrows, filters, Background removal stay; Navigator preview removed. **Amended 2026-10-12:** the Scale slider is also removed (user directive during execution — see Task 4 Step 3); the four spec adjustment sliders + filter chips remain.
3. **Omitted spec entries with no data model:** Select marquee, Clone Stamp, Healing Brush, Gradient, Eyedropper, Hand, Zoom tools; layer blend modes/opacity (meta line renders the always-true `Normal • 100%`); adjustment ranges stay engine-bound.
4. **Responsive split removed:** the mobile bottom rail and right-panel drawer are replaced by the always-present collapsible rails, because the spec mandates the vertical strip and edge handles at every width (minimum supported window is 900 px).
