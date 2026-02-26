import { BadRequest, Forbidden } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { decryptProviderKey, encryptProviderKey, type EncryptedProviderKey } from '../../utils/provider-key-crypto';

type Provider = 'openai' | 'anthropic';

interface LlmProviderKeysCreateData {
  provider: Provider;
  apiKey: string;
}

interface LlmProviderKeysStatus {
  provider: Provider;
  configured: boolean;
}

interface LlmProviderKeysGetResult {
  organizationId: string;
  providers: LlmProviderKeysStatus[];
}

export class LlmProviderKeys {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async get(id: string, params?: Params): Promise<LlmProviderKeysGetResult> {
    if (id !== 'current') {
      throw new BadRequest('Only "current" is supported');
    }

    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      throw new BadRequest('organizationId is required');
    }

    await this.assertCanManageKeys(params);

    const organization = await this.app.service('organizations').get(organizationId, params as any);
    const encryptedMap = (organization as any)?.settings?.llmProviderKeysEncrypted || {};

    return {
      organizationId,
      providers: [
        { provider: 'openai', configured: Boolean(encryptedMap?.openai) },
        { provider: 'anthropic', configured: Boolean(encryptedMap?.anthropic) },
      ],
    };
  }

  async create(data: LlmProviderKeysCreateData, params?: Params): Promise<LlmProviderKeysGetResult> {
    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      throw new BadRequest('organizationId is required');
    }
    if (!data?.provider || !['openai', 'anthropic'].includes(data.provider)) {
      throw new BadRequest('provider must be "openai" or "anthropic"');
    }
    if (!String(data.apiKey || '').trim()) {
      throw new BadRequest('apiKey is required');
    }

    await this.assertCanManageKeys(params);

    const organization = await this.app.service('organizations').get(organizationId, params as any);
    const settings = { ...((organization as any)?.settings || {}) };
    const encryptedMap = { ...(settings.llmProviderKeysEncrypted || {}) };
    encryptedMap[data.provider] = encryptProviderKey(this.app, data.apiKey.trim());
    settings.llmProviderKeysEncrypted = encryptedMap;
    settings.llmProviderKeysUpdatedAt = new Date().toISOString();

    await this.app.service('organizations').patch(organizationId, { settings }, params as any);

    return this.get('current', params);
  }

  async remove(id: string, params?: Params): Promise<LlmProviderKeysGetResult> {
    const provider = String(id) as Provider;
    if (!['openai', 'anthropic'].includes(provider)) {
      throw new BadRequest('id must be "openai" or "anthropic"');
    }

    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      throw new BadRequest('organizationId is required');
    }

    await this.assertCanManageKeys(params);

    const organization = await this.app.service('organizations').get(organizationId, params as any);
    const settings = { ...((organization as any)?.settings || {}) };
    const encryptedMap = { ...(settings.llmProviderKeysEncrypted || {}) };
    delete encryptedMap[provider];
    settings.llmProviderKeysEncrypted = encryptedMap;
    settings.llmProviderKeysUpdatedAt = new Date().toISOString();

    await this.app.service('organizations').patch(organizationId, { settings }, params as any);
    return this.get('current', params);
  }

  async getDecryptedProviderKeys(params?: Params): Promise<Partial<Record<Provider, string>>> {
    const organizationId = String(params?.organizationId || '');
    if (!organizationId) return {};

    const organization = await this.app.service('organizations').get(organizationId, params as any);
    const encryptedMap = (organization as any)?.settings?.llmProviderKeysEncrypted || {};
    const decrypted: Partial<Record<Provider, string>> = {};
    for (const provider of ['openai', 'anthropic'] as Provider[]) {
      const value = encryptedMap?.[provider] as EncryptedProviderKey | undefined;
      if (!value) continue;
      try {
        decrypted[provider] = decryptProviderKey(this.app, value);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // ignore malformed secrets
      }
    }
    return decrypted;
  }

  private async assertCanManageKeys(params?: Params): Promise<void> {
    const userId = String(params?.user?.id || '');
    const organizationId = String(params?.organizationId || '');
    if (!userId || !organizationId) {
      throw new Forbidden('Authentication and organization are required');
    }

    const memberships = await this.app.service('organization-users').find({
      query: {
        userId,
        organizationId,
        role: 'owner',
      },
      paginate: false,
    } as any) as any[];

    if (!memberships.length) {
      throw new Forbidden('Only organization owners can manage provider keys');
    }
  }
}
