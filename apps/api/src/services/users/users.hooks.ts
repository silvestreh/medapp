import * as feathersAuthentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import createPersonalData from '../../hooks/create-personal-data';
import createContactData from '../../hooks/create-contact-data';
import includeData from '../../hooks/include-data';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { lowerCase } from '../../hooks/lowerCase';
import populateUser from './hooks/populate-user';
import { prepareSignupOrganization, handleSignupOrganization } from './hooks/handle-signup-organization';
import { scopeUsersToOrganization } from './hooks/scope-to-organization';
import { disallow } from 'feathers-hooks-common';
// Don't remove this comment. It's needed to format import lines nicely.

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
      authenticate('jwt')
    ],
    create: [
      lowerCase('username'),
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
