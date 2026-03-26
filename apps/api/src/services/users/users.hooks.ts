import * as feathersAuthentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import { disallow } from 'feathers-hooks-common';
import createPersonalData from '../../hooks/create-personal-data';
import createContactData from '../../hooks/create-contact-data';
import patchPersonalData from '../../hooks/patch-personal-data';
import patchContactData from '../../hooks/patch-contact-data';
import includeData from '../../hooks/include-data';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { lowerCase } from '../../hooks/lowerCase';
import { patchMdSettings } from './hooks/patch-md-settings';
import { setupTwoFactor } from './hooks/setup-two-factor';
import { enableTwoFactor } from './hooks/enable-two-factor';
import { changePassword } from './hooks/change-password';
import { extractPatchActions } from './hooks/extract-patch-actions';
import { validatePassword } from './hooks/validate-password';
import { stripSuperAdmin } from './hooks/strip-super-admin';
import populateUser from './hooks/populate-user';
import { prepareSignupOrganization, handleSignupOrganization } from './hooks/handle-signup-organization';
import { scopeUsersToOrganization } from './hooks/scope-users-to-organization';
import { restrictUserToOrganization } from './hooks/restrict-user-to-organization';
import { mergePreferences } from './hooks/merge-preferences';

const { authenticate } = feathersAuthentication.hooks;
const { hashPassword, protect } = local.hooks;

export default {
  before: {
    all: [],
    find: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      scopeUsersToOrganization(),
    ],
    get: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      restrictUserToOrganization(),
    ],
    create: [
      stripSuperAdmin(),
      lowerCase('username'),
      validatePassword(),
      prepareSignupOrganization(),
      hashPassword('password'),
    ],
    update: [
      disallow('external'),
      lowerCase('username'),
      hashPassword('password'),
    ],
    patch: [
      authenticate('jwt'),
      stripSuperAdmin(),
      changePassword(),
      extractPatchActions(),
      lowerCase('username'),
      hashPassword('password'),
      mergePreferences(),
    ],
    remove: [authenticate('jwt')],
  },

  after: {
    all: [
      protect('password', 'twoFactorSecret', 'twoFactorTempSecret'),
      setupTwoFactor(),
      enableTwoFactor(),
    ],
    find: [
      includeData('personal'),
      includeData('contact'),
    ],
    get: [
      populateUser(),
      includeData('personal'),
      includeData('contact'),
    ],
    create: [
      createPersonalData('user'),
      createContactData('user'),
      handleSignupOrganization(),
    ],
    update: [],
    patch: [
      patchPersonalData('user'),
      patchContactData('user'),
      patchMdSettings(),
    ],
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
};
