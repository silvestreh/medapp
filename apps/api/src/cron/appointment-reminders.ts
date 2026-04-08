import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Op, Sequelize } from 'sequelize';
import { Application } from '../declarations';
import logger from '../logger';
import { decryptValue } from '../hooks/encryption';
import { normalizePhone } from '../utils/normalize-ar-phone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'America/Argentina/Buenos_Aires';

const DAY_NAMES: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
};

interface MedicInfo {
  firstName: string;
  lastName: string;
  title: string | null;
}

/**
 * Decrypts and picks the best phone number from an encrypted contact_data phoneNumber
 * field. Multiple numbers are stored as comma-separated encrypted values. After
 * decryption each value may have a cel:/tel: prefix. Prefers cel: (mobile).
 */
function decryptAndPickPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const decrypted = raw.includes(',')
    ? raw.split(',').map((v) => decryptValue(v)).filter(Boolean) as string[]
    : [decryptValue(raw)].filter(Boolean) as string[];

  if (decrypted.length === 0) return null;

  const mobile = decrypted.find((n) => n.startsWith('cel:'));
  return mobile || decrypted[0];
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ReminderOptions {
  delayMin?: number;
  delayMax?: number;
}

export async function sendAppointmentReminders(app: Application, options?: ReminderOptions): Promise<void> {
  const delayMin = options?.delayMin ?? 5000;
  const delayMax = options?.delayMax ?? 15000;
  const sequelize: Sequelize = app.get('sequelizeClient');
  const models = sequelize.models;

  const tomorrow = dayjs().tz(TIMEZONE).add(1, 'day');
  const tomorrowStart = tomorrow.startOf('day').toDate();
  const tomorrowEnd = tomorrow.endOf('day').toDate();

  // Find all appointments for tomorrow
  const appointments = await models.appointments.findAll({
    where: {
      startDate: { [Op.gte]: tomorrowStart, [Op.lte]: tomorrowEnd },
    },
    raw: true,
  }) as any[];

  if (appointments.length === 0) {
    logger.info('[Appointment Reminders] No appointments for tomorrow');
    return;
  }

  // Filter out already-reminded appointments
  const appointmentIds = appointments.map((a: any) => a.id);
  const existingReminders = await models.appointment_reminders.findAll({
    where: { appointmentId: { [Op.in]: appointmentIds } },
    attributes: ['appointmentId'],
    raw: true,
  }) as any[];

  const alreadyReminded = new Set(existingReminders.map((r: any) => r.appointmentId));
  const toProcess = appointments.filter((a: any) => !alreadyReminded.has(a.id));

  if (toProcess.length === 0) {
    logger.info('[Appointment Reminders] All appointments already reminded');
    return;
  }

  // Group by organizationId
  const byOrg = new Map<string, any[]>();
  for (const appt of toProcess) {
    const orgId = appt.organizationId;
    if (!orgId) continue;
    if (!byOrg.has(orgId)) byOrg.set(orgId, []);
    byOrg.get(orgId)!.push(appt);
  }

  // Cache for medic info lookups
  const medicCache = new Map<string, MedicInfo | null>();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [orgId, orgAppointments] of byOrg) {
    // Check if org has WhatsApp connected
    const org = await models.organizations.findByPk(orgId, { raw: true }) as any;
    if (!org?.settings?.whatsapp?.connected) {
      logger.info(`[Appointment Reminders] Skipping org ${orgId} — WhatsApp not connected`);
      continue;
    }

    const orgName = org.name;

    for (const appt of orgAppointments) {
      try {
        // Fetch patient name
        const patientJunction = await models.patient_personal_data.findOne({
          where: { ownerId: appt.patientId },
          raw: true,
        }) as any;

        let patientFirstName = '';
        if (patientJunction?.personalDataId) {
          const personalData = await models.personal_data.findOne({
            where: { id: patientJunction.personalDataId },
            raw: true,
          }) as any;
          patientFirstName = personalData?.firstName || '';
        }

        // Fetch patient phone
        const contactJunction = await models.patient_contact_data.findOne({
          where: { ownerId: appt.patientId },
          raw: true,
        }) as any;

        let phoneNumber: string | null = null;
        if (contactJunction?.contactDataId) {
          const contactData = await models.contact_data.findOne({
            where: { id: contactJunction.contactDataId },
            raw: true,
          }) as any;
          const rawPhone = decryptAndPickPhone(contactData?.phoneNumber);
          if (rawPhone) {
            phoneNumber = normalizePhone(rawPhone);
          }
        }

        if (!phoneNumber) {
          await models.appointment_reminders.create({
            appointmentId: appt.id,
            organizationId: orgId,
            patientId: appt.patientId,
            sentAt: new Date(),
            status: 'skipped',
            errorMessage: 'No phone number or unfixable format',
          });
          skipped++;
          continue;
        }

        // Fetch medic info (cached)
        if (!medicCache.has(appt.medicId)) {
          const medicJunction = await models.user_personal_data.findOne({
            where: { ownerId: appt.medicId },
            raw: true,
          }) as any;

          let medicInfo: MedicInfo | null = null;
          if (medicJunction?.personalDataId) {
            const medicPersonal = await models.personal_data.findOne({
              where: { id: medicJunction.personalDataId },
              raw: true,
            }) as any;

            const mdSettings = await models.md_settings.findOne({
              where: { userId: appt.medicId, organizationId: orgId },
              raw: true,
            }) as any;

            if (medicPersonal) {
              medicInfo = {
                firstName: medicPersonal.firstName || '',
                lastName: medicPersonal.lastName || '',
                title: mdSettings?.title || null,
              };
            }
          }
          medicCache.set(appt.medicId, medicInfo);
        }

        const medic = medicCache.get(appt.medicId);
        const medicLabel = medic
          ? `${medic.title ? medic.title + ' ' : ''}${medic.lastName}`
          : 'su profesional de salud';

        // Compose message
        const apptDate = dayjs(appt.startDate).tz(TIMEZONE);
        const dayName = DAY_NAMES[apptDate.day()];
        const dateStr = apptDate.format('DD/MM');
        const timeStr = apptDate.format('HH:mm');

        const body =
          `Hola ${patientFirstName}! Te recordamos que tenés un turno mañana ${dayName} ${dateStr} a las ${timeStr} hs con ${medicLabel} en ${orgName}.\n` +
          'Si necesitás cancelar o reprogramar, por favor comunicate con anticipación. ¡Gracias!';

        // Anti-spam: staggered delay
        if (delayMax > 0) {
          await randomDelay(delayMin, delayMax);
        }

        // Send via WhatsApp (normalize + verify hooks run automatically)
        const result = await app.service('whatsapp').create({
          type: 'text',
          organizationId: orgId,
          to: phoneNumber,
          body,
        });

        if (result.sent) {
          await models.appointment_reminders.create({
            appointmentId: appt.id,
            organizationId: orgId,
            patientId: appt.patientId,
            sentAt: new Date(),
            status: 'sent',
            messageId: result.messageId || null,
          });
          sent++;
        } else if (result.reason === 'no-whatsapp-account' || result.reason === 'invalid-phone-number') {
          await models.appointment_reminders.create({
            appointmentId: appt.id,
            organizationId: orgId,
            patientId: appt.patientId,
            sentAt: new Date(),
            status: 'skipped',
            errorMessage: result.reason === 'no-whatsapp-account' ? 'No WhatsApp account' : 'Invalid phone number',
          });
          skipped++;
        } else {
          await models.appointment_reminders.create({
            appointmentId: appt.id,
            organizationId: orgId,
            patientId: appt.patientId,
            sentAt: new Date(),
            status: 'failed',
            errorMessage: result.reason || 'WhatsApp service returned sent=false',
          });
          failed++;
        }
      } catch (error: any) {
        logger.error(`[Appointment Reminders] Error processing appointment ${appt.id}:`, error);
        try {
          await models.appointment_reminders.create({
            appointmentId: appt.id,
            organizationId: orgId,
            patientId: appt.patientId,
            sentAt: new Date(),
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
          });
        } catch (recordError) {
          logger.error(`[Appointment Reminders] Failed to record error for appointment ${appt.id}:`, recordError);
        }
        failed++;
      }
    }
  }

  logger.info(`[Appointment Reminders] Done: ${sent} sent, ${failed} failed, ${skipped} skipped`);
}

export function scheduleAppointmentReminders(app: Application): void {
  // 21:00 UTC = 18:00 Argentina time (UTC-3, no DST)
  cron.schedule('0 21 * * *', async () => {
    try {
      await sendAppointmentReminders(app);
    } catch (error) {
      logger.error('[Appointment Reminders] Cron failed:', error);
    }
  });

  logger.info('Scheduled appointment reminders (daily at 18:00 ART / 21:00 UTC)');
}
