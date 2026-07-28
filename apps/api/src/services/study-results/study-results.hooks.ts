import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { parseDecryptedAttributes } from '../../hooks/parse-decrypted-attributes';
import { includeDecryptedAttributes } from '../../hooks/include-decrypted-attributes';
import { sanitizeEncryptedData } from '../../hooks/sanitize-encrypted-data';
import scopeChildRecordsToMedic from '../../hooks/scope-child-records-to-medic';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

// Results have no organizationId of their own — external reads are scoped
// through the parent study (own, shared via shared-encounter-access, or
// studies:find:all)
const scopeToStudies = scopeChildRecordsToMedic({
  parentService: 'studies',
  foreignKey: 'studyId',
});

export default {
  before: {
    all: [authenticate('jwt')],
    find: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      scopeToStudies,
      includeDecryptedAttributes(),
    ],
    get: [
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      includeDecryptedAttributes(),
    ],
    create: [ disallow('external'), sanitizeEncryptedData('data') ],
    update: [ disallow('external') ],
    patch: [ disallow('external'), sanitizeEncryptedData('data') ],
    remove: [ disallow('external') ]
  },

  after: {
    all: [],
    find: [ parseDecryptedAttributes('data') ],
    get: [ scopeToStudies, parseDecryptedAttributes('data') ],
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
