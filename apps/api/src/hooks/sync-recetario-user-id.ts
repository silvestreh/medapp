import { HookContext } from '@feathersjs/feathers';
import { getUsersByDocumentNumber } from '../services/recetario/recetario-client';
import { sanitizeDocumentNumber } from '../services/recetario/data-mapper';

const syncRecetarioUserId = (): ((ctx: HookContext) => Promise<HookContext>) => {
  return async (ctx: HookContext) => {
    try {
      const user = ctx.result?.user;
      if (!user?.id) return ctx;

      const internal = { provider: undefined } as any;

      // Check if user has md-settings (is a medic)
      const mdSettingsResult = await ctx.app.service('md-settings').find({
        query: { userId: String(user.id), $limit: 1 },
        paginate: false,
        ...internal,
      } as any);
      const mdSettings = Array.isArray(mdSettingsResult) ? mdSettingsResult[0] : null;
      if (!mdSettings?.id) return ctx;

      // Already synced
      if (mdSettings.recetarioUserId) return ctx;

      // Get the doctor's document number
      const personalData = (user as any).personalData || {};
      const docNum = sanitizeDocumentNumber(personalData.documentValue);
      if (!docNum) return ctx;

      // Look up Recetario user by documentNumber
      const recetarioUsers = await getUsersByDocumentNumber(docNum);
      const recetarioUser = Array.isArray(recetarioUsers) ? recetarioUsers[0] : null;
      if (!recetarioUser?.id) return ctx;

      // Save the Recetario user ID
      await ctx.app.service('md-settings').patch(
        mdSettings.id,
        { recetarioUserId: recetarioUser.id } as any,
        internal
      );
    } catch {
      // Non-fatal
    }

    return ctx;
  };
};

export default syncRecetarioUserId;
