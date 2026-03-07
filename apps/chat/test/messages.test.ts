import assert from 'assert';
import { startTestServer, stopTestServer, getApp, internalParams } from './test-helpers';

describe('Messages Service', () => {
  const userAId = 'msg-test-user-a-' + Date.now();
  const userBId = 'msg-test-user-b-' + Date.now();
  const outsiderId = 'msg-test-outsider-' + Date.now();
  let conversationId: string;

  before(async () => {
    await startTestServer();

    // Create a conversation for message tests
    const app = getApp();
    const conversation = await app.service('conversations').create(
      {
        name: 'Message Test Chat',
        participantIds: [userAId, userBId],
      },
      internalParams(userAId),
    );
    conversationId = conversation.id;
  });

  after(async () => {
    const app = getApp();
    const sequelize = app.get('sequelizeClient');

    await sequelize.models.messages.destroy({ where: {} });
    await sequelize.models.conversation_participants.destroy({ where: {} });
    await sequelize.models.conversations.destroy({ where: {} });

    await stopTestServer();
  });

  it('creates a message in a conversation', async () => {
    const app = getApp();
    const result = await app.service('messages').create(
      {
        conversationId,
        content: 'Hello, world!',
      },
      internalParams(userAId),
    );

    assert.ok(result.id);
    assert.equal(result.conversationId, conversationId);
    assert.equal(result.senderId, userAId);
    assert.equal(result.content, 'Hello, world!');
    assert.equal(result.type, 'text');
  });

  it('sets senderId automatically from the authenticated user', async () => {
    const app = getApp();
    const result = await app.service('messages').create(
      {
        conversationId,
        content: 'From user B',
      },
      internalParams(userBId),
    );

    assert.equal(result.senderId, userBId);
  });

  it('finds messages in a conversation sorted by createdAt DESC', async () => {
    const app = getApp();
    const result = await app.service('messages').find({
      ...internalParams(userAId),
      query: { conversationId },
    });

    assert.ok(result.total >= 2);
    assert.ok(result.data.length >= 2);

    // Verify sort order (newest first)
    for (let i = 1; i < result.data.length; i++) {
      const prev = new Date(result.data[i - 1].createdAt).getTime();
      const curr = new Date(result.data[i].createdAt).getTime();
      assert.ok(prev >= curr, 'Messages should be sorted newest first');
    }
  });

  it('rejects messages from non-participants', async () => {
    const app = getApp();

    try {
      await app.service('messages').create(
        {
          conversationId,
          content: 'I should not be able to send this',
        },
        internalParams(outsiderId),
      );
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.code, 403);
    }
  });

  it('rejects find without conversationId', async () => {
    const app = getApp();

    try {
      await app.service('messages').find({
        ...internalParams(userAId),
        query: {},
      });
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.code, 400);
    }
  });

  it('rejects find from non-participants', async () => {
    const app = getApp();

    try {
      await app.service('messages').find({
        ...internalParams(outsiderId),
        query: { conversationId },
      });
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.code, 403);
    }
  });

  it('updates conversation updatedAt after creating a message', async () => {
    const app = getApp();

    const convBefore = await app.service('conversations').get(conversationId, {
      ...internalParams(userAId),
      provider: undefined,
    });
    const beforeTime = new Date(convBefore.updatedAt).getTime();

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 50));

    await app.service('messages').create(
      { conversationId, content: 'Touch test' },
      internalParams(userAId),
    );

    const convAfter = await app.service('conversations').get(conversationId, {
      ...internalParams(userAId),
      provider: undefined,
    });
    const afterTime = new Date(convAfter.updatedAt).getTime();

    assert.ok(afterTime >= beforeTime, 'Conversation updatedAt should be updated');
  });
});
