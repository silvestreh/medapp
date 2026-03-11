import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import { BadRequest, Forbidden } from '@feathersjs/errors';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';

const { authenticate } = authentication.hooks;

const restrictFindToOwnerOrSuperAdmin = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    if (context.params.isSuperAdmin) {
      return context;
    }

    if (!context.params.user) {
      throw new Forbidden('Authentication required');
    }

    context.params.query = {
      ...context.params.query,
      userId: context.params.user.id,
    };

    return context;
  };
};

const validateCreate = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    const user = context.params.user;
    if (!user) {
      throw new Forbidden('Authentication required');
    }

    const { idFrontUrl, idBackUrl, selfieUrl } = context.data;

    if (!idFrontUrl || !idBackUrl || !selfieUrl) {
      throw new BadRequest('ID front photo, ID back photo, and selfie are all required');
    }

    context.data.userId = user.id;
    context.data.status = 'pending';
    context.data.verifiedAt = null;
    context.data.verifiedBy = null;
    context.data.notes = null;
    context.data.rejectionReason = null;

    return context;
  };
};

const requireSuperAdminForPatch = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    if (!context.params.isSuperAdmin) {
      throw new Forbidden('Only super admins can review verifications');
    }

    return context;
  };
};

const handleApprovalOrRejection = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    const { status, rejectionReason } = context.data;

    if (status !== 'verified' && status !== 'rejected') {
      return context;
    }

    const verification = await context.service.get(context.id!);
    const targetUserId = String(verification.userId);
    const reviewerId = String(context.params.user!.id);

    if (status === 'verified') {
      // Run SSSalud verification to cross-validate
      const practitionerVerification = context.app.service('practitioner-verification') as any;
      try {
        await practitionerVerification.verifyByUserId(targetUserId);
      } catch (error: any) {
        throw new BadRequest(
          `SSSalud validation failed: ${error.message}. Cannot approve this verification.`
        );
      }

      context.data.verifiedAt = new Date();
      context.data.verifiedBy = reviewerId;
      context.data.rejectionReason = null;
    }

    if (status === 'rejected') {
      context.data.verifiedAt = null;
      context.data.verifiedBy = null;

      if (!rejectionReason) {
        throw new BadRequest('A rejection reason is required');
      }
    }

    // Only allow specific fields to be patched
    const allowed = ['status', 'notes', 'rejectionReason', 'verifiedAt', 'verifiedBy'];
    const sanitized: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in context.data) {
        sanitized[key] = context.data[key];
      }
    }
    context.data = sanitized;

    return context;
  };
};

/**
 * After hook: enrich verification results with user data for super admin views.
 * Since we're proxying to the verification API (no Sequelize), we do a separate lookup.
 */
const enrichWithUserData = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.isSuperAdmin) return context;

    const sequelize = context.app.get('sequelizeClient');
    const { users, personal_data } = sequelize.models;

    const enrichOne = async (item: any): Promise<any> => {
      if (!item?.userId) return item;
      try {
        const user = await users.findByPk(item.userId, {
          attributes: ['id', 'username'],
          include: [{
            model: personal_data,
            attributes: ['firstName', 'lastName', 'documentType', 'documentValue'],
          }],
          raw: false,
          nest: true,
        });
        if (user) {
          item.user = user.toJSON();
        }
      } catch {
        // Silently skip enrichment on error
      }
      return item;
    };

    if (context.result?.data) {
      // Paginated result
      context.result.data = await Promise.all(context.result.data.map(enrichOne));
    } else if (context.result && !context.result.data) {
      // Single result
      context.result = await enrichOne(context.result);
    }

    return context;
  };
};

export default {
  before: {
    all: [iff(isProvider('external'), authenticate('jwt'), verifyOrganizationMembership())],
    find: [restrictFindToOwnerOrSuperAdmin()],
    get: [restrictFindToOwnerOrSuperAdmin()],
    create: [validateCreate()],
    update: [disallow('external')],
    patch: [requireSuperAdminForPatch(), handleApprovalOrRejection()],
    remove: [disallow('external')],
  },

  after: {
    all: [],
    find: [enrichWithUserData()],
    get: [enrichWithUserData()],
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
