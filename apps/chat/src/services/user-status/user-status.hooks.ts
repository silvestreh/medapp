import { HookContext } from '@feathersjs/feathers';
import { authenticate } from '@feathersjs/authentication';
import { Forbidden } from '@feathersjs/errors';

/**
 * Only allow users to update their own status.
 */
const restrictToOwnStatus = () => async (context: HookContext) => {
  // Skip restriction for internal (server-side) calls
  if (!context.params.provider) return context;

  const userId = context.params.user?.id;

  if (context.id) {
    const existing = await context.service.get(context.id);
    if (existing.userId !== userId) {
      throw new Forbidden('You can only update your own status');
    }
  }

  return context;
};

/**
 * Set lastSeenAt when status changes.
 */
const setLastSeenAt = () => async (context: HookContext) => {
  context.data.lastSeenAt = new Date();
  return context;
};

/**
 * Scope find to only return statuses for users the requester shares conversations with.
 */
const scopeToRelevantUsers = () => async (context: HookContext) => {
  const userId = context.params.user?.id;
  if (!userId) return context;

  // If specific userIds are queried, allow it (the UI knows which users to ask about)
  if (context.params.query?.userId) return context;

  const sequelize = context.app.get('sequelizeClient');
  const ConversationParticipants = sequelize.models.conversation_participants;

  // Find all conversations the user is in
  const myMemberships = await ConversationParticipants.findAll({
    where: { userId },
    attributes: ['conversationId'],
    raw: true,
  });

  const conversationIds = myMemberships.map((m: any) => m.conversationId);

  // Find all users in those conversations
  const coParticipants = await ConversationParticipants.findAll({
    where: { conversationId: { $in: conversationIds } },
    attributes: ['userId'],
    raw: true,
  });

  const relevantUserIds = [...new Set(coParticipants.map((p: any) => p.userId))];

  context.params.query = {
    ...context.params.query,
    userId: { $in: relevantUserIds },
  };

  return context;
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [scopeToRelevantUsers()],
    get: [],
    create: [],
    update: [],
    patch: [restrictToOwnStatus(), setLastSeenAt()],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
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
