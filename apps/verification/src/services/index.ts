import { Application } from '../declarations';
import users from './users/users.service';
import verificationSessions from './verification-sessions/verification-sessions.service';
import identityVerifications from './identity-verifications/identity-verifications.service';

export default function (app: Application): void {
  app.configure(users);
  app.configure(verificationSessions);
  app.configure(identityVerifications);
}
