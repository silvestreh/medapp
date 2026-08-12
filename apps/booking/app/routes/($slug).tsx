import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Outlet, Form, useLocation, useRouteLoaderData } from '@remix-run/react';
import { Container, ActionIcon, Text, Title, Stack } from '@mantine/core';
import { SignOutIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getOrganization, type OrganizationInfo } from '~/api.server';
import { resolveBookingContext, getClientIp } from '~/host.server';
import { couldBeOrganization } from '~/organizations.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { slug, basePath } = resolveBookingContext(request, params);

  if (!slug) {
    return json({ organization: null, basePath, error: false as const, noOrg: true as const });
  }

  const notFound = () =>
    json({ organization: null, basePath, error: true as const, noOrg: false as const }, { status: 404 });

  // Wildcard DNS lands every invented hostname here; answer scanner probes
  // without spending an API call on them (see organizations.server.ts).
  if (!(await couldBeOrganization(slug))) {
    return notFound();
  }

  try {
    const organization = await getOrganization(slug, getClientIp(request));
    return json({ organization, basePath, error: false as const, noOrg: false as const });
  } catch {
    return notFound();
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const orgName = data?.organization?.name;
  if (!orgName) return [];
  return [{ title: `Turnos | ${orgName}` }];
};

export type SlugLoaderData = {
  organization: OrganizationInfo | null;
  basePath: string;
  error: boolean;
  noOrg: boolean;
};

export default function SlugLayout() {
  const { t } = useTranslation();
  const data = useRouteLoaderData<typeof loader>('routes/($slug)');
  const location = useLocation();
  const isAuthPage = location.pathname.endsWith('/auth');

  if (data?.noOrg) {
    return (
      <Container size="xs" py="xl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Stack align="center" gap="md">
          <Title order={3}>{t('booking.title')}</Title>
          <Text c="dimmed">{t('common.navigate_to_org')}</Text>
        </Stack>
      </Container>
    );
  }

  if (data?.error || !data?.organization) {
    return (
      <Container size="xs" py="xl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Stack align="center" gap="md">
          <Title order={3}>{t('common.error')}</Title>
          <Text c="dimmed">{t('common.org_not_found')}</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <>
      {!isAuthPage && (
        <Form method="post" action="logout" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100 }}>
          <ActionIcon variant="subtle" color="gray" type="submit" aria-label={t('common.logout')}>
            <SignOutIcon size={18} />
          </ActionIcon>
        </Form>
      )}
      <Container size={isAuthPage ? 'xs' : 'sm'} py="xl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Outlet />
      </Container>
    </>
  );
}
