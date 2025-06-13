import assert from 'assert';
import app from '../../src/app';

describe('\'md-settings\' service', () => {
  it('registered the service', () => {
    const service = app.service('md-settings');

    assert.ok(service, 'Registered the service');
  });
});
