# স্টুডিও এডিটর উন্নয়ন পরিকল্পনা (Improvement Plan)

**তারিখ:** 2025-10-31  
**ভিত্তি:** স্টুডিও সিস্টেম অডিট রিপোর্ট  
**অগ্রাধিকার:** ক্রিটিক্যাল → হাই → মিডিয়াম → লো

## সারসংক্ষেপ

অডিট রিপোর্ট অনুযায়ী স্টুডিও এডিটর অত্যন্ত সমৃদ্ধ ফিচারযুক্ত হলেও প্রধানত মেমোরি ম্যানেজমেন্ট, মনোলিথিক কম্পোনেন্ট এবং পারফরম্যান্স নিয়ে সমস্যা রয়েছে। নিচে অগ্রাধিকার অনুযায়ী উন্নয়ন পরিকল্পনা দেয়া হলো।

## P0 - জরুরি (অবিলম্বে ঠিক করতে হবে)

### 1. মেমোরি লিক ঠিক করা (Object URL Leak)
**সমস্যা:** `URL.createObjectURL()` ব্যবহার করে তৈরি করা blob URL গুলো কখনো `revokeObjectURL()` করা হয় না।

**ফাইলসমূহ:**
- `src/features/studio-editor/StudioEditorCanvas.tsx` (লাইন ~1686, ~1833)
- `src/features/studio-editor/cloneStamp.ts`
- `src/features/studio-editor/tonalTools.ts`

**সমাধান:**
- [ ] সকল তৈরি করা object URL ট্র্যাক করার জন্য একটি `Set<string>` বা ref তৈরি করা
- [ ] কম্পোনেন্ট unmount, reset, history পরিবর্তন হলে সকল URL revoke করা
- [ ] `cloneStamp.ts` এবং `tonalTools.ts` এ data URL snapshot ব্যবহারের পরিবর্তে বিকল্প সমাধান ভাবা
- [ ] Blob URL তৈরি ও cleanup এর জন্য utility function তৈরি করা

**আনুমানিক সময়:** ২-৩ দিন | **প্রভাব:** ক্রিটিক্যাল

### 2. হিস্ট্রি স্ন্যাপশটে রেফারেন্স শেয়ারিং বাগ
**সমস্যা:** `snapshot()` ফাংশনে array/object গুলো deep clone না করে সরাসরি ref থেকে কপি করা হয়।

**ফাইল:**
- `src/features/studio-editor/StudioEditorCanvas.tsx` (লাইন ~716-725, ~753-758)

**সমাধান:**
- [ ] `snapshot()` এ সকল array/object এর জন্য `structuredClone()` ব্যবহার করা
- [ ] `applySnapshot()` এও যথাযথ কপি নিশ্চিত করা
- [ ] `contentLayers`, `cloneStrokes`, `tonalStrokes` ইত্যাদির deep clone করা

**আনুমানিক সময়:** ১ দিন | **প্রভাব:** ক্রিটিক্যাল

## P1 - উচ্চ (শীঘ্রই ঠিক করতে হবে)

### 3. মনোলিথিক কম্পোনেন্ট রিফ্যাক্টরিং
**সমস্যা:** `StudioEditorCanvas.tsx` ৩৭১১ লাইনের একক কম্পোনেন্ট - রক্ষণাবেক্ষণ করা কঠিন।

**লক্ষ্য:** কম্পোনেন্টকে ছোট, পুনঃব্যবহারযোগ্য অংশে ভাগ করা

**পরিকল্পনা:**
- [ ] **Hooks extraction:**
  - `useEditorHistory` - undo/redo logic
  - `useCanvasRendering` - রেন্ডারিং logic
  - `useToolHandlers` - টুল হ্যান্ডলার
  - `useCropInteraction` - ক্রপ ইন্টারঅ্যাকশন
  - `useImageProcessing` - ব্যাকগ্রাউন্ড রিমুভাল, ইত্যাদি
- [ ] **Components extraction:**
  - `CanvasViewport` - মূল ক্যানভাস ভিউ
  - `OptionsBar` - টুল অপশন বার
  - `RightPanel` - রাইট প্যানেল (আগে থেকেই আছে, আরও modular করা)
  - `StatusBar` - স্ট্যাটাস বার
- [ ] **State management:** `useReducer` ব্যবহার করে স্টেট কনসোলিডেট করা

**আনুমানিক সময়:** ২-৩ সপ্তাহ | **প্রভাব:** উচ্চ

