# Alif Shohoj Print: Master Plan ও Master Prompt

> প্রোডাক্ট: **Alif Shohoj Print** (আলিফ সহজ প্রিন্ট) · কোম্পানি: **AAA Tech Solutions**
> এই ফাইলটি coding agent-এর জন্য একটি মাস্টার প্রম্পট। এখানকার নিয়মগুলো আগের আলাদা প্রম্পটগুলোর (UI refactor, Counters, Device Mode, Voice, Asset Audit) জায়গা নেয়।
> সর্বশেষ আপডেট: ১০ অক্টোবর ২০২৬

---

## ০. Agent-এর জন্য সাধারণ নিয়ম (সব কাজে প্রযোজ্য)

1. **আগে বোঝো, পরে লেখো।** কোড বদলানোর আগে বিদ্যমান কোড স্ক্যান করে ছোট প্ল্যান দাও: কোন ফাইল নতুন, কোনটা বদলাবে, কোনটা সরবে। পাথ ধরে নেবে না।
2. **Rewrite নয়।** বিদ্যমান WebSocket প্রোটোকল, SQLite schema, IPC bridge, preload surface, gateway (পোর্ট 43822), heartbeat (১০ সেকেন্ড, ৩০ সেকেন্ডে অফলাইন), QR পোস্টার, queue লজিক পুনরব্যবহার করো।
3. **নিরাপত্তা সার্ভারে/main process-এ।** UI লুকানো নিরাপত্তা নয়। প্রতিটি সীমাবদ্ধতা gateway ও Electron main process-এ জোর করে খাটাতে হবে।
4. **নতুন dependency** যোগ করার আগে আমাকে জিজ্ঞেস করো।
5. **`npm run verify` পাস** করতে হবে প্রতিটি ধাপের পর। প্রতিটি ধাপ আলাদা commit।
6. **থামার জায়গা:** যেখানে "STOP" লেখা আছে, সেখানে কাজ থামিয়ে আমাকে ফলাফল দেখাও।
7. **অনুমান আলাদা করো।** যা কোড থেকে নিশ্চিত হওনি, সেটা "অনুমান" লেবেল দিয়ে লেখো। বানিয়ে লিখবে না।
8. **আইকন/ছবি** নিজে বানাবে বা ডাউনলোড করবে না। বিদ্যমান `lucide-react` ব্যবহার করো।
9. **গোপন তথ্য** (API key, token, সার্টিফিকেট) কোড, manifest বা commit-এ রাখবে না। `.env.example` দাও, `.env` gitignore-এ আছে কিনা যাচাই করো।
10. **সংবেদনশীল নথির তথ্য** (পরিচয়পত্র/পাসপোর্টের নম্বর, নাম, ফাইলের আসল নাম) লিস্ট, Toast, লগ বা ভয়েসে কখনো দেখাবে না; শুধু সার্ভিসের সাধারণ নাম (যেমন "Passport Photo")। নির্দিষ্ট কোনো সার্ভিস কোডে হার্ডকোড করা নয়: যে সার্ভিসে `sensitive` ফ্ল্যাগ আছে তার ওপর এই সুরক্ষা প্রযোজ্য (§৯ক)।
11. **সার্ভিস হার্ডকোড নয়।** কোনো সার্ভিসের নাম, দাম, অপশন, আইকন বা রাউটিং কোডে ধরে নেবে না; সব `services` ডেটা থেকে আসবে। "NID" নামে কোনো বিল্ট-ইন সার্ভিস থাকবে না।
12. প্রতিটি ধাপ শেষে জানাও: কী বদলালে, কোন ফাইল নতুন/সরানো, কীভাবে যাচাই করব, কী বাকি।

---

## ১. প্রোডাক্ট ও সিদ্ধান্ত

বাংলাদেশের কম্পিউটার/ডিজিটাল দোকানের জন্য QR-ভিত্তিক স্মার্ট প্রিন্ট সার্ভিস।

| বিষয় | সিদ্ধান্ত |
|---|---|
| কাস্টমার | QR স্ক্যান → Customer PWA (অ্যাপ ইনস্টল নয়), বাংলা/ইংরেজি ভয়েস গাইড |
| দোকানদার | Windows EXE (Electron + TypeScript, Tray App, login-এ অটো-স্টার্ট) |
| আর্কিটেকচার (এখন) | **LAN-ভিত্তিক:** মূল (Master) PC gateway হোস্ট করে, PWA সার্ভ করে, SQLite queue রাখে, প্রিন্টারে ছাপে। কাউন্টার PC ও কাস্টমারের ফোন একই LAN-এ। |
| সেন্ট্রাল ক্লাউড সার্ভার | **এখন নেই।** পরে আলাদা সিদ্ধান্ত (দেখো §১১)। |
| প্রিন্ট ইঞ্জিন | `pdf-to-printer`/SumatraPDF silent print; paper type/quality/borderless ড্রাইভার সেটিংয়ে |
| POS | EXE-তে থাকবে (বিদ্যমান ShopPosView পুনরুপযোগ) |
| ভাষা | UI লেবেল ইংরেজি (ডিজাইন অনুযায়ী); অর্ডারের বিষয়বস্তু ও Settings গ্রুপের নাম বাংলা; সব টেক্সট i18n কী দিয়ে; বাংলা ফন্ট ফলব্যাক (Nirmala UI / Noto Sans Bengali) |
| থিম | হালকা (teal `#0F766E` প্রাইমারি, সাদা সারফেস, বর্ডার `#E4E7EB`, radius 8–12px); dark পরে |
| ব্র্যান্ড | নাম ও লোগো এক জায়গা (`src/shared/config/brand.ts`) থেকে। পুরনো নাম (`BP`, `BroxPrint`, `ALIF SHOHOJ PRINT 2026`) সরাতে হবে |
| appId/productName | `Alif Shohoj Print` / `com.aaatech.alifshohojprint`। **বড় rollout-এর আগে আমার নিশ্চিতকরণ লাগবে** (auto-update ও ইনস্টল পাথে প্রভাব) |

### Job স্ট্যাটাস
`Pending → Approved → Queued → Printing → Ready → Collected`
`Pending → Edited → (দাম বদলালে Customer Confirm) → Approved`
`Pending → Rejected → Refund/Resubmit → Auto-delete`

---

## ২. রিপোর বর্তমান অবস্থা (`habibbrox2/alif-shohoj-print`)

**যাচাই করা (README ও ফাইল তালিকা থেকে, ১০ অক্টোবর ২০২৬):**

- রিপো **Public**, ১০ কমিট, ০ স্টার/ফর্ক। `main` ব্রাঞ্চ।
- ফোল্ডার: `.freebuff`, `.github/workflows`, `docs`, `electron`, `public`, `scripts`, `src`; ফাইল: `AGENTS.md`, `CHANGELOG.md`, `README.md`, `assets-manifest.json`, `bun.lock` **এবং** `package-lock.json`, `electron-builder.yml`, `index.html`, `vite.config.ts`, `tsconfig*.json`।
- Stack: React + Vite renderer, Electron main, SQLite queue, SumatraPDF silent print, NSIS dual-arch installer (x64 + ia32), tray, single-instance, Start with Windows, log rotation (5 MiB × 5), local-only crash dump।
- Gateway: master PC-তে পোর্ট 43822 (customer PWA + order gateway); WebSocket listener ডিফল্টে `127.0.0.1:43821`। LAN-এ binding-এর জন্য `ALIF_SHOHOJ_PRINT_WS_TLS_CERT/KEY` বাধ্যতামূলক; TLS ছাড়া LAN QR তৈরি হয় না।
- Auth: **একটাই shared bearer token**, প্লেইন টেক্সট ফাইলে (`websocket.token`), rotation/revoke নেই; per-counter পরিচয়, স্টাফ অ্যাকাউন্ট, রোল নেই।
- Master/Counter মোড **renderer-এর `localStorage`-এ** থাকে, যা অথেনটিকেশন নয় (README নিজেই বলছে)।
- Counter heartbeat ১০ সেকেন্ড; ৩০ সেকেন্ডে অফলাইন; Master নতুন অর্ডারে কাউন্টার নম্বর বলে।
- Code signing: workflow ও env আছে, কিন্তু OV/EV সার্টিফিকেট বা Azure Trusted Signing নেই।

**Agent-এর Step 0 অডিট থেকে (docs-এ থাকা পূর্ববর্তী প্ল্যান):**

- একক এন্ট্রি `index.html → src/main.tsx → src/App.tsx`, তিন-ট্যাবের ডেভ সুইচার (`NavigationHeader.tsx`) সবসময় দৃশ্যমান।
- `WindowsAgentView.tsx`-এ নকল উইন্ডো বার ও `File/Scan/Services/...` মেনু।
- আছে: `ShopPosView`, `OrderCardModal` (order card, edit drawer, reject reason, approve), `CustomerPwaView` (৫ ধাপ, ভয়েস গাইড, আপলোড, crop, pay, token slip), `WindowsToast`, `StudioContext`।
- Tray মেনুতে মাত্র ২ আইটেম।
- সাম্প্রতিক patch: brand/shell **naming** আপডেট পর্যন্ত হয়েছে। **পূর্ণ visual desktop shell** (status window, tabs, tray menu, settings, order-card UI) এখনো বাকি এবং Windows-এ বাস্তব GUI যাচাই লাগবে।

**যাচাই করা যায়নি (অনুমান):** `src/` ও `electron/`-এর ভেতরের কোড ও সাম্প্রতিক কমিট; কোনো GUI স্ক্রিনশট; ভয়েস ক্লিপ বা `voice-manifest.json` রিপোতে নেই বলে ধরা হচ্ছে। Agent প্রতিটি ধাপের শুরুতে নিজে এগুলো যাচাই করবে।

