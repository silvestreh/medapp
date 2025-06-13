import { Hook, HookContext } from '@feathersjs/feathers';
import type { ServiceMethods, PatientContactData } from '../declarations';

type Entity = 'user' | 'patient';

const createContactData = (entity: Entity): Hook => async (context: HookContext) => {
  const { app, data, result } = context;
  const { contactData, ...rest } = data;
  const contactDataService = app.service(`${entity}-contact-data`) as ServiceMethods<PatientContactData>;

  if (contactData) {
    const { id: contactDataId } = await app.service('contact-data').create({
      streetAddress: contactData.streetAddress,
      city: contactData.city,
      province: contactData.province,
      country: contactData.country,
      phoneNumber: contactData.phoneNumber,
      email: contactData.email
    });

    await contactDataService.create({
      ownerId: result.id,
      contactDataId
    });
  }

  context.data = rest;

  return context;
};

export default createContactData;
