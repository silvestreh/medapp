import assert from 'assert';
import app from '../../src/app';

describe('\'appointments\' service', () => {
  it('registered the service', () => {
    const service = app.service('appointments');

    assert.ok(service, 'Registered the service');
  });
});
