import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { Application } from './declarations';

export default function (app: Application): void {
  const authentication = new AuthenticationService(app);
  authentication.register('jwt', new JWTStrategy());
  app.use('/authentication', authentication);
}
