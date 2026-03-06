import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { handleFileUpload } from './hooks/handle-file-upload';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [],
    find: [disallow('external')],
    get: [disallow('external')],
    create: [authenticate('jwt'), handleFileUpload()],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')],
  },
  after: { all: [], find: [], get: [], create: [], update: [], patch: [], remove: [] },
  error: { all: [], find: [], get: [], create: [], update: [], patch: [], remove: [] },
} as HooksObject;
