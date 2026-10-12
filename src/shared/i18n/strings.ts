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
  'language.label': { en: 'Language', bn: 'ভাষা' },
  'language.english': { en: 'English', bn: 'ইংরেজি' },
  'language.bengali': { en: 'বাংলা', bn: 'বাংলা' },

  'nav.status': { en: 'Status', bn: 'স্ট্যাটাস' },
  'nav.dashboard': { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  'nav.printers': { en: 'Printers', bn: 'প্রিন্টার' },
  'nav.jobs': { en: 'Jobs', bn: 'জব' },
  'nav.pos': { en: 'POS', bn: 'পিওএস' },
  'nav.reports': { en: 'Reports', bn: 'রিপোর্ট' },
  'nav.settings': { en: 'Settings', bn: 'সেটিংস' },
  'nav.counterInbox': { en: 'Counter Inbox', bn: 'কাউন্টার ইনবক্স' },
  'nav.studio': { en: 'Studio', bn: 'স্টুডিও' },

  'counter.subtitle': { en: 'Orders for this counter only', bn: 'শুধু এই কাউন্টারের অর্ডার' },
  'counter.code': { en: 'Counter code', bn: 'কাউন্টার কোড' },
  'counter.operator': { en: 'Operator', bn: 'অপারেটর' },
  'counter.masterPc': { en: 'Master PC', bn: 'মূল পিসি' },
  'counter.connection.connected': { en: 'Connected to master', bn: 'মূল পিসির সঙ্গে সংযুক্ত' },
  'counter.connection.disconnected': { en: 'Master PC unreachable', bn: 'মূল পিসিতে পৌঁছানো যাচ্ছে না' },
  'counter.connection.unknown': { en: 'Checking connection…', bn: 'সংযোগ যাচাই হচ্ছে…' },
  'counter.activeOrders': { en: '{count} active', bn: '{count}টি চালু' },
  'counter.printedOrders': { en: '{count} printed', bn: '{count}টি প্রিন্ট হয়েছে' },
  'counter.rejectedOrders': { en: '{count} rejected', bn: '{count}টি বাতিল' },
  'counter.empty': { en: 'No orders for this counter yet.', bn: 'এই কাউন্টারে এখনো কোনো অর্ডার নেই।' },
  'counter.ordersCount': { en: '{count} orders', bn: '{count}টি অর্ডার' },
  'counter.source.master': { en: 'Live', bn: 'লাইভ' },
  'counter.source.local': { en: 'On this PC', bn: 'এই PC-তে' },
  'counter.qr.title': { en: 'Your counter QR', bn: 'আপনার কাউন্টারের QR' },
  'counter.qr.hint': {
    en: 'Customers scan this code to send an order straight to this counter through the master PC.',
    bn: 'গ্রাহকরা এই কোড স্ক্যান করলে অর্ডার মূল পিসি হয়ে সরাসরি এই কাউন্টারে আসবে।'
  },
  'counter.qr.download': { en: 'Download QR', bn: 'QR ডাউনলোড' },
  'counter.qr.unavailable': {
    en: 'Enter the master PC URL to build this counter’s QR code.',
    bn: 'এই কাউন্টারের QR বানাতে মূল পিসির URL দিন।'
  },
  'counter.qr.failed': { en: 'The QR code could not be built.', bn: 'QR কোড তৈরি করা যায়নি।' },
  'counter.feed.title': { en: 'Master order feed', bn: 'মূল পিসির অর্ডার ফিড' },
  'counter.feed.live': { en: 'Live from master', bn: 'মূল পিসি থেকে লাইভ' },
  'counter.feed.syncing': { en: 'Connecting…', bn: 'সংযোগ হচ্ছে…' },
  'counter.feed.error': { en: 'Feed problem', bn: 'ফিড সমস্যা' },
  'counter.feed.unconfigured': { en: 'Not paired with master', bn: 'মূল পিসির সঙ্গে পেয়ার করা হয়নি' },
  'counter.feed.lastSynced': { en: 'Updated {time}', bn: 'হালনাগাদ {time}' },
  'counter.feed.keyLabel': { en: 'Counter feed key', bn: 'কাউন্টার ফিড কী' },
  'counter.feed.keyPlaceholder': {
    en: 'Paste the 64-character key from the master PC',
    bn: 'মূল পিসি থেকে ৬৪ অক্ষরের কী পেস্ট করুন'
  },
  'counter.feed.keyHint': {
    en: 'On the master PC open the counter QR poster, copy that counter’s feed key, and paste it here once.',
    bn: 'মূল পিসিতে কাউন্টার QR পোস্টার খুলে সেই কাউন্টারের ফিড কী কপি করে এখানে একবার বসান।'
  },
  'counter.feed.saveKey': { en: 'Save key and start feed', bn: 'কী সংরক্ষণ করে ফিড চালু করুন' },
  'counter.feed.syncNow': { en: 'Sync now', bn: 'এখনই সিঙ্ক করুন' },
  'counter.feed.unpair': { en: 'Remove key', bn: 'কী মুছুন' },
  'counter.feed.keyInvalid': {
    en: 'The key must be the 64-character hexadecimal key shown on the master PC.',
    bn: 'কীটি মূল পিসিতে দেখানো ৬৪ অক্ষরের hex কী হতে হবে।'
  },
  'counter.feed.desktopOnly': {
    en: 'Counter pairing needs the installed Windows app.',
    bn: 'কাউন্টার পেয়ারিংয়ের জন্য ইনস্টল করা Windows অ্যাপ দরকার।'
  },
  'counter.feed.keyProtected': {
    en: 'The key is encrypted with this PC’s Windows account.',
    bn: 'কীটি এই PC-এর Windows অ্যাকাউন্ট দিয়ে এনক্রিপ্ট করা।'
  },
  'counter.feed.keyUnprotected': {
    en: 'This PC cannot encrypt the key, so it is kept in a protected file instead. Keep this PC’s Windows account secure.',
    bn: 'এই PC কী এনক্রিপ্ট করতে পারে না, তাই এটি সুরক্ষিত ফাইলে রাখা আছে। এই PC-এর Windows অ্যাকাউন্ট সুরক্ষিত রাখুন।'
  },
  'counter.feedNote': {
    en: 'Rows marked Live come straight from the master PC, which owns every order and performs every print. Without a feed key this list falls back to the orders this PC already holds.',
    bn: '“লাইভ” চিহ্নিত সারিগুলো আসে সরাসরি মূল পিসি থেকে; সব অর্ডার ও সব প্রিন্ট মূল পিসিই পরিচালনা করে। ফিড কী না থাকলে তালিকায় শুধু এই PC-তে থাকা অর্ডার দেখানো হয়।'
  },
  'counter.lockNote': {
    en: 'A counter PC never shows shop settings, printers, reports or revenue, and the feed only carries this counter’s own orders — no customer phone numbers or uploaded documents.',
    bn: 'কাউন্টার PC কখনো দোকানের সেটিংস, প্রিন্টার, রিপোর্ট বা আয় দেখে না; ফিডে শুধু এই কাউন্টারের নিজের অর্ডার আসে — গ্রাহকের ফোন নম্বর বা আপলোড করা ডকুমেন্ট নয়।'
  },

  'counterFeed.key.title': { en: 'Counter pairing key', bn: 'কাউন্টার পেয়ারিং কী' },
  'counterFeed.key.hint': {
    en: 'Enter this key once on the counter PC to turn on its live order feed.',
    bn: 'এই কীটি একবার কাউন্টার PC-তে বসালেই সেখানে লাইভ অর্ডার ফিড চালু হবে।'
  },
  'counterFeed.key.none': { en: 'No key issued for this counter yet.', bn: 'এই কাউন্টারের জন্য এখনো কী তৈরি হয়নি।' },
  'counterFeed.key.masterHost': {
    en: 'The master PC holds its own orders, so it needs no pairing key.',
    bn: 'মূল পিসি নিজেই অর্ডার রাখে, তাই এখানে পেয়ারিং কী লাগে না।'
  },
  'counterFeed.key.show': { en: 'Show', bn: 'দেখান' },
  'counterFeed.key.hide': { en: 'Hide', bn: 'লুকান' },
  'counterFeed.key.copy': { en: 'Copy', bn: 'কপি' },
  'counterFeed.key.copied': { en: 'Copied', bn: 'কপি হয়েছে' },
  'counterFeed.key.copyFailed': {
    en: 'Copy failed. Select the key text and copy it manually.',
    bn: 'কপি ব্যর্থ হয়েছে। কী-টেক্সট সিলেক্ট করে হাতে কপি করুন।'
  },
  'counterFeed.key.loadFailed': { en: 'The counter pairing key could not be loaded.', bn: 'কাউন্টার পেয়ারিং কী লোড করা যায়নি।' },
  'counterFeed.key.rotate': { en: 'New key', bn: 'নতুন কী' },
  'counterFeed.key.rotateConfirm': {
    en: 'Issue a new key? That counter PC stops receiving orders until the new key is entered there.',
    bn: 'নতুন কী তৈরি করবেন? নতুন কী কাউন্টার PC-তে না বসানো পর্যন্ত সেখানে অর্ডার আসা বন্ধ থাকবে।'
  },
  'counterFeed.key.remove': { en: 'Remove key', bn: 'কী মুছুন' },
  'counterFeed.key.removeConfirm': {
    en: 'Remove this counter key? Its live order feed stops immediately.',
    bn: 'এই কাউন্টারের কী মুছে ফেলবেন? সঙ্গে সঙ্গে তার লাইভ ফিড বন্ধ হবে।'
  },

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
  'printer.capability.color': { en: 'Color', bn: 'রঙিন' },
  'printer.capability.bw': { en: 'B&W', bn: 'সাদা-কালো' },
  'printer.capability.photo': { en: 'Photo', bn: 'ছবি' },
  'printer.capability.document': { en: 'Document', bn: 'ডকুমেন্ট' },
  'printer.service.document': { en: 'Document', bn: 'ডকুমেন্ট' },
  'printer.service.nidCopy': { en: 'NID Copy', bn: 'এনআইডি কপি' },
  'printer.service.passport': { en: 'Passport', bn: 'পাসপোর্ট' },
  'printer.service.stamp': { en: 'Stamp', bn: 'স্ট্যাম্প' },
  'printer.service.photoPrint': { en: 'Photo Print', bn: 'ছবি প্রিন্ট' },
  'printer.service.photo6R': { en: 'Photo 6R', bn: '৬আর ছবি' },
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

  'reports.periodNavigation': { en: 'Report period', bn: 'রিপোর্টের সময়কাল' },
  'reports.today': { en: 'Today', bn: 'আজ' },
  'reports.thisMonth': { en: 'This Month', bn: 'এই মাস' },
  'reports.todayHeading': { en: 'Today summary', bn: 'আজকের সারসংক্ষেপ' },
  'reports.todaySubtitle': { en: 'Printed, queued and completed value for today.', bn: 'আজকের প্রিন্ট, অপেক্ষমাণ কাজ ও সম্পন্ন কাজের মূল্য।' },
  'reports.monthHeading': { en: 'This Month summary', bn: 'এই মাসের সারসংক্ষেপ' },
  'reports.monthSubtitle': { en: 'Printed, queued and completed value this month.', bn: 'এই মাসের প্রিন্ট, অপেক্ষমাণ কাজ ও সম্পন্ন কাজের মূল্য।' },
  'reports.printedJobs': { en: 'Printed jobs', bn: 'প্রিন্ট হওয়া জব' },
  'reports.inQueue': { en: 'In queue', bn: 'কিউতে আছে' },
  'reports.completedValue': { en: 'Completed value', bn: 'সম্পন্ন কাজের মূল্য' },
  'reports.queueErrorTitle': { en: 'Queue data unavailable', bn: 'কিউয়ের তথ্য পাওয়া যাচ্ছে না' },
  'reports.queueError': { en: 'The local print queue could not be read. The summary is hidden to avoid showing misleading totals.', bn: 'লোকাল প্রিন্ট কিউ পড়া যায়নি। ভুল হিসাব এড়াতে সারসংক্ষেপ দেখানো হচ্ছে না।' },
  'reports.empty': { en: 'No local job data is available for this period.', bn: 'এই সময়ের কোনো লোকাল জবের তথ্য নেই।' },
  'reports.localHistoryNote': { en: 'Reports use the jobs currently retained in the local queue. They are not an archived or accounting report.', bn: 'রিপোর্টে লোকাল কিউতে বর্তমানে থাকা জবের তথ্য ব্যবহার করা হয়। এটি সংরক্ষিত ইতিহাস বা হিসাব-নিকাশের রিপোর্ট নয়।' },

  'settings.groups': { en: 'SETTINGS GROUPS', bn: 'সেটিংস গ্রুপ' },
  'settings.subtitle': { en: 'Changes are applied only when you save this group.', bn: 'এই গ্রুপের পরিবর্তন সংরক্ষণ করলেই প্রয়োগ হবে।' },
  'settings.comingSoon': { en: 'Coming soon', bn: 'শীঘ্রই আসছে' },
  'settings.alwaysOn': { en: 'Always on', bn: 'সবসময় চালু' },
  'settings.reset': { en: 'Reset to Defaults', bn: 'ডিফল্টে ফেরান' },
  'settings.save': { en: 'Save Changes', bn: 'পরিবর্তন সংরক্ষণ' },
  'settings.saved': { en: 'Settings saved.', bn: 'সেটিংস সংরক্ষিত হয়েছে।' },
  'settings.saveFailed': { en: 'The settings could not be saved.', bn: 'সেটিংস সংরক্ষণ করা যায়নি।' },
  'settings.masterOnly': { en: 'Service settings can only be changed on the master shop computer.', bn: 'সার্ভিস সেটিংস শুধু মূল দোকানের কম্পিউটার থেকে পরিবর্তন করা যাবে।' },
  'settings.invalidPrice': { en: 'Enter a valid non-negative price for {service}.', bn: '{service}-এর জন্য সঠিক শূন্য বা তার বেশি মূল্য লিখুন।' },
  'settings.priceFor': { en: '{service} price in BDT', bn: '{service}-এর মূল্য (টাকা)' },
  'settings.price.passport4': { en: 'Passport photo — 4-in-1', bn: 'পাসপোর্ট ছবি — ৪ কপি শিট' },
  'settings.price.passport8': { en: 'Passport photo — 8-in-1', bn: 'পাসপোর্ট ছবি — ৮ কপি শিট' },
  'settings.price.stamp': { en: 'Stamp photo', bn: 'স্ট্যাম্প সাইজ ছবি' },
  'settings.price.nidSmart': { en: 'NID smart card copy', bn: 'এনআইডি স্মার্ট কার্ড কপি' },
  'settings.price.nidNormal': { en: 'NID normal A4 copy', bn: 'এনআইডি সাধারণ A4 কপি' },
  'settings.price.photo4R': { en: '4R photo print', bn: '৪-আর ছবি প্রিন্ট' },
  'settings.price.photo6R': { en: '6R photo print', bn: '৬-আর ছবি প্রিন্ট' },
  'settings.price.documentBw': { en: 'A4 document — B&W', bn: 'A4 ডকুমেন্ট — সাদা-কালো' },
  'settings.price.documentColor': { en: 'A4 document — color', bn: 'A4 ডকুমেন্ট — রঙিন' },
  'settings.managePrinters': { en: 'Manage Printers', bn: 'প্রিন্টার পরিচালনা' },
  'settings.autoLaunchUnavailable': { en: 'Windows startup settings are only available in the desktop app.', bn: 'Windows startup সেটিংস শুধু ডেস্কটপ অ্যাপে পাওয়া যায়।' },
  'settings.desktopOnlyUnavailable': { en: 'Desktop agent settings are available only in the Windows desktop app.', bn: 'এজেন্ট সেটিংস শুধু Windows ডেস্কটপ অ্যাপে পাওয়া যায়।' },
  'settings.unsupported': { en: 'This control is not available yet.', bn: 'এই নিয়ন্ত্রণটি এখনো উপলভ্য নয়।' },
  'settings.group.shopOrders': { en: 'দোকান ও অর্ডার', bn: 'দোকান ও অর্ডার' },
  'settings.group.services': { en: 'সার্ভিস', bn: 'সার্ভিস' },
  'settings.group.approval': { en: 'অ্যাপ্রুভাল', bn: 'অ্যাপ্রুভাল' },
  'settings.group.notifications': { en: 'নোটিফিকেশন', bn: 'নোটিফিকেশন' },
  'settings.group.printers': { en: 'প্রিন্টার', bn: 'প্রিন্টার' },
  'settings.group.voiceGuide': { en: 'ভয়েস গাইড', bn: 'ভয়েস গাইড' },
  'settings.group.payments': { en: 'পেমেন্ট', bn: 'পেমেন্ট' },
  'settings.group.security': { en: 'নিরাপত্তা', bn: 'নিরাপত্তা' },
  'settings.group.staff': { en: 'স্টাফ', bn: 'স্টাফ' },
  'settings.group.agent': { en: 'এজেন্ট', bn: 'এজেন্ট' },
  'settings.group.customize': { en: 'কাস্টমাইজ', bn: 'কাস্টমাইজ' },
  'settings.breakMode': { en: 'Shop break mode', bn: 'দোকানের বিরতি মোড' },
  'settings.acceptingOrders': { en: 'Accepting new orders', bn: 'নতুন অর্ডার গ্রহণ' },
  'settings.businessHours': { en: 'Business hours', bn: 'ব্যবসার সময়সূচি' },
  'settings.businessHoursEnabled': { en: 'Enforce business hours', bn: 'ব্যবসার সময়সূচি কার্যকর করুন' },
  'settings.businessHoursOpen': { en: 'Opens at', bn: 'খোলার সময়' },
  'settings.businessHoursClose': { en: 'Closes at', bn: 'বন্ধের সময়' },
  'settings.businessHoursDays': { en: 'Open days', bn: 'খোলার দিন' },
  'settings.businessHoursTimezone': { en: 'Time zone: Asia/Dhaka', bn: 'সময় অঞ্চল: Asia/Dhaka' },
  'settings.businessHoursOvernight': {
    en: 'A close time earlier than the open time keeps the shop open past midnight.',
    bn: 'খোলার সময়ের চেয়ে আগের বন্ধের সময় দিলে দোকান মধ্যরাত পেরিয়েও খোলা থাকে।'
  },
  'settings.businessHoursOff': {
    en: 'While this is off the shop accepts orders at any time.',
    bn: 'এটি বন্ধ থাকলে দোকান যেকোনো সময় অর্ডার নেয়।'
  },
  'settings.businessHoursDaysRequired': {
    en: 'Select at least one open day, or turn business hours off.',
    bn: 'অন্তত একটি খোলার দিন নির্বাচন করুন, অথবা ব্যবসার সময়সূচি বন্ধ করুন।'
  },
  'settings.invalidTime': {
    en: 'Enter a valid time between 00:00 and 23:59.',
    bn: '০০:০০ থেকে ২৩:৫৯ এর মধ্যে একটি বৈধ সময় দিন।'
  },
  'settings.day.monday': { en: 'Monday', bn: 'সোমবার' },
  'settings.day.tuesday': { en: 'Tuesday', bn: 'মঙ্গলবার' },
  'settings.day.wednesday': { en: 'Wednesday', bn: 'বুধবার' },
  'settings.day.thursday': { en: 'Thursday', bn: 'বৃহস্পতিবার' },
  'settings.day.friday': { en: 'Friday', bn: 'শুক্রবার' },
  'settings.day.saturday': { en: 'Saturday', bn: 'শনিবার' },
  'settings.day.sunday': { en: 'Sunday', bn: 'রবিবার' },
  'settings.orderLimits': { en: 'Order limits', bn: 'অর্ডার সীমা' },
  'settings.serviceAvailability': { en: 'Service availability', bn: 'সার্ভিস চালু বা বন্ধ' },
  'settings.servicePricing': { en: 'Service pricing', bn: 'সার্ভিসের মূল্য' },
  'settings.serviceManagement': { en: 'Service management', bn: 'সার্ভিস পরিচালনা' },
  'settings.serviceManagement.addFromPreset': {
    en: 'Add a service from a preset',
    bn: 'প্রিসেট থেকে সার্ভিস যোগ করুন'
  },
  'settings.serviceManagement.presetPlaceholder': { en: 'Select a preset…', bn: 'একটি প্রিসেট নির্বাচন করুন…' },
  'settings.serviceManagement.add': { en: 'Add service', bn: 'সার্ভিস যোগ করুন' },
  'settings.serviceManagement.added': { en: 'Service added.', bn: 'সার্ভিস যোগ হয়েছে।' },
  'settings.serviceManagement.addFailed': {
    en: 'The service could not be added. A service with this code may already exist.',
    bn: 'সার্ভিস যোগ করা যায়নি। এই কোডের সার্ভিস ইতিমধ্যে থাকতে পারে।'
  },
  'settings.serviceManagement.currentServices': { en: 'Current services', bn: 'বর্তমান সার্ভিসসমূহ' },
  'settings.serviceManagement.delete': { en: 'Delete', bn: 'মুছুন' },
  'settings.serviceManagement.confirmDelete': { en: 'Confirm delete', bn: 'মুছে ফেলা নিশ্চিত করুন' },
  'settings.serviceManagement.deleted': { en: 'Service deleted.', bn: 'সার্ভিস মুছে ফেলা হয়েছে।' },
  'settings.serviceManagement.deleteFailed': { en: 'The service could not be deleted.', bn: 'সার্ভিস মুছে ফেলা যায়নি।' },
  'settings.serviceManagement.keepOne': {
    en: 'At least one service must remain.',
    bn: 'অন্তত একটি সার্ভিস রাখতে হবে।'
  },
  'settings.serviceManagement.immediateNote': {
    en: 'Adding or deleting a service takes effect immediately.',
    bn: 'সার্ভিস যোগ বা মুছে ফেলা সাথে সাথেই কার্যকর হয়।'
  },
  'settings.manualApproval': { en: 'Manual approval', bn: 'ম্যানুয়াল অনুমোদন' },
  'settings.autoApproval': { en: 'Automatic approval', bn: 'স্বয়ংক্রিয় অনুমোদন' },
  'settings.autoApprovalFor': { en: 'Automatically approve {service} orders', bn: '{service} অর্ডার স্বয়ংক্রিয়ভাবে অনুমোদন' },
  'settings.orderEditing': { en: 'Allow order editing', bn: 'অর্ডার সম্পাদনার অনুমতি' },
  'settings.priceConfirmation': { en: 'Price-change confirmation', bn: 'মূল্য পরিবর্তনে সম্মতি' },
  'settings.approvalTimeout': { en: 'Approval timeout', bn: 'অনুমোদনের সময়সীমা' },
  'settings.notificationSound': { en: 'Notification sound', bn: 'নোটিফিকেশন সাউন্ড' },
  'settings.windowsToast': { en: 'Windows notifications', bn: 'Windows নোটিফিকেশন' },
  'settings.soundVolume': { en: 'Sound volume', bn: 'সাউন্ডের মাত্রা' },
  'settings.orderReminder': { en: 'Order reminders', bn: 'অর্ডার রিমাইন্ডার' },
  'settings.doNotDisturbSchedule': { en: 'Do-not-disturb schedule', bn: 'বিরক্ত করবেন না সময়সূচি' },
  'settings.printerSelection': { en: 'Printer selection and defaults', bn: 'প্রিন্টার নির্বাচন ও ডিফল্ট' },
  'settings.printerRouting': { en: 'Printer routing rules', bn: 'প্রিন্টার রাউটিং নিয়ম' },
  'settings.fallbackPrinter': { en: 'Fallback printer', bn: 'বিকল্প প্রিন্টার' },
  'settings.printerAlerts': { en: 'Printer alerts', bn: 'প্রিন্টার সতর্কতা' },
  'settings.voiceGuidePreferences': { en: 'Customer voice guide', bn: 'গ্রাহক ভয়েস গাইড' },
  'settings.voiceGuideEnabled': { en: 'Voice guide enabled', bn: 'ভয়েস গাইড চালু' },
  'settings.voiceLanguage': { en: 'Voice language', bn: 'ভয়েসের ভাষা' },
  'settings.voiceSpeed': { en: 'Voice speed', bn: 'ভয়েসের গতি' },
  'settings.customVoice': { en: 'Custom voice', bn: 'নিজস্ব ভয়েস' },
  'settings.voiceCommands': { en: 'Voice commands', bn: 'ভয়েস কমান্ড' },
  'settings.voiceCommandsHint': {
    en: 'Basic bn + English commands work in the customer flow and the order inbox (next, back, confirm, copies up/down, color, replay, help, stop, approve, reject). Needs a Chromium browser with microphone permission.',
    bn: 'গ্রাহক ফ্লো ও অর্ডার ইনবক্সে বাংলা + English বেসিক কমান্ড কাজ করে (পরের ধাপ, পেছনে, কনফার্ম, কপি বাড়াও/কমাও, রঙিন, আবার বলো, সাহায্য, থামো, অনুমোদন, বাতিল)। Chromium ব্রাউজারে মাইক্রোফোন অনুমতি লাগবে।'
  },
  'settings.paymentMethods': { en: 'Payment methods', bn: 'পেমেন্ট পদ্ধতি' },
  'settings.counterPayment': { en: 'Pay at counter (cash)', bn: 'কাউন্টারে পেমেন্ট (ক্যাশ)' },
  'settings.automaticRefund': { en: 'Automatic refunds', bn: 'স্বয়ংক্রিয় রিফান্ড' },
  'settings.paymentsFutureVersion': {
    en: 'Counter cash is the only accepted payment method today. bKash/Nagad and automatic refunds will be added in a future version.',
    bn: 'বর্তমানে শুধু কাউন্টারে ক্যাশ গ্রহণ করা হয়। bKash/Nagad ও স্বয়ংক্রিয় রিফান্ড ভবিষ্যৎ সংস্করণে যোগ করা হবে।'
  },
  'settings.automaticDeletion': { en: 'Automatic file deletion', bn: 'স্বয়ংক্রিয় ফাইল মুছে ফেলা' },
  'settings.previewWatermark': { en: 'Preview watermark', bn: 'প্রিভিউ ওয়াটারমার্ক' },
  'settings.staffPin': { en: 'Staff PIN', bn: 'স্টাফ পিন' },
  'settings.auditLogRequired': { en: 'Audit log', bn: 'অডিট লগ' },
  'settings.staffAccounts': { en: 'Staff accounts', bn: 'স্টাফ অ্যাকাউন্ট' },
  'settings.staffRoles': { en: 'Staff roles and permissions', bn: 'স্টাফের ভূমিকা ও অনুমতি' },
  'settings.jobLock': { en: 'Job lock', bn: 'জব লক' },
  'settings.autoLaunch': { en: 'Start agent when Windows starts', bn: 'Windows চালু হলে এজেন্ট চালু করুন' },
  'settings.minimizeToTray': { en: 'Close to system tray', bn: 'বন্ধ করলে সিস্টেম ট্রেতে রাখুন' },
  'settings.automaticUpdates': { en: 'Automatic updates', bn: 'স্বয়ংক্রিয় আপডেট' },
  'settings.offlineMode': { en: 'Offline mode', bn: 'অফলাইন মোড' },
  'settings.interfaceLanguage': { en: 'Interface language', bn: 'ইন্টারফেসের ভাষা' },
  'settings.shopBranding': { en: 'Shop branding', bn: 'দোকানের ব্র্যান্ডিং' },
  'settings.customerPriceList': { en: 'Customer price list', bn: 'গ্রাহকের মূল্য তালিকা' },
  'settings.customerMessage': { en: 'Customer message', bn: 'গ্রাহকের জন্য বার্তা' },

  'dashboard.title': { en: 'Order Inbox', bn: 'অর্ডার ইনবক্স' },
  'dashboard.sections': { en: 'Dashboard sections', bn: 'ড্যাশবোর্ডের বিভাগ' },
  'dashboard.section.overview': { en: 'Overview', bn: 'সারসংক্ষেপ' },
  'dashboard.section.orders': { en: 'Orders', bn: 'অর্ডার' },
  'dashboard.section.shop': { en: 'Shop & POS', bn: 'দোকান ও পিওএস' },
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
  'toast.newOrder': {
    en: 'নতুন অর্ডার #{tokenCode}: {service}, {paperSize} × {copies}',
    bn: 'নতুন অর্ডার #{tokenCode}: {service}, {paperSize} × {copies}'
  },
  'toast.view': { en: 'View', bn: 'দেখুন' },
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
  'upcoming.dateRange.thisWeek': { en: 'This Week', bn: 'এই সপ্তাহ' },
  'upcoming.reports.today.heading': { en: 'Today summary', bn: 'আজের সারসংক্ষেপ' },
  'upcoming.reports.today.sub': { en: 'Printed, queued and earnings for today.', bn: 'আজকের প্রিন্ট, অপেক্ষাধীন ও ইনকাম।' },
  'upcoming.reports.today.printed': { en: 'Printed', bn: 'প্রিন্ট হয়েছে' },
  'upcoming.reports.today.inQueue': { en: 'In queue', bn: 'কিউতে আছে' },
  'upcoming.reports.today.earnings': { en: 'Earnings', bn: 'আয়' },
  'upcoming.reports.thisMonth.heading': { en: 'This month summary', bn: 'এই মাসের সারসংক্ষেপ' },
  'upcoming.reports.thisMonth.sub': { en: 'Printed and earnings for this month.', bn: 'এই মাসের প্রিন্ট ও আয়।' },
  'upcoming.reports.month.printed': { en: 'Printed', bn: 'প্রিন্ট হয়েছে' },
  'upcoming.reports.month.earnings': { en: 'Earnings', bn: 'আয়' },
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
