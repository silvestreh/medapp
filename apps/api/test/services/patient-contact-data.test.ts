import assert from 'assert';
import app from '../../src/app';

describe('\'patient-contact-data\' service', () => {
  it('registered the service', () => {
    const service = app.service('patient-contact-data');

    assert.ok(service, 'Registered the service');
  });
});
