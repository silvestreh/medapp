import { BadRequest } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';
import dayjs from 'dayjs';

const isValidType = (type: string): boolean => ['vacation', 'cancelDay', 'other'].includes(type);

export const validateTimeOffDateRange = (): Hook => {
  return async (context: HookContext) => {
    if (!['create', 'patch', 'update'].includes(context.method)) {
      return context;
    }

    const currentRecord =
      (context.id && context.method !== 'create'
        ? await context.service.get(context.id, context.params)
        : null);
    const data = context.data || {};

    const nextStartDate = data.startDate ?? currentRecord?.startDate;
    const nextEndDate = data.endDate ?? currentRecord?.endDate;
    const nextType = data.type ?? currentRecord?.type;

    if (!nextStartDate || !nextEndDate) {
      throw new BadRequest('Both startDate and endDate are required');
    }

    if (!nextType || !isValidType(nextType)) {
      throw new BadRequest('Invalid time-off type');
    }

    const startDate = dayjs(nextStartDate).startOf('day');
    const endDate = dayjs(nextEndDate).endOf('day');

    if (!startDate.isValid() || !endDate.isValid()) {
      throw new BadRequest('Invalid startDate or endDate');
    }

    if (startDate.isAfter(endDate)) {
      throw new BadRequest('startDate cannot be after endDate');
    }

    context.data = {
      ...data,
      startDate: startDate.toDate(),
      endDate: endDate.toDate(),
      type: nextType,
    };

    return context;
  };
};
