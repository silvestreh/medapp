import assert from 'assert';
import app from '../../src/app';

describe('\'contact-data\' service', () => {
  it('registered the service', () => {
    const service = app.service('contact-data');

    assert.ok(service, 'Registered the service');
  });
});
