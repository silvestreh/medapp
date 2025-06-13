import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { omitForDeleted } from '../../hooks/omit-for-deleted';
import { checkPermissions } from '../../hooks/check-permissions';
import { includeDecryptedAttributes } from '../../hooks/include-decrypted-attributes';
import { parseDecryptedAttributes } from '../../hooks/parse-decrypted-attributes';
import { sanitizeEncryptedData } from '../../hooks/sanitize-encrypted-data';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      checkPermissions({ foreignKey: 'medicId' })
    ],
    find: [includeDecryptedAttributes()],
    get: [includeDecryptedAttributes()],
    create: [sanitizeEncryptedData('data')],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [
      parseDecryptedAttributes('data'),
      omitForDeleted({ service: 'patients', fkey: 'patientId' })
    ],
    get: [
      parseDecryptedAttributes('data'),
      omitForDeleted({ service: 'patients', fkey: 'patientId' })
    ],
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
