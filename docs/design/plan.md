# Windows EXE UI refactor — plan (step 0)

Reference: `docs/design/status-window.jpg`, `docs/design/printer-settings.jpg`,
`docs/design/tray-menu.jpg`, `docs/design/specs.md`.
Product name: **Alif Shohoj Print** (আলিফ সহজ প্রিন্ট), company **AAA Tech Solutions**.

## 1. What exists today

| Area | File | Notes |
| --- | --- | --- |
| Single entry | `index.html` → `src/main.tsx` → `src/App.tsx` | One page holds all three views plus a 3-tab switcher. |
| Dev-preview switcher | `src/shared/components/NavigationHeader.tsx` | `Agent \| Customer PWA \| Shop POS` tabs, always visible. |
| Fake window chrome | `src/features/print-agent/WindowsAgentView.tsx` (lines 260–404) | Hand-drawn title bar (minimize/maximize/close), a `File/Scan/Services/Counters/Server/Help` menu bar and five inner tabs. |
| POS | `src/features/shop-pos/ShopPosView.tsx` | Real: order table, pricing, shop settings, counters, auto-print. |
| Order inbox | `src/features/shop-pos/OrderCardModal.tsx` | Real: order card, edit drawer, reject reason, approve. |
| Customer PWA | `src/features/customer-pwa/CustomerPwaView.tsx` | Real: 5 steps, voice guide, upload, crop, pay, token slip. |
| Toast | `src/shared/components/WindowsToast.tsx` | Real: order alert, view/approve buttons. |
| Electron main | `electron/main.ts` | Tray (2 items), single-instance lock, one BrowserWindow, WS + gateway + queue + sound. |
| Gateway | `electron/services/local-gateway.ts` | Serves `dist` for the LAN customer PWA and static fallback `index.html`. |
| State | `src/shared/context/StudioContext.tsx` | Shop profile, printers, jobs (from the desktop SQLite queue over IPC), counters, pricing, services, toast, modals. |

## 2. Screen → code mapping

| Design screen / element | Status | Existing code |
| --- | --- | --- |
| Status window: Connected card | ⚠️ partial | `WindowsAgentView` console header (`🟢 Connected`) — demo copy, not the design layout |
| Status window: shop card + Shop Code badge + Subscription | ⚠️ partial | `shopProfile` (name/code) exists; subscription state does not |
| Status window: `PRINTERS (n)` list with online/offline dot + ⋮ menu | ⚠️ partial | `printers` from `StudioContext`; rendered as 3 cards, not a list |
| Status window: OVERVIEW stat cards | ⚠️ partial | `pendingJobsCount`, `todayPrintedCount` exist; "This Month" is new |
| Status window: RECENT JOBS table | ❌ | pending jobs list exists in a different shape; no table + time column |
| Status window: bottom action row | ⚠️ partial | buttons exist scattered in the agent tabs |
| Tab bar `Status/Dashboard/Printers/Jobs/POS/Reports/Settings` | ❌ | five *inner* agent tabs instead |
| Right side of tab bar: `?` help + shop name/code dropdown | ❌ | brand + shop name live in `NavigationHeader` |
| Dashboard: order inbox card | ✅ | `OrderCardModal.tsx` (uses `activeOrderCardJob`) |
| Dashboard: counters filter | ✅ | `ShopPosView.tsx` counter filter tabs |
| Printers page: console data (Online/Offline, DPI, sheet count) | ✅ | `WindowsAgentView` `printers` tab + `WindowsGdiGenericDriver` capability registry |
| Printer Settings dialog | ⚠️ partial | add-printer modal exists in `WindowsAgentView`; the "Detected Printers" checklist dialog is new |
| Jobs list with status/printer/date filters | ⚠️ partial | `ShopPosView` order table has status filter only |
| POS (today income, print count, pending, price list, auto-print) | ✅ | `ShopPosView.tsx` |
| Reports (Today / This Month) | ⚠️ partial | `todayPrintedCount`, `todayEarningsBDT` only |
| Settings panel (11 Bengali groups) | ❌ | settings are spread across `ShopPosView` (tab 3) and `WindowsAgentView` |
| Tray menu (12 rows) | ⚠️ partial | `electron/main.ts` tray has 2 items |
| Windows Toast (title + `#127: NID Photo, 4R × 4` + printer•price•Paid) | ⚠️ partial | `WindowsToast.tsx` shows title + `serviceLabelBn, paperSize × copies` |
| Product name / logo in one place | ❌ | `ALIF SHOHOJ PRINT`, `BP`, `BroxPrint Studio`, `ALIF SHOHOJ PRINT 2026` are scattered |
| i18n keys for new UI text | ❌ | hard-coded Bengali/English strings |

