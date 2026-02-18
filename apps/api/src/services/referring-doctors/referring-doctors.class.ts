import { Sequelize, QueryTypes } from 'sequelize';
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

  async find(): Promise<ReferringDoctor[]> {
    const sequelize: Sequelize = this.app.get('sequelizeClient');

    const rows = await sequelize.query<ReferringDoctor>(
      `
      SELECT DISTINCT "referringDoctor" AS name, NULL AS "medicId"
      FROM studies
      WHERE "referringDoctor" IS NOT NULL

      UNION

      SELECT DISTINCT
        TRIM(CONCAT(pd."firstName", ' ', pd."lastName")) AS name,
        u.id AS "medicId"
      FROM users u
      JOIN user_personal_data upd ON upd."ownerId" = u.id
      JOIN personal_data pd ON pd.id = upd."personalDataId"
      WHERE u."roleId" = 'medic'

      ORDER BY name
      `,
      { type: QueryTypes.SELECT }
    );

    return rows;
  }
}
