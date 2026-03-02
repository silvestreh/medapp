import type { HookContext } from '@feathersjs/feathers';

export const populateMedicare = () => async function (context: HookContext) {
  const { app, result, method } = context;
  const res = [];

  if  (method === 'find') {
    if (Array.isArray(result)) {
      for (const patient of result) {
        patient.insurer = patient.medicareId ? await app.service('prepagas').get(patient.medicareId) : null;
        res.push(patient);
      }
    } else {
      for (const patient of result.data) {
        patient.insurer = patient.medicareId ? await app.service('prepagas').get(patient.medicareId) : null;
        res.push(patient);
      }
    }

    context.result = res;
  } else if (method === 'get') {
    result.insurer = result.medicareId ? await app.service('prepagas').get(result.medicareId) : null;
    context.result = result;
  }

  return context;
};
