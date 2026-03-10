import { Forbidden } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';

export const requireIdentityVerification = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined || !context.params.user) {
      return context;
    }

    const sequelize = context.app.get('sequelizeClient');
    const verification = await sequelize.models.identity_verifications.findOne({
      where: {
        userId: context.params.user.id,
        status: 'verified',
      },
      raw: true,
    });

    if (!verification) {
      throw new Forbidden(
        'Identity verification is required before generating or uploading a signing certificate'
      );
    }

    return context;
  };
};
