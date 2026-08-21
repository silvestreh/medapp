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

  // MP's legacy sandbox host (sandbox_init_point) is decommissioned; the
  // provider must always hand back init_point. Test vs live is decided by the
  // credentials that own the preference, never by the checkout URL.
  it('uses init_point even when a legacy sandbox_init_point is present', async () => {
    stubPreference({ id: 'pref-1', init_point: 'https://www.mp/checkout', sandbox_init_point: 'https://sandbox.mp/checkout' });
    const result = await charge();
    assert.strictEqual(result.checkoutUrl, 'https://www.mp/checkout');
  });

  it('uses init_point when no sandbox URL is returned', async () => {
    stubPreference({ id: 'pref-2', init_point: 'https://www.mp/checkout' });
    const result = await charge();
    assert.strictEqual(result.checkoutUrl, 'https://www.mp/checkout');
  });
});