---

## ৩. প্ল্যানের সাথে ফাঁক (Gap)

| # | ফাঁক | গুরুত্ব |
|---|---|---|
| G1 | রিপো Public, `.freebuff` ফোল্ডারে কী আছে অজানা, দুটো lockfile | **P0** |
| G2 | Master/Counter মোড `localStorage`-এ; কাউন্টার PC সহজে Master হয়ে সব দেখতে পারে | **P0** |
| G3 | Shared token, প্রতি-কাউন্টার পরিচয় নেই; "অন্য কাউন্টার দেখবে না" সার্ভারে প্রয়োগ অসম্ভব | **P0** |
| G4 | LAN IP হাতে লেখা; QR/URL-এর IP স্বয়ংক্রিয় নয় | P1 |
| G5 | কাউন্টার যোগ করার ইন্টারফেস নেই (QR পোস্টার + হাতে URL) | P1 |
| G6 | ডিজাইন অনুযায়ী desktop shell (শীর্ষ ট্যাব বার), Status পাতা, Printer Settings ডায়ালগ, Tray মেনু (১২ আইটেম), Toast স্টাইল নেই | P1 |
| G7 | Settings ১১ গ্রুপ একত্রিত নয় (ছড়ানো) | P1 |
| G8 | Reports, Jobs ফিল্টার, Subscription অবস্থা, "This Month" নেই | P2 |
| G9 | ভয়েস: ক্লিপ ও ইংরেজি সংস্করণ, TTS পাইপলাইন নেই | P1 |
| G10 | লোগো/আইকন/PWA ম্যানিফেস্ট আইকন অডিট ও ডিজাইন বাকি | P1 |
| G11 | প্রিন্টে paper type/quality/borderless কন্ট্রোল সীমিত (Sumatra) | P2 |
| G12 | Code signing সার্টিফিকেট নেই (SmartScreen) | P1 (পাইলটের আগে) |
| G14 | সার্ভিস হার্ডকোড (PWA-তে ৪টি স্থির কার্ড, "NID কপি" সহ); নতুন সার্ভিস/Presets তৈরির ব্যবস্থা নেই | P1 |
| G13 | প্রি-লঞ্চ: রোল/স্টাফ PIN, Audit Log, auto-delete, sensitive-সার্ভিসের watermark যাচাই | P1 |

---

## ৪. কাজের ক্রম (Phases)

নির্ভরতা বুঝে ক্রম। প্রতিটি Phase আলাদা PR/commit-সিরিজ।

| Phase | কাজ | নির্ভর করে | STOP |
|---|---|---|---|
| **A** | Hygiene ও গোপনীয়তা (§৫) | কিছুতে না | আমার হাতে: রিপো Private করা |
| **B** | Desktop shell: এন্ট্রি আলাদা, ট্যাব বার, Status পাতা (§৬, Step 1–3) | A | Step 3 শেষে স্ক্রিনশট |
| **S** | Services ও Presets (§৯ক) | A | ডেটা মডেল ও মাইগ্রেশন শেষে |
| **C** | Device Mode: প্রথমবার Master/Counter বাছাই, লক, LAN IP (§৭) | A | ধাপ ১ (লক) শেষে |
| **D** | Counters + Device Token + Counter Mode (§৮) | C | ধাপ ২ (অ্যাক্সেস টেস্ট) শেষে |
| **E** | বাকি UI: Dashboard, Printers, Jobs/POS/Reports, Tray, Toast (§৬, Step 4–9) | B | Step 8 (tray) শেষে |
| **F** | Settings ১১ গ্রুপ (§৯) | B, D | — |
| **G** | ভয়েস বাংলা + ইংরেজি (§১০) | B | — |
| **H** | Asset অডিট ও ব্র্যান্ডিং (§১২) | B | — |
| **I** | ইনস্টলার, signing, পাইলট প্রস্তুতি (§১৩) | সব | — |

B ও C সমান্তরালে চলতে পারে, কিন্তু D-র আগে C শেষ হতে হবে।

---

## ৫. Phase A: Hygiene ও গোপনীয়তা

- **আমার করণীয় (agent নয়):** রিপো Private করা; পরে AAA Tech Solutions GitHub Organization-এ ট্রান্সফার; 2FA চালু।
- Agent: `.freebuff` ফোল্ডারে key/token/ব্যক্তিগত তথ্য আছে কিনা স্ক্যান করে রিপোর্ট দাও (মান প্রকাশ না করে শুধু ফাইল ও ধরন)। থাকলে আমাকে জানাও যাতে key বদলাই।
- একটা lockfile রাখো (কোনটা, আমাকে জিজ্ঞেস করে), অন্যটা সরাও; `.gitignore` ও CI সেই অনুযায়ী।
- `.env.example`, secrets scan (gitleaks বা সমতুল্য, dependency লাগলে জিজ্ঞেস করো) CI-তে প্রস্তাব করো।
- `docs/design/` ফোল্ডারে ডিজাইন ছবি (`status-window.jpg`, `printer-settings.jpg`, `tray-menu.jpg`) ও `specs.md` আছে কিনা যাচাই করো; না থাকলে আমাকে জানাও।

---

## ৬. Phase B ও E: Desktop shell ও UI (Step 0 প্ল্যান অনুযায়ী)

রেফারেন্স: `docs/design/status-window.jpg`, `printer-settings.jpg`, `tray-menu.jpg`, `specs.md`। লেআউট, ক্রম, স্পেসিং, রং, আইকন-স্টাইল হুবহু অনুসরণ। ছবির প্রিন্টার ফটো কপি করবে না, আইকন ব্যবহার করো। ছবির `BroxPrint Studio` ও `B` লোগো সব জায়গায় **Alif Shohoj Print**-এ বদলাবে।

### Step ক্রম (প্রতিটি আলাদা commit)

| Step | কাজ |
|---|---|
| 1 | এন্ট্রি আলাদা: `desktop.html` (EXE), `pwa.html` (কাস্টমার), `index.html` (শুধু dev harness); ডেভ সুইচার `import.meta.env.DEV`-এ সীমাবদ্ধ; `vite.config.ts` multi-page; Electron `desktop.html` লোড করে; gateway ফলব্যাক `pwa.html` |
| 2 | Desktop shell: Windows-এর নিজস্ব টাইটেল বার; নকল উইন্ডো বার ও `File/Scan/Services/Counters/Server/Help` মেনু সরানো (কাজ হারাবে না, উপযুক্ত পাতা/Settings-এ সরাও); শীর্ষ ট্যাব বার; উইন্ডো `minWidth 900 / minHeight 600`, সাইজ/পজিশন মনে রাখা, single-instance |
| 3 | **Status পাতা** + design tokens। **STOP, স্ক্রিনশট** |
| 4 | Dashboard (অর্ডার ইনবক্স) |
| 5 | Printers পাতা + Printer Settings ডায়ালগ |
| 6 | Jobs, POS, Reports |
| 7 | Settings প্যানেল (§৯) |
| 8 | Tray মেনু **STOP** |
| 9 | Windows Toast |
| 10 | Branding/i18n cleanup, README |

### ট্যাব বার
`Status | Dashboard | Printers | Counters | Jobs | POS | Reports | Settings`
ডানে: Help আইকন, দোকানের নাম + Shop Code ড্রপডাউন। সাইডবার শুধু Settings-এর ভেতরে (১১ গ্রুপ)। সক্রিয় ট্যাব teal ফিল।

### পাতা অনুযায়ী বিষয়বস্তু
- **Status:** বাঁ কলামে Connected কার্ড, দোকান কার্ড (নাম, Shop Code ব্যাজ, Subscription: Active), PRINTERS (n) তালিকা (নাম, মডেল, online/offline ডট, ⋮ মেনু, রিফ্রেশ), "View all printers →"; ডানে OVERVIEW (Pending, Today, This Month স্ট্যাট কার্ড, "View … →"), RECENT JOBS টেবিল (Job Name, Printer, Status, Time), নিচে বাটন: Open Dashboard (প্রাইমারি), Printer Settings, Shop। ডেটা বিদ্যমান WebSocket/queue/DB থেকে, হার্ডকোড ডেমো নয়।
- **Dashboard:** অর্ডার কার্ড (টেবিল নয়): #নম্বর, কত আগে, সার্ভিস, স্পেক, প্রিন্টার (অটো) + ডট, দাম + পেইড/কাউন্টারে, কাউন্টার ট্যাগ, Preview বক্স (ডেটা না থাকলে লোডিং/ত্রুটি অবস্থা), বাটন: Reject, Edit, Approve। কাউন্টার ফিল্টার বিদ্যমান আকারে।
- **Printers:** Online/Offline, DPI, শিট কাউন্ট, Capabilities, Default for। **Printer Settings ডায়ালগ:** "Detected Printers", প্রতিটি কার্ডে চেকবক্স, আইকন, নাম, Ready/Offline, Capabilities ও Default for, Offline-এর চেকবক্স ফাঁকা, নিচে Refresh Printers ও Save Changes। সেভ করলে Routing নিয়মে প্রভাব।
- **Jobs:** সব job, ফিল্টার (স্ট্যাটাস, প্রিন্টার, তারিখ)।
- **POS:** আজকের আয়, প্রিন্ট সংখ্যা, পেন্ডিং কিউ, সার্ভিস মূল্য তালিকা, অটো-প্রিন্ট, কাউন্টার ফিল্টার। বিদ্যমান কম্পোনেন্ট ভাঙবে না।
- **Reports:** আজ ও এই মাসের সারাংশ, আয়ের হিসাব।
- **Counters:** §৮।

