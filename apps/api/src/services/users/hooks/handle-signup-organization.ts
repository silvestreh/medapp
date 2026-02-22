import { HookContext } from '@feathersjs/feathers';
import { randomUUID } from 'crypto';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const prepareSignupOrganization = () => async (context: HookContext) => {
  const orgName = context.data?.signupOrganization;
  if (!orgName || typeof orgName !== 'string') return context;

  context.params._signupOrganization = orgName.trim();
  delete context.data.signupOrganization;
  context.data.roleId = 'admin';

  return context;
};

const handleSignupOrganization = () => async (context: HookContext) => {
  const orgName = context.params._signupOrganization as string | undefined;
  if (!orgName) return context;

  const { app, result } = context;
  const sequelize = app.get('sequelizeClient');
  const { organizations, organization_users } = sequelize.models;

  const orgId = randomUUID();
  const slug = `${slugify(orgName)}-${randomUUID().slice(0, 8)}`;

  await organizations.create({
    id: orgId,
    name: orgName,
    slug,
    settings: {},
  });

  await organization_users.create({
    id: randomUUID(),
    organizationId: orgId,
    userId: result.id,
    role: 'owner',
  });

  context.result.signupOrganizationId = orgId;

  return context;
};

export { prepareSignupOrganization, handleSignupOrganization };
