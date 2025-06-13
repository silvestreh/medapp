import { Hook, HookContext, Id } from '@feathersjs/feathers';

type DataType = 'personal' | 'contact';

const includeData = (type: DataType): Hook => async (context: HookContext) => {
  const { app, result, method, path } = context;
  const dataId = type === 'personal' ? 'personalDataId' : 'contactDataId';
  const fieldToWrite = type === 'personal' ? 'personalData' : 'contactData';
  const dataService = type === 'personal'
    ? app.service('personal-data')
    : app.service('contact-data');

  const joinService = path === 'patients'
    ? app.service(`patient-${type}-data`)
    : app.service(`user-${type}-data`);

  const fetchData = async (ownerId: Id) => {
    const joinData = await joinService.find({
      query: { ownerId },
      paginate: false
    });

    if (!joinData[0] || !joinData[0][dataId]) {
      return null;
    }

    return await dataService.get(joinData[0][dataId]);
  };

  if (method === 'find' && Array.isArray(result)) {
    for (const item of result) {
      item[fieldToWrite] = await fetchData(item.id);
    }
  } else if (method === 'find' && Array.isArray(result.data)) {
    for (const item of result.data) {
      item[fieldToWrite] = await fetchData(item.id);
    }
  } else {
    result[fieldToWrite] = await fetchData(result.id);
  }

  return context;
};

export default includeData;