### অর্ডার ওয়ার্কফ্লো নিয়ম
- **Approve:** auto-approve নিয়ম Settings-এ; `sensitive` সার্ভিস কখনো অটো-অ্যাপ্রুভ নয়।
- **Reject:** কারণ বাধ্যতামূলক; পেইড হলে অটো refund; ফাইল auto-delete।
- **Edit:** কপি, সাইজ, Color/B&W, প্রিন্টার override, Crop/Rotate/Layout। দাম বদলালে কাস্টমারের সম্মতি লাগবে। `sensitive` সার্ভিসের কন্টেন্টে retouch বন্ধ। সব পরিবর্তন Audit Log-এ।
- **সুরক্ষা:** idempotency key (ডাবল অ্যাকশন ঠেকাতে), "Locked by [নাম]" (একাধিক স্টাফ), ১০–১৫ মিনিট timeout।

### Tray মেনু (ক্রম)
`Alif Shohoj Print` (শিরোনাম) → Connected → Shop: <নাম> → Pending Jobs: n → Today Printed: n → Open Dashboard → Show Status Window → Printer Settings → Shop Settings → Restart Agent → Quit। সংখ্যা গতিশীল; নতুন অর্ডারে ট্রে আইকনে লাল ব্যাজ। প্রথমে নেটিভ Electron Menu; গোল কোণের কাস্টম পপআপ আলাদা ঐচ্ছিক কাজ হিসেবে প্রস্তাব করো।

### Windows Toast
শিরোনাম "Alif Shohoj Print", `নতুন অর্ডার #127: Passport Photo, 4R × 4`, `Epson L805 • ৳80 • Paid`, বাটন [দেখুন] [Approve]। বাংলা সাউন্ড, Do Not Disturb সমর্থন, ২–৩ মিনিটে reminder। পরিচয়পত্র নম্বর/নাম নয়, `sensitive` সার্ভিসে ফাইলের নামও নয়।

---

## ৬ক. UI Refactor: কোড অডিট ও ফাইল-ভিত্তিক প্ল্যান (Step 0)

> এই অংশ agent-এর নিজের Step 0 অডিট (`docs/` প্ল্যান) থেকে নেওয়া, অর্থাৎ বাস্তব কোড দেখে লেখা। §২-এর অনুমানের সাথে গরমিল হলে **এই অংশের ফাইল পাথই সঠিক ধরবে**। রেফারেন্স: `docs/design/status-window.jpg`, `printer-settings.jpg`, `tray-menu.jpg`, `specs.md`।

### ১. এখন কোথায় কী আছে

| এলাকা | ফাইল | মন্তব্য |
|---|---|---|
| একক এন্ট্রি | `index.html` → `src/main.tsx` → `src/App.tsx` | এক পেজে তিনটি ভিউ + তিন-ট্যাব সুইচার |
| ডেভ-প্রিভিউ সুইচার | `src/shared/components/NavigationHeader.tsx` | `Agent \| Customer PWA \| Shop POS`, সবসময় দৃশ্যমান |
| নকল উইন্ডো chrome | `src/features/print-agent/WindowsAgentView.tsx` (প্রায় লাইন ২৬০–৪০৪) | হাতে আঁকা টাইটেল বার (মিনিমাইজ/ম্যাক্সিমাইজ/ক্লোজ), `File/Scan/Services/Counters/Server/Help` মেনু বার ও পাঁচটি ভেতরের ট্যাব |
| POS | `src/features/shop-pos/ShopPosView.tsx` | বাস্তব: অর্ডার টেবিল, মূল্য, দোকান সেটিংস, কাউন্টার, অটো-প্রিন্ট |
| অর্ডার ইনবক্স | `src/features/shop-pos/OrderCardModal.tsx` | বাস্তব: অর্ডার কার্ড, edit drawer, reject কারণ, approve |
| Customer PWA | `src/features/customer-pwa/CustomerPwaView.tsx` | বাস্তব: ৫ ধাপ, ভয়েস গাইড, আপলোড, crop, pay, token slip |
| Toast | `src/shared/components/WindowsToast.tsx` | বাস্তব: অর্ডার অ্যালার্ট, দেখুন/Approve |
| Electron main | `electron/main.ts` | Tray (২ আইটেম), single-instance, একটি BrowserWindow, WS + gateway + queue + sound |
| Gateway | `electron/services/local-gateway.ts` | LAN customer PWA-র জন্য `dist` সার্ভ ও static fallback `index.html` |
| State | `src/shared/context/StudioContext.tsx` | দোকান প্রোফাইল, প্রিন্টার, জব (desktop SQLite queue থেকে IPC দিয়ে), কাউন্টার, মূল্য, সার্ভিস, toast, modal |

### ২. ডিজাইনের স্ক্রিন বনাম বিদ্যমান কোড

| ডিজাইনের স্ক্রিন/উপাদান | অবস্থা | বিদ্যমান কোড |
|---|---|---|
| Status: Connected কার্ড | ⚠️ আংশিক | `WindowsAgentView` কনসোল হেডার (ডেমো টেক্সট, ডিজাইনের লেআউট নয়) |
| Status: দোকান কার্ড + Shop Code ব্যাজ + Subscription | ⚠️ আংশিক | `shopProfile` (নাম/কোড) আছে; Subscription অবস্থা নেই |
| Status: `PRINTERS (n)` তালিকা + online/offline ডট + ⋮ মেনু | ⚠️ আংশিক | `StudioContext`-এর `printers`; এখন ৩টি কার্ড, তালিকা নয় |
| Status: OVERVIEW স্ট্যাট কার্ড | ⚠️ আংশিক | `pendingJobsCount`, `todayPrintedCount` আছে; "This Month" নতুন |
| Status: RECENT JOBS টেবিল | ❌ | পেন্ডিং জব তালিকা অন্য আকারে আছে; টেবিল + সময় কলাম নেই |
| Status: নিচের বাটন সারি | ⚠️ আংশিক | বাটনগুলো এজেন্টের ট্যাবে ছড়ানো |
| ট্যাব বার (`Status/Dashboard/Printers/Counters/Jobs/POS/Reports/Settings`) | ❌ | এখন পাঁচটি *ভেতরের* এজেন্ট ট্যাব |
| ট্যাব বারের ডানে `?` ও দোকান ড্রপডাউন | ❌ | ব্র্যান্ড ও দোকানের নাম `NavigationHeader`-এ |
| Dashboard: অর্ডার ইনবক্স কার্ড | ✅ | `OrderCardModal.tsx` (`activeOrderCardJob`) |
| Dashboard: কাউন্টার ফিল্টার | ✅ | `ShopPosView.tsx` ফিল্টার ট্যাব |
| Printers পাতা: কনসোল ডেটা (Online/Offline, DPI, শিট কাউন্ট) | ✅ | `WindowsAgentView` `printers` ট্যাব + `WindowsGdiGenericDriver` capability registry |
| Printer Settings ডায়ালগ | ⚠️ আংশিক | add-printer মডাল আছে; "Detected Printers" চেকলিস্ট ডায়ালগ নতুন |
| Jobs তালিকা + স্ট্যাটাস/প্রিন্টার/তারিখ ফিল্টার | ⚠️ আংশিক | `ShopPosView` টেবিলে শুধু স্ট্যাটাস ফিল্টার |
| POS | ✅ | `ShopPosView.tsx` |
| Reports (Today / This Month) | ⚠️ আংশিক | শুধু `todayPrintedCount`, `todayEarningsBDT` |
| Settings প্যানেল (১১ বাংলা গ্রুপ) | ❌ | সেটিংস `ShopPosView` (ট্যাব ৩) ও `WindowsAgentView`-এ ছড়ানো |
| Tray মেনু (১২ সারি) | ⚠️ আংশিক | `electron/main.ts`-এ ২ আইটেম |
| Windows Toast (শিরোনাম + `#127: …` + প্রিন্টার • দাম • Paid) | ⚠️ আংশিক | `WindowsToast.tsx` শুধু শিরোনাম + `serviceLabelBn, paperSize × copies` |
| প্রোডাক্টের নাম/লোগো এক জায়গায় | ❌ | `ALIF SHOHOJ PRINT`, `BP`, `BroxPrint Studio`, `ALIF SHOHOJ PRINT 2026` ছড়ানো (নামকরণের patch আংশিক হয়েছে) |
| নতুন UI টেক্সটের i18n কী | ❌ | হার্ডকোড বাংলা/ইংরেজি |

**Step 0-র পরে যোগ হওয়া সিদ্ধান্তের কারণে অতিরিক্ত (এখনো ❌):** Counters ট্যাব ও Add Counter ডায়ালগ (§৮) · Device Mode উইজার্ড (§৭) · সার্ভিস ব্যবস্থাপনা ও Presets (§৯ক) · PWA-র হার্ডকোড করা সার্ভিস কার্ড গতিশীল করা।

### ৩. ফাইল-ভিত্তিক লক্ষ্য পরিবর্তন

**নতুন:**
- `src/shared/config/brand.ts`: প্রোডাক্টের নাম, বাংলা নাম, কোম্পানি, app id, লোগো প্লেসহোল্ডার।
- `src/shared/i18n/strings.ts` ও `src/shared/i18n/useTranslation.ts`: `en`/`bn` ডিকশনারি ও `t(key)`।
- `desktop.html` ও `src/desktop/main.tsx`: EXE renderer এন্ট্রি (শুধু desktop shell)।
- `pwa.html` ও `src/pwa/main.tsx`: কাস্টমার PWA এন্ট্রি (শপ LAN-এর ফোনে)।
- `src/features/desktop/DesktopApp.tsx`: shell (ট্যাব বার, help মেনু, দোকান ড্রপডাউন, পাতা রাউটিং)।
- `src/features/desktop/pages/StatusPage.tsx` (Step 3) এবং `src/features/desktop/pages/*`: Dashboard, Printers, Counters, Jobs, Reports, Settings (Step 4–7)।

