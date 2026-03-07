import { HookContext } from '@feathersjs/feathers';
import { authenticate } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';

/**
 * Scope find queries to only return conversations the authenticated user participates in.
 */
const scopeToUserConversations = () => async (context: HookContext) => {
  const userId = context.params.user?.id;
  if (!userId) return context;

  const sequelize = context.app.get('sequelizeClient');
  const ConversationParticipants = sequelize.models.conversation_participants;

  const memberships = await ConversationParticipants.findAll({
    where: { userId },
    attributes: ['conversationId'],
    raw: true,
  });

  const conversationIds = memberships.map((m: any) => m.conversationId);

  context.params.query = {
    ...context.params.query,
    id: { $in: conversationIds },
  };

  return context;
};

/**
 * Attach participants to a single conversation result.
 */
async function attachParticipants(app: any, conversation: any): Promise<any> {
  const sequelize = app.get('sequelizeClient');
  const ConversationParticipants = sequelize.models.conversation_participants;

  const participants = await ConversationParticipants.findAll({
    where: { conversationId: conversation.id },
    raw: true,
  });

  return { ...conversation, participants };
}

/**
 * After hook: attach participants to get/find results.
 */
const includeParticipantsAfter = () => async (context: HookContext) => {
  if (context.method === 'get') {
    context.result = await attachParticipants(context.app, context.result);
  } else if (context.method === 'find') {
    const data = context.result.data || context.result;
    const withParticipants = await Promise.all(
      data.map((c: any) => attachParticipants(context.app, c))
    );

    if (context.result.data) {
      context.result.data = withParticipants;
    } else {
      context.result = withParticipants;
    }
  }

  return context;
};

/**
 * Validate that participantIds is provided and includes at least the creator.
 */
const validateParticipants = () => async (context: HookContext) => {
  const { participantIds } = context.data;
  const userId = context.params.user?.id;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    throw new BadRequest('participantIds is required and must be a non-empty array');
  }

  // Ensure the creator is included
  if (!participantIds.includes(userId)) {
    context.data.participantIds = [...participantIds, userId];
  }

  return context;
};

/**
 * After creating a conversation, create participant records and join them to the channel.
 */
const createParticipants = () => async (context: HookContext) => {
  const conversationId = context.result.id;
  const participantIds: string[] = context.params._participantIds;

  const participantsService = context.app.service('conversation-participants');

  await Promise.all(
    participantIds.map((userId: string) =>
      participantsService.create(
        { conversationId, userId },
        { ...context.params, provider: undefined },
      )
    )
  );

  // Re-fetch with participants
  context.result = await attachParticipants(context.app, context.result);

  // Join connected participants to the conversation channel
  const app = context.app as any;
  if (typeof app.channel === 'function') {
    participantIds.forEach((userId: string) => {
      const connections = app.channel('authenticated').connections.filter(
        (conn: any) => conn.user?.id === userId
      );
      connections.forEach((conn: any) => {
        app.channel(`conversations/${conversationId}`).join(conn);
      });
    });
  }

  return context;
};

/**
 * Strip participantIds from the data before it hits Sequelize (it's not a model field).
 */
const stripParticipantIds = () => async (context: HookContext) => {
  const { participantIds, ...rest } = context.data;
  context.params._participantIds = participantIds;
  context.data = rest;
  return context;
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [scopeToUserConversations()],
    get: [],
    create: [validateParticipants(), stripParticipantIds()],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [includeParticipantsAfter()],
    get: [includeParticipantsAfter()],
    create: [createParticipants()],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
