import { Hook, HookContext } from '@feathersjs/feathers';
import { Sequelize } from 'sequelize';

export default function autoProtocol(): Hook {
  return async (context: HookContext) => {
    if (context.data.protocol) {
      return context;
    }

    const sequelize: Sequelize = context.app.get('sequelizeClient');
    const maxProtocol = await sequelize.models.studies.max('protocol') as number | null;

    context.data.protocol = (maxProtocol ?? 0) + 1;
    return context;
  };
}