**পরিবর্তন:**
- `index.html`: ডেভ harness হিসেবে থাকবে; তিন-ট্যাব সুইচার শুধু `import.meta.env.DEV`-এ।
- `src/shared/components/NavigationHeader.tsx`: সুইচার DEV-এর বাইরে লুকানো।
- `vite.config.ts`: multi-page build (`index`, `desktop`, `pwa`)।
- `src/features/print-agent/WindowsAgentView.tsx`: নকল টাইটেল বার ও মেনু বার সরানো; পাঁচটি ভেতরের ট্যাব embeddable পাতার বডি (`initialTab`, `onTabChange`)।
- `electron/main.ts`: `desktop.html` লোড; উইন্ডো সাইজ/পজিশন মনে রাখা; `minWidth 900 / minHeight 600`; প্রোডাক্টের নাম ও app id।
- `electron/services/local-gateway.ts`: static fallback `pwa.html`; কাউন্টার PC-র জন্য `/` POS সার্ভ করা বজায় রাখা (Counter Mode-এর পর পুনর্বিবেচনা, §৮)।
- `electron-builder.yml`: `productName: Alif Shohoj Print`, `appId: com.aaatech.alifshohojprint` (**ব্যাপক rollout-এর আগে নিশ্চিতকরণ**)।
- `src/index.css`: ছবি থেকে teal primary ও surface টোকেন, বাংলা ফন্ট ফলব্যাক।
- `README.md`: এন্ট্রি পয়েন্ট, প্রোডাক্টের নাম, ইনস্টল পাথ।

**সরানো (Step 2-র পর dead code):** নকল window-bar/menu-bar markup এবং `WindowsAgentView`-এর ভেতরের `isMinimized`/`isMaximized` state।

### ৪. কাজের ক্রম (প্রতিটি আলাদা commit)

| Step | commit-এর পরিধি |
|---|---|
| 0 | এই প্ল্যান (সম্পন্ন) |
| 1 | আলাদা এন্ট্রি, ডেভ-অনলি সুইচার, Electron `desktop.html` লোড করে, gateway `pwa.html` সার্ভ করে |
| 2 | Desktop shell: ট্যাব বার, help মেনু, দোকান ড্রপডাউন, উইন্ডো স্টেট, নকল chrome সরানো |
| 3 | Status পাতা + design tokens (**STOP, স্ক্রিনশট**) |
| 4–7 | Dashboard, Printers/Printer Settings ডায়ালগ, Jobs/POS/Reports, Settings প্যানেল (Counters ও Services ট্যাব এখানে, §৮ ও §৯ক-র সাথে সমন্বয়ে) |
| 8 | Tray মেনু (**STOP**) |
| 9 | Windows Toast restyle |
| 10 | Branding/i18n cleanup, README |

### ৫. বাধ্যবাধকতা (বজায় রাখতে হবে)

- কোনো নতুন dependency নয়।
- বিদ্যমান WebSocket প্রোটোকল, SQLite schema, IPC bridge ও preload surface অপরিবর্তিত।
- প্রতিটি ধাপের পর `npm run verify` পাস।
- রং/ফন্ট রেফারেন্স ছবি থেকে: teal `#0F766E` প্রাইমারি, সাদা সারফেস, নরম বর্ডার `#E4E7EB`, radius ৮–১২px, Segoe UI / Noto Sans Bengali।
- রেফারেন্সের প্রিন্টার ফটো সরিয়ে আইকন (বিদ্যমান `lucide-react`)।

### ৬. অগ্রগতি ও বাকি যাচাই

- সম্পন্ন: Step 0 অডিট ও প্ল্যান; brand/shell **naming** patch (আংশিক)।
- বাকি: Step 1 থেকে ১০। পূর্ণ visual shell (status window, tabs, tray menu, settings, order-card UI) **Windows ডেস্কটপ মেশিনে বাস্তব `npm run verify` ও `npm run dev:desktop` চালিয়ে** চোখে যাচাই করতে হবে; এই ধরনের GUI যাচাই Windows runtime ছাড়া সম্ভব নয়।

---

## ৭. Phase C: Device Mode (প্রথমবার Master/Counter, লক, LAN IP)

### লক্ষ্য
১) প্রথমবার চালুতে ইউজার ঠিক করবে এই PC Master নাকি Counter।
২) Counter বাছলে চেকবক্স: **"এই PC স্থায়ীভাবে Counter হিসেবে লক করো (আর Master মোডে ফেরা যাবে না)"**। ডিফল্ট টিক নেই; টিক দিলে নিশ্চিতকরণ ডায়ালগ।
৩) LAN IP অটো-ডিটেক্ট: Master নিজের IP বের করবে; Counter LAN-এ Master খুঁজে পাবে।

### ধাপ ১: মোড ও লক main process-এ (সবার আগে) **STOP**
- মোড (`unset | master | counter`) ও লক-ফ্ল্যাগ main process-এর userData-তে `device-mode.json`-এ (atomic write)। renderer-এর `localStorage` আর সত্যের উৎস নয়; renderer শুধু IPC (`getDeviceMode`) দিয়ে জানবে।
- লক হলে main process প্রত্যাখ্যান করবে: মোড বদল এবং সব master-only IPC (Settings, Reports, POS আয়/মূল্য সম্পাদনা, প্রিন্টার কনফিগ ও Routing, token প্রদর্শন, QR পোস্টার ছাপা, Counters ব্যবস্থাপনা, স্টাফ, Audit Log)। শুধু UI লুকালে চলবে না।
- Counter মোডে (লক হোক বা না হোক) gateway হোস্টিং, প্রিন্টার ব্যবস্থাপনা ও queue-র master অংশ চালু হবে না।
- লক না থাকলে Settings-এর "Device mode" থেকে মোড বদলানো যাবে (কনফার্মেশন সহ)।
- **লক ফেরানোর কোনো UI/CLI সুইচ নেই।** পুনরুদ্ধার: আনইনস্টল + userData মুছে নতুন ইনস্টল। README ও চেকবক্সের পাশের সতর্কবার্তায় এটা স্পষ্ট লেখো।
- docs-এ সীমা লেখো: এটা অপারেটরের ভুল ঠেকানোর ব্যবস্থা; Windows অ্যাডমিন ফাইল মুছলে ঠেকানো যায় না। আসল নিরাপত্তা প্রতি-কাউন্টার Device Token (§৮)।
- **গুরুত্বপূর্ণ:** কাউন্টার PC-তেও একই EXE ইনস্টল থাকে, তাই master কোডও সেখানে আছে। সুরক্ষা মূলত (ক) main-এর IPC গার্ড ও (খ) gateway-র Device Token যাচাই; UI লুকানো নয়।

### ধাপ ২: প্রথমবার চালুর Setup উইজার্ড
- মোড `unset` হলে অ্যাপ সরাসরি উইজার্ডে যাবে। দুটি বড় কার্ড: Master (দোকানদারের মূল PC), Counter (শুধু কাউন্টার)।
- Master: নিজের LAN IP ও gateway URL দেখাও, TLS অবস্থা জানাও, তারপর সাধারণ অ্যাপ।
- Counter: Master খোঁজা (ধাপ ৪) → লক চেকবক্স → কাউন্টার পেয়ারিং (§৮; যতদিন না তৈরি, বিদ্যমান shared token এন্ট্রি ও `TODO` চিহ্ন)।

### ধাপ ৩: Master-এর LAN IP অটো-ডিটেক্ট
- `os.networkInterfaces()` থেকে IPv4; শুধু প্রাইভেট রেঞ্জ (10/8, 172.16/12, 192.168/16); loopback ও link-local (169.254.x.x) বাদ।
- ভার্চুয়াল অ্যাডাপ্টার বাদ (VirtualBox, VMware, WSL/vEthernet, Hyper-V, Docker, VPN/TAP; নাম/MAC প্রিফিক্স দেখে)। সক্রিয় ও গেটওয়ে-যুক্ত অ্যাডাপ্টার অগ্রাধিকার।
- একাধিক প্রার্থী থাকলে ড্রপডাউন (অ্যাডাপ্টারের নামসহ); সেরাটি ডিফল্ট।
- IP বদলালে (DHCP) শনাক্ত করে gateway URL ও QR আপডেট; ছাপা QR পোস্টার পুরনো হতে পারে জানাও। স্ট্যাটিক IP/DHCP reservation-এর পরামর্শ UI ও docs-এ।
- QR URL: `https://<auto-ip>:43822/?shop=...`।
- TLS: সার্টিফিকেটের SAN-এ IP না থাকলে বা TLS কনফিগ না থাকলে স্পষ্ট সতর্কবার্তা। সার্টিফিকেট নিজে বানাবে/ইনস্টল করবে না। ফায়ারওয়াল নিজে বদলাবে না; TCP 43822-এর নির্দেশনা দাও।

