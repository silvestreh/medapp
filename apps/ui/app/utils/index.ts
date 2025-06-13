import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import type { Slot, Account } from '~/declarations';

dayjs.extend(isSameOrBefore);

export function generateEmptySlots(date: Dayjs, medic: Account | null): Slot[] {
  if (!dayjs.isDayjs(date)) {
    return [];
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const duration = medic?.settings?.encounterDuration ?? 20;
  const slots: Slot[] = [];
  const day = days[date.day()];
  const dayStart = `${day}Start` as keyof Account['settings'];
  const dayEnd = `${day}End` as keyof Account['settings'];

  if (!medic || !dayStart || !dayEnd) {
    return [];
  }

  const startTime = dayjs(date.format('YYYY-MM-DD') + 'T' + medic.settings[dayStart]);
  const endTime = dayjs(date.format('YYYY-MM-DD') + 'T' + medic.settings[dayEnd]);
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
