import { Hook, HookContext } from '@feathersjs/feathers';
import { Sequelize, QueryTypes } from 'sequelize';

export default function autoProtocol(): Hook {
  return async (context: HookContext) => {
    if (context.data.protocol) {
      return context;
    }

    const sequelize: Sequelize = context.app.get('sequelizeClient');

    const [row] = await sequelize.query<{ max: number | null }>(
      'SELECT MAX(protocol) as max FROM studies',
      { type: QueryTypes.SELECT }
    );

    context.data.protocol = (row?.max ?? 0) + 1;
    return context;
  };
}
