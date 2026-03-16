import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { AccessLogChainVerification, ChainVerificationResult } from './access-log-chain-verification.class';
import hooks from './access-log-chain-verification.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'access-log-chain-verification': AccessLogChainVerification & ServiceAddons<ChainVerificationResult>;
  }
}

export default function (app: Application): void {
  app.use('/access-log-chain-verification', new AccessLogChainVerification(app) as any);

  const service = app.service('access-log-chain-verification');
  service.hooks(hooks);
}
