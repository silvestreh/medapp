import type { Application } from '../declarations';
import type { PaymentConnections } from '../services/payment-connections/payment-connections.class';
import { getProvider } from '../services/payments/provider-registry';
import { getPaymentsConfig } from '../utils/payments-config';
import logger from '../logger';

// OAuth authorization-code callback (GET /payments/oauth/callback).
// Identity comes EXCLUSIVELY from the previously stored state row — never
// from a session, cookie, or query hint. Any state mismatch rejects; the
// redirect back to the UI carries only an outcome code, never tokens or the
// authorization code.
export default function paymentOauthCallbackHandler(app: Application) {
  return async (req: any, res: any): Promise<void> => {
    const uiUrl = getPaymentsConfig(app).uiUrl ?? '';
    const redirectTo = (outcome: string) =>
      res.redirect(302, `${uiUrl}/settings/payments?${outcome}`);

    try {
      const { code, state, error } = req.query ?? {};

      if (error) {
        return redirectTo('connect_error=denied');
      }

      if (typeof code !== 'string' || !code || typeof state !== 'string' || !state) {
        return redirectTo('connect_error=state_mismatch');
      }

      const service = app.service('payment-connections') as unknown as PaymentConnections;
      const claimed = await service.claimOauthState(state);

      if (!claimed) {
        logger.warn('Payment OAuth callback with unknown, expired, or reused state');
        return redirectTo('connect_error=state_mismatch');
      }

      const provider = getProvider(claimed.provider);
      const credentials = await provider.exchangeCode({
        code,
        codeVerifier: claimed.codeVerifier,
        redirectUri: service.getRedirectUri(),
      });

      await service.storeCredentials(claimed.userId, claimed.provider, credentials);

      return redirectTo('connected=1');
    } catch (err: any) {
      logger.error('Payment OAuth code exchange failed: %s', err?.message);
      return redirectTo('connect_error=exchange_failed');
    }
  };
}
