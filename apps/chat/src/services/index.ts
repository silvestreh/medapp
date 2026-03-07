import { Application } from '../declarations';
import users from './users/users.service';
import conversations from './conversations/conversations.service';
import messages from './messages/messages.service';
import userStatus from './user-status/user-status.service';

export default function (app: Application): void {
  app.configure(users);
  app.configure(conversations);
  app.configure(messages);
  app.configure(userStatus);
}
