import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import normalizePhoneNumber from './hooks/normalize-phone-number';
import verifyWhatsAppNumber from './hooks/verify-whatsapp-number';

export default {
  before: {
    all: [disallow('external')],
    find: [],
    get: [],
    create: [normalizePhoneNumber(), verifyWhatsAppNumber()],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
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
} as HooksObject;
