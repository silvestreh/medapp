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
