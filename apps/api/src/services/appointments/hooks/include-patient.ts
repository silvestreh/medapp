import { Hook, HookContext } from '@feathersjs/feathers';

export const includePatient = (): Hook => {
  return async (context: HookContext) => {
    const { app, method, result } = context;

    const fetchPatient = async (appointment: any) => {
      if (appointment.patientId) {
        const patient = await app.service('patients').get(appointment.patientId, { disableSoftDelete: true });
        appointment.patient = patient;
      }
    };

    if (method === 'find') {
      if (Array.isArray(result.data)) {
        await Promise.all(result.data.map(fetchPatient));
      } else if (Array.isArray(result)) {
        await Promise.all(result.map(fetchPatient));
      }
    } else if (['get', 'create', 'update', 'patch'].includes(method)) {
      await fetchPatient(result);
    }

    return context;
  };
};
