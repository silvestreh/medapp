import { Sequelize, QueryTypes } from 'sequelize';
import type { Params } from '@feathersjs/feathers';
import type { Application } from '../../declarations';

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

    const orgFilter = organizationId
      ? `AND s."organizationId" = ${sequelize.escape(organizationId)}`
      : '';

    const orgJoinFilter = organizationId
      ? `JOIN organization_users ou ON ou."userId" = u.id AND ou."organizationId" = ${sequelize.escape(organizationId)}`
      : '';

    const rows = await sequelize.query<ReferringDoctor>(
      `
      SELECT DISTINCT "referringDoctor" AS name, NULL AS "medicId"
      FROM studies s
      WHERE "referringDoctor" IS NOT NULL
      ${orgFilter}

      UNION

      SELECT DISTINCT
        TRIM(CONCAT(pd."firstName", ' ', pd."lastName")) AS name,
        u.id AS "medicId"
      FROM users u
      JOIN user_personal_data upd ON upd."ownerId" = u.id
      JOIN personal_data pd ON pd.id = upd."personalDataId"
      ${orgJoinFilter}
      WHERE u."roleId" = 'medic'

      ORDER BY name
      `,
      { type: QueryTypes.SELECT }
    );

    return rows;
  }
}
