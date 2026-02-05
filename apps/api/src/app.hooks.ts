// Application hooks that run for every service
// Don't remove this comment. It's needed to format import lines nicely.
import { HookContext } from '@feathersjs/feathers';

export default {
  before: {
    all: [
      (ctx: HookContext) => {
        if (process.env.DEBUG !== 'true') return ctx;

        const { method, path } = ctx;

        console.log(`[BEFORE] ${path}:${method}`);

        if (ctx.params.query) {
          console.log('query =', JSON.stringify(ctx.params.query, null, 2));
        }

        if (ctx.data) {
          console.log('data =', JSON.stringify(ctx.data, null, 2));
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

  after: {
    all: [
      (ctx: HookContext) => {
        if (process.env.DEBUG !== 'true') return ctx;

        const { method, path } = ctx;

        console.log(`[AFTER] ${path}:${method}`);

        if (ctx.result) {
          console.log('result =', JSON.stringify(ctx.result, null, 2));
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
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
