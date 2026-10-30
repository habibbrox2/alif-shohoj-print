# Studio Editor System Audit Report

**Audit Date:** 2025-10-31  
**Repository:** alif-shohoj-print  
**Scope:** `src/features/studio-editor/` and related integration points (`src/features/desktop/pages/StudioPage.tsx`, `src/shared/desktop-api.ts`, related services/tests)

## Executive Summary

The Studio Editor is a feature-rich image editing canvas with painting, cropping, adjustments, filters, layers, extended Photoshop-like tools (marquee/wand/clone/heal/dodge/burn/sponge), background removal/replacement, warp/transform, and print integration. Recent changes show a major expansion of functionality. While the implementation is ambitious and has many good patterns (immutable updates, history with snapshots, normalised coordinates), there are significant concerns around maintainability, performance, memory management, and some potential bugs.

Overall Assessment: **Medium-High Risk** - Functional but needs refactoring and hardening before scaling further.


## 1. Architecture

### Strengths
- **Clear separation of concerns** in utilities: `strokeModel.ts` (layers/strokes), `editorHistory.ts` (undo/redo), `cropTool.ts` (crop geometry), `printSettings.ts`/`printBackend.ts` (print logic), etc.
- **Normalised coordinates** for strokes/crops/selections allow resolution-independent operations
- **Immutable update patterns** in models (`addPoint`, `eraseStrokes`, layer update helpers)
- **Plugin-like tool architecture** with clear tool IDs and handlers
- **Good integration pattern** with `StudioPage` acting as container/orchestrator

### Issues

#### HIGH - Monolithic Component
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx` (3711 lines)
- **Issue:** Single component manages all state, rendering, tool logic, UI, history, etc. Extremely difficult to test, maintain, and reason about.
- **Impact:** High cognitive load, merge conflicts, harder to debug, poor reusability
- **Recommendation:** Split into hooks (`useEditorHistory`, `useCanvasRender`, `useToolHandlers`, `useCropInteraction`), sub-components (`CanvasViewport`, `RightPanel`, `OptionsBar`, `ToolRail` already separate). Consider a state machine/reducer.

#### MEDIUM - Mixed Concerns in Rendering
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx:993-1224`
- **Issue:** Massive `useEffect` (230+ lines) handles photo rendering, source canvas rebuild, clone/tonal replay, stroke drawing, overlays all in one effect with 30+ dependencies
- **Impact:** Performance issues, hard to debug rendering bugs
- **Recommendation:** Extract rendering into separate pure functions, use multiple focused effects or a render loop with `requestAnimationFrame`

#### MEDIUM - State Management Complexity
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx` (many useState calls throughout)
- **Issue:** 50+ state variables, complex synchronization between state/refs (e.g., `contentLayers` + `contentLayersRef`, history refs)
- **Impact:** Risk of stale closures, sync bugs
- **Recommendation:** Consolidate related state into objects/reducers, be consistent about ref/state usage


## 2. Code Quality

### Strengths
- Good TypeScript usage overall with well-defined interfaces
- Consistent naming conventions
- Helpful comments explaining complex logic (e.g., clone stamp offset stability, crop coordinate systems)
- Immutable patterns in utility functions

### Issues

#### HIGH - Type Safety Gaps
- **File:** `src/features/desktop/pages/StudioPage.tsx:172,189` - `adjustments: any` in callbacks
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx` - Some loose typing with dynamic imports
- **Issue:** Using `any` bypasses type checking
- **Recommendation:** Use proper types (`StudioCanvasAdjustments`), add strict typing for all callbacks

#### MEDIUM - Large File Size
- Multiple files are quite large and complex. `StudioEditorCanvas.tsx` is the worst offender at 3711 lines.
- **Recommendation:** Enforce file size limits, refactor into modules