### ধাপ ৪: Counter-এর জন্য Master অটো-ডিসকভারি
- Master প্রতি ~৫ সেকেন্ডে LAN-এ ছোট UDP ব্রডকাস্ট beacon (Node `dgram`, নতুন dependency নয়; mDNS লাগলে আগে জিজ্ঞেস)। বিষয়বস্তু: দোকানের নাম, Shop Code, gateway URL, প্রোটোকল ভার্সন। **token/কোড/গোপন কিছু নয়।**
- Counter উইজার্ডে beacon শুনে Master-এর তালিকা; নির্বাচনে URL নিজে ভরে। একাধিক Shop Code থাকলে ব্যবহারকারী বাছবে।
- ফলব্যাক: হাতে URL; ঐচ্ছিক "সাবনেট স্ক্যান" (শুধু পোর্ট 43822, সীমিত সময়/রেঞ্জ, ইউজার চাইলে)।
- Master IP বদলালে Counter আবার discovery করে Shop Code মিলিয়ে নিজে পুনঃসংযোগ করবে। অচেনা Master-এ কিছু পাঠাবে না।
- discovery শুধু ঠিকানা দেয়, অথেনটিকেশন নয়।

### ধাপ ৫: মাইগ্রেশন
- `localStorage`-এ মোড থাকলে প্রথম রানে main কনফিগে কপি (লক = false) ও একবার জানাও। না থাকলে উইজার্ড।
- আনইনস্টলে সেটিংস, queue ও লক-ফ্ল্যাগ থাকে।

### টেস্ট (বাধ্যতামূলক)
`unset`-এ উইজার্ড ছাড়া কিছু খোলে না · লক হলে মোড-বদল IPC প্রত্যাখ্যাত · লক হলে প্রতিটি master-only IPC প্রত্যাখ্যাত (তালিকা ধরে) · `localStorage` সম্পাদনায় মোড বদলায় না · IP ফিল্টার (mock) · একাধিক অ্যাডাপ্টারে ডিফল্ট · beacon-এ গোপন তথ্য নেই · IP বদলে QR আপডেট · মাইগ্রেশন।

---

## ৮. Phase D: Counters, Device Token, Counter Mode

### মূল নিয়ম
যে PC কাউন্টার হিসেবে যোগ হবে সেটি **শুধুই কাউন্টার**: অন্য কাউন্টার বা মূল PC-র কোনো সেটিং/ফিচার দেখতে বা ডাকতে পারবে না।

### ধাপ ১: ডেটা ও অথেনটিকেশন (সার্ভারে, সবার আগে)
- `counters`: id, code (CTR-n অটো), name, type (`master | lan`), operator_id (nullable), allowed_services[], can_approve (ডিফল্ট false), status (`active | disabled`), last_seen, created_at।
- `device_tokens`: counter_id, **token hash** (প্লেইন নয়), created_at, revoked_at।
- `pairing_codes`: ৬ সংখ্যা, ১০ মিনিট বৈধ, একবার ব্যবহার্য, counter_id-তে বাঁধা; রেট লিমিট; বারবার ভুলে সাময়িক লক।
- ফ্লো: Add Counter → কোড/QR → কাউন্টার PC-তে কোড → gateway Device Token দেয় → কোড বাতিল।
- Master একটাই; দ্বিতীয় Master তৈরি করা যাবে না।
- shared token থেকে migrate করার পথ দাও। **পুরনো token বন্ধ করার আগে আমাকে জিজ্ঞেস করো।** বর্তমান shared token কোথায় কোথায় ব্যবহৃত তার তালিকা দাও।

### ধাপ ২: সার্ভারে অ্যাক্সেস নিয়ন্ত্রণ **STOP (অ্যাক্সেস টেস্টের ফল দেখাও)**
- gateway-র প্রতিটি রিকোয়েস্ট ও WebSocket সংযোগে Device Token যাচাই → counter_id।
- **Allowlist (কাউন্টার যা পারবে):** নিজের কাউন্টারের অর্ডার/জব তালিকা; নিজের অর্ডারের Preview; নিজের জবের অবস্থা; সাধারণ "প্রিন্টার ব্যস্ত/অফলাইন" সংকেত; নিজের কাউন্টারের তথ্য; `can_approve` থাকলে নিজের অর্ডারে Approve/Reject।
- **বাকি সব 403:** Settings, Reports, POS আয়/মূল্য সম্পাদনা, প্রিন্টার কনফিগ ও Routing, স্টাফ, Audit Log, Counters ব্যবস্থাপনা, ভয়েস/পেমেন্ট সেটিং; অন্য কাউন্টারের id/অর্ডার।
- WebSocket-এ কাউন্টার শুধু নিজের রুমে; ব্রডকাস্টে অন্য কাউন্টারের ডেটা যাবে না।
- **সব প্রিন্ট জব মূল PC-র প্রিন্টারে।** কাউন্টার প্রিন্টারের তালিকা/নাম/কনফিগ পাবে না, নিজে প্রিন্ট চালাবে না। (সিদ্ধান্ত: এটা ধরে নেওয়া হয়েছে, বদলাতে চাইলে আমি বলবো।)
- কাউন্টার মুছলে/বন্ধ করলে token সঙ্গে সঙ্গে revoke, চলমান সংযোগ কাটো।
- প্রতিটি কাজ Audit Log-এ: কাউন্টারের কোড, কাজ, সময়।

### ধাপ ৩: Master PC-র UI
- ট্যাব `Counters` (Printers-এর পরে)। তালিকা-সারি: অনলাইন/অফলাইন ডট, নাম, কোড ট্যাগ (CTR-1) ও ধরন ট্যাগ (Master/LAN), অপারেটর, সার্ভিস, চলমান অর্ডার সংখ্যা, ⋮ মেনু (এডিট, বন্ধ করুন, মুছুন), অফলাইনে last_seen।
- **Add Counter ডায়ালগ:** নাম · কোড (অটো, read-only) · ধরন (Master থাকলে ডিসেবল) · অপারেটর (স্টাফ থেকে) · যে সার্ভিস নেবে (`services` তালিকা থেকে বহু-নির্বাচন, §৯ক) · ☐ "অর্ডার Approve/Reject করতে পারবে" (ডিফল্ট বন্ধ) · পেয়ারিং কোড + QR (১০ মিনিটের কাউন্টডাউন) · Cancel / Add Counter। **ডিফল্ট প্রিন্টার ঘর নেই।**
- মুছার আগে কনফার্মেশন; চলমান অর্ডার থাকলে সতর্কবার্তা।

### ধাপ ৪: Counter Mode (কাউন্টার PC-র দিক)
- কাউন্টার PC §৭-এর লক-করা Counter মোডে চলে এবং শুধু **কাউন্টার ইনবক্স** দেখায়: নিজের কাউন্টারের নাম/কোড, সংযোগ অবস্থা, নিজের অর্ডার কার্ড (Preview; `can_approve` থাকলে Reject/Approve), নিজের জবের অবস্থা। ট্যাব বারে শুধু এই পাতা।
- ব্রাউজার/PWA বিকল্প: gateway-র `/counter` পাতা, আলাদা entry/chunk, মূল অ্যাপের কম্পোনেন্ট import করবে না। (EXE নাকি `/counter`, agent প্রস্তাব দেবে; আমি সিদ্ধান্ত নেব।)
- প্রথমবার পেয়ারিং কোড স্ক্রিন → Device Token সংরক্ষণ (Windows Credential/DPAPI-সুরক্ষিত স্টোরেজ প্রস্তাব করো; প্লেইন ফাইল নয়)।
- সংযোগ কাটলে বা token revoke হলে স্পষ্ট বার্তা ও পুনরায় পেয়ার করার পথ।

### টেস্ট (বাধ্যতামূলক)
কাউন্টার টোকেনে allowlist-বহির্ভূত প্রতিটি এন্ডপয়েন্টে 403 · অন্য কাউন্টারের অর্ডারে 403 · WebSocket-এ অন্য কাউন্টারের ইভেন্ট আসে না · মেয়াদোত্তীর্ণ/ব্যবহৃত পেয়ারিং কোড ব্যর্থ · revoke-এ সংযোগ কাটে · দ্বিতীয় Master হয় না · `can_approve` বন্ধে Approve 403।

---

## ৯. Phase F: Settings (১১ গ্রুপ, ৫৯ সেটিং)

কাঠামো: বাঁয়ে ১১ গ্রুপের তালিকা, ডানে ফর্ম (ON/OFF টগল, সংখ্যা ইনপুট), শেষে [ডিফল্টে ফেরান] [সেভ করুন]। Server-authoritative; পরিবর্তনে WebSocket ইভেন্ট `settings.updated` দিয়ে সব Agent ও কাস্টমার পেজে প্রযোজ্য। Role-based (Owner/Manager/Operator)। Export/Import backup। যেগুলোর ব্যাকএন্ড নেই সেগুলোতে "শীঘ্রই আসছে" চিহ্ন; কাজ করছে এমন ভান করবে না।

**সীমাবদ্ধতা:** Audit Log বন্ধ করার টগল নেই; `sensitive` সার্ভিসের ফাইল সংরক্ষণকাল প্ল্যাটফর্ম সর্বোচ্চ সীমার বেশি নয়।