### 4. হিস্ট্রি মেমোরি অপটিমাইজেশন
**সমস্যা:** প্রতিটি স্ট্রোকেই full canvas snapshot data URL হিসেবে সংরক্ষণ করা হয়।

**ফাইলসমূহ:**
- `src/features/studio-editor/cloneStamp.ts`
- `src/features/studio-editor/tonalTools.ts`
- `src/features/studio-editor/editorHistory.ts`

**সমাধান:**
- [ ] সম্পূর্ণ data URL snapshot সংরক্ষণের পরিবর্তে শুধু প্রয়োজনীয় ডাটা সংরক্ষণ
- [ ] `ImageData` ব্যবহার করা যেখানে সম্ভব
- [ ] Snapshot সংখ্যা সীমিত করা (বর্তমান ৫০ থেকে আরও কমিয়ে memory-aware করা)
- [ ] Command pattern ব্যবহার করে incremental update করা
- [ ] বড় snapshot গুলো compress করা

**আনুমানিক সময়:** ১-২ সপ্তাহ | **প্রভাব:** উচ্চ

### 5. ইউনিট টেস্ট যোগ করা
**সমস্যা:** অনেক core utility function এ টেস্ট নেই।

**অগ্রাধিকার অনুযায়ী টেস্ট যোগ:**
- [ ] `editorHistory.ts` - undo/redo, snapshot apply
- [ ] `strokeModel.ts` - layer operations, point addition
- [ ] `cropTool.ts` - geometry calculations
- [ ] `selectionModel.ts` - selection operations
- [ ] `magicWand.ts` - flood fill logic
- [ ] `cloneStamp.ts` - clone logic
- [ ] `tonalTools.ts` - dodge/burn/sponge
- [ ] `backgroundReplace.ts` - color parsing
- [ ] `printSettings.ts`, `printBackend.ts`

**আনুমানিক সময়:** ১-২ সপ্তাহ | **প্রভাব:** উচ্চ

### 6. সোর্স ক্যানভাস রোবাস্টনেস উন্নত করা
**সমস্যা:** `sourceCanvasRef.current` এর null check কম, error handling দুর্বল।

**ফাইল:** `src/features/studio-editor/StudioEditorCanvas.tsx`

**সমাধান:**
- [ ] সকল ব্যবহারস্থানে null check যোগ করা
- [ ] Fallback mechanism তৈরি করা
- [ ] Error boundary যোগ করা
- [ ] User-friendly error message দেখানো

**আনুমানিক সময়:** ২-৩ দিন | **প্রভাব:** উচ্চ

## P2 - মধ্যম (পরিকল্পনা করে করা যেতে পারে)

### 7. রেন্ডারিং পারফরম্যান্স অপটিমাইজেশন
**সমস্যা:** বড় `useEffect` ব্লক (২৩০+ লাইন) সব রেন্ডারিং হ্যান্ডেল করে।

**সমাধান:**
- [ ] `requestAnimationFrame` ব্যবহার করা
- [ ] Rendering logic কে আলাদা pure function এ ভাগ করা
- [ ] Dirty flag system ইমপ্লিমেন্ট করা
- [ ] WebGL renderer আরো কার্যকরভাবে ব্যবহার করা (আগে থেকেই `webglImageRenderer.ts` আছে)
- [ ] Debouncing/throttling যোগ করা যেখানে প্রয়োজন

**আনুমানিক সময়:** ১ সপ্তাহ | **প্রভাব:** মধ্যম-উচ্চ

### 8. ভ্যালিডেশন একীভূত করা
**সমস্যা:** `StudioPage.tsx` এ নিজস্ব ভ্যালিডেশন লজিক, অথচ `validateImageFile.ts` এ shared validator আছে।

**ফাইলসমূহ:**
- `src/features/desktop/pages/StudioPage.tsx`
- `src/features/studio-editor/validateImageFile.ts`

**সমাধান:**
- [ ] `StudioPage.tsx` এ `validateImageFile.ts` এর shared validator ব্যবহার করা
- [ ] Duplicate code মুছে ফেলা
- [ ] Consistent error message নিশ্চিত করা

**আনুমানিক সময়:** অল্প সময় (১-২ ঘন্টা) | **প্রভাব:** মধ্যম

### 9. টাইপ সেফটি উন্নত করা
**সমস্যা:** কিছু জায়গায় `any` টাইপ ব্যবহার করা হয়েছে।

**ফাইল:**
- `src/features/desktop/pages/StudioPage.tsx` (লাইন ~172, ~189)

**সমাধান:**
- [ ] `any` কে proper টাইপ দিয়ে প্রতিস্থাপন করা
- [ ] `StudioCanvasAdjustments` টাইপ ব্যবহার করা
- [ ] Strict typing নিশ্চিত করা

