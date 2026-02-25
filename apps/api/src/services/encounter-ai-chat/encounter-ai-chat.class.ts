import { BadRequest, Forbidden } from '@feathersjs/errors';
import type { Params } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { anonymizeEncounterHistory, type AnonymizedEncounterHistory } from '../../utils/anonymize-encounter-history';
import { requestLlmCompletion } from './llm-adapter';

export type EncounterAiChatRole = 'system' | 'user' | 'assistant';
export type LlmProvider = 'openai' | 'anthropic';

export interface EncounterAiChatMessage {
  role: EncounterAiChatRole;
  content: string;
}

export interface EncounterAiChatSuggestion {
  title: string;
  detail: string;
  confidence?: number;
}

export interface EncounterAiChatData {
  patientId: string;
  encounterDraft: Record<string, any>;
  messages: EncounterAiChatMessage[];
  providerApiKey?: string;
  preferredProvider?: LlmProvider;
  model?: string;
}

export interface EncounterAiChatResult {
  message: string;
  differentials: EncounterAiChatSuggestion[];
  suggestedNextSteps: EncounterAiChatSuggestion[];
  treatmentIdeas: EncounterAiChatSuggestion[];
  warnings: string[];
  rationale: string;
  confidence: number;
  citations: string[];
  meta: {
    provider: LlmProvider | 'local-lm-studio';
    model: string;
    onDemand: true;
    encounterCount: number;
  };
}

