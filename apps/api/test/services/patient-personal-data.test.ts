import assert from 'assert';
import app from '../../src/app';

describe('\'patient-personal-data\' service', () => {
  it('registered the service', () => {
    const service = app.service('patient-personal-data');

    assert.ok(service, 'Registered the service');
  });
});
