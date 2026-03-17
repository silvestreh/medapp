import cron from 'node-cron';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Application } from '../declarations';
import logger from '../logger';

const expo = new Expo();

export function scheduleDoseReminderPush(app: Application) {
  // Every 30 minutes between 8am and 10pm
  cron.schedule('*/30 8-21 * * *', async () => {
    try {
      await sendDoseReminders(app);
    } catch (error) {
      logger.error('Dose reminder push failed:', error);
    }
  });

  logger.info('Scheduled dose reminder push (every 30 min, 8am–10pm)');
}

async function sendDoseReminders(app: Application) {
  const sequelize = app.get('sequelizeClient');
  const TreatmentModel = sequelize.models.sire_treatments;
  const DoseLogModel = sequelize.models.sire_dose_logs;
  const PushTokenModel = sequelize.models.sire_push_tokens;

  if (!TreatmentModel || !DoseLogModel || !PushTokenModel) return;

  const today = dayjs().format('YYYY-MM-DD');

  // Find all active treatments
  const treatments = await TreatmentModel.findAll({
    where: { status: 'active' },
    raw: true,
  }) as any[];

  if (!treatments.length) return;

  // Find all dose logs for today
  const todayLogs = await DoseLogModel.findAll({
    where: {
      date: today,
      treatmentId: { [Op.in]: treatments.map((t: any) => t.id) },
    },
    raw: true,
  }) as any[];

  const loggedTreatmentIds = new Set(todayLogs.map((l: any) => l.treatmentId));

  // Filter to patients who haven't logged today
  const unloggedTreatments = treatments.filter(
    (t: any) => !loggedTreatmentIds.has(t.id),
  );

  if (!unloggedTreatments.length) return;

  // Get unique patient IDs
  const patientIds = [...new Set(unloggedTreatments.map((t: any) => t.patientId))];

  // Find push tokens for these patients with dose reminders enabled
  const tokens = await PushTokenModel.findAll({
    where: {
      patientId: { [Op.in]: patientIds },
      doseReminders: true,
    },
    raw: true,
  }) as any[];

  if (!tokens.length) return;

  // Build a map: patientId -> treatment (for message content)
  const patientTreatment = new Map<string, any>();
  for (const t of unloggedTreatments) {
    if (!patientTreatment.has(t.patientId)) {
      patientTreatment.set(t.patientId, t);
    }
  }

  const messages: ExpoPushMessage[] = tokens
    .filter((t: any) => Expo.isExpoPushToken(t.token))
    .map((t: any) => ({
      to: t.token,
      title: 'Recordatorio de dosis',
      body: '¿Tomaste tu medicación hoy? Registrá tu dosis.',
      data: {
        type: 'dose-reminder',
        treatmentId: patientTreatment.get(t.patientId)?.id,
      },
      sound: 'default' as const,
      channelId: 'dose-reminders',
    }));

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      sent += tickets.length;

      // Clean up invalid tokens
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const invalidToken = (chunk[i] as any).to;
          PushTokenModel.destroy({ where: { token: invalidToken } }).catch(() => {});
        }
      }
    } catch (err) {
      logger.error('Dose reminder push chunk failed:', err);
    }
  }

  logger.info(`Dose reminder push: sent ${sent} notifications to ${patientIds.length} patients`);
}
