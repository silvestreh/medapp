import { Hook, HookContext } from '@feathersjs/feathers';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

interface SirePushConfig {
  getPatientId: (context: HookContext) => Promise<string>;
  getTitle: (context: HookContext) => string;
  getBody: (context: HookContext) => string;
  getData?: (context: HookContext) => Record<string, any>;
}

const sendSirePush = (config: SirePushConfig): Hook =>
  async (context: HookContext): Promise<HookContext> => {
    // Skip if the patient themselves triggered this action
    if (context.params.patient) return context;

    try {
      const patientId = await config.getPatientId(context);
      if (!patientId) return context;

      const sequelize = context.app.get('sequelizeClient');
      const PushTokenModel = sequelize.models.sire_push_tokens;

      if (!PushTokenModel) return context;

      const tokens = await PushTokenModel.findAll({
        where: { patientId },
        raw: true,
      }) as any[];

      if (!tokens.length) return context;

      const messages: ExpoPushMessage[] = tokens
        .filter((t: any) => Expo.isExpoPushToken(t.token))
        .map((t: any) => ({
          to: t.token,
          title: config.getTitle(context),
          body: config.getBody(context),
          data: config.getData?.(context) ?? {},
          sound: 'default' as const,
          channelId: 'dose-reminders',
        }));

      if (!messages.length) return context;

      const chunks = expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        try {
          const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

          // Clean up invalid tokens
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
              const invalidToken = (chunk[i] as any).to;
              PushTokenModel.destroy({ where: { token: invalidToken } }).catch(() => {});
            }
          }
        } catch (err) {
          console.error('[send-sire-push] Failed to send chunk:', err);
        }
      }
    } catch (err) {
      console.error('[send-sire-push] Unexpected error:', err);
    }

    return context;
  };

export default sendSirePush;
