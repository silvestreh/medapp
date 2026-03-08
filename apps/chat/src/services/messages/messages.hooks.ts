import { HookContext } from '@feathersjs/feathers';
import { authenticate } from '@feathersjs/authentication';
import { BadRequest, Forbidden } from '@feathersjs/errors';

/**
 * Set senderId from the authenticated user.
 */
const setSenderId = () => async (context: HookContext) => {
  context.data.senderId = context.params.user?.id;
  return context;
};

/**
 * Verify the sender is a participant of the conversation.
 */
const verifySenderIsParticipant = () => async (context: HookContext) => {
  const userId = context.params.user?.id;
  const conversationId = context.data?.conversationId || context.params.query?.conversationId;

  if (!conversationId) {
    throw new BadRequest('conversationId is required');
  }

  const sequelize = context.app.get('sequelizeClient');
  const ConversationParticipants = sequelize.models.conversation_participants;

  const membership = await ConversationParticipants.findOne({
    where: { conversationId, userId },
    raw: true,
  });

  if (!membership) {
    throw new Forbidden('You are not a participant of this conversation');
  }

  return context;
};

/**
 * Require conversationId on find and default sort by createdAt DESC.
 */
const requireConversationId = () => async (context: HookContext) => {
  if (!context.params.query?.conversationId) {
    throw new BadRequest('conversationId is required when querying messages');
  }

  // Default sort: newest first
  context.params.query.$sort = context.params.query.$sort || { createdAt: -1 };

  return context;
};

/**
 * Include the replyTo association when querying messages.
 */
const includeReplyTo = () => async (context: HookContext) => {
  const sequelize = context.app.get('sequelizeClient');
  const Messages = sequelize.models.messages;

  context.params.sequelize = {
    ...context.params.sequelize,
    raw: false,
    include: [
      ...(context.params.sequelize?.include ?? []),
      { model: Messages, as: 'replyTo', attributes: ['id', 'senderId', 'content'] },
    ],
  };

  return context;
};

/**
 * Populate replyTo on a newly created message (after hook).
 */
const populateReplyTo = () => async (context: HookContext) => {
  if (!context.result.replyToId) return context;

  const sequelize = context.app.get('sequelizeClient');
  const Messages = sequelize.models.messages;

  const reply = await Messages.findByPk(context.result.replyToId, {
    attributes: ['id', 'senderId', 'content'],
    raw: true,
  });

  if (reply) {
    context.result = {
      ...(context.result.toJSON ? context.result.toJSON() : context.result),
      replyTo: reply,
    };
  }

  return context;
};

/**
 * Update the conversation's updatedAt after a new message.
 */
const touchConversation = () => async (context: HookContext) => {
  const conversationId = context.result.conversationId;
  const sequelize = context.app.get('sequelizeClient');
  const Conversations = sequelize.models.conversations;

  await Conversations.update(
    { updatedAt: new Date() },
    { where: { id: conversationId } },
  );

  return context;
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [requireConversationId(), verifySenderIsParticipant(), includeReplyTo()],
    get: [includeReplyTo()],
    create: [setSenderId(), verifySenderIsParticipant()],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [populateReplyTo(), touchConversation()],
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