| গ্রুপ | মূল সেটিং |
|---|---|
| ১. দোকান ও অর্ডার | Accepting Orders (ON), Break Mode, কর্মঘণ্টা অটো চালু/বন্ধ, সর্বোচ্চ অপেক্ষমাণ অর্ডার (20), সর্বোচ্চ কপি/ফাইল সাইজ (50 / 20MB) |
| ২. সার্ভিস ও Presets | সার্ভিস তৈরি/এডিট/ডুপ্লিকেট/মুছুন, প্রতিটি আলাদা ON/OFF, দাম, অপশন, রাউটিং, `sensitive` ফ্ল্যাগ, প্রদর্শন ক্রম, Presets লাইব্রেরি (বিস্তারিত §৯ক) |
| ৩. অ্যাপ্রুভাল/Edit | ম্যানুয়াল অ্যাপ্রুভাল ON, অটো-অ্যাপ্রুভাল (`sensitive` সার্ভিস কখনো নয়), Edit অনুমতি, দাম বদলে Customer Confirm ON, timeout 15 মিনিট |
| ৪. নোটিফিকেশন | Toast ON, বাংলা সাউন্ড ON, ভলিউম 70%, Reminder ON, Do Not Disturb |
| ৫. প্রিন্টার | প্রতিটি আলাদা, অটো Routing ON, কাস্টম নিয়ম (যেমন "Passport Photo সবসময় Epson"), Fallback প্রিন্টার, কালি/কাগজ alert, Test Print |
| ৬. ভয়েস গাইড | চালু/বন্ধ, ডিফল্ট ভাষা (বাংলা/English), গতি Normal, কাস্টম রেকর্ড, ভয়েস কমান্ড OFF |
| ৭. পেমেন্ট | bKash/Nagad, Pay at Counter, Reject হলে অটো Refund |
| ৮. নিরাপত্তা | Auto-delete ON, `sensitive` সার্ভিসের Preview Watermark ON, Staff PIN, Audit Log ON (বন্ধ করা যাবে না) |
| ৯. স্টাফ | একাধিক অ্যাকাউন্ট, ভূমিকা, "Locked by" সুরক্ষা |
| ১০. Agent/সিস্টেম | অটো-স্টার্ট ON, Tray মিনিমাইজ, অটো-আপডেট, অফলাইন মোড, ভাষা; **Device mode** (§৭) |
| ১১. কাস্টমার পেজ | দোকানের নাম/লোগো, মূল্য তালিকা, কাস্টম বার্তা |

### প্রিন্টার Routing
Order → Capability Matcher → দোকানদারের Routing নিয়ম → প্রিন্টার → Print। উদাহরণ: HP LaserJet = A4 B&W Document; Canon G-series = A4 Color Photo; Epson L805 = 4R/6R Photo। Fallback ও alert আছে। paper type/quality/borderless ড্রাইভার সেটিং থেকে; এটা UI-তে স্পষ্ট নোট দাও।

### অফলাইন
Internet ❌ → Local Queue + Job Cache → Local Printer চলবে → ফিরলে Sync। Idempotency key → duplicate print নয়। Settings-এর শেষ কপি local cache-এ।

---

## ৯ক. Phase S: Services ও Presets

### সিদ্ধান্ত
- **"NID" নামে কোনো বিল্ট-ইন সার্ভিস থাকবে না।** সার্ভিস হার্ডকোড করা নয়।
- **মূল (Master) PC থেকে দোকানদার নতুন সার্ভিস তৈরি করতে পারবেন।** আর **Service Presets** থাকবে: তৈরি-করা টেমপ্লেট থেকে এক ক্লিকে সার্ভিস বানানো, এবং নিজের সার্ভিস Preset হিসেবে সংরক্ষণ।
- কাউন্টার PC সার্ভিস তৈরি বা বদলাতে পারবে না (master-only, §৮-এর 403 নিয়মে)। কাউন্টার শুধু নিজের অনুমতি-পাওয়া সার্ভিসের অর্ডার দেখে।

### `services` ডেটা মডেল (সার্ভারে/main-এ, SQLite)
| ফিল্ড | বিবরণ |
|---|---|
| id, slug | স্থায়ী আইডি (নাম বদলালেও একই থাকে) |
| name (bn, en) | প্রদর্শনের নাম; ডিফল্ট কাস্টমার-ভাষা অনুযায়ী |
| description (bn, en) | কার্ডের নিচের এক লাইন |
| icon | বিদ্যমান আইকন লাইব্রেরি থেকে নির্বাচন (নতুন ছবি আপলোড নয়) |
| category | `photo | document | copy | finishing | other` |
| enabled, sort_order | ON/OFF ও কার্ডের ক্রম |
| input | `image | pdf | any | none` এবং অনুমোদিত ফাইল টাইপ ও সর্বোচ্চ সাইজ |
| options[] | কাস্টমারের বাছাই করা অপশন: কপি সংখ্যা, কাগজ/সাইজ (4R, 6R, A4, A5, পাসপোর্ট শিট ইত্যাদি), রঙ/সাদা-কালো, এক/দুই পাশ, অতিরিক্ত বিকল্প; প্রতিটিতে ডিফল্ট, সর্বনিম্ন/সর্বোচ্চ |
| pricing | মডেল (`per_copy | per_page | per_sheet | fixed | tiered`), মূল্য, ঐচ্ছিক স্তর (যেমন ১–৯ কপি, ১০+), সর্বনিম্ন চার্জ; অপশন-ভিত্তিক বাড়তি (রঙিনে +) |
| routing | প্রয়োজনীয় capability (যেমন `photo_color`, `a4_bw`) এবং ঐচ্ছিক পছন্দের প্রিন্টার; না থাকলে Capability Matcher ঠিক করবে |
| approval | `manual | auto_allowed` (ডিফল্ট `manual`) |
| sensitive | bool। সংবেদনশীল নথি (পরিচয়পত্র, পাসপোর্ট ইত্যাদি) হলে দোকানদার টিক দেবেন |
| retention | ফাইল auto-delete সময় (`sensitive` হলে ছোট ডিফল্ট ও প্ল্যাটফর্ম সর্বোচ্চ সীমা মানতে হবে) |
| voice_clip | ঐচ্ছিক কাস্টম রেকর্ড; না থাকলে নাম TTS-এ |
| allowed_counters | সব কাউন্টার বা নির্দিষ্ট কাউন্টার (এটা `counters.allowed_services`-এর সাথে সামঞ্জস্যপূর্ণ হতে হবে) |
| preset_id | কোন Preset থেকে এসেছে (ঐচ্ছিক) |

### `sensitive` ফ্ল্যাগের প্রভাব (সার্ভিসের নামের ওপর নির্ভর নয়)
অটো-অ্যাপ্রুভ নিষিদ্ধ · Preview-তে watermark · retouch/edit সীমিত (শুধু crop/rotate/layout) · ফাইলের আসল নাম লিস্ট/Toast/লগে নয় · ভয়েসে নম্বর/নাম নয় · ছোট retention · Audit Log-এ প্রতিটি দেখা/পরিবর্তন লেখা · কাউন্টারে শুধু অনুমতি-পাওয়া কাউন্টার।

### Presets
- **লাইব্রেরি:** অ্যাপে কয়েকটি বিল্ট-ইন সাধারণ Preset থাকবে (ডেটা হিসেবে, কোড হিসেবে নয়): Passport Size Photo, 4R Photo Print, 6R Photo Print, Document Print (PDF/ছবি, A4), Photocopy, Scan, Lamination, Online Application Assistance। এখানে কোনো "NID" Preset থাকবে না। দোকানদার চাইলে নিজে "ID Card Copy" নামে সার্ভিস বানিয়ে `sensitive` টিক দিতে পারবেন।
- **ব্যবহার:** `Add Service` → ধাপ ১: "Preset থেকে" বা "ফাঁকা থেকে" → ধাপ ২: নাম, দাম, অপশন, রাউটিং, `sensitive`, retention এডিট → ধাপ ৩: প্রিভিউ (কাস্টমার কার্ড কেমন দেখাবে) → সেভ।
- **অপারেশন:** ডুপ্লিকেট, এডিট, ON/OFF (মুছার বদলে প্রথমে নিষ্ক্রিয়), ক্রম টেনে সাজানো, "নিজের Preset হিসেবে সংরক্ষণ", Export/Import (JSON, ব্যাকআপ ও এক দোকান থেকে আরেক দোকানে)। Import-এ স্কিমা ও মান যাচাই; অবিশ্বস্ত Preset-এ কোড/স্ক্রিপ্ট চালানো যাবে না, শুধু ডেটা।
- **মুছার নিয়ম:** চলমান অর্ডার থাকা সার্ভিস মুছা যাবে না (শুধু নিষ্ক্রিয়); পুরনো অর্ডার/রিপোর্টে সার্ভিসের নাম snapshot হিসেবে অর্ডারেই থাকবে, যাতে নাম বদলালে পুরনো রেকর্ড ভাঙে না।
- **দাম বদল:** চলমান অর্ডারের দাম বদলায় না। দাম বদলের কাস্টমার-সম্মতি নিয়ম (§৬) আগের মতোই।

### প্রভাবিত অন্য অংশ (agent আপডেট করবে)
- **Customer PWA:** সার্ভিস কার্ড গতিশীল (ডেটা থেকে, `enabled` ও দোকানের সময় অনুযায়ী); আপলোড/অপশন/দাম ধাপ সার্ভিসের `options` ও `pricing` থেকে তৈরি; হার্ডকোড করা ৪টি কার্ড সরাতে হবে।
- **Order card/Toast/Dashboard:** সার্ভিসের নাম snapshot থেকে; `sensitive` হলে ফাইলের নাম লুকানো।
- **Printer Routing:** সার্ভিসের `routing` capability অনুযায়ী প্রিন্টার; দোকানদারের কাস্টম নিয়ম ওভাররাইড করতে পারে।
- **Counters:** Add Counter ডায়ালগের "যে সার্ভিস নেবে" তালিকা `services` থেকে (বহু-নির্বাচন); Device Token-এর allowlist-এ সার্ভিস-ভিত্তিক ফিল্টার (সার্ভারে প্রয়োগ)।
- **POS ও Reports:** সার্ভিস-ভিত্তিক মূল্য তালিকা ও আয়ের হিসাব।
- **Settings গ্রুপ ২:** এই পাতাই সার্ভিস ব্যবস্থাপনা (তালিকা + Add Service + Presets)।
- **Voice:** §১০-এর C03 ও `voice_clip`।
- **Asset অডিট:** সার্ভিস আইকন সেট (বিদ্যমান `lucide-react` থেকে নির্বাচন)।

