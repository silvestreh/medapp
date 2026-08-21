import type { PaymentProvider } from './payment-provider';

const providers = new Map<string, PaymentProvider>();
const testOverrides = new Map<string, PaymentProvider>();

export function registerProvider(provider: PaymentProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): PaymentProvider {
  const provider = testOverrides.get(id) ?? providers.get(id);

  if (!provider) {
    throw new Error(`Unknown payment provider: ${id}`);
  }

  return provider;
}

export function hasProvider(id: string): boolean {
  return testOverrides.has(id) || providers.has(id);
}

// The provider a professional connects to when none is named explicitly: the
// first one registered at boot (only one exists today).
export function getDefaultProviderId(): string {
  const [first] = [...testOverrides.keys(), ...providers.keys()];

  if (!first) {
    throw new Error('No payment provider registered');
  }

  return first;
}

// Webhook routing is derived from the provider id so adding a provider never
// touches the booking path or the middleware table: `mercado_pago` listens on
// `/webhooks/payments/mercado-pago`.
export const webhookPathFor = (providerId: string): string =>
  `/webhooks/payments/${providerId.replace(/_/g, '-')}`;

export const providerIdFromWebhookSlug = (slug: string): string => slug.replace(/-/g, '_');

export const webhookUrlFor = (publicUrl: string, providerId: string): string =>
  `${publicUrl.replace(/\/$/, '')}${webhookPathFor(providerId)}`;

// Test seam (same idea as setEnqueueImplForTesting in queues/whatsapp-queue.ts):
// tests swap the provider at the adapter boundary instead of intercepting HTTP.
export function setProviderForTesting(id: string, provider: PaymentProvider | null): void {
  if (provider) {
    testOverrides.set(id, provider);
  } else {
    testOverrides.delete(id);
  }
}

export function resetProvidersForTesting(): void {
  testOverrides.clear();
}