export class EncounterAiChat {
  app: Application;
  private userRateMap = new Map<string, number[]>();
  private readonly maxHistoryEncounters = Number(process.env.ENCOUNTER_AI_CHAT_MAX_HISTORY_ENCOUNTERS || 10);
  private readonly maxHistoryStudies = Number(process.env.ENCOUNTER_AI_CHAT_MAX_HISTORY_STUDIES || 10);
  private readonly maxMessageHistory = Number(process.env.ENCOUNTER_AI_CHAT_MAX_MESSAGE_HISTORY || 8);
  private readonly maxDataCharsPerItem = Number(process.env.ENCOUNTER_AI_CHAT_MAX_DATA_CHARS_PER_ITEM || 1000);
  private readonly maxDraftChars = Number(process.env.ENCOUNTER_AI_CHAT_MAX_DRAFT_CHARS || 2000);
  private readonly maxHistoryChars = Number(process.env.ENCOUNTER_AI_CHAT_MAX_HISTORY_CHARS || 12000);

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: EncounterAiChatData, params?: Params): Promise<EncounterAiChatResult> {
    this.assertFeatureEnabled();
    this.assertRolloutAllowed(String(params?.organizationId || ''));

    if (!params?.user) {
      throw new Forbidden('Authentication required');
    }

    if ((params.user as any).roleId !== 'medic') {
      throw new Forbidden('Only medics can use encounter AI chat');
    }

    const userId = String((params.user as any).id || '');
    this.assertRateLimit(userId);

    const patientId = String(data?.patientId || '');
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const encounterDraft = data?.encounterDraft;

    if (!patientId) {
      throw new BadRequest('patientId is required');
    }

    if (!messages.length) {
      throw new BadRequest('messages is required');
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || !String(lastMessage.content || '').trim()) {
      throw new BadRequest('Last message must be a non-empty user message');
    }

    if (!encounterDraft || typeof encounterDraft !== 'object') {
      throw new BadRequest('encounterDraft is required');
    }

    const history = await this.fetchAnonymizedHistory(patientId, params);
    const compact = this.compactContext(history, encounterDraft);
    let systemPrompt = this.buildSystemPrompt(compact);
    const userMessage = String(lastMessage.content).trim();
    const trimmedMessages = this.trimMessages(messages);
    const providerApiKeys = await this.getProviderApiKeys(params);
    const organizationLlmConfig = await this.getOrganizationLlmConfig(params);
    let completion;
    try {
      completion = await requestLlmCompletion({
        systemPrompt,
        messages: trimmedMessages,
        preferredProvider: data.preferredProvider || organizationLlmConfig.preferredProvider,
        providerApiKey: data.providerApiKey,
        providerApiKeys,
        model: data.model || organizationLlmConfig.model,
      });
    } catch (error: any) {
      if (!this.isContextLengthError(error)) throw error;
      // Fallback to a highly compressed prompt for small-context local models.
      systemPrompt = this.buildSystemPrompt(this.compactContext(history, encounterDraft, true));
      completion = await requestLlmCompletion({
        systemPrompt,
        messages: trimmedMessages.slice(-2),
        preferredProvider: data.preferredProvider || organizationLlmConfig.preferredProvider,
        providerApiKey: data.providerApiKey,
        providerApiKeys,
        model: data.model || organizationLlmConfig.model,
      });
    }
    const parsed = this.parseAssistantPayload(completion.text);

    const result: EncounterAiChatResult = {
      message: parsed.message || `Context reviewed (${history.encounters.length} encounters). "${userMessage}"`,
      differentials: parsed.differentials,
      suggestedNextSteps: parsed.suggestedNextSteps,
      treatmentIdeas: parsed.treatmentIdeas,
      warnings: parsed.warnings,
      rationale: parsed.rationale,
      confidence: parsed.confidence,
      citations: parsed.citations,
      meta: {
        provider: completion.provider,
        model: completion.model,
        onDemand: true,
        encounterCount: history.encounters.length,
      },
    };

    this.logAudit({
      userId,
      patientId,
      organizationId: String(params?.organizationId || ''),
      provider: result.meta.provider,
      model: result.meta.model,
      encounterCount: result.meta.encounterCount,
      messageCount: trimmedMessages.length,
    });

    return result;
  }

  private async fetchAnonymizedHistory(patientId: string, params?: Params): Promise<AnonymizedEncounterHistory> {
    const patient = await this.app.service('patients').get(patientId, params as any);
    const [encountersResult, studiesResult] = await Promise.all([
      this.app.service('encounters').find({
        ...(params as any),
        paginate: false,
        query: {
          patientId,
          $sort: { date: 1 },
          $limit: 200,
        },
      } as any),
      this.app.service('studies').find({
        ...(params as any),
        paginate: false,
        query: {
          patientId,
          $sort: { date: 1 },
          $limit: 200,
        },
      } as any),
    ]);
    const encounters = Array.isArray(encountersResult)
      ? encountersResult
      : (encountersResult as any).data || [];
    const studies = Array.isArray(studiesResult)
      ? studiesResult
      : (studiesResult as any).data || [];

    return anonymizeEncounterHistory({
      patient,
      encounters,
      studies,
    });
  }

  private buildClinicalSummary(history: AnonymizedEncounterHistory): string {
    if (history.encounters.length === 0) {
      return 'No prior encounter history was found for this patient.';
    }

    const lastEncounter = history.encounters[history.encounters.length - 1];
    const preview = JSON.stringify(lastEncounter.data).slice(0, 500);
    return `Analyzed ${history.encounters.length} anonymized encounters. Most recent relative day: ${lastEncounter.relativeDay}. Latest clinical data preview: ${preview}`;
  }

  private buildSystemPrompt(compactPayload: {
    history: Record<string, any>;
    encounterDraft: Record<string, any>;
  }): string {
    const historyJson = this.limitString(JSON.stringify(compactPayload.history), this.maxHistoryChars);
    const draftJson = this.limitString(JSON.stringify(compactPayload.encounterDraft), this.maxDraftChars);
    return [
      'You are a clinical assistant for physicians.',
      'The input is anonymized and must remain anonymized.',
      'Never provide definitive diagnosis. Suggest options and caution flags only.',
      'Always mention suggestions are assistive and require physician judgement.',
      'Respond in valid JSON with this shape:',
      '{"message":"string","differentials":[{"title":"string","detail":"string","confidence":0.0}],"suggestedNextSteps":[{"title":"string","detail":"string","confidence":0.0}],"treatmentIdeas":[{"title":"string","detail":"string","confidence":0.0}],"warnings":["string"],"rationale":"string","confidence":0.0,"citations":["string"]}',
      `ANONYMIZED_STUDY_COUNT: ${compactPayload.history.studiesCount || 0}`,
      `ANONYMIZED_HISTORY: ${historyJson}`,
      `CURRENT_ENCOUNTER_DRAFT: ${draftJson}`,
    ].join('\n');
  }

  private compactContext(history: AnonymizedEncounterHistory, encounterDraft: Record<string, any>, ultra = false): {
    history: Record<string, any>;
    encounterDraft: Record<string, any>;
  } {
    const encounterLimit = ultra ? 4 : this.maxHistoryEncounters;
    const studyLimit = ultra ? 4 : this.maxHistoryStudies;
    const perItemLimit = ultra ? Math.floor(this.maxDataCharsPerItem / 2) : this.maxDataCharsPerItem;

    const compactEncounters = history.encounters.slice(-encounterLimit).map(encounter => ({
      date: encounter.date,
      relativeDay: encounter.relativeDay,
      data: this.compactObject(encounter.data, perItemLimit),
    }));

    const compactStudies = history.studies.slice(-studyLimit).map(study => ({
      date: study.date,
      relativeDay: study.relativeDay,
      protocol: study.protocol,
      studies: study.studies,
      results: (study.results || []).slice(0, ultra ? 1 : 3).map(result => ({
        type: result.type,
        data: this.compactObject(result.data, perItemLimit),
      })),
    }));

    return {
      history: {
        patient: history.patient,
        timelineStartDate: history.timelineStartDate,
        encountersCount: history.encounters.length,
        studiesCount: history.studies.length,
        encounters: compactEncounters,
        studies: compactStudies,
      },
      encounterDraft: this.compactObject(encounterDraft || {}, this.maxDraftChars),
    };
  }

  private compactObject(value: any, maxChars: number): any {
    const json = this.limitString(JSON.stringify(value), maxChars);
    try {
      return JSON.parse(json);
    } catch (_error) {
      return { truncated: json };
    }
  }

  private trimMessages(messages: EncounterAiChatMessage[]): EncounterAiChatMessage[] {
    if (!Array.isArray(messages)) return [];
    return messages.slice(-this.maxMessageHistory).map(message => ({
      role: message.role,
      content: this.limitString(String(message.content || ''), 1200),
    }));
  }

  private limitString(value: string, maxChars: number): string {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars - 14))}...[truncated]`;
  }

  private isContextLengthError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('context length') ||
      message.includes('tokens to keep') ||
      message.includes('maximum context') ||
      message.includes('prompt is too long')
    );
  }

  private parseAssistantPayload(rawText: string): Omit<EncounterAiChatResult, 'meta'> {
    const fallback: Omit<EncounterAiChatResult, 'meta'> = {
      message: rawText.slice(0, 1500),
      differentials: [],
      suggestedNextSteps: [],
      treatmentIdeas: [],
      warnings: ['AI suggestions are assistive only and must be reviewed by a clinician.'],
      rationale: 'Model response could not be parsed as structured JSON.',
      confidence: 0,
      citations: [],
    };

    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return fallback;
      const payload = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));

      const toSuggestionList = (value: any): EncounterAiChatSuggestion[] => {
        if (!Array.isArray(value)) return [];
        return value
          .map((item: any) => ({
            title: String(item?.title || '').trim(),
            detail: String(item?.detail || '').trim(),
            confidence: typeof item?.confidence === 'number' ? item.confidence : undefined,
          }))
          .filter((item: EncounterAiChatSuggestion) => Boolean(item.title) && Boolean(item.detail));
      };

      return {
        message: String(payload?.message || fallback.message),
        differentials: toSuggestionList(payload?.differentials),
        suggestedNextSteps: toSuggestionList(payload?.suggestedNextSteps),
        treatmentIdeas: toSuggestionList(payload?.treatmentIdeas),
        warnings: Array.isArray(payload?.warnings) ? payload.warnings.map((item: any) => String(item)) : fallback.warnings,
        rationale: String(payload?.rationale || fallback.rationale),
        confidence: typeof payload?.confidence === 'number' ? payload.confidence : 0,
        citations: Array.isArray(payload?.citations) ? payload.citations.map((item: any) => String(item)) : [],
      };
    } catch (_error) {
      return fallback;
    }
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

  private async getOrganizationLlmConfig(params?: Params): Promise<{
    preferredProvider?: LlmProvider;
    model?: string;
  }> {
    const organizationId = String(params?.organizationId || '');
    if (!organizationId) {
      return {};
    }

    try {
      const org = await this.app.service('organizations').get(organizationId, params as any);
      const llmChat = (org as any)?.settings?.llmChat || {};
      const preferredProvider = llmChat?.preferredProvider;
      const model = llmChat?.model;
      return {
        preferredProvider: preferredProvider === 'openai' || preferredProvider === 'anthropic'
          ? preferredProvider
          : undefined,
        model: typeof model === 'string' && model.trim() ? model.trim() : undefined,
      };
    } catch (_error) {
      return {};
    }
  }

  private assertFeatureEnabled(): void {
    const enabled = process.env.ENCOUNTER_AI_CHAT_ENABLED ?? 'true';
    if (enabled.toLowerCase() !== 'true') {
      throw new Forbidden('Encounter AI chat is disabled');
    }
  }

  private assertRolloutAllowed(organizationId: string): void {
    const allowlist = String(process.env.ENCOUNTER_AI_CHAT_ORG_ALLOWLIST || '').trim();
    if (!allowlist) return;
    const allowedOrgIds = allowlist
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    if (!allowedOrgIds.length) return;
    if (!organizationId || !allowedOrgIds.includes(organizationId)) {
      throw new Forbidden('Encounter AI chat rollout is not enabled for this organization');
    }
  }

  private assertRateLimit(userId: string): void {
    if (!userId) return;
    const now = Date.now();
    const windowMs = Number(process.env.ENCOUNTER_AI_CHAT_RATE_WINDOW_MS || 60_000);
    const maxRequests = Number(process.env.ENCOUNTER_AI_CHAT_RATE_MAX || 10);
    const existing = this.userRateMap.get(userId) || [];
    const next = existing.filter(timestamp => now - timestamp <= windowMs);
    if (next.length >= maxRequests) {
      throw new BadRequest('Too many AI chat requests. Please wait before sending another message.');
    }
    next.push(now);
    this.userRateMap.set(userId, next);
  }

  private logAudit(data: {
    userId: string;
    organizationId: string;
    patientId: string;
    provider: string;
    model: string;
    encounterCount: number;
    messageCount: number;
  }): void {
    console.info('[encounter-ai-chat]', JSON.stringify({
      at: new Date().toISOString(),
      userId: data.userId,
      organizationId: data.organizationId,
      patientId: data.patientId,
      provider: data.provider,
      model: data.model,
      encounterCount: data.encounterCount,
      messageCount: data.messageCount,
    }));
  }
}
