import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/es';
import 'dayjs/locale/en';

import type { Slot, Account } from '~/declarations';

dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);
dayjs.extend(customParseFormat);

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const UUID_RE = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

/** Locales supported by the app (must match i18n supportedLngs). */
export type SupportedLocale = 'es' | 'en';

const SUPPORTED_LOCALES: SupportedLocale[] = ['es', 'en'];

function toSupportedLocale(locale: string | null | undefined): SupportedLocale {
  if (locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return 'es';
}

/**
 * Returns a dayjs instance with the given locale. Use this when you need
 * date formatting (month names, day names, etc.) in the user's language.
 */
export function dayjsInLocale(date?: string | number | Date | Dayjs | null | undefined, locale?: string | null): Dayjs {
  const l = toSupportedLocale(locale);
  const d = date == null ? dayjs() : dayjs(date);
  return d.locale(l);
}

/**
 * Format a date in the given locale. Uses dayjs format tokens (e.g. 'MMMM YYYY', 'dddd', 'DD/MM/YYYY').
 */
export function formatInLocale(date: string | number | Date | Dayjs, format: string, locale?: string | null): string {
  return dayjsInLocale(date, locale).format(format);
}

/**
 * Month names in the given locale. Index 0 = January.
 * format: 'short' (e.g. Jan) or 'long' (e.g. January).
 */
export function getMonthNames(locale?: string | null, format: 'short' | 'long' = 'long'): string[] {
  const l = toSupportedLocale(locale);
  const d = dayjs().locale(l);
  return format === 'short' ? d.localeData().monthsShort() : d.localeData().months();
}

/**
 * Weekday names in the given locale, Monday first (index 0 = Monday).
 * format: 'short' (e.g. Mon) or 'long' (e.g. Monday).
 */
export function getWeekdayNames(locale?: string | null, format: 'short' | 'long' = 'short'): string[] {
  const l = toSupportedLocale(locale);
  const d = dayjs().locale(l);
  const names = format === 'short' ? d.localeData().weekdaysShort() : d.localeData().weekdays();
  // dayjs uses Sunday = 0; return Monday-first for calendar UIs
  return [...names.slice(1), names[0]];
}

/**
 * Parse a date string in the given locale (e.g. "November, 2024" or "noviembre, 2024").
 * Uses dayjs string + format parsing with the locale so month/day names are understood.
 */
export function parseInLocale(str: string, format: string, locale?: string | null): Dayjs {
  const l = toSupportedLocale(locale);
  return dayjs(str, format, l);
}

/**
 * Returns the display value for a national ID / document value.
 * If the value looks like an internal ID (MongoDB ObjectID or UUID) rather
 * than a real document number, returns '—' so we don't leak implementation
 * details to the UI.
 */
export function displayDocumentValue(value: string | null | undefined): string {
  if (!value) return '—';
  if (MONGO_OBJECT_ID_RE.test(value) || UUID_RE.test(value)) return '—';
  return value;
}

type WeekdayName = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

const WEEKDAY_NAMES: WeekdayName[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function isDayEnabledFromSettings(settings: Account['settings'] | null | undefined, day: WeekdayName): boolean {
  if (!settings) {
    return false;
  }

  const dayStart = `${day}Start` as keyof Account['settings'];
  const dayEnd = `${day}End` as keyof Account['settings'];
  const startValue = settings[dayStart];
  const endValue = settings[dayEnd];

  return Boolean(startValue && endValue);
}

export function getWorkDaysFromSettings(settings: Account['settings'] | null | undefined): number[] {
  return WEEKDAY_NAMES.map((day, index) => (isDayEnabledFromSettings(settings, day) ? index : null)).filter(
    (index): index is number => index !== null
  );
}

export function generateEmptySlots(date: Dayjs, medic: Account | null): Slot[] {
  if (!dayjs.isDayjs(date)) {
    return [];
  }

  const duration = medic?.settings?.encounterDuration ?? 20;
  const slots: Slot[] = [];
  const day = WEEKDAY_NAMES[date.day()];
  const dayStart = `${day}Start` as keyof Account['settings'];
  const dayEnd = `${day}End` as keyof Account['settings'];
  const startValue = medic?.settings?.[dayStart];
  const endValue = medic?.settings?.[dayEnd];

  if (!medic || !startValue || !endValue || !isDayEnabledFromSettings(medic.settings, day)) {
    return [];
  }

  const startTime = dayjs(date.format('YYYY-MM-DD') + 'T' + startValue);
  const endTime = dayjs(date.format('YYYY-MM-DD') + 'T' + endValue);

  if (!startTime.isValid() || !endTime.isValid() || startTime.isAfter(endTime)) {
    return [];
  }

  let current = startTime;

  while (current.isSameOrBefore(endTime)) {
    slots.push({ date: current.toISOString(), appointment: null });
    current = current.add(duration, 'minute');
  }

  return slots;
}

export function generateSlots(date: Dayjs, appointments: any[], medic: Account | null): Slot[] {
  const slots = generateEmptySlots(date, medic);

  appointments.forEach(appointment => {
    const appointmentTime = dayjs(appointment.startDate);
    const slotIndex = slots.findIndex(slot => dayjs(slot.date).isSame(appointmentTime));

    if (slotIndex !== -1) {
      slots[slotIndex].appointment = appointment;
    }

    if (appointmentTime.isSame(date, 'day') && appointment.extra) {
      slots.push({ date: 'ST', appointment });
    }
  });

  return slots;
}
