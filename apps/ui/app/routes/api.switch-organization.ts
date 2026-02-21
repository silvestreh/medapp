import { json, type ActionFunctionArgs } from '@remix-run/node';
import { setCurrentOrganizationId } from '~/session';

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { organizationId } = body;

  if (!organizationId) {
    return json({ error: 'organizationId is required' }, { status: 400 });
  }

  const cookieHeader = await setCurrentOrganizationId(request, organizationId);

  return json(
    { success: true },
    {
      headers: {
        'Set-Cookie': cookieHeader,
      },
    }
  );
};
