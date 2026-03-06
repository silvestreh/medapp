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
  provider: LlmProvider;
  models: string[];
  defaultModel?: string;
}

export class LlmModels {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: LlmModelsCreateData, params?: Params): Promise<LlmModelsResult> {
    const orgConfig = await this.getOrganizationLlmConfig(params);
    let provider = data?.provider || orgConfig.preferredProvider;
    if (provider && !['openai', 'anthropic', 'lmstudio'].includes(provider)) {
      throw new BadRequest('provider must be "openai", "anthropic", or "lmstudio"');
    }

    const providerApiKeys = await this.getProviderApiKeys(params);
    const result = await listLlmModels({
      preferredProvider: provider,
      providerApiKey: data?.providerApiKey,
      providerApiKeys,
      lmStudioBaseUrl: orgConfig.lmStudioBaseUrl,
    });
    return {
      ...result,
      defaultModel: orgConfig.defaultModel,
    };
  }

  private async getProviderApiKeys(params?: Params): Promise<Partial<Record<LlmProvider, string>>> {
    try {
      const keyService = this.app.service('llm-api-keys') as any;
      if (!keyService?.getDecryptedProviderKeys) return {};
      const organizationId = String(params?.organizationId || '');
      return await keyService.getDecryptedProviderKeys(organizationId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return {};
    }
  }

  private async getOrganizationLlmConfig(params?: Params): Promise<{
    preferredProvider?: LlmProvider;
    defaultModel?: string;
    lmStudioBaseUrl?: string;
  }> {
    const organizationId = String(params?.organizationId || '');
    if (!organizationId) return {};
    try {
      const org = await this.app.service('organizations').get(organizationId, params as any);
      const llmChat = (org as any)?.settings?.llmChat || {};
      const preferred = llmChat.preferredProvider;
      return {
        preferredProvider: ['openai', 'anthropic', 'lmstudio'].includes(preferred) ? preferred : undefined,
        defaultModel: typeof llmChat.model === 'string' && llmChat.model.trim() ? llmChat.model.trim() : undefined,
        lmStudioBaseUrl: typeof llmChat.lmStudioBaseUrl === 'string' && llmChat.lmStudioBaseUrl.trim()
          ? llmChat.lmStudioBaseUrl.trim()
          : undefined,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      return {};
    }
  }
}
