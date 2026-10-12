import type { BusinessHoursSettings, OrderLimitsSettings, WeeklyDndSchedule } from '../settings.js';
import type { PrintJob } from '../types.js';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const MAX_DATA_URL_BYTES = 40 * 1024 * 1024;

const getDhakaClock = (timestamp: number): { weekday: typeof WEEKDAYS[number]; minutes: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const weekday = values.weekday.toLowerCase() as typeof WEEKDAYS[number];
  return { weekday, minutes: Number(values.hour) * 60 + Number(values.minute) };
};

const clockMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const isWithinShopHours = (now: number, schedule: BusinessHoursSettings): boolean => {
  if (!schedule.enabled) return true;
  if (!Number.isFinite(now)) return false;

  const current = getDhakaClock(now);
  const open = clockMinutes(schedule.openTime);
  const close = clockMinutes(schedule.closeTime);
  const currentDayIndex = WEEKDAYS.indexOf(current.weekday);
  const previousDay = WEEKDAYS[(currentDayIndex + WEEKDAYS.length - 1) % WEEKDAYS.length];

  if (open === close) return schedule.daysOfWeek.includes(current.weekday);
  if (open < close) {
    return schedule.daysOfWeek.includes(current.weekday) && current.minutes >= open && current.minutes < close;
  }
  return (schedule.daysOfWeek.includes(current.weekday) && current.minutes >= open) ||
    (schedule.daysOfWeek.includes(previousDay) && current.minutes < close);
};

export const isWithinWeeklyDndSchedule = (now: number, schedule: WeeklyDndSchedule | null): boolean => {
  if (!schedule || !Number.isFinite(now)) return false;
  const current = getDhakaClock(now);
  const start = clockMinutes(schedule.startTime);
  const end = clockMinutes(schedule.endTime);
  if (start === end) return schedule.daysOfWeek.includes(current.weekday);
  if (start < end) {
    return schedule.daysOfWeek.includes(current.weekday) && current.minutes >= start && current.minutes < end;
  }
  const currentDayIndex = WEEKDAYS.indexOf(current.weekday);
  const previousDay = WEEKDAYS[(currentDayIndex + WEEKDAYS.length - 1) % WEEKDAYS.length];
  return (schedule.daysOfWeek.includes(current.weekday) && current.minutes >= start) ||
    (schedule.daysOfWeek.includes(previousDay) && current.minutes < end);
};

const dataUrlByteLength = (fileUrl: string): number | null => {
  const match = /^data:(?:application\/pdf|image\/(?:jpeg|png));base64,([a-z0-9+/]*={0,2})$/i.exec(fileUrl);
  if (!match) return null;
  const encoded = match[1];
  if (encoded.length % 4 !== 0) return null;
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.floor(encoded.length * 3 / 4) - padding;
};

/**
 * Customer orders are counter-cash only: an order that claims an MFS payment
 * would otherwise be shown as already paid without any verified settlement.
 */
export const validateCustomerOrderPayment = (
  job: Pick<PrintJob, 'paymentMethod' | 'paymentStatus'>
): string | null => {
  if (job.paymentMethod === 'counter_cash' && job.paymentStatus === 'unpaid') return null;
  return 'Only counter-cash payment is accepted for customer orders.';
};

export const validateCustomerOrderLimits = (
  job: Pick<PrintJob, 'copies' | 'fileUrl'>,
  limits: OrderLimitsSettings
): string | null => {
  if (!Number.isInteger(job.copies) || job.copies < 1 || job.copies > limits.maxCopies) {
    return `Order copies must be between 1 and ${limits.maxCopies}.`;
  }
  const byteLength = dataUrlByteLength(job.fileUrl);
  if (byteLength === null) return 'The uploaded file must be a valid PDF, JPEG, or PNG data URL.';
  if (byteLength > limits.maxFileSizeMB * 1024 * 1024) {
    return `The uploaded file exceeds the ${limits.maxFileSizeMB} MB limit.`;
  }
  if (byteLength > MAX_DATA_URL_BYTES) return 'The uploaded file exceeds the supported maximum size.';
  return null;
};
