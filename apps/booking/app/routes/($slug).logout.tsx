import { redirect, type ActionFunctionArgs } from '@remix-run/node';
import { clearPatientToken } from '~/session.server';
import { resolveBookingContext } from '~/host.server';

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { basePath } = resolveBookingContext(request, params);
  const cookieHeader = await clearPatientToken(request);
  return redirect(`${basePath}/auth`, {
    headers: { 'Set-Cookie': cookieHeader },
  });
};
