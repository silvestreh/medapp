import { HooksObject, HookContext } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
import { setUserId } from './hooks/set-user-id';
import { scopeToUser } from './hooks/scope-to-user';
import { validateUserIsMedic } from './hooks/validate-user-is-medic';
import logger from '../../logger';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

const logCreateResult = () => async (context: HookContext) => {
  if (!context.params.provider) return context;
  const result: any = context.result;
  logger.debug(
    '[practice-codes:after-create] id=%s userId=%s practiceId=%s insurerId=%s code=%s',
    result?.id,
    result?.userId,
    result?.practiceId,
    result?.insurerId,
    result?.code
  );
  return context;
};

const logFindResult = () => async (context: HookContext) => {
  if (!context.params.provider) return context;
  const result: any = context.result;
  const rows = Array.isArray(result) ? result : result?.data;
  logger.debug(
    '[practice-codes:after-find] query=%j count=%d userIds=%j',
    context.params.query,
    Array.isArray(rows) ? rows.length : -1,
    Array.isArray(rows) ? rows.map((r: any) => r.userId) : undefined
  );
  return context;
};

const logError = () => async (context: HookContext) => {
  if (!context.params.provider) return context;
  const err: any = context.error;
  logger.error(
    '[practice-codes:error] method=%s id=%s data=%j query=%j name=%s code=%s message=%s original=%s stack=%s',
    context.method,
    context.id,
    context.data,
    context.params.query,
    err?.name,
    err?.code,
    err?.message,
    err?.original?.message || err?.errors?.map?.((e: any) => e.message).join('; '),
    err?.stack
  );
  return context;
};

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      checkPermissions({ scopeToOrganization: false })
    ],
    find: [scopeToUser()],
    get: [],
    create: [setUserId(), validateUserIsMedic()],
    update: [disallow('external')],
    patch: [scopeToUser()],
    remove: [scopeToUser()]
  },

  after: {
    all: [],
    find: [logFindResult()],
    get: [],
    create: [logCreateResult()],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [logError()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
} as HooksObject;
