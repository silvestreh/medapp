import { HookContext } from '@feathersjs/feathers';
import * as feathersAuthentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import createPersonalData from '../../hooks/create-personal-data';
import createContactData from '../../hooks/create-contact-data';
import includeData from '../../hooks/include-data';
import populateUser from './hooks/populate-user';
import { prepareSignupOrganization, handleSignupOrganization } from './hooks/handle-signup-organization';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = feathersAuthentication.hooks;
const { hashPassword, protect } = local.hooks;

const scopeUsersToOrganization = () => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;

  if (!params.provider || !params.organizationId) return context;

  const memberships: any[] = await app.service('organization-users').find({
    query: { organizationId: params.organizationId },
    paginate: false,
  } as any);

  const userIds = memberships.map((m: any) => m.userId);

  context.params.query = {
    ...context.params.query,
    id: { $in: userIds },
  };

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
      authenticate('jwt')
    ],
    create: [ prepareSignupOrganization(), hashPassword('password') ],
    update: [
      hashPassword('password'),
      authenticate('jwt')
    ],
    patch: [
      hashPassword('password'),
      authenticate('jwt')
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
