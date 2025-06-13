import assert from 'assert';
import app from '../../src/app';

describe('\'personal-data\' service', () => {
  it('registered the service', () => {
    const service = app.service('personal-data');

    assert.ok(service, 'Registered the service');
  });
});
