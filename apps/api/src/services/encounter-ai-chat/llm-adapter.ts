import { BadRequest } from '@feathersjs/errors';

import type { EncounterAiChatMessage, LlmProvider } from './encounter-ai-chat.class';

export interface LlmAdapterInput {
  systemPrompt: string;
  messages: EncounterAiChatMessage[];
  preferredProvider?: LlmProvider;
  providerApiKey?: string;
  providerApiKeys?: Partial<Record<LlmProvider, string>>;
  model?: string;
  lmStudioBaseUrl?: string;
}

export interface LlmAdapterOutput {
  provider: LlmProvider;
  model: string;
  text: string;
}

const MAX_RETRIES = 2;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function toProviderOrder(preferredProvider?: LlmProvider): LlmProvider[] {
  if (preferredProvider === 'lmstudio') {
    if (isProduction()) return ['openai', 'anthropic'];
    return ['lmstudio'];
  }
  if (!preferredProvider) return ['openai', 'anthropic'];
  return preferredProvider === 'openai'
    ? ['openai', 'anthropic']
    : ['anthropic', 'openai'];
}

function getProviderApiKey(provider: LlmProvider, input: LlmAdapterInput): string | null {
  if (provider === 'lmstudio') return 'not-needed';
  if (input.preferredProvider === provider && input.providerApiKey) {
    return input.providerApiKey;
  }
  if (input.providerApiKeys?.[provider]) {
    return input.providerApiKeys[provider] || null;
  }
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY || null;
  }
  return process.env.ANTHROPIC_API_KEY || null;
}

function getLmStudioBaseUrl(input: LlmAdapterInput): string {
  return input.lmStudioBaseUrl || process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';
}

async function callLocalLmStudio(input: LlmAdapterInput): Promise<LlmAdapterOutput> {
  if (isProduction()) {
    throw new BadRequest('LM Studio is only available in local development');
  }
  const baseUrl = getLmStudioBaseUrl(input);
  const model = input.model || process.env.LM_STUDIO_MODEL || 'local-model';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: input.systemPrompt },
        ...input.messages.map(message => ({ role: message.role, content: message.content })),
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new BadRequest(`LM Studio request failed: ${text || response.statusText}`);
  }

  const payload = await response.json() as any;
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    throw new BadRequest('LM Studio returned an empty response');
  }
  return {
    provider: 'lmstudio',
    model,
    text,
  };
}

function fetchOpenAi(baseUrl: string, apiKey: string, body: Record<string, any>): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

async function callOpenAi(input: LlmAdapterInput, apiKey: string): Promise<LlmAdapterOutput> {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = input.model || process.env.OPENAI_MODEL || 'gpt-4.1';
  const body: Record<string, any> = {
    model,
    messages: [
      { role: 'system', content: input.systemPrompt },
      ...input.messages.map(message => ({ role: message.role, content: message.content })),
    ],
  };

  // Some OpenAI models (e.g. gpt-5-mini) reject custom temperature values.
  // Try with temperature first; if unsupported, retry without it.
  let response = await fetchOpenAi(baseUrl, apiKey, { ...body, temperature: 0.2 });
  if (!response.ok) {
    const text = await response.text();
    if (text.includes('temperature') && text.includes('unsupported_value')) {
      response = await fetchOpenAi(baseUrl, apiKey, body);
      if (!response.ok) {
        const retryText = await response.text();
        throw new Error(retryText || response.statusText);
      }
    } else {
      throw new Error(text || response.statusText);
    }
  }

  const payload = await response.json() as any;
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI returned an empty response');
  }

  return {
    provider: 'openai',
    model,
    text,
  };
}

async function callAnthropic(input: LlmAdapterInput, apiKey: string): Promise<LlmAdapterOutput> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
  const model = input.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.2,
      system: input.systemPrompt,
      messages: input.messages
        .filter(message => message.role !== 'system')
        .map(message => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content,
        })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  const payload = await response.json() as any;
  const text = payload?.content?.[0]?.text;
  if (!text) {
    throw new Error('Anthropic returned an empty response');
  }

  return {
    provider: 'anthropic',
    model,
    text,
  };
}

async function callWithRetry(provider: LlmProvider, input: LlmAdapterInput, apiKey: string): Promise<LlmAdapterOutput> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      if (provider === 'lmstudio') {
        return await callLocalLmStudio(input);
      }
      if (provider === 'openai') {
        return await callOpenAi(input, apiKey);
      }
      return await callAnthropic(input, apiKey);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error(`Unknown ${provider} adapter error`);
}

export async function requestLlmCompletion(input: LlmAdapterInput): Promise<LlmAdapterOutput> {
  const preferred = input.preferredProvider || (isProduction() ? undefined : 'lmstudio');
  const providerOrder = toProviderOrder(preferred);
  const providerErrors: string[] = [];

  for (const provider of providerOrder) {
    const apiKey = getProviderApiKey(provider, input);
    if (!apiKey) {
      providerErrors.push(`${provider}: missing api key`);
      continue;
    }

    try {
      return await callWithRetry(provider, input, apiKey);
    } catch (error: any) {
      providerErrors.push(`${provider}: ${String(error?.message || error)}`);
    }
  }

  throw new BadRequest(`Could not reach an LLM provider. ${providerErrors.join(' | ')}`);
}

export interface LlmModelListInput {
  preferredProvider?: LlmProvider;
  providerApiKey?: string;
  providerApiKeys?: Partial<Record<LlmProvider, string>>;
  lmStudioBaseUrl?: string;
}

export interface LlmModelListOutput {
  provider: LlmProvider;
  models: string[];
}

function normalizeModelIds(payload: any): string[] {
  const raw = Array.isArray(payload?.data) ? payload.data : [];
  const ids = raw
    .map((item: any) => String(item?.id || '').trim())
    .filter((id: string) => Boolean(id));
  return Array.from(new Set<string>(ids)).sort((a, b) => a.localeCompare(b));
}

async function listLmStudioModels(baseUrl: string): Promise<LlmModelListOutput> {
  if (isProduction()) {
    throw new BadRequest('LM Studio is only available in local development');
  }
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new BadRequest(`LM Studio models request failed: ${text || response.statusText}`);
  }
  const payload = await response.json();
  return { provider: 'lmstudio', models: normalizeModelIds(payload) };
}

async function listOpenAiModels(input: LlmModelListInput): Promise<LlmModelListOutput> {
  const apiKey = getProviderApiKey('openai', {
    systemPrompt: '',
    messages: [],
    preferredProvider: input.preferredProvider,
    providerApiKey: input.providerApiKey,
    providerApiKeys: input.providerApiKeys,
  });
  if (!apiKey) {
    throw new BadRequest('Missing OpenAI API key for model listing');
  }
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new BadRequest(`OpenAI models request failed: ${text || response.statusText}`);
  }
  const payload = await response.json();
  return { provider: 'openai', models: normalizeModelIds(payload) };
}

export async function listLlmModels(input: LlmModelListInput): Promise<LlmModelListOutput> {
  const provider = input.preferredProvider || (isProduction() ? 'openai' : 'lmstudio');

  if (provider === 'lmstudio') {
    const baseUrl = input.lmStudioBaseUrl || process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';
    return listLmStudioModels(baseUrl);
  }

  if (provider === 'openai') {
    return listOpenAiModels(input);
  }

  // Anthropic doesn't expose a model listing endpoint
  return { provider, models: [] };
}
