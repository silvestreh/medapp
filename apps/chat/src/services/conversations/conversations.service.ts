import { Application } from '../../declarations';
import createModel from '../../models/conversations.model';
import createParticipantsModel from '../../models/conversation-participants.model';
import { Conversations } from './conversations.class';
import hooks from './conversations.hooks';

export default function (app: Application): void {
  const Model = createModel(app);
  createParticipantsModel(app);

  const paginate = app.get('paginate');

  const options = {
    Model,
    paginate,
  };

  app.use('/conversations', new Conversations(options));
  app.service('conversations').hooks(hooks);

  // Also register the conversation-participants service (no external hooks needed)
  const ParticipantsModel = app.get('sequelizeClient').models.conversation_participants;
  const { Service } = require('feathers-sequelize');
  app.use('/conversation-participants', new Service({ Model: ParticipantsModel, paginate }));
}
