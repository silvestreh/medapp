import assert from 'assert';
import app from '../../src/app';

describe('\'user-personal-data\' service', () => {
  it('registered the service', () => {
    const service = app.service('user-personal-data');

    assert.ok(service, 'Registered the service');
  });
});