## 3. Target file changes

New:

- `src/shared/config/brand.ts` — product name, Bengali name, company, app id, logo placeholder.
- `src/shared/i18n/strings.ts` + `src/shared/i18n/useTranslation.ts` — `en`/`bn` dictionaries and `t(key)` for every new UI string.
- `desktop.html` + `src/desktop/main.tsx` — the EXE renderer entry (desktop shell only).
- `pwa.html` + `src/pwa/main.tsx` — the customer PWA entry (phones on the shop LAN).
- `src/features/desktop/DesktopApp.tsx` — shell: tab bar, help menu, shop dropdown, page routing.
- `src/features/desktop/pages/StatusPage.tsx` — status-window.jpg layout (step 3).
- `src/features/desktop/pages/*` — Dashboard, Jobs, Reports, Settings (steps 4–7).

Changed:

- `index.html` — stays the dev preview harness; the 3-tab switcher renders only when `import.meta.env.DEV`.
- `src/shared/components/NavigationHeader.tsx` — switcher hidden outside DEV.
- `vite.config.ts` — multi-page build (`index`, `desktop`, `pwa`).
- `src/features/print-agent/WindowsAgentView.tsx` — fake title bar + menu bar removed; the five inner tabs become embeddable page bodies (`initialTab`, `onTabChange`).
- `electron/main.ts` — load `desktop.html`; remember window size/position; `minWidth 900 / minHeight 600`; product name + app id.
- `electron/services/local-gateway.ts` — static fallback `pwa.html`; keep `/` serving the POS for counter PCs.
- `electron-builder.yml` — `productName: Alif Shohoj Print`, `appId: com.aaatech.alifshohojprint`.
- `src/index.css` — teal primary + surface tokens from the reference images, Bengali font fallback.
- `README.md` — entry points, product name, install path.

Removed (dead code after step 2): the fake window-bar/menu-bar markup and the
`isMinimized`/`isMaximized` state inside `WindowsAgentView`.

## 4. Order of work (one commit each)

| Step | Commit scope |
| --- | --- |
| 0 | this plan |
| 1 | separate entries, dev-only switcher, electron loads `desktop.html`, gateway serves `pwa.html` |
| 2 | desktop shell: tab bar, help menu, shop dropdown, window state, remove fake chrome |
| 3 | Status page + design tokens (stop here — screenshot for review) |
| 4–7 | Dashboard, Printers/Settings dialog, Jobs/POS/Reports, Settings panel |
| 8 | tray menu |
| 9 | Windows Toast restyle |
| 10 | branding/i18n cleanup, README |

## 5. Constraints kept

- No new dependencies.
- Existing WebSocket protocol, SQLite schema, IPC bridge and preload surface unchanged.
- `npm run verify` must pass after every step.
- Colors/fonts come from the reference images: teal `#0F766E` primary, white surface,
  soft grey borders `#E4E7EB`, radius 8–12 px, Segoe UI / Noto Sans Bengali.
- Printer photos in the reference are replaced with printer icons (existing `lucide-react`).
