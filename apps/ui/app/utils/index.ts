import dayjs, { Dayjs } from 'dayjs';

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const UUID_RE = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

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
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import type { Slot, Account } from '~/declarations';

dayjs.extend(isSameOrBefore);

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
