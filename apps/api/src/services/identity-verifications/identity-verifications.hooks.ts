import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import { BadRequest, Forbidden } from '@feathersjs/errors';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { runAutomatedChecks } from './hooks/run-automated-checks';
import { cleanupFiles } from './hooks/cleanup-files';

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

    // Set userId to current user and force pending status
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
      // Set md_settings.isVerified = false
      const sequelize = context.app.get('sequelizeClient');
      const mdSettings = await sequelize.models.md_settings.findOne({
        where: { userId: targetUserId },
        raw: true,
      });

      if (mdSettings) {
        await context.app.service('md-settings').patch(mdSettings.id, {
          isVerified: false,
        });
      }

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

const sendNotificationEmail = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    try {
      const userId = context.result.userId;
      const fullUser = await context.app.service('users').get(userId, { provider: undefined } as any) as any;
      const personalData = fullUser.personalData || {};
      const fullName = [personalData.firstName, personalData.lastName].filter(Boolean).join(' ') || fullUser.username;

      await context.app.service('mailer').create({
        template: 'identity-verification-pending',
        to: 'admin@athel.as',
        subject: `New identity verification: ${fullName}`,
        data: {
          userName: fullName,
          userId,
        },
      });
    } catch (error) {
      console.error('Failed to send identity verification notification email:', error);
    }

    return context;
  };
};

const includeUserData = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.isSuperAdmin) return context;

    const sequelize = context.app.get('sequelizeClient');
    const { users, personal_data } = sequelize.models;

    context.params.sequelize = {
      include: [
        {
          model: users,
          as: 'user',
          attributes: ['id', 'username'],
          include: [
            {
              model: personal_data,
              attributes: ['firstName', 'lastName', 'documentType', 'documentValue'],
            },
          ],
        },
      ],
      raw: false,
      nest: true,
    };

    return context;
  };
};

export default {
  before: {
    all: [iff(isProvider('external'), authenticate('jwt'), verifyOrganizationMembership())],
    find: [restrictFindToOwnerOrSuperAdmin(), includeUserData()],
    get: [restrictFindToOwnerOrSuperAdmin()],
    create: [validateCreate()],
    update: [disallow('external')],
    patch: [requireSuperAdminForPatch(), handleApprovalOrRejection()],
    remove: [disallow('external')],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [runAutomatedChecks()],
    update: [],
    patch: [cleanupFiles()],
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
