import { ActionFunction, redirect } from '@remix-run/node';
import { getSession, destroySession } from '~/session';

export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get('Cookie'));

  return redirect('/login', {
    headers: {
      'Set-Cookie': await destroySession(session),
    },
  });
};
