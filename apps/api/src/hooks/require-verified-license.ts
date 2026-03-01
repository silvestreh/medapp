import { Forbidden } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';

export const requireVerifiedLicense = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    const orgRoleIds: string[] = params.orgRoleIds || [];
    if (!orgRoleIds.includes('medic')) {
      return context;
    }

    const sequelize = app.get('sequelizeClient');
    const mdSettings = await sequelize.models.md_settings.findOne({
      where: { userId: params.user.id },
      raw: true,
    });

    if (!mdSettings?.isVerified) {
      throw new Forbidden('Your medical license has not been verified');
    }

    return context;
  };
};
