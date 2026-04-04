// Application hooks that run for every service
// Don't remove this comment. It's needed to format import lines nicely.
import { setOrganizationContext } from './hooks/set-organization-context';
import { tagRequestSource } from './hooks/tag-request-source';
import { logAccessDenial } from './hooks/log-access-denial';
import { captureSentryError } from './hooks/capture-sentry-error';
import { debug } from './hooks/debug';

export default {
  before: {
    all: [
      tagRequestSource(),
      debug('before'),
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
      debug('after')
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
      captureSentryError(),
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
