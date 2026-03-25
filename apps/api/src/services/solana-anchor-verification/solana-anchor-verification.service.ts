import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { SolanaAnchorVerification, AnchorVerificationResult } from './solana-anchor-verification.class';
import hooks from './solana-anchor-verification.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'solana-anchor-verification': SolanaAnchorVerification & ServiceAddons<AnchorVerificationResult>;
  }
}

export default function (app: Application): void {
  app.use('/solana-anchor-verification', new SolanaAnchorVerification(app) as any);

  const service = app.service('solana-anchor-verification');
  service.hooks(hooks);
}
