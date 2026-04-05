import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { parseDecryptedAttributes } from '../../hooks/parse-decrypted-attributes';
import { includeDecryptedAttributes } from '../../hooks/include-decrypted-attributes';
import { sanitizeEncryptedData } from '../../hooks/sanitize-encrypted-data';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt')],
    find: [ includeDecryptedAttributes() ],
    get: [ includeDecryptedAttributes() ],
    create: [ disallow('external'), sanitizeEncryptedData('data') ],
    update: [ disallow('external') ],
    patch: [ disallow('external'), sanitizeEncryptedData('data') ],
    remove: [ disallow('external') ]
  },

  after: {
    all: [],
    find: [ parseDecryptedAttributes('data') ],
    get: [ parseDecryptedAttributes('data') ],
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
} as HooksObject;
