import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { EncounterChainVerification, ChainVerificationResult } from './encounter-chain-verification.class';
import hooks from './encounter-chain-verification.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'encounter-chain-verification': EncounterChainVerification & ServiceAddons<ChainVerificationResult>;
  }
}

export default function (app: Application): void {
  app.use('/encounter-chain-verification', new EncounterChainVerification(app) as any);

  const service = app.service('encounter-chain-verification');
  service.hooks(hooks);
}
