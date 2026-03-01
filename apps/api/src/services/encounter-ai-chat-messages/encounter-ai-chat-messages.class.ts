import { BadRequest, Forbidden } from '@feathersjs/errors';
import type { Params, Paginated } from '@feathersjs/feathers';
import { Service, SequelizeServiceOptions } from 'feathers-sequelize';

import type { Application } from '../../declarations';

type MessageRole = 'user' | 'assistant';

interface EncounterAiChatSuggestions {
  differentials?: any[];
  suggestedNextSteps?: any[];
  treatmentIdeas?: any[];
  warnings?: string[];
  rationale?: string;
  confidence?: number;
  citations?: string[];
}

export interface EncounterAiChatMessageRecord {
  id: string;
  organizationId: string;
  patientId: string;
  medicId: string;
  role: MessageRole;
  content: string;
  model?: string | null;
  suggestions?: EncounterAiChatSuggestions | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EncounterAiChatMessages extends Service<EncounterAiChatMessageRecord> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }

  async find(params?: Params): Promise<Paginated<EncounterAiChatMessageRecord> | EncounterAiChatMessageRecord[]> {
    const { userId, organizationId } = this.assertMedicAccess(params);
    const patientId = String(params?.query?.patientId || '');
    if (!patientId) {
      throw new BadRequest('patientId is required');
    }

    const nextParams: Params = {
      ...(params || {}),
      query: {
        ...(params?.query || {}),
        organizationId,
        medicId: userId,
        patientId,
      },
    };

    if (!nextParams.query?.$sort) {
      nextParams.query = {
        ...nextParams.query,
        $sort: { createdAt: -1 },
      };
    }

    return super.find(nextParams);
  }

  async create(data: Partial<EncounterAiChatMessageRecord>, params?: Params): Promise<EncounterAiChatMessageRecord> {
    const { userId, organizationId } = this.assertMedicAccess(params);
    const patientId = String(data?.patientId || '');
    const role = String(data?.role || '') as MessageRole;
    const content = String(data?.content || '').trim();

    if (!patientId) {
      throw new BadRequest('patientId is required');
    }
    if (!content) {
      throw new BadRequest('content is required');
    }
    if (role !== 'user' && role !== 'assistant') {
      throw new BadRequest('role must be "user" or "assistant"');
    }

    const payload: Partial<EncounterAiChatMessageRecord> = {
      organizationId,
      patientId,
      medicId: userId,
      role,
      content,
      model: role === 'assistant' && data?.model ? String(data.model) : null,
      suggestions: role === 'assistant' && data?.suggestions ? data.suggestions : null,
    };

    const created = await super.create(payload, params);
    if (Array.isArray(created)) {
      return created[0];
    }
    return created;
  }

  private assertMedicAccess(params?: Params): { userId: string; organizationId: string } {
    const userId = String(params?.user?.id || '');
    const organizationId = String(params?.organizationId || '');
    if (!userId || !organizationId) {
      throw new Forbidden('Authentication and organization are required');
    }
    const orgRoleIds: string[] = (params as any)?.orgRoleIds || [];
    if (!orgRoleIds.includes('medic')) {
      throw new Forbidden('Only medics can access encounter AI chat history');
    }
    return { userId, organizationId };
  }
}

