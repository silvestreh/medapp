import type { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, softDelete } from 'feathers-hooks-common';
import createPersonalData from '../../hooks/create-personal-data';
import createContactData from '../../hooks/create-contact-data';
import { checkPermissions } from '../../hooks/check-permissions';
import { findByPersonalData } from './hooks/find-by-personal-data';
import includeData from '../../hooks/include-data';
import { encryptFields, decryptFields } from '../../hooks/encryption';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      checkPermissions(),
      softDelete()
    ],
    find: [ findByPersonalData() ],
    get: [],
    create: [
      encryptFields('medicareNumber', 'mugshot', 'gender')
    ],
    update: [
      disallow('external')
    ],
    patch: [
      encryptFields('medicareNumber', 'mugshot', 'gender')
    ],
    remove: []
  },

  after: {
    all: [],
    find: [
      includeData('personal'),
      includeData('contact'),
      decryptFields('medicareNumber', 'mugshot', 'gender')
    ],
    get: [
      includeData('personal'),
      includeData('contact'),
      decryptFields('medicareNumber', 'mugshot', 'gender')
    ],
    create: [
      createPersonalData('patient'),
      createContactData('patient')
    ],
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
