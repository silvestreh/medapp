import type { Application, SolanaAnchor, ServiceMethods } from '../../declarations';
import { SolanaAnchors } from './solana-anchors.class';
import createModel from '../../models/solana-anchors.model';
import createLeafModel from '../../models/solana-anchor-leaves.model';
import hooks from './solana-anchors.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'solana-anchors': ServiceMethods<SolanaAnchor>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: false,
  };

  // Also initialize the leaves model so Sequelize knows about it
  createLeafModel(app);

  app.use('/solana-anchors', new SolanaAnchors(options, app));

  const service = app.service('solana-anchors');
  service.hooks(hooks);
}
