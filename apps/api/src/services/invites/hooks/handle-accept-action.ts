import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest, NotFound } from '@feathersjs/errors';
import * as local from '@feathersjs/authentication-local';
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../../utils/validate-password';

const { hashPassword } = local.hooks;

const handleAcceptAction = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (!context.params._isAcceptAction) return context;

  const { app, id, data } = context;

  const invite = await app.service('invites').get(id!, { provider: undefined } as any);

  if (!invite) {
    throw new NotFound('Invite not found');
  }

  if (invite.status !== 'pending') {
    throw new BadRequest(`This invite has already been ${invite.status}`);
  }

  if (new Date(invite.expiresAt) < new Date()) {
    await app.service('invites').patch(invite.id, { status: 'expired' }, { provider: undefined } as any);
    throw new BadRequest('This invite has expired');
  }

  if (!invite.userId) {
    throw new BadRequest('This invite is not associated with a user');
  }

  if (data.password) {
    if (!isPasswordValid(data.password)) {
      throw new BadRequest(PASSWORD_POLICY_MESSAGE);
    }

    context.data = { password: data.password };
    await hashPassword('password')(context);
    const hashedPassword = context.data.password;

    const sequelize = app.get('sequelizeClient');
    await sequelize.models.users.update(
      { password: hashedPassword },
      { where: { id: invite.userId } }
    );
  }

  await app.service('organization-users').create(
    {
      organizationId: invite.organizationId,
      userId: invite.userId,
    },
    { provider: undefined } as any
  );

  await app.service('user-roles').create(
    {
      userId: invite.userId,
      roleId: invite.roleId,
      organizationId: invite.organizationId,
    },
    { provider: undefined } as any
  );

  context.data = { status: 'accepted' };

  return context;
};

export default handleAcceptAction;
