export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface BusinessHoursSettings {
  enabled: boolean;
  timezone: 'Asia/Dhaka';
  daysOfWeek: Weekday[];
  openTime: string;
  closeTime: string;
}

export interface OrderLimitsSettings {
  maxPendingOrders: number;
  maxCopies: number;
  maxFileSizeMB: number;
}

export interface ApprovalSettings {
  manualApprovalRequired: boolean;
  allowOrderEditing: boolean;
  requirePriceChangeConsent: boolean;
  reminderAfterMinutes: number;
}

export interface WeeklyDndSchedule {
  daysOfWeek: Weekday[];
  startTime: string;
  endTime: string;
}

export interface NotificationSettings {
  windowsToastsEnabled: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  orderRemindersEnabled: boolean;
  orderReminderIntervalMinutes: number;
  weeklyDndSchedule: WeeklyDndSchedule | null;
}

export interface PrinterAlertSettings {
  offline: boolean;
  error: boolean;
}

export interface PrinterSettings {
  fallbackPrinterName: string | null;
  routingMode: 'capability';
  alerts: PrinterAlertSettings;
}

export interface RetentionSettings {
  completedMinutes: number;
  rejectedMinutes: number;
}

export interface AppSettings {
  businessHours: BusinessHoursSettings;
  orderLimits: OrderLimitsSettings;
  approvals: ApprovalSettings;
  notifications: NotificationSettings;
  printer: PrinterSettings;
  retention: RetentionSettings;
  previewWatermarkEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  businessHours: {
    enabled: false,
    timezone: 'Asia/Dhaka',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    openTime: '09:00',
    closeTime: '17:00',
  },
  orderLimits: {
    maxPendingOrders: 20,
    maxCopies: 50,
    maxFileSizeMB: 20,
  },
  approvals: {
    manualApprovalRequired: false,
    allowOrderEditing: true,
    requirePriceChangeConsent: true,
    reminderAfterMinutes: 15,
  },
  notifications: {
    windowsToastsEnabled: true,
    soundEnabled: true,
    soundVolume: 70,
    orderRemindersEnabled: true,
    orderReminderIntervalMinutes: 2,
    weeklyDndSchedule: null,
  },
  printer: {
    fallbackPrinterName: null,
    routingMode: 'capability',
    alerts: {
      offline: true,
      error: true,
    },
  },
  retention: {
    completedMinutes: 15,
    rejectedMinutes: 2,
  },
  previewWatermarkEnabled: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

const isIntegerInRange = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;

const WEEKDAYS: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const isWeekday = (value: unknown): value is Weekday =>
  typeof value === 'string' && WEEKDAYS.some(day => day === value);

const isWeekdayList = (value: unknown): value is Weekday[] =>
  Array.isArray(value) && value.every(isWeekday) && new Set(value).size === value.length;

/** Shared with the Settings UI so clock times are validated identically before saving. */
export const isClockTime = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const isBusinessHoursSettings = (value: unknown): value is BusinessHoursSettings =>
  isRecord(value) &&
  hasExactKeys(value, ['enabled', 'timezone', 'daysOfWeek', 'openTime', 'closeTime']) &&
  typeof value.enabled === 'boolean' &&
  value.timezone === 'Asia/Dhaka' &&
  isWeekdayList(value.daysOfWeek) &&
  isClockTime(value.openTime) &&
  isClockTime(value.closeTime);

const isOrderLimitsSettings = (value: unknown): value is OrderLimitsSettings =>
  isRecord(value) &&
  hasExactKeys(value, ['maxPendingOrders', 'maxCopies', 'maxFileSizeMB']) &&
  isIntegerInRange(value.maxPendingOrders, 1, 10_000) &&
  isIntegerInRange(value.maxCopies, 1, 10_000) &&
  isIntegerInRange(value.maxFileSizeMB, 1, 1_000);

const isApprovalSettings = (value: unknown): value is ApprovalSettings =>
  isRecord(value) &&
  hasExactKeys(value, [
    'manualApprovalRequired',
    'allowOrderEditing',
    'requirePriceChangeConsent',
    'reminderAfterMinutes',
  ]) &&
  typeof value.manualApprovalRequired === 'boolean' &&
  typeof value.allowOrderEditing === 'boolean' &&
  typeof value.requirePriceChangeConsent === 'boolean' &&
  isIntegerInRange(value.reminderAfterMinutes, 1, 1_440);

const isWeeklyDndSchedule = (value: unknown): value is WeeklyDndSchedule =>
  isRecord(value) &&
  hasExactKeys(value, ['daysOfWeek', 'startTime', 'endTime']) &&
  isWeekdayList(value.daysOfWeek) &&
  isClockTime(value.startTime) &&
  isClockTime(value.endTime);

const isNotificationSettings = (value: unknown): value is NotificationSettings =>
  isRecord(value) &&
  hasExactKeys(value, [
    'windowsToastsEnabled',
    'soundEnabled',
    'soundVolume',
    'orderRemindersEnabled',
    'orderReminderIntervalMinutes',
    'weeklyDndSchedule',
  ]) &&
  typeof value.windowsToastsEnabled === 'boolean' &&
  typeof value.soundEnabled === 'boolean' &&
  isIntegerInRange(value.soundVolume, 0, 100) &&
  typeof value.orderRemindersEnabled === 'boolean' &&
  isIntegerInRange(value.orderReminderIntervalMinutes, 1, 1_440) &&
  (value.weeklyDndSchedule === null || isWeeklyDndSchedule(value.weeklyDndSchedule));

const isPrinterAlertSettings = (value: unknown): value is PrinterAlertSettings =>
  isRecord(value) &&
  hasExactKeys(value, ['offline', 'error']) &&
  typeof value.offline === 'boolean' &&
  typeof value.error === 'boolean';

const isPrinterSettings = (value: unknown): value is PrinterSettings => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['fallbackPrinterName', 'routingMode', 'alerts']) ||
    value.routingMode !== 'capability' ||
    !isPrinterAlertSettings(value.alerts)
  ) return false;

  return value.fallbackPrinterName === null ||
    (typeof value.fallbackPrinterName === 'string' &&
      value.fallbackPrinterName.length > 0 &&
      value.fallbackPrinterName.length <= 128 &&
      value.fallbackPrinterName.trim() === value.fallbackPrinterName &&
      !/[\u0000-\u001f\u007f]/.test(value.fallbackPrinterName));
};

const isRetentionSettings = (value: unknown): value is RetentionSettings =>
  isRecord(value) &&
  hasExactKeys(value, ['completedMinutes', 'rejectedMinutes']) &&
  isIntegerInRange(value.completedMinutes, 1, 525_600) &&
  isIntegerInRange(value.rejectedMinutes, 1, 525_600);

export const isAppSettings = (value: unknown): value is AppSettings =>
  isRecord(value) &&
  hasExactKeys(value, [
    'businessHours',
    'orderLimits',
    'approvals',
    'notifications',
    'printer',
    'retention',
    'previewWatermarkEnabled',
  ]) &&
  isBusinessHoursSettings(value.businessHours) &&
  isOrderLimitsSettings(value.orderLimits) &&
  isApprovalSettings(value.approvals) &&
  isNotificationSettings(value.notifications) &&
  isPrinterSettings(value.printer) &&
  isRetentionSettings(value.retention) &&
  typeof value.previewWatermarkEnabled === 'boolean';
