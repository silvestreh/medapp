import assert from 'assert';
import { Forbidden } from '@feathersjs/errors';
import { requireVerifiedLicense } from '../../src/hooks/require-verified-license';

describe('requireVerifiedLicense hook', () => {
  it('skips internal calls', async () => {
    const hook = requireVerifiedLicense();
    const context: any = {
      app: {
        get: () => ({
          models: {
            md_settings: {
              findOne: async () => ({ isVerified: false }),
            },
          },
        }),
      },
      params: {
        provider: undefined,
        user: { id: 'u1' },
        orgRoleIds: ['medic'],
      },
    };

    const result = await hook(context);
    assert.strictEqual(result, context);
  });

  it('skips non-medic users', async () => {
    const hook = requireVerifiedLicense();
    const context: any = {
      app: {
        get: () => ({
          models: {
            md_settings: {
              findOne: async () => ({ isVerified: false }),
            },
          },
        }),
      },
      params: {
        provider: 'rest',
        user: { id: 'u1' },
        orgRoleIds: ['admin'],
      },
    };

    const result = await hook(context);
    assert.strictEqual(result, context);
  });

  it('throws Forbidden when medic is not verified', async () => {
    const hook = requireVerifiedLicense();
    const context: any = {
      app: {
        get: () => ({
          models: {
            md_settings: {
              findOne: async () => ({ isVerified: false }),
            },
          },
        }),
      },
      params: {
        provider: 'rest',
        user: { id: 'u1' },
        orgRoleIds: ['medic'],
      },
    };

    await assert.rejects(
      async () => hook(context),
      (error: any) => {
        assert.ok(error instanceof Forbidden);
        assert.strictEqual(error.message, 'Your medical license has not been verified');
        return true;
      }
    );
  });

  it('throws Forbidden when md-settings record is missing', async () => {
    const hook = requireVerifiedLicense();
    const context: any = {
      app: {
        get: () => ({
          models: {
            md_settings: {
              findOne: async () => null,
            },
          },
        }),
      },
      params: {
        provider: 'rest',
        user: { id: 'u1' },
        orgRoleIds: ['medic'],
      },
    };

    await assert.rejects(
      async () => hook(context),
      (error: any) => {
        assert.ok(error instanceof Forbidden);
        return true;
      }
    );
  });

  it('allows verified medic', async () => {
    const hook = requireVerifiedLicense();
    const context: any = {
      app: {
        get: () => ({
          models: {
            md_settings: {
              findOne: async () => ({ isVerified: true }),
            },
          },
        }),
      },
      params: {
        provider: 'rest',
        user: { id: 'u1' },
        orgRoleIds: ['medic'],
      },
    };

    const result = await hook(context);
    assert.strictEqual(result, context);
  });
});
