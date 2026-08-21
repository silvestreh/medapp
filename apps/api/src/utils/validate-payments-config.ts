import type { Application } from '../declarations';
import { getPaymentsConfig } from './payments-config';

// Boot-time guard, called from app.ts. Payment credentials are encrypted with
// a key that must exist and must NOT be the clinical-records key: compromise
// of one domain's key must not expose the other. When the feature is not
// configured (no Mercado Pago client id) the app boots exactly as before.
export function validatePaymentsConfig(app: Application): void {
  const config = getPaymentsConfig(app);

  if (!config.mercadoPago.clientId) {
    return;
  }

  if (!config.encryptionKey) {
    throw new Error(
      'PAYMENTS_ENCRYPTION_KEY must be set when Mercado Pago payments are configured (MP_CLIENT_ID is present)'
    );
  }

  if (process.env.ENCRYPTION_KEY && config.encryptionKey === process.env.ENCRYPTION_KEY) {
    throw new Error(
      'PAYMENTS_ENCRYPTION_KEY must be different from ENCRYPTION_KEY — payment credentials and clinical records must not share a key'
    );
  }

  if (!config.mercadoPago.clientSecret) {
    throw new Error('MP_CLIENT_SECRET must be set when MP_CLIENT_ID is present');
  }

  if (!config.publicUrl) {
    throw new Error(
      'API_PUBLIC_URL must be set when Mercado Pago payments are configured — it builds the OAuth callback and webhook URLs'
    );
  }
}
