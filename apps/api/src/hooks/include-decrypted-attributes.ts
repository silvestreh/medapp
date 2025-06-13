import { HookContext } from '@feathersjs/feathers';

export const includeDecryptedAttributes = () => {
  return async (context: HookContext) => {
    const { service } = context;
    const { decryptedAttributes } = service.Model;

    if (!context.params.sequelize) {
      context.params.sequelize = {};
    }

    context.params.sequelize.attributes = {
      include: decryptedAttributes,
    };

    return context;
  };
};
