import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { restrictToMedicOwner } from './hooks/restrict-to-medic-owner';
import { handleCertificateGeneration } from './hooks/handle-certificate-generation';
import { handleCertificateUpload } from './hooks/handle-certificate-upload';
import { removeExistingCertificate } from './hooks/remove-existing-certificate';
import { stripCertificateData } from './hooks/strip-certificate-data';
import { requireIdentityVerification } from './hooks/require-identity-verification';
import { includeDecryptedAttributes } from '../../hooks/include-decrypted-attributes';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), verifyOrganizationMembership()],
    find: [restrictToMedicOwner(), includeDecryptedAttributes()],
    get: [disallow('external')],
    create: [enforceActiveOrganization(), restrictToMedicOwner(), requireIdentityVerification(), handleCertificateGeneration(), handleCertificateUpload(), removeExistingCertificate()],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [enforceActiveOrganization(), restrictToMedicOwner()],
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
