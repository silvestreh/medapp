import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { omitForDeleted } from '../../hooks/omit-for-deleted';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { blockSuperAdmin } from '../../hooks/block-super-admin';
import { includeDecryptedAttributes } from '../../hooks/include-decrypted-attributes';
import { parseDecryptedAttributes } from '../../hooks/parse-decrypted-attributes';
import { sanitizeEncryptedData } from '../../hooks/sanitize-encrypted-data';
import { validateEncounterData } from '../../hooks/validate-encounter-data';
import { requireVerifiedLicense } from '../../hooks/require-verified-license';
import { setCost } from '../practice-costs/hooks/set-cost';
import { checkEncounterPermissions } from './hooks/check-encounter-permissions';
import { applySharedAccess } from './hooks/apply-shared-access';
import { markSharedEncounters } from './hooks/mark-shared-encounters';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      blockSuperAdmin(),
      enforceActiveOrganization(),
      checkEncounterPermissions()
    ],
    find: [applySharedAccess(), includeDecryptedAttributes()],
    get: [includeDecryptedAttributes()],
    create: [requireVerifiedLicense(), validateEncounterData(), sanitizeEncryptedData('data')],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [
      parseDecryptedAttributes('data'),
      omitForDeleted({ service: 'patients', fkey: 'patientId' }),
      markSharedEncounters()
    ],
    get: [
      parseDecryptedAttributes('data'),
      omitForDeleted({ service: 'patients', fkey: 'patientId' }),
      markSharedEncounters()
    ],
    create: [setCost('encounter')],
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
