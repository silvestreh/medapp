import * as feathersAuthentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import { BadRequest } from '@feathersjs/errors';
import createPersonalData from '../../hooks/create-personal-data';
import createContactData from '../../hooks/create-contact-data';
import patchPersonalData from '../../hooks/patch-personal-data';
import patchContactData from '../../hooks/patch-contact-data';
import includeData from '../../hooks/include-data';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { lowerCase } from '../../hooks/lowerCase';
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../utils/validate-password';
import { patchMdSettings } from './hooks/patch-md-settings';
import { setupTwoFactor } from './hooks/setup-two-factor';
import { enableTwoFactor } from './hooks/enable-two-factor';
import { changePassword } from './hooks/change-password';
import populateUser from './hooks/populate-user';
import { prepareSignupOrganization, handleSignupOrganization } from './hooks/handle-signup-organization';
import { scopeUsersToOrganization } from './hooks/scope-users-to-organization';
import { restrictUserToOrganization } from './hooks/restrict-user-to-organization';
import { disallow } from 'feathers-hooks-common';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = feathersAuthentication.hooks;
const { hashPassword, protect } = local.hooks;

const validatePassword = () => (context: any) => {
  const password = context.data?.password;
  if (typeof password === 'string' && !isPasswordValid(password)) {
    throw new BadRequest(PASSWORD_POLICY_MESSAGE);
  }
  return context;
};

const stripSuperAdmin = () => (context: any) => {
  if (context.data) {
    delete context.data.isSuperAdmin;
  }
  return context;
};

/**
 * Extract action fields from patch data into params so hooks can read them,
 * then strip them from data so Sequelize doesn't try to save them as columns.
 */
const extractPatchActions = () => (context: any) => {
  if (!context.data) return context;

  if (context.data.twoFactorSetup) {
    context.params._twoFactorSetup = true;
    delete context.data.twoFactorSetup;
  }

  if (context.data.twoFactorCode) {
    context.params._twoFactorCode = context.data.twoFactorCode;
    delete context.data.twoFactorCode;
  }

  // changePassword is handled in its own before hook which replaces context.data

  return context;
};

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
    ],
    remove: [ authenticate('jwt') ]
  },

  after: {
    all: [
      // Make sure the password field is never sent to the client
      // Always must be the last hook
      protect('password', 'twoFactorSecret', 'twoFactorTempSecret')
    ],
    find: [
      includeData('personal'),
      includeData('contact')
    ],
    get: [
      populateUser(),
      includeData('personal'),
      includeData('contact')
    ],
    create: [
      createPersonalData('user'),
      createContactData('user'),
      handleSignupOrganization()
    ],
    update: [],
    patch: [
      patchPersonalData('user'),
      patchContactData('user'),
      patchMdSettings(),
      setupTwoFactor(),
      enableTwoFactor(),
    ],
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
};
