import assert from 'assert';
import { startTestServer, stopTestServer, getApp, internalParams } from './test-helpers';

describe('Conversations Service', () => {
  const userAId = 'test-user-a-' + Date.now();
  const userBId = 'test-user-b-' + Date.now();
  const userCId = 'test-user-c-' + Date.now();
  let conversationId: string;

  before(async () => {
    await startTestServer();
  });

  after(async () => {
    // Clean up test data
    const app = getApp();
    const sequelize = app.get('sequelizeClient');

    await sequelize.models.messages.destroy({ where: {} });
    await sequelize.models.conversation_participants.destroy({ where: {} });
    await sequelize.models.conversations.destroy({ where: {} });
    await sequelize.models.user_status.destroy({ where: {} });

    await stopTestServer();
  });

  it('creates a conversation with participants', async () => {
    const app = getApp();
    const result = await app.service('conversations').create(
      {
        name: 'Test Group Chat',
        participantIds: [userAId, userBId, userCId],
      },
      internalParams(userAId),
    );

    conversationId = result.id;

    assert.ok(result.id);
    assert.equal(result.name, 'Test Group Chat');
    assert.ok(result.participants);
    assert.equal(result.participants.length, 3);

    const participantUserIds = result.participants.map((p: any) => p.userId);
    assert.ok(participantUserIds.includes(userAId));
    assert.ok(participantUserIds.includes(userBId));
    assert.ok(participantUserIds.includes(userCId));
  });

  it('auto-adds the creator if not in participantIds', async () => {
    const app = getApp();
    const result = await app.service('conversations').create(
      {
        name: 'Auto-add Test',
        participantIds: [userBId],
      },
      internalParams(userAId),
    );

    const participantUserIds = result.participants.map((p: any) => p.userId);
    assert.ok(participantUserIds.includes(userAId), 'creator should be auto-added');
    assert.ok(participantUserIds.includes(userBId));
  });

  it('finds only conversations the user is a participant of', async () => {
    const app = getApp();

    const resultA = await app.service('conversations').find(internalParams(userAId));
    assert.ok(resultA.total >= 2, 'User A should see at least 2 conversations');

    // Create a conversation userC is NOT part of
    await app.service('conversations').create(
      {
        name: 'A and B only',
        participantIds: [userAId, userBId],
      },
      internalParams(userAId),
    );

    const resultC = await app.service('conversations').find(internalParams(userCId));
    const conversationNames = resultC.data.map((c: any) => c.name);
    assert.ok(!conversationNames.includes('A and B only'), 'User C should not see A-and-B conversation');
  });

  it('gets a conversation by id with participants', async () => {
    const app = getApp();
    const result = await app.service('conversations').get(conversationId, internalParams(userAId));

    assert.equal(result.id, conversationId);
    assert.ok(result.participants);
    assert.equal(result.participants.length, 3);
  });

  it('rejects creation without participantIds', async () => {
    const app = getApp();

    try {
      await app.service('conversations').create(
        { name: 'No participants' },
        internalParams(userAId),
      );
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.code, 400);
    }
  });
});
