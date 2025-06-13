import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { encryptFields, decryptFields } from '../../hooks/encryption';
import { encryptPhoneNumbers } from './hooks/encrypt-phone-numbers';
import { decryptPhoneNumbers } from './hooks/decrypt-phone-numbers';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [ authenticate('jwt') ],
    find: [ disallow('external') ],
    get: [ disallow('external') ],
    create: [
      disallow('external'),
      encryptFields('email', 'streetAddress', 'city', 'province'),
      encryptPhoneNumbers()
    ],
    update: [
      disallow('external'),
      encryptFields('email', 'streetAddress', 'city', 'province'),
      encryptPhoneNumbers()
    ],
    patch: [
      encryptFields('email', 'streetAddress', 'city', 'province'),
      encryptPhoneNumbers()
    ],
    remove: []
  },

  after: {
    all: [],
    find: [
      decryptFields('email', 'streetAddress', 'city', 'province'),
      decryptPhoneNumbers()
    ],
    get: [
      decryptFields('email', 'streetAddress', 'city', 'province'),
      decryptPhoneNumbers()
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
