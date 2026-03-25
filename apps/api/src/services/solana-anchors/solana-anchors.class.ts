import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Params } from '@feathersjs/feathers';
import type { Application, SolanaAnchor } from '../../declarations';
import { runAnchoring } from '../../cron/solana-anchoring';
import { submitMemoTransaction } from '../../utils/solana-client';

export class SolanaAnchors extends Service<SolanaAnchor> {
  app: Application;

  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async create(data: any, params?: Params): Promise<any> {
    if (data?.intent === 'trigger') {
      const result = await runAnchoring(this.app, submitMemoTransaction);
      return result;
    }

    return super.create(data, params);
  }
}
