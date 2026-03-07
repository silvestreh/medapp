import assert from 'assert';
import { startTestServer, stopTestServer, getApp, internalParams } from './test-helpers';

describe('User Status Service', () => {
  const userAId = 'status-test-user-a-' + Date.now();
  const userBId = 'status-test-user-b-' + Date.now();
  let statusAId: string;
  let statusBId: string;

  before(async () => {
    await startTestServer();
  });

  after(async () => {
    const app = getApp();
    const sequelize = app.get('sequelizeClient');

    await sequelize.models.user_status.destroy({ where: {} });
    await sequelize.models.conversation_participants.destroy({ where: {} });
    await sequelize.models.conversations.destroy({ where: {} });

    await stopTestServer();
  });

  it('creates a user status', async () => {
    const app = getApp();
    const result = await app.service('user-status').create(
      {
        userId: userAId,
        status: 'online',
      },
      { provider: undefined },
    );

    statusAId = result.id;
    assert.ok(result.id);
    assert.equal(result.userId, userAId);
    assert.equal(result.status, 'online');
    assert.ok(result.lastSeenAt);
  });

  it('creates another user status', async () => {
    const app = getApp();
    const result = await app.service('user-status').create(
      {
        userId: userBId,
        status: 'away',
        text: 'In a meeting',
      },
      { provider: undefined },
    );

    statusBId = result.id;
    assert.equal(result.status, 'away');
    assert.equal(result.text, 'In a meeting');
  });

  it('patches a user status', async () => {
    const app = getApp();
    const result = await app.service('user-status').patch(
      statusAId,
      {
        status: 'dnd',
        text: 'Do not disturb',
      },
      internalParams(userAId),
    );

    assert.equal(result.status, 'dnd');
    assert.equal(result.text, 'Do not disturb');
    assert.ok(result.lastSeenAt);
  });

  it('prevents updating another user status', async () => {
    const app = getApp();

    try {
      await app.service('user-status').patch(
        statusBId,
        { status: 'online' },
        internalParams(userAId),
      );
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.equal(err.code, 403);
    }
  });

  it('finds user statuses', async () => {
    const app = getApp();

    // Create a conversation so scopeToRelevantUsers works
    await app.service('conversations').create(
      { name: 'Status Test Conv', participantIds: [userAId, userBId] },
      internalParams(userAId),
    );

    const result = await app.service('user-status').find({
      ...internalParams(userAId),
      query: { userId: userAId },
    });

    assert.ok(result.total >= 1);
    assert.equal(result.data[0].userId, userAId);
  });

  it('enforces unique userId constraint', async () => {
    const app = getApp();

    try {
      await app.service('user-status').create(
        { userId: userAId, status: 'online' },
        { provider: undefined },
      );
      assert.fail('should have thrown due to unique constraint');
    } catch (err: any) {
      assert.ok(err);
    }
  });
});
