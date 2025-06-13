import assert from 'assert';
import app from '../../src/app';

describe('\'study-results\' service', () => {
  it('registered the service', () => {
    const service = app.service('study-results');

    assert.ok(service, 'Registered the service');
  });
});