### মাইগ্রেশন
- বিদ্যমান হার্ডকোড সার্ভিসগুলো (Passport photo, 4R photo, Document, Photocopy/Scan, Lamination, "NID copy") খুঁজে বের করো। বিদ্যমান "NID কপি"-র মতো সার্ভিস ডেটা হিসেবে সংরক্ষণ করো কিন্তু নাম বিল্ট-ইন রেখো না: প্রথম রানে একটি জেনেরিক সার্ভিস (যেমন "ID Card Copy", `sensitive = true`) হিসেবে তৈরি করে দোকানদারকে জানাও যে চাইলে নাম বদলাতে/মুছতে পারবেন। বিদ্যমান queue/অর্ডারের সার্ভিস কোড নতুন `services` আইডিতে মিলিয়ে দাও; মেলে না এমন পুরনো অর্ডার ভাঙবে না (snapshot দেখাবে)।
- সব বদল backward-compatible; পুরনো ক্লায়েন্ট/কাউন্টার সংস্করণ যাতে হঠাৎ ভাঙে না তার পরিকল্পনা দাও।

### UI (Settings → সার্ভিস ও Presets)
- তালিকা: আইকন, নাম, ক্যাটাগরি, দামের সারাংশ, ON/OFF টগল, `sensitive` ব্যাজ, ⋮ মেনু (এডিট, ডুপ্লিকেট, Preset হিসেবে সংরক্ষণ, নিষ্ক্রিয়/মুছুন); টেনে ক্রম বদল।
- `+ Add Service` বাটন → উপরের তিন-ধাপ ডায়ালগ। ডায়ালগের শেষে কাস্টমারের সার্ভিস কার্ড ও দাম-ধাপের লাইভ প্রিভিউ।
- Presets ট্যাব: বিল্ট-ইন ও নিজের Preset, ব্যবহার/এডিট/মুছুন (বিল্ট-ইন মুছা যায় না, লুকানো যায়), Import/Export।
- ভ্যালিডেশন: নাম ফাঁকা নয়/ডুপ্লিকেট নয়, দাম ঋণাত্মক নয়, অপশনের min ≤ default ≤ max, routing capability বিদ্যমান প্রিন্টারে মেলে কিনা সতর্কবার্তা (কোনো প্রিন্টার মেলে না হলে সার্ভিস চালু করার আগে সতর্ক)।
- Role: শুধু Owner/Manager সার্ভিস বদলাতে পারবেন; Operator পারবেন না। প্রতিটি বদল Audit Log-এ।

### টেস্ট (বাধ্যতামূলক)
সার্ভিস CRUD ও মুছার নিয়ম (চলমান অর্ডার থাকলে ব্লক) · `sensitive` সার্ভিসে অটো-অ্যাপ্রুভ প্রত্যাখ্যাত, watermark আছে, ফাইলের নাম লিস্ট/Toast/লগে নেই · কাউন্টার টোকেনে সার্ভিস তৈরি/এডিট 403 · কাউন্টার শুধু `allowed_services`-এর অর্ডার পায় · Preset Import-এ অবৈধ স্কিমা প্রত্যাখ্যাত ও কোড চালানো যায় না · দাম গণনা (প্রতিটি মডেল ও স্তর) · পুরনো অর্ডারে নাম snapshot · PWA-তে নতুন সার্ভিস ও নিষ্ক্রিয় সার্ভিসের আচরণ · মাইগ্রেশন।

---

## ১০. Phase G: ভয়েস গাইড (বাংলা ও ইংরেজি)

- `voice-manifest.json` হলো **source of truth** (রিপোতে উপযুক্ত জায়গায় রাখো; গ্রাহকের ক্লিপ PWA-র `public/audio/{lang}/`, দোকানদারের ক্লিপ Electron `resources/sounds/`; বাস্তব পাথ কোড দেখে ঠিক করো)।
- ফরম্যাট: MP3, মনো, 64 kbps, প্রতি ক্লিপ ৩–৮ সেকেন্ড, ভাষা প্রতি ~২ MB।
- **ক্রম:** রেকর্ড করা ফাইল → TTS ফাইল → (পরিবর্তনশীল হলে) server TTS (bn-BD; কণ্ঠের নাম provider ডকুমেন্টেশন থেকে যাচাই) → Web Speech API → শুধু টেক্সট।
- `neverSpeak`: পরিচয়পত্র/পাসপোর্ট নম্বর, পূর্ণ নাম, ফোন নম্বর কখনো না; `sensitive` সার্ভিসের ফাইলের নামও না।
- PWA: ব্রাউজার নিয়মে প্রথম অডিও ট্যাপের পরে; বড় বাটন "🔊 ভয়েস গাইড চালু করুন"; কন্ট্রোল: রিপ্লে, থামান, গতি (0.8/1/1.25), ভাষা (bn/en), মিউট; পছন্দ সংরক্ষিত; Service Worker precache (ভাষা অনুযায়ী, ভার্সন বদলালে পুরনো cache মুছবে); Settings (গ্রুপ ৬) `settings.updated`-এ প্রযোজ্য।
- দোকানদারের `SoundService`: ভলিউম (ডিফল্ট ৭০%), Do Not Disturb মানবে, queue করে বাজাবে (ওভারল্যাপ নয়), একই সাউন্ড ৩ সেকেন্ডে দুইবার নয়, ফাইল না থাকলে সিস্টেম beep। Master নতুন অর্ডারে কাউন্টার নম্বর বলবে (বিদ্যমান আচরণ রাখো)।
- পাইপলাইন: `scripts/voice/generate` (TTS, provider প্লাগেবল, key শুধু env, `--dry-run --lang --ids --force-tts`, recorded ফাইল ওভাররাইট করবে না) · `scripts/voice/import` (রেকর্ড করা ফাইল ID মিলিয়ে কনভার্ট/নর্মালাইজ, `source: recorded`) · `scripts/voice/check` (ফাইল মিল, bn/en ID সমান, সময়, বিট রেট, আকার, neverSpeak, source রিপোর্ট; CI-তে চলার মতো) · `voice-recording-sheet.csv`/`.md`। ffmpeg দরকার হলে আগে জিজ্ঞেস।
- WAV মাস্টার git-এ নয়।

### ক্লিপ তালিকা (গ্রাহক)

C04 ও C05 বাদ (সার্ভিস নির্দিষ্ট ক্লিপ আর নেই; ID পুনর্ব্যবহার করবে না)। সার্ভিসের নাম বলতে: সার্ভিসে ঐচ্ছিক `voice_clip` থাকলে সেটা বাজবে, না থাকলে নাম server/fallback TTS-এ পড়া হবে (`sensitive` সার্ভিসের নামও সাধারণ নামই, ফাইলের নাম নয়)।


| ID | বাংলা | English |
|---|---|---|
| C01 | স্বাগতম! আমি আপনাকে ধাপে ধাপে সাহায্য করব। | Welcome! I'll guide you step by step. |
| C02 | আপনি কী প্রিন্ট করতে চান? নিচের বাটন থেকে বেছে নিন। | What would you like to print? Choose from the buttons below. |
| C03 | আপনার প্রয়োজনীয় সার্ভিসটির কার্ডে চাপুন। | Tap the card for the service you need. |
| C06 | এবার আপনার ফাইল বা ছবি আপলোড করুন। | Now upload your file or photo. |
| C07 | আপলোড হচ্ছে, একটু অপেক্ষা করুন। | Uploading, please wait a moment. |
| C08 | আপলোড সম্পন্ন হয়েছে। | Upload complete. |
| C09 | ছবি ঠিকমতো যায়নি। আবার চেষ্টা করুন। | The upload didn't go through. Please try again. |
| C10 | কয় কপি লাগবে, সংখ্যাটি বেছে নিন। | Choose how many copies you need. |
| C11 | ছবির সাইজ বেছে নিন। | Choose the photo size. |
| C12 | রঙিন নাকি সাদা-কালো, সেটি বেছে নিন। | Choose color or black and white. |
| C13 | প্রয়োজনে ছবি কাটুন বা ঘুরিয়ে নিন। | If needed, crop or rotate the photo. |
| C14 | প্রিভিউ দেখে নিন। সব ঠিক থাকলে "কনফার্ম" চাপুন। | Check the preview. If everything looks right, tap "Confirm". |
| C15 | আপনার অর্ডার দোকানে পাঠানো হয়েছে। দোকানদার দেখে নিশ্চিত করবেন। | Your order has been sent to the shop. The shopkeeper will review and confirm it. |
| C16 | অনুগ্রহ করে অপেক্ষা করুন। | Please wait. |
| C17 | আপনার অর্ডারটি অনুমোদিত হয়েছে। প্রিন্ট শুরু হচ্ছে। | Your order has been approved. Printing is starting. |
| C18 | আপনার প্রিন্ট প্রস্তুত। দোকান থেকে সংগ্রহ করুন। | Your print is ready. Please collect it from the shop. |
| C19 | দোকানদার দাম বদলেছেন। নতুন দাম দেখে সম্মতি দিন। | The shopkeeper has changed the price. Please review the new price and agree. |
| C20 | দুঃখিত, আপনার অর্ডারটি গ্রহণ করা যায়নি। কারণটি নিচে দেখুন। | Sorry, your order could not be accepted. See the reason below. |
| C21 | টাকা দিলে আপনি ফেরত পাবেন। | If you have paid, you will get a refund. |
| C22 | পেমেন্ট করতে বিকাশ বা নগদ বেছে নিন, অথবা কাউন্টারে দিন। | To pay, choose bKash or Nagad, or pay at the counter. |
| C23 | পেমেন্ট সফল হয়েছে। ধন্যবাদ। | Payment successful. Thank you. |
| C24 | দুঃখিত, দোকান এখন অর্ডার নিচ্ছে না। একটু পরে আসুন। | Sorry, the shop is not taking orders right now. Please come back later. |
| C25 | ইন্টারনেট সংযোগ নেই। সংযোগ দেখে আবার চেষ্টা করুন। | No internet connection. Check your connection and try again. |
| C26 | আপনার তথ্য নিরাপদ। কাজ শেষে ফাইল মুছে ফেলা হবে। | Your information is safe. Files will be deleted when the work is done. |
| C27 | ধন্যবাদ! আবার আসবেন। | Thank you! Please come again. |

