import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { encryptFields, decryptFields } from '../../hooks/encryption';
import queryEncryptedFields from '../../hooks/query-encrypted-fields';
import sanitizePersonalData from './hooks/sanitize-personal-data';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [ authenticate('jwt') ],
    find: [
      queryEncryptedFields('documentValue', 'birthDate'),
    ],
    get: [ disallow('external') ],
    create: [
      disallow('external'),
      sanitizePersonalData(),
      encryptFields('documentValue', 'birthDate')
    ],
    update: [
      disallow('external'),
      sanitizePersonalData(),
      encryptFields('documentValue', 'birthDate')
    ],
    patch: [
      sanitizePersonalData(),
      encryptFields('documentValue', 'birthDate')
    ],
    remove: []
  },

  after: {
    all: [],
    find: [ decryptFields('documentValue', 'birthDate') ],
    get: [ decryptFields('documentValue', 'birthDate') ],
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
