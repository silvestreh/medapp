import { Op, Sequelize } from 'sequelize';
import type { Params } from '@feathersjs/feathers';
import type {
  Application,
  UserPersonalData,
  PersonalData,
} from '../../declarations';

export interface ReferringDoctor {
  name: string;
  medicId: string | null;
}

export class ReferringDoctors {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params?: Params): Promise<ReferringDoctor[]> {
    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const organizationId = params?.organizationId;

    const studyWhere: Record<string, unknown> = {
      referringDoctor: { [Op.ne]: null },
    };
    if (organizationId) {
      studyWhere.organizationId = organizationId;
    }

    const studyRows = await sequelize.models.studies.findAll({
      where: studyWhere,
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('referringDoctor')), 'referringDoctor']],
      raw: true,
    }) as unknown as { referringDoctor: string }[];

    const studyDoctors: ReferringDoctor[] = studyRows
      .map(r => r.referringDoctor)
      .filter(Boolean)
      .map(name => ({ name, medicId: null }));

    let medicUserIds: string[] = [];
    if (organizationId) {
      const medicRoles = await sequelize.models.user_roles.findAll({
        where: { organizationId, roleId: 'medic' },
        attributes: ['userId'],
        raw: true,
      }) as unknown as { userId: string }[];
      medicUserIds = medicRoles.map(r => r.userId);
    } else {
      const allMedicRoles = await sequelize.models.user_roles.findAll({
        where: { roleId: 'medic' },
        attributes: ['userId'],
        raw: true,
      }) as unknown as { userId: string }[];
      medicUserIds = [...new Set(allMedicRoles.map(r => r.userId))];
    }

    if (medicUserIds.length === 0) {
      return studyDoctors.sort((a, b) => a.name.localeCompare(b.name));
    }

    const userRows = await sequelize.models.users.findAll({
      where: { id: { [Op.in]: medicUserIds } },
      attributes: ['id'],
      include: [{
        model: sequelize.models.md_settings,
        attributes: [],
        where: { isVerified: true },
        required: true,
      }],
      raw: true,
    }) as unknown as { id: string }[];

    const userIds = userRows.map(u => u.id);
    if (userIds.length === 0) {
      return studyDoctors.sort((a, b) => a.name.localeCompare(b.name));
    }

    const upds = await this.app.service('user-personal-data').find({
      query: { ownerId: { $in: userIds } },
      paginate: false,
    }) as UserPersonalData[];

    const pdIds = upds.map(upd => upd.personalDataId as string);
    const pds = pdIds.length
      ? await this.app.service('personal-data').find({
        query: { id: { $in: pdIds }, $select: ['id', 'firstName', 'lastName'] },
        paginate: false,
      }) as PersonalData[]
      : [];

    const pdById = new Map(pds.map(pd => [pd.id.toString(), pd]));
    const updByOwnerId = new Map(upds.map(upd => [upd.ownerId.toString(), upd]));

    const medicDoctors: ReferringDoctor[] = userIds
      .map(userId => {
        const upd = updByOwnerId.get(userId);
        const pd = upd ? pdById.get(upd.personalDataId.toString()) : null;
        const name = `${pd?.firstName || ''} ${pd?.lastName || ''}`.trim();
        return { name, medicId: userId };
      })
      .filter(d => d.name.length > 0);

    const seen = new Set<string>();
    const result: ReferringDoctor[] = [];
    const all = [...studyDoctors, ...medicDoctors].sort((a, b) => a.name.localeCompare(b.name));

    for (const doctor of all) {
      if (!seen.has(doctor.name)) {
        seen.add(doctor.name);
        result.push(doctor);
      }
    }

    return result;
  }
}