#### MEDIUM - Code Duplication
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx` - Color parsing logic duplicated? `parseHexColor` defined twice (line ~315-320 and also in backgroundReplace.ts has its own)
- **File:** Canvas creation/handling patterns repeated
- **Recommendation:** Extract shared utilities

#### LOW - Inconsistent Patterns
- Some state synced via refs + effects, some direct; could be standardized


## 3. Performance

### Issues

#### CRITICAL - Memory Leaks
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx:1664-1710` - `handleRemoveBackground` creates object URLs with `URL.createObjectURL(blob)` but never calls `URL.revokeObjectURL()`
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx:767-783,1830-1834` - Images loaded from blob/data URLs stored in history/snapshots; old object URLs not revoked
- **File:** `src/features/studio-editor/cloneStamp.ts:22,36-44` - Stores full source canvas snapshots as base64 data URLs in every clone stroke; `restoreSourceSnapshot` creates Image but doesn't clean up
- **File:** `src/features/studio-editor/tonalTools.ts:36` - Similar issue storing data URL snapshots in tonal strokes
- **Impact:** Unbounded memory growth, can crash on large images/many operations
- **Recommendation:** Track all created object URLs in a Set/ref, revoke them on cleanup/unmount/reset/history changes. For snapshots, consider storing ImageData or using transferable objects. Limit snapshot storage.

#### HIGH - Excessive Memory in History
- **Files:** `strokeModel.ts:203-284`, `editorHistory.ts`, `StudioEditorCanvas.tsx:716-725,753-758`
- **Issue:** Every history snapshot stores full `contentLayers` (all strokes with all points), `cloneStrokes` with `sourceSnapshot` data URLs, `tonalStrokes` with snapshots, image URLs. History limit is 50 but each can be megabytes
- **Impact:** Memory exhaustion, slow serialization
- **Recommendation:** Store diffs instead of full snapshots, compress history, exclude heavy data from snapshots or store references differently, use LRU with size limits not just count

#### HIGH - Expensive Rendering
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx:993-1224` - Single effect does all rendering synchronously; rebuilds source canvas on photo signature changes
- **Issue:** No debouncing/throttling, re-renders on every state change, expensive pixel operations on large images
- **Impact:** Laggy UI, poor performance with high-res images
- **Recommendation:** Use `requestAnimationFrame`, separate render concerns, optimize with dirty flags, consider OffscreenCanvas/Web Workers for heavy processing

