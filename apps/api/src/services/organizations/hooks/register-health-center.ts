import { Hook, HookContext } from '@feathersjs/feathers';
import * as recetarioClient from '../../recetario/recetario-client';

const registerHealthCenter = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, result } = context;
  if (!result) return context;

  const settings = result.settings || {};

  // Already has a health center ID — nothing to do
  if (settings.recetario?.healthCenterId) return context;

  const hc = settings.healthCenter;

  // When recetario is enabled without a healthCenterId, try to match by email
  if (settings.recetario?.enabled && hc?.email) {
    try {
      const healthCenters = await recetarioClient.getHealthCenters();
      const match = healthCenters.find(
        (center: any) => center.email?.toLowerCase() === hc.email.toLowerCase()
      );
      if (match?.id) {
        const updatedSettings = { ...settings };
        updatedSettings.recetario = { ...updatedSettings.recetario, healthCenterId: match.id };
        await app.service('organizations').patch(
          result.id,
          { settings: updatedSettings } as any,
          { provider: undefined }
        );
        return context;
      }
    } catch (error: any) {
      console.error('Failed to match health center by email:', error?.message);
    }
  }

  // Register a new health center if all required data is present
  if (!hc?.address || !hc?.phone || !hc?.email) return context;

  try {
    const response = await recetarioClient.createHealthCenter({
      name: result.name,
      address: hc.address,
      phone: hc.phone,
      email: hc.email,
      logoUrl: hc.logoUrl,
    });
    if (response?.id) {
      const updatedSettings = { ...settings };
      updatedSettings.recetario = { ...updatedSettings.recetario, healthCenterId: response.id };
      await app.service('organizations').patch(
        result.id,
        { settings: updatedSettings } as any,
        { provider: undefined }
      );
    }
  } catch (error: any) {
    console.error('Failed to register health center in Recetario:', error?.message);
  }

  return context;
};

export default registerHealthCenter;
