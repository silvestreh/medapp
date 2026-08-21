import type { Application } from '../../declarations';
import { getPaymentsConfig } from '../../utils/payments-config';
import { registerProvider } from './provider-registry';
import { MercadoPagoProvider } from './providers/mercado-pago/mercado-pago-provider';

// Configuration-driven provider registration: a second processor is a new
// adapter file plus an entry here.
export default function registerPaymentProviders(app: Application): void {
  const config = getPaymentsConfig(app);

  if (config.mercadoPago.clientId && config.mercadoPago.clientSecret) {
    registerProvider(new MercadoPagoProvider({
      clientId: config.mercadoPago.clientId,
      clientSecret: config.mercadoPago.clientSecret,
      webhookSecret: config.mercadoPago.webhookSecret ?? '',
    }));
  }
}
