import { redirect, type LoaderFunctionArgs } from '@remix-run/node';

import { requireAuth } from '~/utils/auth.server';
import { getFirstDocSlug } from '~/lib/docs-manifest';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth(request);
  return redirect(`/docs/${getFirstDocSlug()}`);
};
