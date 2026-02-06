import { Hook, HookContext } from '@feathersjs/feathers';
import type { ServiceMethods, PatientPersonalData } from '../declarations';

type Entity = 'user' | 'patient';

const createPersonalData = (entity: Entity): Hook => async (context: HookContext) => {
  const { app, data, result } = context;
  const { personalData, ...rest } = data;
  const personalDataService = app.service(`${entity}-personal-data`) as ServiceMethods<PatientPersonalData>;

  if (personalData) {
    const existingPersonalData = await app.service('personal-data').find({
      query: {
        documentValue: personalData.documentValue,
        $limit: 1
      },
      paginate: false
    }) as any[];

    let personalDataId;

    if (existingPersonalData.length > 0) {
      personalDataId = existingPersonalData[0].id;
    } else {
      const newPersonalData = await app.service('personal-data').create({
        firstName: personalData.firstName,
        lastName: personalData.lastName,
        birthDate: personalData.birthDate,
        maritalStatus: personalData.maritalStatus,
        documentType: personalData.documentType,
        documentValue: personalData.documentValue,
        nationality: personalData.nationality
      });
      personalDataId = newPersonalData.id;
    }

    await personalDataService.create({
      ownerId: result.id,
      personalDataId
    });
  }

  context.data = rest;

  return context;
};

export default createPersonalData;
