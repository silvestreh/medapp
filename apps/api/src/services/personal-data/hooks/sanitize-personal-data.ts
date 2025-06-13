import { HookContext } from '@feathersjs/feathers';
import { startCase } from 'lodash';

const sanitizePersonalData = () => async (context: HookContext) => {
  const { data } = context;

  if (data.firstName) {
    data.firstName = startCase(data.firstName);
  }

  if (data.lastName) {
    data.lastName = startCase(data.lastName);
  }

  context.data = data;

  return context;
};

export default sanitizePersonalData;