#### MEDIUM - Unnecessary Re-renders
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx` - Many state updates trigger full re-renders; large dependency arrays in effects
- **Recommendation:** Memoize callbacks/components, use `useMemo` more strategically, split context/state

#### MEDIUM - Clone/Tonal Tools Performance
- **Files:** `cloneStamp.ts:50-116`, `tonalTools.ts:44-112` - Pixel-by-pixel operations in loops without optimization
- **Issue:** For large brush sizes/strokes this can be slow in JS
- **Recommendation:** Use canvas operations where possible, optimize loops, consider WebGL for heavy operations (there is `webglImageRenderer.ts`, `webglWarpRenderer.ts` - good start)


## 4. State Management

### Issues

#### HIGH - Snapshot Reference Sharing
- **File:** `src/features/studio-editor/StudioEditorCanvas.tsx:716-717,755-756` - `snapshot()` does `contentLayers: contentLayersRef.current`, `cloneStrokes: cloneStrokesRef.current` passing array references directly
- **Issue:** If arrays are mutated later, snapshots/history would be affected (shared references). Also `applySnapshot` passes arrays directly to state
- **Impact:** History corruption, undo/redo bugs
- **Recommendation:** Deep clone arrays/objects when creating snapshots: `structuredClone()` or proper deep copy

#### MEDIUM - Complex Ref/State Synchronization
- **Files:** `StudioEditorCanvas.tsx:428-431,455-457,629-634,428-431`
- **Issue:** Multiple useEffects sync refs from state and vice versa; easy to get out of sync
- **Impact:** Stale closure bugs (they tried to fix with refs per comments)
- **Recommendation:** Centralize state updates, consider using a single source of truth

#### MEDIUM - History Implementation
- **File:** `editorHistory.ts` - Simple array-based history is fine, but combined with heavy snapshots causes issues
- **Recommendation:** Consider command pattern with incremental updates


## 5. UI/UX

### Strengths
- Photoshop-like layout with tool rail, panels, status bar
- Good keyboard shortcuts (V,B,E,T,S,C, Ctrl+Z/Y/P etc.)
- Tooltips and hints throughout
- Responsive panel resizing
- Tour/help system
- Bengali text in UI where appropriate

### Issues

#### MEDIUM - Accessibility
- **Files:** `StudioEditorCanvas.tsx`, `StudioWorkspaceChrome.tsx`
- **Issue:** Some controls may lack proper ARIA labels, keyboard navigation could be improved, color contrast not verified
- **Recommendation:** Audit ARIA, add focus management, test keyboard-only navigation

#### MEDIUM - Mobile/Touch Support
- **File:** `StudioEditorCanvas.tsx:3349-3353` has touch handlers but UI may not be optimized for mobile
- **Recommendation:** Test touch interactions, ensure responsive design

#### LOW - UI State Persistence
- Some UI state (panel open/closed, sizes) not persisted? `rightPanelWidth` in state but maybe not saved to localStorage
- **Recommendation:** Persist UI preferences


## 6. Integration

### Strengths
- Clean integration with `StudioPage` via props/callbacks
- Proper use of preload bridge for desktop features
- Print integration with dialog and backend abstraction
- Job creation flow for walk-in prints

### Issues

#### MEDIUM - Print Flow Complexity
- **Files:** `printBackend.ts`, `PrintDialog.tsx`, `StudioEditorCanvas.tsx:1870-1965` (handleWalkInPrint)
- **Issue:** Multiple print paths (with job vs walk-in), complex state management. Walk-in print creates job in `StudioEditorCanvas` via dynamic imports and passes through bridge
- **Recommendation:** Simplify print flow, better error handling

#### MEDIUM - File Validation Duplication
- **File:** `src/features/studio-editor/validateImageFile.ts` - Good validation with Bengali messages. Tests look comprehensive.
- **Note:** TIFF is in ACCEPTED_IMAGE_TYPES but rejected by browser-decodable check with helpful message (correct per tests)
- **Issue:** In `StudioPage.tsx:95-133` they do their own validation logic instead of using the shared `validateImageFile.ts` utility
- **Recommendation:** Use the shared validator in StudioPage to avoid duplication

#### LOW - Desktop API Surface
- **File:** `src/shared/desktop-api.ts` - Studio-related APIs seem reasonable


## 7. Tests

### Existing Tests
- **File:** `src/shared/services/__tests__/studio-file-validation.test.ts` - Comprehensive tests for `validateImageFile.ts` (9 tests, good coverage)
- Note from AGENTS.md says "The current test scripts do not list `electron/services/__tests__/sound-service.test.ts` or `src/shared/services/__tests__/voiceGuideService.test.ts`. If relevant, inspect these tests and report this coverage gap; do not silently change scripts as part of an unrelated task." - but also notes about studio editor tests

### Issues

#### HIGH - Insufficient Test Coverage
- **Missing tests for:** `editorHistory.ts`, `strokeModel.ts`, `cropTool.ts`, `selectionModel.ts`, `magicWand.ts`, `cloneStamp.ts`, `tonalTools.ts`, `backgroundReplace.ts`, `printSettings.ts`, `printBackend.ts`
- **Issue:** Many core utilities and complex logic have no unit tests
- **Impact:** High risk of regressions, bugs go undetected
- **Recommendation:** Add unit tests for pure functions (history operations, geometry calculations, filters, etc.)

#### MEDIUM - No Component/Integration Tests
- **Issue:** No tests for `StudioEditorCanvas`, `StudioPage`, `PrintDialog`
- **Recommendation:** Add React Testing Library tests for critical user flows

#### MEDIUM - No Tests for Complex Features
- **Issue:** Clone stamp, tonal tools, background replacement, warp/transform have no tests
- **Recommendation:** Add tests for these complex features

## 8. Potential Bugs & Issues

### Critical

#### CRITICAL - Memory Leak from Object URLs
- **Files:** `StudioEditorCanvas.tsx:1686,1833`, `cloneStamp.ts`, `tonalTools.ts`
- **Description:** Blob URLs created with `URL.createObjectURL()` are never revoked. Base64 data URL snapshots stored in history can accumulate to GBs of memory.
- **Reproduction:** Use background removal multiple times, do many clone/tonal operations, undo/redo extensively
- **Fix:** Implement URL tracking and cleanup on unmount, reset, history changes. Consider not storing full data URLs in history or implementing size limits.

#### CRITICAL - Shared Reference Bugs in History
- **File:** `StudioEditorCanvas.tsx:716-725,753-758`
- **Description:** Snapshots store references to arrays from refs (`contentLayersRef.current`) without deep cloning. Mutations could corrupt history.
- **Fix:** Deep clone all objects/arrays in `snapshot()`: use `structuredClone()` or manual deep copy

### High

#### HIGH - Source Canvas Assumptions
- **File:** `StudioEditorCanvas.tsx:646,997,1041,1063,1160,1284,1337,1482,1504,1718,3321`
- **Description:** Code assumes `sourceCanvasRef.current` exists and works; it's initialized as null and created via JSX. If something goes wrong, features silently fail. Also complex rebuild logic could have edge cases.
- **Fix:** Add better null checks, defensive programming, error handling

#### HIGH - Large Component Complexity
- **File:** `StudioEditorCanvas.tsx` (3711 lines)
- **Description:** Hard to test, high bug risk due to complexity
- **Fix:** Refactor as recommended in Architecture section

#### HIGH - Clone Stamp/Tonal Tools Memory
- **Files:** `cloneStamp.ts:22,67`, `tonalTools.ts:36`
- **Description:** Storing full canvas snapshots as data URLs in every stroke. Each stroke can store a full image snapshot - with many strokes this explodes memory.
- **Fix:** Store only diffs or use ImageData, implement compression, limit number of stored snapshots

### Medium

#### MEDIUM - TIFF Handling
- **File:** `validateImageFile.ts:33-58`
- **Description:** TIFF is accepted in `ACCEPTED_IMAGE_TYPES` but rejected as not browser-decodable with message telling user to convert. This is correct per tests, but could confuse users. Also duplicate validation in StudioPage.
- **Fix:** Either remove TIFF from accepted types or handle differently; use shared validator everywhere

#### MEDIUM - Error Handling Gaps
- Some async operations lack proper error handling, errors might not surface to user
- **Files:** Various places in StudioEditorCanvas

#### MEDIUM - Race Conditions
- **File:** `StudioEditorCanvas.tsx` - Complex async operations (background removal, image loading) with multiple state updates could have race conditions
- **Fix:** Add cancellation tokens/flags

#### MEDIUM - Missing Cleanup
- **File:** `StudioEditorCanvas.tsx:826-833` - Only cleans up commit timer; doesn't clean up object URLs, canvas contexts, event listeners in some cases
- **Fix:** Comprehensive cleanup in useEffect cleanup

### Low

#### LOW - Magic Numbers
- Many hardcoded values (sizes, timeouts, limits) - could be extracted to constants
- **Recommendation:** Create constants files for magic numbers

## 9. Prioritized Improvement Plan

### P0 - Critical (Fix Immediately)
1. **Fix memory leaks** (Memory) - Track and revoke object URLs, limit data URL snapshots in history
   - Files: `StudioEditorCanvas.tsx`, `cloneStamp.ts`, `tonalTools.ts`
   - Effort: High, Impact: Critical

2. **Fix history snapshot reference sharing** (Bugs) - Deep clone in `snapshot()`
   - Files: `StudioEditorCanvas.tsx:716-725`
   - Effort: Medium, Impact: Critical

### P1 - High (Fix Soon)
3. **Refactor monolithic component** (Architecture) - Break `StudioEditorCanvas.tsx` into smaller components/hooks
   - Effort: Very High, Impact: High

4. **Optimize history memory usage** (Performance) - Don't store full image snapshots in every stroke, use diffs or limits
   - Files: `cloneStamp.ts`, `tonalTools.ts`, `editorHistory.ts`
   - Effort: High, Impact: High

5. **Add missing unit tests** (Tests) - Test pure functions (history, geometry, tools)
   - Effort: High, Impact: High

6. **Fix source canvas robustness** (Bugs) - Better null checks and error handling
   - Files: `StudioEditorCanvas.tsx`
   - Effort: Medium, Impact: High

### P2 - Medium (Plan For)
7. **Improve rendering performance** (Performance) - Optimize the large render effect, use RAF
   - Effort: High, Impact: Medium-High

8. **Consolidate validation** (Integration) - Use shared validator in StudioPage
   - Files: `StudioPage.tsx`, `validateImageFile.ts`
   - Effort: Low, Impact: Medium

9. **Improve type safety** (Code Quality) - Replace `any` with proper types
   - Files: `StudioPage.tsx`
   - Effort: Low, Impact: Medium

10. **Add cleanup in effects** (Bugs) - Comprehensive cleanup on unmount
    - Files: `StudioEditorCanvas.tsx`
    - Effort: Medium, Impact: Medium

### P3 - Low (Nice to Have)
11. **Extract constants** (Code Quality) - Remove magic numbers
12. **Improve accessibility** (UI/UX) - ARIA labels, keyboard nav
13. **Add component tests** (Tests) - React Testing Library tests
14. **Optimize clone/tonal tools** (Performance) - Better algorithms, use WebGL where beneficial

## Conclusion

The Studio Editor is feature-rich and well-architected in terms of its utility functions and data models. However, it suffers from being a monolithic component with significant memory management issues (object URL leaks, storing full image snapshots in history) and performance concerns. The most urgent issues are the memory leaks and reference sharing bugs which could cause crashes and data corruption. A major refactoring effort is needed for long-term maintainability.

**Key Recommendation:** Focus on P0 issues immediately (memory leaks and history bugs), then tackle the monolith refactoring in phases to avoid breaking existing functionality.
