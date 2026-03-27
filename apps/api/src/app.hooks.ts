// Application hooks that run for every service
// Don't remove this comment. It's needed to format import lines nicely.
import { HookContext } from '@feathersjs/feathers';
import Sentry from './sentry';
import { setOrganizationContext } from './hooks/set-organization-context';
import { logAccessDenial } from './hooks/log-access-denial';
import { sanitizeForLog } from './utils/sanitize-for-log';

export default {
  before: {
    all: [
      (ctx: HookContext) => {
        if (process.env.DEBUG !== 'true') return ctx;

        const { method, path } = ctx;

        console.log(`[BEFORE] ${path}:${method}`);

        if (ctx.params.query) {
          console.log('query =', JSON.stringify(sanitizeForLog(ctx.params.query), null, 2));
        }

        if (ctx.data) {
          console.log('data =', JSON.stringify(sanitizeForLog(ctx.data), null, 2));
        }
      },
      setOrganizationContext()
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [
      (ctx: HookContext) => {
        if (process.env.DEBUG !== 'true') return ctx;

        const { method, path } = ctx;

        console.log(`[AFTER] ${path}:${method}`);

        if (ctx.result) {
          console.log('result =', JSON.stringify(sanitizeForLog(ctx.result), null, 2));
        }
      }
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [
      logAccessDenial(),
      (ctx: HookContext) => {
        if (ctx.error) {
          const isLegacyNotFound =
            ctx.error.code === 404 &&
            typeof ctx.id === 'string' &&
            ctx.id.length > 36;

          const isAccessLogError = ctx.path === 'access-logs';
          const isExpectedError = ctx.error.code === 401 || isLegacyNotFound || isAccessLogError;

          if (!isExpectedError) {
            if (ctx.params.user) {
              Sentry.setUser({ id: ctx.params.user.id, email: ctx.params.user.email });
            }
            Sentry.captureException(ctx.error);
          }
        }
      },
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
