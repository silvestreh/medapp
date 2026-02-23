import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { restrictToMedicOwner } from './hooks/restrict-to-medic-owner';
import { handleCertificateUpload } from './hooks/handle-certificate-upload';
import { removeExistingCertificate } from './hooks/remove-existing-certificate';
import { stripCertificateData } from './hooks/strip-certificate-data';
import { includeDecryptedAttributes } from '../../hooks/include-decrypted-attributes';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt')],
    find: [restrictToMedicOwner(), includeDecryptedAttributes()],
    get: [disallow('external')],
    create: [restrictToMedicOwner(), handleCertificateUpload(), removeExistingCertificate()],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [restrictToMedicOwner()],
  },

  after: {
    all: [stripCertificateData()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
} as HooksObject;
