import { HookContext } from '@feathersjs/feathers';
import { getUsersByDocumentNumber, createRecetarioUser, RecetarioUserPayload } from '../services/recetario/recetario-client';
import { sanitizeDocumentNumber, mapDocumentType, mapProvince, reverseMapProvince } from '../services/recetario/data-mapper';

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

      // Already fully synced
      const needsBackfill = !mdSettings.recetarioTitle || !mdSettings.recetarioProvince;
      if (mdSettings.recetarioUserId && !needsBackfill) return ctx;

      // Get the doctor's document number
      const personalData = (user as any).personalData || {};
      const contactData = (user as any).contactData || {};
      const docNum = sanitizeDocumentNumber(personalData.documentValue);
      if (!docNum) return ctx;

      // Get the organization's healthCenterId (required by the Recetario API)
      const sequelize = (ctx.app as any).get('sequelizeClient');
      const orgUser = await sequelize.models.organization_users.findOne({
        where: { userId: user.id },
      });
      if (!orgUser) return ctx;

      const org = await ctx.app.service('organizations').get(orgUser.organizationId, internal);
      const healthCenterId = org?.settings?.recetario?.healthCenterId;
      if (!healthCenterId) return ctx;

      // Look up Recetario user by documentNumber
      const recetarioUsers = await getUsersByDocumentNumber(docNum, healthCenterId);
      let recetarioUser = Array.isArray(recetarioUsers) ? recetarioUsers[0] : null;

      // If no Recetario user found, try to create one if we have all required data
      if (!recetarioUser?.id) {
        const email = contactData.email;
        const firstName = personalData.firstName;
        const lastName = personalData.lastName;
        const nationalLicenseNumber = mdSettings.nationalLicenseNumber;
        const specialty = mdSettings.medicalSpecialty;
        const province = mdSettings.recetarioProvince;
        const title = mdSettings.recetarioTitle;

        // All fields are required to create a Recetario user
        if (!email || !firstName || !lastName || !nationalLicenseNumber || !specialty || !province || !title) {
          return ctx;
        }

        const payload: RecetarioUserPayload = {
          title,
          firstName,
          lastName,
          nationalId: docNum,
          nationalIdType: mapDocumentType(personalData.documentType),
          email,
          nationalLicenseNumber,
          stateLicenseNumber: mdSettings.stateLicenseNumber || undefined,
          stateLicenseName: mdSettings.stateLicense || undefined,
          specialty,
          province: mapProvince(province),
          healthCenterId,
        };

        recetarioUser = await createRecetarioUser(payload);
      }

      if (!recetarioUser?.id) return ctx;

      // Save the Recetario user ID and backfill title/province from API response
      const patchData: Record<string, any> = {};
      if (!mdSettings.recetarioUserId) patchData.recetarioUserId = recetarioUser.id;
      if (!mdSettings.recetarioTitle && recetarioUser.title) patchData.recetarioTitle = recetarioUser.title;
      if (!mdSettings.recetarioProvince && recetarioUser.province) patchData.recetarioProvince = reverseMapProvince(recetarioUser.province);

      if (Object.keys(patchData).length > 0) {
        await ctx.app.service('md-settings').patch(mdSettings.id, patchData as any, internal);
      }
    } catch {
      // Non-fatal
    }

    return ctx;
  };
};

export default syncRecetarioUserId;
