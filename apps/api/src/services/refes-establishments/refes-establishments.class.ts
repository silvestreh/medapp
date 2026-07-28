import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, RefesEstablishment } from '../../declarations';

const UPSERT_FIELDS: (keyof RefesEstablishment)[] = [
  'name', 'province', 'provinceId', 'department', 'departmentId',
  'city', 'cityId', 'postalCode', 'address', 'website', 'financing',
  'typologyId', 'typologyAcronym', 'typologyName', 'longitude', 'latitude',
  'isActive', 'lastSeenAt',
];

export class RefesEstablishmentsService extends Service<RefesEstablishment> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }

  /**
   * Insert-or-update a batch of establishments by REFES code. Used by the
   * sync worker so registry refreshes update existing rows in place instead
   * of wiping the table.
   */
  async bulkUpsert(rows: RefesEstablishment[]): Promise<void> {
    await this.Model.bulkCreate(rows, {
      updateOnDuplicate: [...UPSERT_FIELDS, 'updatedAt'] as string[],
    });
  }
}
