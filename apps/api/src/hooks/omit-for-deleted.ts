import { Hook, HookContext } from '@feathersjs/feathers';
import { NotFound } from '@feathersjs/errors';

interface Options {
  service: string;
  fkey: string;
}

export const omitForDeleted = (options: Options): Hook => {
  return async (context: HookContext) => {
    const { app, method, result } = context;

    const checkSoftDelete = async (item: any) => {
      let relatedRecord;

      try {
        relatedRecord = await app.service(options.service).get(item[options.fkey], { disableSoftDelete: true });
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-unused-vars
        relatedRecord = { deleted: true };
      }

      if (relatedRecord.deleted) {
        if (method === 'find') {
          return false;
        } else if (method === 'get') {
          throw new NotFound('Record not found');
        }
      }
      return true;
    };

    if (method === 'find') {
      if (Array.isArray(result.data)) {
        const checks = await Promise.all(result.data.map(checkSoftDelete));
        context.result.data = result.data.filter((_: any, index: number) => checks[index]);
      } else if (Array.isArray(result)) {
        const checks = await Promise.all(result.map(checkSoftDelete));
        context.result = result.filter((_: any, index: number) => checks[index]);
      }
    } else if (method === 'get') {
      await checkSoftDelete(result);
    }

    return context;
  };
};
