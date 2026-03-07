import assert from 'assert';
import { startTestServer, stopTestServer, getApp } from './test-helpers';

describe('Service Registration', () => {
  before(async () => {
    await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('registers the conversations service', () => {
    const service = getApp().service('conversations');
    assert.ok(service, 'conversations service should be registered');
  });

  it('registers the conversation-participants service', () => {
    const service = getApp().service('conversation-participants');
    assert.ok(service, 'conversation-participants service should be registered');
  });

  it('registers the messages service', () => {
    const service = getApp().service('messages');
    assert.ok(service, 'messages service should be registered');
  });

  it('registers the user-status service', () => {
    const service = getApp().service('user-status');
    assert.ok(service, 'user-status service should be registered');
  });

  it('registers the users service', () => {
    const service = getApp().service('users');
    assert.ok(service, 'users service should be registered');
  });

  it('registers the authentication service', () => {
    const service = getApp().service('authentication');
    assert.ok(service, 'authentication service should be registered');
  });
});
