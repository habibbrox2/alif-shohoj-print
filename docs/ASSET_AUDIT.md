# ALIF SHOHOJ PRINT Asset Audit

**Audited:** 2026-10-09  
**Scope:** first-party raster/vector assets, PWA metadata, desktop and installer icons, UI icon sources, generated print graphics, and referenced audio files. Dependency internals and generated build output are excluded.

## Summary

The repository contains almost no standalone image assets. The browser favicon and Windows tray mark are embedded SVG; most interface icons come from `lucide-react`; service illustrations are emoji; and counter QR codes are generated at runtime. Branding uses the ALIF SHOHOJ PRINT name and green CSS colors.

There are release-impacting gaps:

1. `public/audio/manifest.json` references 27 Bengali MP3 clips under `public/audio/bn/`, and the Electron sound service references six clips under `resources/sounds/`. None of those MP3 files exist in the checked-in `public/` tree. The Electron packaging config also has no `extraResources` entry for `resources/sounds/`.
2. `public/sw.js` includes `/manifest.json` in its install-time `cache.addAll()`, but that file is absent. A failed `addAll()` rejects service-worker installation; the service worker also has no corresponding `<link rel="manifest">` in `index.html`.
3. The app has no Windows `.ico` configured for Electron executable, installer, or shortcuts. The inline tray SVG is used for the tray only.
4. `index.html` has a data-URL SVG favicon, but no `apple-touch-icon`, `og:image`, or installable web manifest.

## Inventory

| Area | Current source / asset | Status | Finding |
| --- | --- | --- | --- |
| Browser favicon | `index.html` inline `data:image/svg+xml` | Present, embedded | 32×32 emerald square with a white printer-like mark. Not a reusable file. |
| Web manifest | Service worker expects `/manifest.json` | Missing | No root manifest file or manifest link in the HTML head. |
| Apple touch icon | HTML head | Missing | No touch icon is declared or present. |
| Social preview | HTML metadata | Missing image | Open Graph title/description and Twitter card metadata exist, but no `og:image` or preview image asset exists. |
| PWA service worker | `public/sw.js` | Present | Install precache includes missing `/manifest.json`; this can prevent installation. |
| PWA voice clips | `public/audio/manifest.json` | Manifest present; media missing | Clip entries C01–C27 point to `audio/bn/C01.mp3` through `C27.mp3`; none are present. Runtime falls back when clips cannot be fetched. |
| Desktop alert sounds | `electron/services/sound-service.ts` | References present; media missing | S01–S06 point to `resources/sounds/S01.mp3` through `S06.mp3`; no files or packaging resource mapping were found. |
| Electron/tray icon | Inline SVG in `electron/main.ts` `createTray()` | Present, embedded | 32×32 green tray icon. No separate app/installer icon file. |
| Windows executable/installer icon | `electron-builder.yml` | Missing | No `win.icon`, `installerIcon`, `uninstallerIcon`, or NSIS wizard/sidebar bitmap is configured. Electron Builder's default icon behavior applies. |
| Brand mark in UI | `src/shared/components/NavigationHeader.tsx` and other UI | Text only | “ALIF SHOHOJ PRINT” is rendered as text; no shared logo asset was found. |
| Service illustrations | `src/shared/services/studioServices.ts`; customer PWA | Emoji | Camera, ID/card, photo, and document emoji are used as service icons. These depend on platform emoji rendering. |
| Interface icons | Many `src/` components | Dependency-provided | `lucide-react` supplies navigation, printer, status, sound, and action icons. No local icon font or icon image files are required. |
| Counter QR graphics | `src/features/shop-pos/CounterPosterModal.tsx` | Generated at runtime | `qrcode` renders each counter QR into canvas for display/printing; there are no static QR image files. |
| Receipt/order card | `src/features/shop-pos/OrderCardModal.tsx` | HTML/CSS and text | Print view uses UI markup and Lucide icons; no embedded logo image was found. |
| Payment provider marks | Customer PWA and Shop POS | Text only | bKash/Nagad are named in text; no provider logos are present. |
| Empty/error states | Shop POS and Customer PWA | UI only | No dedicated empty-state or error illustration files were found. |
| Avatar/profile marks | Shop UI | Not found | No dedicated user avatar image assets were found. |

## Missing referenced assets

| Reference | Expected files | Checked-in state | Impact |
| --- | --- | --- | --- |
| `public/audio/manifest.json` | `public/audio/bn/C01.mp3` … `C27.mp3` | All 27 absent | Voice-guide clips cannot load; fallback behavior is used. |
| `electron/services/sound-service.ts` | `resources/sounds/S01.mp3` … `S06.mp3` | All 6 absent; resource directory not included by builder config | Native desktop sound playback cannot load these sound files in the current tree/package configuration. |
| `public/sw.js` | `/manifest.json` | Absent | `cache.addAll()` during service-worker installation includes an unavailable URL and can reject the install. |

## Brand and visual system

- Product-facing name is **ALIF SHOHOJ PRINT** in the HTML title, Electron product name, package metadata, navigation header, and tray tooltip.
- The legacy string **BroxPrint Studio** remains in `electron/main.ts` only as the previous user-data directory migration source; it is a compatibility path, not a current visual asset/name.
- Green values include `#059669` in the inline favicon/tray SVG and `#107c10` / `#4ade80` in `src/index.css` theme tokens.
- No custom font files are checked in. `index.html` loads Hind Siliguri, Plus Jakarta Sans, and JetBrains Mono from Google Fonts.

## Recommended order of work

1. Add and link a valid web app manifest, include the real static icon sizes it declares, and remove or correct the missing `/manifest.json` service-worker precache entry.
2. Decide whether to provide the 27 voice-guide clips and six desktop alert sounds. If retained, add the media files and include desktop resources in the Electron build; otherwise remove stale references and keep/document the text/synthesized fallback.
3. Create a coherent brand mark and export favicon, Apple touch, Open Graph, and Windows `.ico` variants from the same source. Configure Electron Builder to use the Windows icon.
4. Consider replacing service emoji with a consistent icon set only if identical rendering across Windows/browser platforms is a product requirement.

## Evidence locations

- `index.html` — page metadata and inline favicon.
- `public/sw.js` — service-worker precache references.
- `public/audio/manifest.json` — voice clip inventory.
- `electron/services/sound-service.ts` — desktop sound file references.
- `electron/main.ts` — inline tray SVG and app identity.
- `electron-builder.yml` — packaged files and absent icon/resource configuration.
- `src/index.css` — theme colors.
- `src/shared/services/studioServices.ts` — service emoji definitions.
- `src/features/shop-pos/CounterPosterModal.tsx` — runtime QR rendering.
- `src/features/shop-pos/OrderCardModal.tsx` — printable order card.
