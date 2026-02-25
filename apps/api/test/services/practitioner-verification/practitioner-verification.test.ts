import assert from 'assert';
import app from '../../../src/app';
import { PractitionerVerification } from '../../../src/services/practitioner-verification/practitioner-verification.class';

describe('\'practitioner-verification\' service', () => {
  it('registered the service', () => {
    const service = app.service('practitioner-verification');

    assert.ok(service, 'Registered the service');
  });

  describe('create', () => {
    let service: PractitionerVerification;
    let mockApp: any;

    beforeEach(() => {
      mockApp = {
        service: (name: string) => {
          if (name === 'user-personal-data') {
            return {
              find: async () => [{ personalDataId: 'pd-1' }]
            };
          }
          if (name === 'personal-data') {
            return {
              get: async () => ({ documentValue: '12345678' })
            };
          }
          if (name === 'md-settings') {
            return {
              find: async () => [{ id: 'md-1' }],
              patch: async () => {},
              create: async () => {}
            };
          }
          return {};
        }
      };
      service = new PractitionerVerification(mockApp);
    });

    it('initializes correctly', () => {
      assert.ok(service);
    });
  });
});
