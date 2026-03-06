import { BadRequest, Forbidden } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';

type Provider = 'openai' | 'anthropic' | 'lmstudio';

interface LlmApiKeysCreateData {
  provider: Provider;
  apiKey: string;
}

interface LlmApiKeysProviderStatus {
  provider: Provider;
  configured: boolean;
  keyHint?: string;
}

interface LlmApiKeysGetResult {
  organizationId: string;
  providers: LlmApiKeysProviderStatus[];
}

export class LlmApiKeys {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async get(id: string, params?: Params): Promise<LlmApiKeysGetResult> {
    if (id !== 'current') {
      throw new BadRequest('Only "current" is supported');
    }

    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      throw new BadRequest('organizationId is required');
    }

    await this.assertCanManageKeys(params);

    const model = this.getModel();
    if (!model) {
      console.error('[llm-api-keys] Model not found in get(). Has the DB been synced?');
      throw new BadRequest('llm_api_keys model not available');
    }
    const rows = await model.findAll({
      where: { organizationId },
      attributes: ['provider', 'keyHint'],
      raw: true,
    });
    console.log(`[llm-api-keys] get() org=${organizationId} found ${rows.length} keys`);

    const rowMap = new Map(rows.map((r: any) => [r.provider, r]));

    return {
      organizationId,
      providers: [
        {
          provider: 'openai',
          configured: rowMap.has('openai'),
          keyHint: (rowMap.get('openai') as any)?.keyHint || undefined,
        },
        {
          provider: 'anthropic',
          configured: rowMap.has('anthropic'),
          keyHint: (rowMap.get('anthropic') as any)?.keyHint || undefined,
        },
        { provider: 'lmstudio', configured: true },
      ],
    };
  }

  async create(data: LlmApiKeysCreateData, params?: Params): Promise<LlmApiKeysGetResult> {
    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      throw new BadRequest('organizationId is required');
    }
    if (!data?.provider || !['openai', 'anthropic', 'lmstudio'].includes(data.provider)) {
      throw new BadRequest('provider must be "openai", "anthropic", or "lmstudio"');
    }
    const apiKey = String(data.apiKey || '').trim();
    if (!apiKey) {
      throw new BadRequest('apiKey is required');
    }

    await this.assertCanManageKeys(params);

    const model = this.getModel();
    if (!model) {
      console.error('[llm-api-keys] Model not found. Has the DB been synced?');
      throw new BadRequest('llm_api_keys model not available');
    }
    const keyHint = `${apiKey.length}-${apiKey.slice(-4)}`;

    const existing = await model.findOne({
      where: { organizationId, provider: data.provider },
    });

    if (existing) {
      await existing.update({ key: apiKey, keyHint });
    } else {
      await model.create({
        provider: data.provider,
        key: apiKey,
        keyHint,
        organizationId,
      } as any);
    }
    console.log(`[llm-api-keys] Saved key for provider=${data.provider} org=${organizationId}`);

    return this.get('current', params);
  }

  async remove(id: string, params?: Params): Promise<LlmApiKeysGetResult> {
    const provider = String(id) as Provider;
    if (!['openai', 'anthropic', 'lmstudio'].includes(provider)) {
      throw new BadRequest('id must be "openai", "anthropic", or "lmstudio"');
    }

    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      throw new BadRequest('organizationId is required');
    }

    await this.assertCanManageKeys(params);

    const model = this.getModel();
    await model.destroy({ where: { organizationId, provider } });

    return this.get('current', params);
  }

  async getDecryptedProviderKeys(organizationId: string): Promise<Partial<Record<Provider, string>>> {
    if (!organizationId) {
      console.warn('[llm-api-keys] getDecryptedProviderKeys called without organizationId');
      return {};
    }

    try {
      const model = this.getModel();
      if (!model) {
        console.error('[llm-api-keys] Model not found in getDecryptedProviderKeys()');
        return {};
      }
      const decryptedAttributes = (model as any).decryptedAttributes;
      const rows = await model.findAll({
        where: { organizationId },
        ...(decryptedAttributes ? { attributes: decryptedAttributes } : {}),
        raw: true,
      });

      const result: Partial<Record<Provider, string>> = {};
      for (const row of rows as any[]) {
        if (row.provider && row.key) {
          result[row.provider as Provider] = typeof row.key === 'string'
            ? row.key
            : Buffer.isBuffer(row.key)
              ? row.key.toString('utf8')
              : String(row.key);
        }
      }
      console.log(`[llm-api-keys] getDecryptedProviderKeys org=${organizationId} providers=[${Object.keys(result).join(',')}]`);
      return result;
    } catch (error: any) {
      console.error('[llm-api-keys] getDecryptedProviderKeys failed:', error?.message || error);
      return {};
    }
  }

  private getModel() {
    const sequelize = this.app.get('sequelizeClient');
    return sequelize.models.llm_api_keys;
  }

  private async assertCanManageKeys(params?: Params): Promise<void> {
    const userId = String(params?.user?.id || '');
    const organizationId = String(params?.organizationId || '');
    if (!userId || !organizationId) {
      throw new Forbidden('Authentication and organization are required');
    }

    const userRoles = await this.app.service('user-roles').find({
      query: {
        userId,
        organizationId,
        roleId: 'owner',
      },
      paginate: false,
    } as any) as any[];

    if (!userRoles.length) {
      throw new Forbidden('Only organization owners can manage provider keys');
    }
  }
}
