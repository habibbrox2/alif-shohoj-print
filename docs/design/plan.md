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


# কাজ: প্রথমবার Master/Counter বাছাই, Counter লক, LAN IP অটো-ডিটেক্ট

## লক্ষ্য
১) অ্যাপ প্রথমবার চালালে ইউজার ঠিক করবে এই PC "Master" নাকি "Counter"।
২) Counter বাছার সময় একটি চেকবক্স থাকবে: "এই PC স্থায়ীভাবে Counter হিসেবে লক করো (আর Master মোডে ফেরা যাবে না)"। টিক দিলে লক হবে।
৩) LAN IP অটো-ডিটেক্ট হবে: Master নিজের LAN IP বের করবে (QR/gateway URL-এর জন্য), Counter নিজে থেকে LAN-এ Master খুঁজে পাবে।
বিদ্যমান gateway (পোর্ট 43822), heartbeat (১০ সেকেন্ড, ৩০ সেকেন্ডে অফলাইন), QR পোস্টার ও queue লজিক ভাঙবে না, পুনরব্যবহার করো।

## ধাপ ০: আগে বোঝো (কোড বদলানোর আগে)
- এখন master/counter মোড কোথায় সংরক্ষিত ও পড়া হয় খুঁজে বের করো (README অনুযায়ী renderer-এর localStorage)। মোডের ওপর নির্ভর করা সব UI, route ও IPC হ্যান্ডলারের তালিকা করো।
- বর্তমানে কাউন্টার কীভাবে master URL পায় (হাতে লেখা base URL), QR URL কীভাবে তৈরি হয়, TLS কনফিগ (ALIF_SHOHOJ_PRINT_WS_TLS_CERT/KEY) কীভাবে পড়া হয় দেখো।
- পাথ ধরে নেবে না। ছোট প্ল্যান দাও: কোন ফাইল নতুন, কোনটা বদলাবে। বিদ্যমান ইনস্টলের (যাদের মোড localStorage-এ আছে) মাইগ্রেশন প্ল্যানও দাও।

## ধাপ ১: মোড ও লক main process-এ সংরক্ষণ (সবার আগে)
- মোড (unset | master | counter) ও লক-ফ্ল্যাগ Electron main process-এর userData ফোল্ডারে একটি কনফিগ ফাইলে রাখো (যেমন device-mode.json, লেখার সময় atomic write)। renderer-এর localStorage আর সত্যের উৎস নয়।
- renderer মোড জানবে শুধু IPC দিয়ে (getDeviceMode), main process থেকে।
- লক হলে main process এই IPC হ্যান্ডলারগুলো প্রত্যাখ্যান করবে: মোড বদলানো, master-only সব ফিচার (Settings, Reports, POS আয়/মূল্য সম্পাদনা, প্রিন্টার কনফিগ ও Routing, token প্রদর্শন, QR পোস্টার ছাপা, Counters ব্যবস্থাপনা, স্টাফ, Audit Log)। শুধু UI লুকালে চলবে না, main-এর IPC-তেও চেক থাকবে।
- Counter মোডে (লক হোক বা না হোক) gateway হোস্টিং, প্রিন্টার ব্যবস্থাপনা ও queue-র master অংশ চালু হবে না।
- লক না থাকলে (চেকবক্স টিক না দিলে) Settings-এর "Device mode" থেকে মোড বদলানো যাবে, তবে কনফার্মেশন ও অনুমতি লাগবে।
- লক ফেরানোর কোনো UI বা কমান্ড-লাইন সুইচ দেবে না। পুনরুদ্ধারের একমাত্র পথ: অ্যাপ আনইনস্টল করে userData মুছে নতুন করে ইনস্টল। এটা README ও লক চেকবক্সের পাশের সতর্কবার্তায় স্পষ্ট করে লেখো।
- লক নিয়মের সীমা স্পষ্ট করে docs-এ লেখো: এটা অপারেটরের ভুল ঠেকানোর ব্যবস্থা, কেউ Windows অ্যাডমিন হয়ে ফাইল মুছলে ঠেকানো যায় না। আসল নিরাপত্তা সার্ভারে প্রতি-কাউন্টার Device Token দিয়ে (আলাদা কাজ), তাই এই কাজে সেটা ধরে নেবে না।

