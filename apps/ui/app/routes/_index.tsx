import { type MetaFunction, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { getUser } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'home') }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUser(request);

  if (!user) {
    throw redirect('/login');
  }

  const orgs = user.organizations ?? [];
  if (orgs.length === 0) {
    throw redirect('/profile');
  }

  let currentOrgId = await getCurrentOrganizationId(request);
  const org = orgs.find((o: any) => o.id === currentOrgId) ?? orgs[0];
  const roleIds: string[] = org?.roleIds ?? [];

  if (roleIds.includes('medic')) {
    return redirect('/encounters');
  }
  if (roleIds.includes('receptionist')) {
    if (roleIds.includes('lab-tech')) {
      return redirect('/studies');
    }
    return redirect('/appointments');
  }
  if (roleIds.includes('admin') || roleIds.includes('owner')) {
    return redirect('/users');
  }

  return redirect('/encounters');
};
