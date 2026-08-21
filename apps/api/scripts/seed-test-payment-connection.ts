import app from '../src/app';
import type { PaymentConnections } from '../src/services/payment-connections/payment-connections.class';

// Sandbox helper: seeds a payment_connections row for one professional using
// the application's TEST access token as the seller credential, so the full
// charge → checkout → webhook path can be exercised BEFORE the Mercado Pago
// application is production-activated (the OAuth connect flow needs the real
// client_secret, which only exists after activation).
//
// Usage:
//   MP_TEST_ACCESS_TOKEN=TEST-... npm run db:seed-test-payment-connection -- <medic username or id>
//
// NEVER run this against production: real professionals must connect through
// the OAuth flow so charges land in THEIR account, not the platform's.

const MP_APP_OWNER_ID = '3631881652';

async function seedTestPaymentConnection() {
  try {
    const target = process.argv[2];
    const accessToken = process.env.MP_TEST_ACCESS_TOKEN;

    if (!target) {
      console.error('Usage: npm run db:seed-test-payment-connection -- <medic username or id>');
      process.exit(1);
    }

    if (!accessToken || !accessToken.startsWith('TEST-')) {
      console.error('MP_TEST_ACCESS_TOKEN must be set and start with "TEST-" — this script is sandbox-only.');
      process.exit(1);
    }

    if (process.env.NODE_ENV === 'production') {
      console.error('Refusing to run in production: professionals must connect via OAuth.');
      process.exit(1);
    }

    await app.get('sequelizeSync');

    // Resolve the medic by id first, then by username.
    let user: any = null;
    try {
      user = await app.service('users').get(target, { provider: undefined });
    } catch {
      const result = await app.service('users').find({
        query: { username: target, $limit: 1 },
        provider: undefined,
        paginate: false,
      }) as any[];
      user = result[0] ?? null;
    }

    if (!user) {
      console.error(`No user found for "${target}".`);
      process.exit(1);
    }

    const connections = app.service('payment-connections') as unknown as PaymentConnections;
    await connections.storeCredentials(String(user.id), 'mercado_pago', {
      accessToken,
      // The TEST token has no refresh token; the refresh cron skips rows whose
      // expiry is far out, and refresh failures only degrade to unpaid booking.
      refreshToken: '', // coerced to null by storeCredentials (TEST token has no refresh token)
      providerAccountId: MP_APP_OWNER_ID,
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
    }, { logEvent: false });

    console.log(`Seeded sandbox payment connection for ${user.username} (${user.id}).`);
    console.log('Remember: payment-settings must be enabled and an insurerPrices._particular.encounter price set for booking to offer payment.');
    process.exit(0);
  } catch (error: any) {
    console.error('Seed failed:', error?.message || error);
    process.exit(1);
  }
}

seedTestPaymentConnection();
