import { Hook, HookContext } from '@feathersjs/feathers';
import type { WhatsAppInstanceSettings } from '../../whatsapp-instances/whatsapp-instances.class';

/**
 * Before hook for whatsapp.create that verifies the recipient phone number
 * has an active WhatsApp account via Evolution API's whatsappNumbers endpoint.
 *
 * If the number has no WhatsApp account, short-circuits with
 * { sent: false, reason: 'no-whatsapp-account' } — the actual send is skipped.
 *
 * If the verification call itself fails (network error, API not configured, etc.),
 * the hook logs a warning and lets the send proceed (fail-open).
 */
const verifyWhatsAppNumber = (): Hook => {
  return async (context: HookContext) => {
    const { app, data } = context;
    if (!data?.to || !data?.organizationId) return context;

    try {
      // Get Evolution API config
      const config = (app.get as any)('evolution') || {};
      const apiUrl = (config.apiUrl || process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
      const apiKey = config.apiKey || process.env.EVOLUTION_API_KEY || '';

      if (!apiUrl || !apiKey) return context;

      // Get instance name for the organization
      const org = await app.service('organizations').get(data.organizationId) as any;
      const waSettings = org?.settings?.whatsapp as WhatsAppInstanceSettings | undefined;
      if (!waSettings?.instanceName || !waSettings?.connected) return context;

      // Normalize phone to digits only (same as WhatsApp.create does)
      const digits = data.to.replace(/[^0-9]/g, '');
      if (!digits) return context;

      // Strip leading 0 and prepend 54 for local numbers (match WhatsApp.normalizePhone)
      let phone = digits.replace(/^0+/, '');
      if (phone.length <= 10) {
        phone = `54${phone}`;
      }

      const response = await fetch(
        `${apiUrl}/chat/whatsappNumbers/${waSettings.instanceName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify({ numbers: [phone] }),
        }
      );

      if (!response.ok) {
        console.warn('[WhatsApp] whatsappNumbers check failed, proceeding with send');
        return context;
      }

      const results = await response.json() as any[];
      const check = results?.[0];

      if (check && check.exists === false) {
        context.result = { sent: false, reason: 'no-whatsapp-account' };
        return context;
      }
    } catch (error: any) {
      console.warn('[WhatsApp] whatsappNumbers verification error, proceeding with send:', error.message);
    }

    return context;
  };
};

export default verifyWhatsAppNumber;
