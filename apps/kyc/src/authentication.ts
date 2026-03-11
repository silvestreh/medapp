import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { Application } from './declarations';
import logger from './logger';

class LoggingAuthService extends AuthenticationService {
  async authenticate(data: any, params: any, ...args: any[]) {
    logger.info('[auth] authenticate called, strategy:', data?.strategy);
    try {
      const result = await super.authenticate(data, params, ...args);
      logger.info('[auth] authenticate OK, userId:', result?.user?.id);
      return result;
    } catch (err: any) {
      logger.error('[auth] authenticate FAILED:', err.message);
      throw err;
    }
  }
}

export default function (app: Application): void {
  const authentication = new LoggingAuthService(app);
  authentication.register('jwt', new JWTStrategy());
  app.use('/authentication', authentication);
}