**আনুমানিক সময়:** অল্প সময় | **প্রভাব:** মধ্যম

### 10. Effect Cleanup উন্নত করা
**সমস্যা:** কিছু useEffect এ cleanup সম্পূর্ণ নয়।

**ফাইল:** `src/features/studio-editor/StudioEditorCanvas.tsx`

**সমাধান:**
- [ ] সকল event listener এর cleanup
- [ ] Object URL revoke
- [ ] Timer/interval cleanup
- [ ] Canvas context cleanup

**আনুমানিক সময়:** ১-২ দিন | **প্রভাব:** মধ্যম

## P3 - নিম্ন (সৌন্দর্য বর্ধন)

### 11. Magic Number গুলো Constants এ বের করা
- [ ] Common values কে `constants.ts` এ স্থানান্তর
- [ ] Brush sizes, timeouts, limits ইত্যাদি centralized করা

**আনুমানিক সময়:** অর্ধ দিন | **প্রভাব:** নিম্ন

### 12. Accessibility উন্নত করা
- [ ] ARIA labels যোগ করা
- [ ] Keyboard navigation উন্নত করা
- [ ] Focus management যোগ করা
- [ ] Color contrast check

**আনুমানিক সময়:** ২-৩ দিন | **প্রভাব:** নিম্ন

### 13. কম্পোনেন্ট টেস্ট যোগ করা
- [ ] React Testing Library ব্যবহার করে টেস্ট লেখা
- [ ] Critical user flow গুলো কভার করা
- [ ] PrintDialog, StudioPage এর টেস্ট

**আনুমানিক সময়:** ১ সপ্তাহ | **প্রভাব:** নিম্ন

### 14. Clone/Tonal Tools অপটিমাইজেশন
- [ ] Pixel operation গুলো অপটিমাইজ করা
- [ ] WebGL ব্যবহার বাড়ানো
- [ ] Algorithm 개선

**আনুমানিক সময়:** ৩-৫ দিন | **প্রভাব:** নিম্ন

## সুপারিশকৃত বাস্তবায়ন ক্রম

১. **সপ্তাহ ১-২:** P0 আইটেমসমূহ (মেমোরি লিক + হিস্ট্রি রেফারেন্স বাগ) - সবচেয়ে জরুরি
২. **সপ্তাহ ৩-৪:** P1 শুরু - সোর্স ক্যানভাস রোবাস্টনেস, ভ্যালিডেশন একীভূতকরণ
৩. **মাস ২:** P1 মূল কাজ - মনোলিথিক কম্পোনেন্ট রিফ্যাক্টরিং (ধাপে ধাপে)
৪. **মাস ২-৩:** P1 - হিস্ট্রি অপটিমাইজেশন এবং টেস্ট যোগ
৫. **ক্রমাগত:** P2 এবং P3 items

## গুরুত্বপূর্ণ নোট

- **রিফ্যাক্টরিং সাবধানে করতে হবে:** `StudioEditorCanvas.tsx` রিফ্যাক্টরিং করার সময় existing functionality ভাঙা উচিত নয়। ধাপে ধাপে এবং প্রতিটি ধাপের পরে টেস্ট করতে হবে।
- **মেমোরি টেস্টিং:** P0 ঠিক করার পর বড় ইমেজ নিয়ে দীর্ঘ সময় ব্যবহার করে মেমোরি লিক টেস্ট করতে হবে।
- **ব্যাকওয়ার্ড কম্প্যাটিবিলিটি:** হিস্ট্রি ফরম্যাট পরিবর্তন করলে পুরোনো সেশন হ্যান্ডেল করা দরকার।
- **পারফরম্যান্স মনিটরিং:** বড় পরিবর্তনের আগে এবং পরে পারফরম্যান্স মাপতে হবে।

## সফলতার মানদণ্ড

- [ ] মেমোরি লিক নেই (DevTools Memory Profiler দিয়ে যাচাই)
- [ ] হিস্ট্রি undo/redo কোন bug ছাড়া কাজ করে
- [ ] কম্পোনেন্ট সাইজ যথেষ্ট কমিয়ে আনা হয়েছে (target: < 1000 লাইন প্রতি কম্পোনেন্ট)
- [ ] Core utility গুলোতে unit test কভারেজ >= 70%
- [ ] কোন ক্রিটিক্যাল console error নেই
- [ ] বড় ইমেজ (৪-৮MB) নিয়ে মসৃণ পারফরম্যান্স
