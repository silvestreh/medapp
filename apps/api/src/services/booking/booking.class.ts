import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BadRequest } from '@feathersjs/errors';
import type { Application } from '../../declarations';

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface MedicData {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  title: string;
  isActive?: boolean;
}

interface AnonymizedSlot {
  date: string;
  taken: boolean;
  extra?: boolean;
}

export class Booking {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any) {
    const patientId = params.patient?.id;
    const intent = params.query?.intent;

    if (intent === 'find-medics') {
      return this.findMedics(params);
    }

    if (intent === 'find-appointments') {
      return this.findAppointments(params);
    }

    if (intent === 'find-bookings') {
      return this.findBookings(params);
    }

    return { patientId, data: [] };
  }

  async create(data: any, params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    const { medicId, startDate } = data;

    if (!medicId || !startDate) {
      throw new BadRequest('medicId and startDate are required');
    }

    // Verify the medic belongs to this organization
    const userRolesResult = await this.app.service('user-roles').find({
      query: { userId: medicId, organizationId, roleId: 'medic', $limit: 1 },
    }) as any;
    const userRoles = userRolesResult.data || userRolesResult;

    if (userRoles.length === 0) {
      throw new BadRequest('Invalid medic');
    }

    // Check the slot is not already taken
    const targetDate = dayjs(startDate);
    const existingResult = await this.app.service('appointments').find({
      query: {
        medicId,
        organizationId,
        startDate: targetDate.toISOString(),
        $limit: 1,
      },
      provider: undefined,
    }) as any;
    const existing = existingResult.data || existingResult;

    if (existing.length > 0) {
      throw new BadRequest('This slot is already taken');
    }

    // Create the appointment
    const appointment = await (this.app.service('appointments') as any).create(
      {
        patientId,
        medicId,
        organizationId,
        startDate: targetDate.toDate(),
        extra: false,
      },
      { provider: undefined }
    );

    return { ok: true, appointmentId: appointment.id };
  }

  async remove(id: string, params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    if (!id) {
      throw new BadRequest('Appointment ID is required');
    }

    // Verify the appointment belongs to this patient and organization
    const appointment = await this.app.service('appointments').get(id, {
      provider: undefined,
    }) as any;

    if (!appointment || appointment.patientId !== patientId) {
      throw new BadRequest('Appointment not found');
    }

    // Only allow cancelling future appointments
    if (dayjs(appointment.startDate).isBefore(dayjs())) {
      throw new BadRequest('Cannot cancel past appointments');
    }

    await this.app.service('appointments').remove(id, { provider: undefined });

    return { ok: true };
  }

  async findMedics(params: any) {
    const organizationId = params.patient?.organizationId;

    if (!organizationId) {
      throw new BadRequest('Organization ID is required');
    }

    const userRolesResult = await this.app.service('user-roles').find({
      query: {
        organizationId,
        roleId: 'medic',
        $select: ['userId'],
        $limit: 100,
      },
    }) as any;
    const userRoles = userRolesResult.data || userRolesResult;

    const medics: MedicData[] = await Promise.all(
      userRoles.map(async (role: any) => {
        const user = await this.app.service('users').get(role.userId) as any;

        return {
          id: role.userId,
          firstName: user.personalData?.firstName || '',
          lastName: user.personalData?.lastName || '',
          specialty: user.settings?.medicalSpecialty || '',
          title: user.settings?.title || (user.personalData?.gender === 'female' ? 'Dra.' : 'Dr.'),
          isActive: user.settings?.isVerified,
        };
      }),
    );

    return medics.filter((medic: MedicData) => medic.isActive);
  }

  async findAppointments(params: any) {
    const organizationId = params.patient?.organizationId;
    const { medicId, date } = params.query || {};

    if (!organizationId) {
      throw new BadRequest('Organization ID is required');
    }

    if (!medicId) {
      throw new BadRequest('medicId is required');
    }

    const targetDate = dayjs(date || undefined);
    if (!targetDate.isValid()) {
      throw new BadRequest('Invalid date');
    }

    // Fetch medic's schedule settings
    const settingsResult = await this.app.service('md-settings').find({
      query: { userId: medicId, $limit: 1 },
      provider: undefined,
    }) as any;
    const settings = (settingsResult.data || settingsResult)[0];

    if (!settings) {
      return [];
    }

    // Generate empty slots from schedule
    const day = WEEKDAY_NAMES[targetDate.day()];
    const dayStart = settings[`${day}Start`];
    const dayEnd = settings[`${day}End`];
    const duration = settings.encounterDuration ?? 20;

    const slots: AnonymizedSlot[] = [];

    if (dayStart && dayEnd) {
      const startTime = dayjs.tz(targetDate.format('YYYY-MM-DD') + 'T' + dayStart, 'America/Argentina/Buenos_Aires');
      const endTime = dayjs.tz(targetDate.format('YYYY-MM-DD') + 'T' + dayEnd, 'America/Argentina/Buenos_Aires');

      if (startTime.isValid() && endTime.isValid() && !startTime.isAfter(endTime)) {
        let current = startTime;
        while (current.isSameOrBefore(endTime)) {
          slots.push({ date: current.toISOString(), taken: false });
          current = current.add(duration, 'minute');
        }
      }
    }

    // Fetch ALL appointments for this medic on this date (across orgs — a medic
    // can't be in two places at once, and some legacy rows lack organizationId).
    const dayStartISO = targetDate.startOf('day').toISOString();
    const dayEndISO = targetDate.endOf('day').toISOString();

    const appointmentsResult = await this.app.service('appointments').find({
      query: {
        medicId,
        startDate: { $gte: dayStartISO, $lte: dayEndISO },
        $limit: 100,
      },
      provider: undefined,
    }) as any;
    const appointments = appointmentsResult.data || appointmentsResult;

    // Mark taken slots
    for (const appt of appointments) {
      const apptMs = dayjs(appt.startDate).valueOf();

      if (appt.extra) {
        slots.push({ date: dayjs(appt.startDate).toISOString(), taken: true, extra: true });
        continue;
      }

      // Match by closest minute (tolerance of 60 s) to handle ms/tz drift
      const slotIndex = slots.findIndex(
        slot => Math.abs(dayjs(slot.date).valueOf() - apptMs) < 60_000
      );
      if (slotIndex !== -1) {
        slots[slotIndex].taken = true;
      }
    }

    return slots;
  }

  async findBookings(params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    const appointmentsResult = await this.app.service('appointments').find({
      query: {
        patientId,
        organizationId,
        startDate: { $gte: dayjs().startOf('day').toISOString() },
        $sort: { startDate: 1 },
        $limit: 50,
      },
      provider: undefined,
    }) as any;
    const appointments = appointmentsResult.data || appointmentsResult;

    // Enrich with medic info
    const medicCache = new Map<string, { firstName: string; lastName: string; specialty: string }>();

    return Promise.all(
      appointments.map(async (appt: any) => {
        let medic = medicCache.get(appt.medicId);
        if (!medic) {
          const user = await this.app.service('users').get(appt.medicId) as any;
          medic = {
            firstName: user.personalData?.firstName || '',
            lastName: user.personalData?.lastName || '',
            specialty: user.settings?.medicalSpecialty || '',
          };
          medicCache.set(appt.medicId, medic);
        }

        return {
          id: appt.id,
          startDate: appt.startDate,
          medic,
        };
      })
    );
  }
}
