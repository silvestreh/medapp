import { json, type ActionFunctionArgs } from '@remix-run/node';
import { setCurrentOrganizationId } from '~/session';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { organizationId } = await request.json();

  if (!organizationId || typeof organizationId !== 'string') {
    return json({ error: 'organizationId is required' }, { status: 400 });
  }

  const cookieHeader = await setCurrentOrganizationId(request, organizationId);

  return json({ ok: true }, {
    headers: { 'Set-Cookie': cookieHeader },
  });
};
