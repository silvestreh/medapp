import assert from 'assert';
import { MercadoPagoProvider } from '../../src/services/payments/providers/mercado-pago/mercado-pago-provider';
import { setMercadoPagoRequestImplForTesting } from '../../src/services/payments/providers/mercado-pago/mercado-pago-client';

describe('MercadoPagoProvider.createCharge checkout URL', function () {
  const provider = new MercadoPagoProvider({ clientId: 'x', clientSecret: 'y', webhookSecret: 'z' });

  const stubPreference = (resp: Record<string, unknown>) => {
    setMercadoPagoRequestImplForTesting(async (config) => {
      if (String(config.url).includes('/checkout/preferences')) {
        return { data: resp };
      }
      throw new Error(`unexpected call: ${config.url}`);
    });
  };

  const charge = () => provider.createCharge({
    credentials: { accessToken: 't', refreshToken: 'r', providerAccountId: '1', expiresAt: null },
    amount: { amount: 2250000, currency: 'ARS' },
    externalReference: 'ext-1',
    idempotencyKey: 'idem-1',
    title: 'Consulta médica',
    backUrls: { success: 'https://x/s', failure: 'https://x/f', pending: 'https://x/p' },
    notificationUrl: 'https://x/webhook',
  });

  after(() => {
    setMercadoPagoRequestImplForTesting(null);
  });

  it('uses sandbox_init_point in non-production when present', async () => {
    // NODE_ENV=test in the suite → non-production.
    stubPreference({ id: 'pref-1', init_point: 'https://www.mp/checkout', sandbox_init_point: 'https://sandbox.mp/checkout' });
    const result = await charge();
    assert.strictEqual(result.checkoutUrl, 'https://sandbox.mp/checkout');
  });

  it('falls back to init_point when no sandbox_init_point is returned', async () => {
    stubPreference({ id: 'pref-2', init_point: 'https://www.mp/checkout' });
    const result = await charge();
    assert.strictEqual(result.checkoutUrl, 'https://www.mp/checkout');
  });

  it('uses init_point in production even if a sandbox URL is present', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      stubPreference({ id: 'pref-3', init_point: 'https://www.mp/checkout', sandbox_init_point: 'https://sandbox.mp/checkout' });
      const result = await charge();
      assert.strictEqual(result.checkoutUrl, 'https://www.mp/checkout');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