## ধাপ ২: প্রথমবার চালুর Setup উইজার্ড
- মোড unset থাকলে অ্যাপ সরাসরি এই উইজার্ডে যাবে, আর কোনো পাতা দেখাবে না।
- ধাপ ১: "এই PC কী হিসেবে চলবে?" দুটি বড় কার্ড: Master (দোকানদারের মূল PC) ও Counter (শুধু কাউন্টার)। প্রতিটির নিচে এক লাইনের বর্ণনা।
- Master বাছলে: নিজের LAN IP ও gateway URL দেখাও (ধাপ ৩), TLS কনফিগ আছে কিনা জানাও, তারপর সাধারণ অ্যাপে যাও।
- Counter বাছলে: Master খোঁজার ধাপ (ধাপ ৪), তারপর চেকবক্স "এই PC স্থায়ীভাবে Counter হিসেবে লক করো। পরে Master মোডে ফেরা যাবে না।" ডিফল্ট টিক নেই। টিক দিলে নিশ্চিতকরণ ডায়ালগ: "লক করলে এই PC কখনো Master হতে পারবে না। নিশ্চিত?"
- কাউন্টারের নাম/কোড (CTR-n) এই ধাপে বা Master-এর পেয়ারিং ব্যবস্থায় নির্ধারিত হবে। যদি পেয়ারিং কোড ব্যবস্থা এখনো না থাকে, বিদ্যমান shared token এন্ট্রি ব্যবহার করো এবং সেটা TODO হিসেবে চিহ্নিত করো।
- UI লেবেল i18n কী দিয়ে।

