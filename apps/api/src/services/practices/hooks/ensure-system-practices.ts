import { Hook, HookContext } from '@feathersjs/feathers';
import { v4 as uuidv4 } from 'uuid';

const SYSTEM_PRACTICES = [
  { systemKey: 'encounter', title: 'Consulta', description: 'Consulta médica' },
  { systemKey: 'anemia', title: 'Anemia', description: 'Estudio de anemia' },
  { systemKey: 'anticoagulation', title: 'Anticoagulación', description: 'Estudio de anticoagulación' },
  { systemKey: 'compatibility', title: 'Compatibilidad', description: 'Estudio de compatibilidad' },
  { systemKey: 'hemostasis', title: 'Hemostasia', description: 'Estudio de hemostasia' },
  { systemKey: 'myelogram', title: 'Mielograma', description: 'Estudio de mielograma' },
  { systemKey: 'thrombophilia', title: 'Trombofilia', description: 'Estudio de trombofilia' },
];

const seededOrgs = new Set<string>();

export const ensureSystemPractices = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    const organizationId = params.organizationId || params.query?.organizationId;
    if (!organizationId || seededOrgs.has(organizationId)) {
      return context;
    }

    // Use raw Sequelize model to avoid recursive hook calls
    const sequelize = app.get('sequelizeClient');
    const { practices } = sequelize.models;

    const existingCount = await practices.count({
      where: { organizationId, isSystem: true },
    });

    if (existingCount > 0) {
      seededOrgs.add(organizationId);
      return context;
    }

    for (const practice of SYSTEM_PRACTICES) {
      try {
        await practices.create({
          id: uuidv4(),
          ...practice,
          organizationId,
          isSystem: true,
        });
      } catch (err: any) {
        if (err.name === 'SequelizeUniqueConstraintError') {
          continue;
        }
        throw err;
      }
    }

    seededOrgs.add(organizationId);
    return context;
  };
};
