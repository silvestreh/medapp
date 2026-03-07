import * as feathersAuthentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import { BadRequest } from '@feathersjs/errors';
import createPersonalData from '../../hooks/create-personal-data';
import createContactData from '../../hooks/create-contact-data';
import includeData from '../../hooks/include-data';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { lowerCase } from '../../hooks/lowerCase';
import populateUser from './hooks/populate-user';
import { prepareSignupOrganization, handleSignupOrganization } from './hooks/handle-signup-organization';
import { scopeUsersToOrganization } from './hooks/scope-users-to-organization';
import { restrictUserToOrganization } from './hooks/restrict-user-to-organization';
import { disallow } from 'feathers-hooks-common';
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../utils/validate-password';
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
};