## ধাপ ৩: Master-এর LAN IP অটো-ডিটেক্ট
- os.networkInterfaces() দিয়ে IPv4 ঠিকানা সংগ্রহ করো। শুধু প্রাইভেট রেঞ্জ (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) নাও; loopback, link-local (169.254.x.x) বাদ।
- ভার্চুয়াল অ্যাডাপ্টার বাদ দাও (VirtualBox, VMware, WSL/vEthernet, Hyper-V, Docker, VPN/TAP-র নাম/ MAC প্রিফিক্স দেখে)। সক্রিয় ও গেটওয়ে-যুক্ত অ্যাডাপ্টারকে অগ্রাধিকার দাও।
- একাধিক প্রার্থী থাকলে ড্রপডাউনে দেখাও (অ্যাডাপ্টারের নামসহ), সেরাটি ডিফল্ট; ইউজার বদলাতে পারবে। অ্যাপ চালু থাকা অবস্থায় IP বদলালে (DHCP) শনাক্ত করে gateway URL ও QR আপডেট করবে; ব্যবহারকারীকে জানাবে যে ছাপা QR পোস্টার পুরনো হয়ে যেতে পারে। দোকানে স্ট্যাটিক IP বা DHCP reservation রাখার পরামর্শ UI-তে ও docs-এ দাও।
- QR URL-এ এই অটো-ডিটেক্ট করা IP ব্যবহার করো (https://<ip>:43822/?shop=...), বর্তমান হাতে-লেখা মান নয়।
- TLS যাচাই: কনফিগ করা সার্টিফিকেটের SAN-এ এই IP নেই বা TLS কনফিগই নেই হলে স্পষ্ট সতর্কবার্তা দেখাও (README অনুযায়ী TLS ছাড়া LAN QR তৈরি হয় না, সেটা বদলাবে না)। সার্টিফিকেট নিজে বানাবে বা অটো-ইনস্টল করবে না।
- Windows Firewall-এ TCP 43822 খোলা আছে কিনা জানার সহজ উপায় থাকলে জানাও, না থাকলে নির্দেশনা লেখো। ফায়ারওয়াল নিজে বদলাবে না।

## ধাপ ৪: Counter-এর জন্য Master অটো-ডিসকভারি
- Master চালু থাকলে LAN-এ ছোট একটি discovery beacon পাঠাবে (Node-এর বিল্ট-ইন dgram UDP ব্রডকাস্ট; নতুন dependency নয়, mDNS লাগলে আগে আমাকে জিজ্ঞেস করো)। beacon-এ থাকবে: দোকানের নাম, Shop Code, gateway URL (IP+পোর্ট), প্রোটোকল ভার্সন। token, কোড, গোপন কিছু থাকবে না। ফ্রিকোয়েন্সি কম (যেমন ৫ সেকেন্ড)।
- Counter উইজার্ডে beacon শুনে পাওয়া Master-দের তালিকা দেখাবে, নির্বাচন করলে URL নিজে ভরবে। একাধিক Shop Code থাকলে ব্যবহারকারী বেছে নেবে।
- না পেলে (ব্রডকাস্ট আটকানো রাউটার) ফলব্যাক: হাতে URL লেখা (বিদ্যমান ধরন) এবং ঐচ্ছিকভাবে "সাবনেটে স্ক্যান করো" (শুধু পোর্ট 43822, সীমিত সময় ও সীমিত রেঞ্জ, ব্যবহারকারী চাইলে)।
- সংযোগের পর Master IP বদলালে Counter আবার discovery দিয়ে খুঁজে নিজে পুনঃসংযোগ করবে (Shop Code মিলিয়ে)। ভুল/অচেনা Master-এ নিজে থেকে কিছু পাঠাবে না।
- discovery শুধু ঠিকানা দেয়, অথেনটিকেশন নয়। সংযোগে বিদ্যমান token/পেয়ারিং যাচাই আগের মতোই লাগবে।

## ধাপ ৫: মাইগ্রেশন
- বিদ্যমান ইনস্টলে localStorage-এ মোড থাকলে প্রথম রানে main কনফিগে কপি করো (মোড = সেই মান, লক = false) এবং ইউজারকে একবার জানাও। মোড না থাকলে উইজার্ড।
- আনইনস্টল করলে বিদ্যমান আচরণ বজায়: সেটিংস ও queue থাকে (README অনুযায়ী)। লক-ফ্ল্যাগও থাকবে, কারণ এটা মুছলে লক অর্থহীন হয়।

## মান ও টেস্ট
- TypeScript; বিদ্যমান lint/format/test মেনে চলো; npm run verify পাস করতে হবে।
- টেস্ট বাধ্যতামূলক: (১) unset অবস্থায় উইজার্ড ছাড়া কিছু খোলে না, (২) লক হলে মোড-বদল IPC প্রত্যাখ্যাত, (৩) লক হলে প্রতিটি master-only IPC হ্যান্ডলার প্রত্যাখ্যান করে (তালিকা ধরে টেস্ট), (৪) localStorage সম্পাদনা করে মোড বদলানো যায় না, (৫) IP ফিল্টার: ভার্চুয়াল/loopback/link-local বাদ ও প্রাইভেট রেঞ্জ গ্রহণ (mock networkInterfaces), (৬) একাধিক অ্যাডাপ্টারে সঠিক ডিফল্ট, (৭) beacon-এ কোনো গোপন তথ্য নেই, (৮) IP বদলালে QR URL আপডেট, (৯) মাইগ্রেশন।
- নতুন dependency যোগ করার আগে আমাকে জিজ্ঞেস করো।
- প্রতিটি ধাপ আলাদা commit। ধাপ ১ শেষে থেমে আমাকে দেখাও (লক কীভাবে প্রয়োগ হচ্ছে), তারপর পরের ধাপে যাও।
- আইকন/ছবি নিজে বানাবে না, বিদ্যমান আইকন লাইব্রেরি ব্যবহার করো।
- README-র "Counter QR orders" ও "Authentication" অংশ নতুন আচরণ অনুযায়ী আপডেট করো, আর লকের সীমা ও পুনরুদ্ধারের পথ লেখো।
- শেষে জানাও: কী বদলালে, কোন ফাইল নতুন/সরানো, কীভাবে যাচাই করব (দুই PC-তে কীভাবে চালিয়ে দেখব), আর কী বাকি।
# কাজ: Counters ট্যাব ও Counter Mode (সীমাবদ্ধ কাউন্টার PC)

## লক্ষ্য
মূল PC-র অ্যাপে Counters ট্যাব ও Add Counter ডায়ালগ বানাও। যে PC কাউন্টার হিসেবে যোগ হবে সেটি শুধুই কাউন্টার: অন্য কাউন্টার বা মূল PC-র কোনো সেটিং/ফিচার দেখতে বা ডাকতে পারবে না। বিদ্যমান CTR-1/2/3 কাউন্টার, ফিল্টার, gateway, WebSocket ও queue লজিক পুনরব্যবহার করো, rewrite করবে না।

## ধাপ ০: আগে বোঝো (কোড বদলানোর আগে)
- বিদ্যমান কাউন্টার সংক্রান্ত সব কোড খোঁজো: মডেল/টেবিল, gateway রুট (পোর্ট 43822), auth/token লজিক (এখন একটাই shared bearer token), কাউন্টার ফিল্টার UI, LAN Terminal সংযোগ, PWA/Customer পাতা।
- পাথ ধরে নেবে না। প্ল্যান দাও: কোন ফাইল নতুন, কোনটা বদলাবে, কোনটা সরবে। শেষে বর্তমান shared token কোথায় কোথায় ব্যবহৃত তার তালিকা দাও।

## ধাপ ১: ডেটা ও অথেনটিকেশন (সবার আগে, সার্ভারে)
- counters টেবিল: id, code (CTR-n, অটো), name, type (master | lan), operator_id (nullable, স্টাফ থেকে), allowed_services[], can_approve (ডিফল্ট false), status (active | disabled), last_seen, created_at।
- device_tokens টেবিল: counter_id, token hash (প্লেইন টোকেন সংরক্ষণ করবে না), created_at, revoked_at।
- pairing_codes: ৬ সংখ্যা, ১০ মিনিট বৈধ, একবার ব্যবহার্য, counter_id-র সাথে বাঁধা। ভুল কোডে রেট লিমিট, বারবার ভুলে সাময়িক লক।
- পেয়ারিং ফ্লো: Add Counter → কোড/QR তৈরি → কাউন্টার PC-তে কোড দিলে gateway একটি Device Token দেয় (ওই counter_id-র নামে) → কোড বাতিল।
- Master কাউন্টার একটাই। দ্বিতীয় Master তৈরি করতে দেবে না। Master = মূল PC, সম্পূর্ণ অ্যাক্সেস।
- বিদ্যমান shared token থেকে Device Token ব্যবস্থায় migrate করার পথ দাও। পুরনো token কাজ করা বন্ধ করার আগে আমাকে জিজ্ঞেস করো।

## ধাপ ২: সার্ভারে অ্যাক্সেস নিয়ন্ত্রণ (UI লুকানো যথেষ্ট নয়)
- gateway-র প্রতিটি রিকোয়েস্টে ও WebSocket সংযোগে Device Token যাচাই, token → counter_id নির্ধারণ।
- কাউন্টার ডিভাইস শুধু এই এন্ডপয়েন্টগুলো পাবে (allowlist): নিজের কাউন্টারের অর্ডার/জব তালিকা, নিজের অর্ডারের Preview, নিজের জবের অবস্থা, "প্রিন্টার ব্যস্ত/অফলাইন" সাধারণ সংকেত, নিজের কাউন্টারের তথ্য, এবং can_approve থাকলে নিজের অর্ডারে Approve/Reject।
- বাকি সব এন্ডপয়েন্টে (Settings, Reports, POS আয়/মূল্য সম্পাদনা, প্রিন্টার কনফিগারেশন ও Routing, স্টাফ, Audit Log, Counters ব্যবস্থাপনা, ভয়েস/পেমেন্ট সেটিং) কাউন্টার টোকেনে 403 ফেরত দাও।
- অন্য কাউন্টারের id বা অর্ডার চাইলেও 403। WebSocket-এ কাউন্টার শুধু নিজের চ্যানেল/রুমে সাবস্ক্রাইব করতে পারবে, ব্রডকাস্ট ইভেন্টে অন্য কাউন্টারের ডেটা যাবে না।
- সব প্রিন্ট জব মূল PC-র প্রিন্টারে যায়। কাউন্টার ডিভাইস প্রিন্টারের তালিকা, নাম বা কনফিগ পাবে না, নিজে প্রিন্টও চালাবে না।
- কাউন্টার মুছলে/বন্ধ করলে Device Token সঙ্গে সঙ্গে revoke, চলমান WebSocket সংযোগ কেটে দাও।
- প্রতিটি কাজ Audit Log-এ লেখো: কাউন্টারের কোড, কাজ, সময়।

## ধাপ ৩: মূল PC-র UI (EXE)
- ট্যাব বারে Printers-এর পরে "Counters" ট্যাব (মূল PC-তেই দেখাবে)।
- তালিকা: প্রতিটি কাউন্টার একটি সারি: অনলাইন/অফলাইন ডট, নাম, কোড ট্যাগ (CTR-1) ও ধরন ট্যাগ (Master/LAN), অপারেটর, সার্ভিস, চলমান অর্ডার সংখ্যা, ⋮ মেনু (এডিট, বন্ধ করুন, মুছুন), অফলাইনে last_seen।
- "+ Add Counter" ডায়ালগ: কাউন্টারের নাম; কোড (অটো, read-only); ধরন (Master থাকলে ডিসেবল); অপারেটর (স্টাফ তালিকা থেকে); যে সার্ভিস নেবে (Photo, NID/Passport, Document, Photocopy/Scan, Lamination); চেকবক্স "অর্ডার Approve/Reject করতে পারবে" (ডিফল্ট বন্ধ); পেয়ারিং কোড ও QR (১০ মিনিটের কাউন্টডাউন সহ); Cancel / Add Counter। ডিফল্ট প্রিন্টার ঘর রাখবে না।
- মুছার আগে কনফার্মেশন; চলমান অর্ডার থাকলে সতর্কবার্তা।
- UI লেবেল ইংরেজি, কাউন্টারের নাম ও অর্ডারের বিষয়বস্তু বাংলা সমর্থন করবে; সব টেক্সট i18n কী দিয়ে।

## ধাপ ৪: Counter Mode (কাউন্টার PC-র দিক)
- কাউন্টার PC-তে gateway-র আলাদা পাতা `/counter` (ব্রাউজার/PWA)। মূল অ্যাপের কোড, Settings ফাইল বা অন্য ট্যাব এই বান্ডলে থাকবে না (আলাদা entry/chunk, মূল অ্যাপের কম্পোনেন্ট import করবে না)।
- প্রথমবার খুললে পেয়ারিং কোড দেওয়ার স্ক্রিন; সফল হলে Device Token সংরক্ষণ, কাউন্টার ইনবক্স দেখাবে: নিজের কাউন্টারের নাম/কোড, সংযোগ অবস্থা, নিজের অর্ডার কার্ড (Preview; can_approve থাকলে Reject/Approve), নিজের জবের অবস্থা।
- সংযোগ কেটে গেলে বা token revoke হলে স্পষ্ট বার্তা ও পুনরায় পেয়ার করার পথ।
- NID নম্বর/নাম তালিকা, Toast বা ভয়েসে দেখাবে না।
- (ঐচ্ছিক, আমাকে জিজ্ঞেস করে) কাউন্টার PC-তে EXE বসাতে হলে আলাদা counter মোড প্রস্তাব করো, যেখানে ট্যাব বারে শুধু কাউন্টারের নিজের পাতা থাকে। এটা এই কাজের বাইরে, শুধু প্রস্তাব দাও।

## মান ও টেস্ট
- TypeScript; বিদ্যমান lint/format/test মেনে চলো; npm run verify পাস করতে হবে।
- টেস্ট বাধ্যতামূলক: (১) কাউন্টার টোকেন দিয়ে allowlist-বহির্ভূত প্রতিটি এন্ডপয়েন্টে 403, (২) অন্য কাউন্টারের অর্ডার চাইলে 403, (৩) WebSocket-এ অন্য কাউন্টারের ইভেন্ট আসে না, (৪) মেয়াদোত্তীর্ণ/ব্যবহৃত পেয়ারিং কোড ব্যর্থ, (৫) revoke করলে সংযোগ কাটে, (৬) দ্বিতীয় Master তৈরি হয় না, (৭) can_approve বন্ধ থাকলে Approve 403।
- নতুন dependency (যেমন QR লাইব্রেরি) যোগ করার আগে আমাকে জিজ্ঞেস করো।
- প্রতিটি ধাপ আলাদা commit। ধাপ ২ শেষে থেমে অ্যাক্সেস টেস্টের ফল দেখাও, তারপর UI-তে যাও।
- আইকন/ছবি নিজে বানাবে না, বিদ্যমান আইকন লাইব্রেরি ব্যবহার করো।
- শেষে জানাও: কী বদলালে, কোন ফাইল নতুন/সরানো, কীভাবে যাচাই করব, আর কী বাকি।