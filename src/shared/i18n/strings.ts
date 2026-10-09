/**
 * Translation dictionary for the desktop shell and the pages it hosts.
 *
 * Every label is keyed so the shopkeeper can switch the interface between
 * English and Bengali later without touching components. Values follow the
 * design references: chrome labels are English, order content and the Settings
 * group names are Bengali.
 */
export const LANGUAGES = ['en', 'bn'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export const STRINGS = {
  'nav.status': { en: 'Status', bn: 'স্ট্যাটাস' },
  'nav.dashboard': { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  'nav.printers': { en: 'Printers', bn: 'প্রিন্টার' },
  'nav.jobs': { en: 'Jobs', bn: 'জব' },
  'nav.pos': { en: 'POS', bn: 'পিওএস' },
  'nav.reports': { en: 'Reports', bn: 'রিপোর্ট' },
  'nav.settings': { en: 'Settings', bn: 'সেটিংস' },

  'shell.help': { en: 'Help', bn: 'সাহায্য' },
  'shell.help.printers': { en: 'Scan for printers', bn: 'প্রিন্টার স্ক্যান করুন' },
  'shell.help.services': { en: 'Service manager', bn: 'সার্ভিস ম্যানেজার' },
  'shell.help.server': { en: 'Local server status', bn: 'লোকাল সার্ভার স্ট্যাটাস' },
  'shell.help.package': { en: 'Windows agent package', bn: 'উইন্ডোজ এজেন্ট প্যাকেজ' },
  'shell.shopCode': { en: 'Shop Code: {code}', bn: 'শপ কোড: {code}' },
  'shell.shopMenu.title': { en: 'Shop', bn: 'দোকান' },
  'shell.shopMenu.settings': { en: 'Shop settings', bn: 'দোকানের সেটিংস' },
  'shell.shopMenu.poster': { en: 'Counter QR poster', bn: 'কাউন্টার QR পোস্টার' },

  'status.connected': { en: 'Connected', bn: 'সংযুক্ত' },
  'status.connectedDetail': { en: '{product} is connected', bn: '{product} সংযুক্ত আছে' },
  'status.subscription': { en: 'Subscription:', bn: 'সাবস্ক্রিপশন:' },
  'status.subscriptionActive': { en: 'Active', bn: 'সক্রিয়' },
  'status.printers': { en: 'PRINTERS ({count})', bn: 'প্রিন্টার ({count})' },
  'status.viewAllPrinters': { en: 'View all printers', bn: 'সব প্রিন্টার দেখুন' },
  'status.printersEmpty': { en: 'No printers detected yet.', bn: 'এখনো কোনো প্রিন্টার পাওয়া যায়নি।' },

  'status.overview': { en: 'OVERVIEW', bn: 'সারসংক্ষেপ' },
  'status.pending': { en: 'Pending', bn: 'পেন্ডিং' },
  'status.today': { en: 'Today', bn: 'আজ' },
  'status.thisMonth': { en: 'This Month', bn: 'এই মাস' },
  'status.viewJobs': { en: 'View jobs', bn: 'জব দেখুন' },
  'status.viewReport': { en: 'View report', bn: 'রিপোর্ট দেখুন' },

  'status.recentJobs': { en: 'RECENT JOBS', bn: 'সাম্প্রতিক জব' },
  'status.viewAllJobs': { en: 'View all jobs', bn: 'সব জব দেখুন' },
  'status.table.jobName': { en: 'Job Name', bn: 'জবের নাম' },
  'status.table.printer': { en: 'Printer', bn: 'প্রিন্টার' },
  'status.table.status': { en: 'Status', bn: 'স্ট্যাটাস' },
  'status.table.time': { en: 'Time', bn: 'সময়' },
  'status.jobsEmpty': { en: 'No print jobs yet.', bn: 'এখনো কোনো প্রিন্ট জব নেই।' },
  'status.jobsLoading': { en: 'Loading jobs…', bn: 'জব লোড হচ্ছে…' },
  'status.jobsError': { en: 'Could not read the local print queue.', bn: 'লোকাল প্রিন্ট কিউ পড়া যায়নি।' },

  'status.openDashboard': { en: 'Open Dashboard', bn: 'ড্যাশবোর্ড খুলুন' },
  'status.printerSettings': { en: 'Printer Settings', bn: 'প্রিন্টার সেটিংস' },
  'status.shop': { en: 'Shop', bn: 'দোকান' },

  'printer.online': { en: 'online', bn: 'অনলাইন' },
  'printer.offline': { en: 'offline', bn: 'অফলাইন' },
  'printer.menu': { en: 'Printer actions', bn: 'প্রিন্টারের কাজ' },
  'printer.menu.testPrint': { en: 'Send a test print', bn: 'টেস্ট প্রিন্ট পাঠান' },
  'printer.menu.setOnline': { en: 'Mark as online', bn: 'অনলাইন হিসেবে চিহ্নিত করুন' },
  'printer.menu.setOffline': { en: 'Mark as offline', bn: 'অফলাইন হিসেবে চিহ্নিত করুন' },
  'printer.menu.viewPrinters': { en: 'Open printer settings', bn: 'প্রিন্টার সেটিংস খুলুন' },

  'job.status.printed': { en: 'Printed', bn: 'প্রিন্ট হয়েছে' },
  'job.status.failed': { en: 'Failed', bn: 'ব্যর্থ' },
  'job.status.pending': { en: 'Pending', bn: 'অপেক্ষমাণ' },
  'job.status.printing': { en: 'Printing…', bn: 'প্রিন্ট হচ্ছে…' },
  'job.status.rejected': { en: 'Rejected', bn: 'বাতিল' },

  'job.nidPhoto': { en: 'NID Photo', bn: 'এনআইডি ছবি' },
  'job.retry': { en: 'Retry', bn: 'আবার চেষ্টা' },

  'dashboard.title': { en: 'Order Inbox', bn: 'অর্ডার ইনবক্স' },
  'dashboard.subtitle': {
    en: 'Review every incoming order, then approve, edit or reject it.',
    bn: 'গ্রাহকের আসা প্রতিটি অর্ডার দেখে অনুমোদন, সম্পাদনা বা বাতিল করুন।'
  },
  'dashboard.counterFilter': { en: 'Counter filter:', bn: 'কাউন্টার ফিল্টার:' },
  'dashboard.allCounters': { en: 'All counters ({count})', bn: 'সকল কাউন্টার ({count})' },
  'dashboard.openOrders': { en: '{count} open order(s)', bn: '{count}টি খোলা অর্ডার' },
  'dashboard.empty': {
    en: 'No orders are waiting for approval.',
    bn: 'অনুমোদনের অপেক্ষায় কোনো অর্ডার নেই।'
  },
  'dashboard.queueError': {
    en: 'Could not read the local print queue.',
    bn: 'লোকাল প্রিন্ট কিউ পড়া যায়নি।'
  },

  'order.timeAgo.now': { en: 'just now', bn: 'এইমাত্র' },
  'order.timeAgo.minutes': { en: '{count} min ago', bn: '{count} মিনিট আগে' },
  'order.timeAgo.hours': { en: '{count} hr ago', bn: '{count} ঘন্টা আগে' },
  'order.copies': { en: '{count} copy', bn: '{count} কপি' },
  'order.color': { en: 'Color', bn: 'কালার' },
  'order.bw': { en: 'B&W', bn: 'সাদা-কালো' },
  'order.printerAuto': { en: 'Printer: {name} (auto)', bn: 'প্রিন্টার: {name} (অটো)' },
  'order.paid': { en: 'Paid', bn: 'পেইড' },
  'order.paidMfs': { en: 'Paid (bKash/Nagad)', bn: 'পেইড (bKash/Nagad)' },
  'order.counterCash': { en: 'Counter cash', bn: 'কাউন্টার ক্যাশ' },
  'order.previewOpen': { en: 'Preview (enlarge)', bn: 'প্রিভিউ (বড় করুন)' },
  'order.previewLoading': { en: 'Loading preview…', bn: 'প্রিভিউ লোড হচ্ছে…' },
  'order.previewError': { en: 'The preview could not be loaded.', bn: 'প্রিভিউ দেখানো যাচ্ছে না।' },
  'order.previewRemoved': {
    en: 'File removed after printing',
    bn: 'প্রিন্টের পর ফাইল মুছে ফেলা হয়েছে'
  },
  'order.previewPdf': { en: 'PDF document', bn: 'পিডিএফ ডকুমেন্ট' },
  'order.reject': { en: 'Reject', bn: 'বাতিল' },
  'order.edit': { en: 'Edit', bn: 'সম্পাদনা' },
  'order.approve': { en: 'Approve', bn: 'অনুমোদন' },
  'order.cancel': { en: 'Cancel', bn: 'ফিরে যান' },
  'order.reject.title': { en: 'Reject this order', bn: 'অর্ডার বাতিল করুন' },
  'order.reject.hint': {
    en: 'A reason is required — the customer gets it with the notification.',
    bn: 'কারণ দেওয়া বাধ্যতামূলক — কাস্টমার নোটিফিকেশনে এটি পাবে।'
  },
  'order.reject.reasonLabel': { en: 'Reason (required)', bn: 'কারণ (বাধ্যতামূলক)' },
  'order.reject.noteLabel': {
    en: 'Message for the customer (optional)',
    bn: 'কাস্টমারের জন্য বার্তা (ঐচ্ছিক)'
  },
  'order.reject.confirm': { en: 'Reject order', bn: 'অর্ডার বাতিল করুন' },
  'order.rejectReason.blurry_photo': {
    en: 'Blurry / low-resolution photo',
    bn: 'ছবি অস্পষ্ট / লো-রেজোলিউশন'
  },
  'order.rejectReason.corrupted_file': {
    en: 'File damaged or cannot be opened',
    bn: 'ফাইল নষ্ট বা খোলা যাচ্ছে না'
  },
  'order.rejectReason.invalid_size': {
    en: 'Size and ratio do not match',
    bn: 'সাইজ ও রেশিও মিলছে না'
  },
  'order.rejectReason.printer_unavailable': {
    en: 'Printer out of paper / ink or offline',
    bn: 'প্রিন্টারে পেপার বা কালি শেষ / অফলাইন'
  },
  'order.rejectReason.other': { en: 'Other reason', bn: 'অন্যান্য কারণ' },

  'printers.settings.title': { en: 'Printer Settings', bn: 'প্রিন্টার সেটিংস' },
  'printers.settings.heading': { en: 'Detected Printers', bn: 'পাওয়া যাওয়া প্রিন্টার' },
  'printers.settings.subtitle': {
    en: 'Select the printers you want to use and configure defaults.',
    bn: 'যে প্রিন্টারগুলো ব্যবহার করবেন সেগুলো নির্বাচন করে ডিফল্ট ঠিক করুন।'
  },
  'printers.settings.capabilities': { en: 'Capabilities:', bn: 'সক্ষমতা:' },
  'printers.settings.defaultFor': { en: 'Default for:', bn: 'ডিফল্ট যেসব সার্ভিসে:' },
  'printers.settings.status': { en: 'Status:', bn: 'অবস্থা:' },
  'printers.settings.ready': { en: 'Ready', bn: 'প্রস্তুত' },
  'printers.settings.offline': { en: 'Offline / Not responding', bn: 'অফলাইন / সাড়া দিচ্ছে না' },
  'printers.settings.offlineHint': {
    en: 'This printer is offline, so it cannot be enabled yet.',
    bn: 'প্রিন্টারটি অফলাইন, তাই এখন চালু করা যাবে না।'
  },
  'printers.settings.refresh': { en: 'Refresh Printers', bn: 'প্রিন্টার রিফ্রেশ করুন' },
  'printers.settings.save': { en: 'Save Changes', bn: 'পরিবর্তন সংরক্ষণ' },
  'printers.settings.saved': {
    en: 'Saved — the selected printers are applied to new-order routing.',
    bn: 'সংরক্ষিত — নির্বাচিত প্রিন্টারগুলো নতুন অর্ডারের রাউটিঙে প্রয়োগ হয়েছে।'
  },
  'printers.settings.partialSave': {
    en: '{count} service default(s) could not be updated.',
    bn: '{count}টি সার্ভিস ডিফল্ট আপডেট করা যায়নি।'
  },

  'upcoming.title': { en: 'Coming in the next step', bn: 'পরবর্তী ধাপে আসছে' },
  'upcoming.dashboard': {
    en: 'The order inbox (card layout, reject reason, edit drawer) lands in step 4.',
    bn: 'অর্ডার ইনবক্স (কার্ড লেআউট, বাতিলের কারণ, এডিট ড্রয়ার) ধাপ ৪-এ আসছে।'
  },
  'upcoming.jobs': {
    en: 'The full job list with status, printer and date filters lands in step 6.',
    bn: 'স্ট্যাটাস, প্রিন্টার ও তারিখ ফিল্টারসহ পূর্ণ জব তালিকা ধাপ ৬-এ আসছে।'
  },
  'upcoming.reports': {
    en: 'Today and this-month reporting lands in step 6.',
    bn: 'আজ ও এই মাসের রিপোর্ট ধাপ ৬-এ আসছে।'
  },
  'upcoming.settings': {
    en: 'The 11-group settings panel lands in step 7.',
    bn: '১১ গ্রুপের সেটিংস প্যানেল ধাপ ৭-এ আসছে।'
  },
  'upcoming.printers': {
    en: 'The printer selection dialog lands in step 5.',
    bn: 'প্রিন্টার নির্বাচনের ডায়ালগ ধাপ ৫-এ আসছে।'
  }
} as const;

export type TranslationKey = keyof typeof STRINGS;