(দ্রষ্টব্য: LAN-ভিত্তিক বর্তমান আর্কিটেকচারে C25 "ইন্টারনেট নেই"-র বদলে "দোকানের সাথে সংযোগ নেই" ধরনের বাক্য লাগতে পারে। Agent এটা বিবেচনা করে আমাকে প্রস্তাব দেবে।)

### ক্লিপ তালিকা (দোকানদার)

| ID | বাংলা | English |
|---|---|---|
| S01 | নতুন অর্ডার এসেছে। | New order received. |
| S02 | একটি অর্ডার এখনো অপেক্ষায় আছে। | An order is still waiting. |
| S03 | প্রিন্টারে কাগজ শেষ। | The printer is out of paper. |
| S04 | প্রিন্টারে কালি কম। | The printer is low on ink. |
| S05 | প্রিন্টার সংযোগ বিচ্ছিন্ন। | The printer is disconnected. |
| S06 | ইন্টারনেট নেই, অফলাইন মোডে চলছে। | No internet. Running in offline mode. |

### TTS টেমপ্লেট (রানটাইমে)
`আপনার মোট দাম {amount} টাকা।` · `আপনার পিকআপ কোড {code}।` · `আপনার অর্ডার নম্বর {number}।` / `Your total is {amount} taka.` · `Your pickup code is {code}.` · `Your order number is {number}.`
সংখ্যা বলার নিয়ম টেস্ট করো (৮০ → "আশি"; পিকআপ কোড অঙ্ক ধরে ধরে)।

---

## ১১. সিদ্ধান্ত বাকি (আমাকে জিজ্ঞেস করো, নিজে ধরে নেবে না)

1. LAN-ভিত্তিকই থাকবে, নাকি পরে সেন্ট্রাল সার্ভার (PHP/MySQL/Redis/Node WebSocket Gateway + private storage) আসবে? কাস্টমার ইন্টারনেট দিয়ে অর্ডার দিতে চাইলে সেটা লাগবে।
2. TLS-এর বাস্তব সমাধান: কাস্টমারের ফোনে বিশ্বস্ত সার্টিফিকেট কীভাবে (সম্ভাব্য পথ: সত্যিকারের ডোমেইন + লোকাল DNS/ওয়াইল্ডকার্ড সার্টিফিকেট, অথবা অন্য পথ)।
3. কাউন্টার PC: লক-করা EXE নাকি `/counter` ব্রাউজার পাতা।
4. লক ফেরানোর জন্য Master থেকে এক-বারের "আনলক কোড" ব্যবস্থা লাগবে কি না।
5. কাউন্টার PC নিজে প্রিন্ট চালাবে কি না (এখন: না)।
6. appId/productName ব্যাপক rollout-এর সময়।
7. কোন lockfile রাখা হবে (npm বনাম bun)।

---

## ১২. Phase H: Asset অডিট ও ব্র্যান্ডিং (শুধু অডিট, ছবি বানানো নয়)

`docs/ASSET_AUDIT.md` ও আপডেটেড `assets-manifest.json` তৈরি করো। প্রতিটি asset-এ: ID, নাম, কোন প্যাকেজ/স্ক্রিন, কেন লাগে (কোড রেফারেন্স বা প্ল্যাটফর্মের নিয়ম), ফরম্যাট, সাইজ, @2x, ট্রান্সপারেন্সি/safe-zone, বর্তমান অবস্থা (✅ আছে / ⚠️ ভুল / ❌ নেই / 🔁 অব্যবহৃত), প্রত্যাশিত পাথ, প্রায়োরিটি (P0/P1/P2), ডিজাইনার নোট।

যাচাই করবে অন্তত:
- **Customer PWA:** favicon (ICO/SVG/PNG), manifest আইকন (192, 512, maskable), apple-touch-icon (180), splash/screenshots, OG ছবি, দোকানের লোগো প্লেসহোল্ডার ও আপলোড নিয়ম, সার্ভিস আইকন (Presets-এর ডিফল্ট আইকন সেট + কাস্টম সার্ভিসের জন্য নির্বাচনযোগ্য আইকন লাইব্রেরি), স্ট্যাটাস আইকন, ভয়েস বাটন, bKash/Nagad লোগো (তাদের ব্র্যান্ড গাইডলাইন লাগবে), empty/error ছবি।
- **EXE:** অ্যাপ আইকন `.ico` (16, 24, 32, 48, 64, 128, 256), Tray আইকন (normal, নতুন অর্ডার ব্যাজ, offline, error; 16/32 ও HiDPI; light/dark টাস্কবারে দৃশ্যমান), Toast আইকন, NSIS installer আইকন ও sidebar/header bitmap, uninstaller আইকন, প্রিন্টার টাইপ আইকন।
- **প্রিন্টযোগ্য:** কাউন্টার QR পোস্টার/স্ট্যান্ড, পিকআপ স্লিপ লোগো।
- **ব্র্যান্ডিং:** পুরনো নামের চিহ্ন, রং-লোগো মিল।
- কোনো ছবি তৈরি/ডাউনলোড/মুছা নয়; সোর্স কোড বদলানো নয়। ঐচ্ছিক `scripts/check-assets` (আমাকে জিজ্ঞেস করে)।

---

## ১৩. Phase I: ইনস্টলার, signing, পাইলট

- Code signing: OV/EV সার্টিফিকেট বা Azure Trusted Signing (এখন নেই; আমি সংগ্রহ করব)। SmartScreen বাধা কমাতে পাইলটের আগে।
- Installer: proper uninstaller, Start Menu এন্ট্রি, Windows 10/11, silent auto-update ও rollback, crash report (ঐচ্ছিক, local)।
- Windows Service নয়, Tray App (login-এ অটো-স্টার্ট): কারণ Service আলাদা session-এ চলে, তাই প্রিন্টার ও Toast কঠিন। দোকানের PC-তে auto-login রাখার পরামর্শ।
- পাইলট: ৩–৫ দোকান, কমপক্ষে ২–৩টি প্রিন্টার মডেলে টেস্ট (Epson L805, HP LaserJet, Canon G-series), বাস্তব Windows PC-তে `npm run verify` ও `npm run dev:desktop` চালিয়ে ভিজ্যুয়াল যাচাই।

### নিরাপত্তা (পাইলটের আগে প্রযোজ্য)
TLS/WSS; Device-bound auth; স্বল্পমেয়াদি token + rotation (Phase D-র পর); private storage + signed URL (সেন্ট্রাল সার্ভার এলে); MIME validation; malware scanning; auto-delete; `sensitive` সার্ভিসের Preview Watermark; Staff PIN; Audit Log; rate limiting; print job idempotency।

### মূল ঝুঁকি
| ঝুঁকি | প্রতিকার |
|---|---|
| প্রিন্টার ড্রাইভার ভিন্নতা | ২–৩ মডেলে আগে টেস্ট |
| SmartScreen | Code signing |
| Duplicate print (offline) | Idempotency key |
| সংবেদনশীল নথি ফাঁস | Private repo/storage, auto-delete, watermark, ম্যানুয়াল approve, লগে সংবেদনশীল তথ্য নেই |
| LAN/TLS/ফায়ারওয়াল সেটআপ জটিল | Setup উইজার্ডে ধাপে ধাপে নির্দেশনা ও স্বয়ংক্রিয় যাচাই |
| IP বদলে QR পুরনো | স্ট্যাটিক IP/DHCP reservation, UI সতর্কবার্তা |
| বাংলা ভয়েস সব ফোনে নয় | রেকর্ড অডিও primary, TTS fallback |
| দোকানদার সাড়া না দিলে | Timeout + reminder + কাস্টমারকে জানানো |

---

## ১৪. Definition of Done (প্রতিটি Phase)

- `npm run verify` সবুজ; নতুন কোডে টেস্ট আছে (নিরাপত্তা-সংক্রান্ত টেস্টগুলো বাধ্যতামূলক)।
- README ও docs নতুন আচরণ অনুযায়ী আপডেট (বিশেষত "Counter QR orders", "Authentication", Device mode ও লকের সীমা)।
- কোনো গোপন তথ্য বা সংবেদনশীল নথির তথ্য কোড/লগ/commit-এ নেই।
- Windows-এ বাস্তব মেশিনে যাচাইয়ের ধাপ লেখা আছে (দুই PC-তে কীভাবে চালিয়ে দেখব)।
- শেষে সংক্ষিপ্ত রিপোর্ট: কী বদলালে, নতুন/সরানো ফাইল, যাচাইয়ের উপায়, কী বাকি।
