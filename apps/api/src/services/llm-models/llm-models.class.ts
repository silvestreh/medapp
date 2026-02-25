import { BadRequest } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import type { LlmProvider } from '../encounter-ai-chat/encounter-ai-chat.class';
import { listLlmModels } from '../encounter-ai-chat/llm-adapter';

interface LlmModelsCreateData {
  provider?: LlmProvider;
  providerApiKey?: string;
}

export interface LlmModelsResult {
  provider: LlmProvider | 'local-lm-studio';
  models: string[];
}

export class LlmModels {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: LlmModelsCreateData, params?: Params): Promise<LlmModelsResult> {
    let provider = data?.provider;
    if (!provider) {
      provider = await this.getOrganizationPreferredProvider(params);
    }
    if (provider && provider !== 'openai' && provider !== 'anthropic') {
      throw new BadRequest('provider must be "openai" or "anthropic"');
    }

    const providerApiKeys = await this.getProviderApiKeys(params);
    return listLlmModels({
      preferredProvider: provider,
      providerApiKey: data?.providerApiKey,
      providerApiKeys,
    });
  }

  private async getProviderApiKeys(params?: Params): Promise<Partial<Record<LlmProvider, string>>> {
    try {
      const keyService = this.app.service('llm-provider-keys') as any;
      if (!keyService?.getDecryptedProviderKeys) return {};
      return await keyService.getDecryptedProviderKeys(params);
    } catch (_error) {
      return {};
    }
  }

  private async getOrganizationPreferredProvider(params?: Params): Promise<LlmProvider | undefined> {
    const organizationId = String(params?.organizationId || '');
    if (!organizationId) return undefined;
    try {
      const org = await this.app.service('organizations').get(organizationId, params as any);
      const preferred = (org as any)?.settings?.llmChat?.preferredProvider;
      if (preferred === 'openai' || preferred === 'anthropic') {
        return preferred;
      }
      return undefined;
    } catch (_error) {
      return undefined;
    }
  }
}
