import assert from 'assert';
import app from '../../src/app';

describe('\'user-contact-data\' service', () => {
  it('registered the service', () => {
    const service = app.service('user-contact-data');

    assert.ok(service, 'Registered the service');
  });
});
