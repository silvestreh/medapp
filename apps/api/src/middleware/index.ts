import { Application } from '../declarations';
import rawBodyJson from './raw-body-json';
import recetarioWebhookHandler from './recetario-webhook-handler';
import paymentOauthCallbackHandler from './payment-oauth-callback';
import paymentWebhookHandler from './payment-webhook-handler';
import { webhookPathFor } from '../services/payments/provider-registry';
// Don't remove this comment. It's needed to format import lines nicely.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (app: Application): void {
  app.post('/webhooks/recetario', rawBodyJson(), recetarioWebhookHandler(app) as any);

  app.get('/payments/oauth/callback', paymentOauthCallbackHandler(app) as any);

  // One route for every payment provider; the handler resolves the adapter
  // from the `:provider` slug (see webhookPathFor).
  app.post(webhookPathFor(':provider'), rawBodyJson(), paymentWebhookHandler(app) as any);
}
