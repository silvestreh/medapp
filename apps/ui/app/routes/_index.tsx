import { type MetaFunction, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { getUser } from '~/utils/auth.server';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'home') }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const user = await getUser(request);

    if (!user) {
      throw redirect('/login');
    }

    switch (user.role.id) {
      case 'admin':
        return redirect('/users');
      case 'medic':
        return redirect('/encounters');
      case 'receptionist':
        return redirect('/appointments');
      default:
        throw redirect('/login');
    }
  } catch (error) {
    // If there's an authentication error, redirect to login
    if (error instanceof Response && error.status === 302) {
      throw error;
    }
    throw redirect('/login');
  }
};
