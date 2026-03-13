import { redirect, type ActionFunctionArgs } from '@remix-run/node';
import { clearPatientToken } from '~/session.server';

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const cookieHeader = await clearPatientToken(request);
  return redirect(`/${params.slug}/auth`, {
    headers: { 'Set-Cookie': cookieHeader },
  });
};
