import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Outlet, Form, useLocation, useRouteLoaderData } from '@remix-run/react';
import { Container, ActionIcon, Text, Title, Stack } from '@mantine/core';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getOrganization, type OrganizationInfo } from '~/api.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const slug = params.slug!;

  try {
    const organization = await getOrganization(slug);
    return json({ organization, error: false as const });
  } catch {
    return json({ organization: null, error: true as const }, { status: 404 });
  }
};

export type SlugLoaderData = {
  organization: OrganizationInfo | null;
  error: boolean;
};

export default function SlugLayout() {
  const { t } = useTranslation();
  const data = useRouteLoaderData<typeof loader>('routes/$slug');
  const location = useLocation();
  const isAuthPage = location.pathname.endsWith('/auth');

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
            <LogOut size={18} />
          </ActionIcon>
        </Form>
      )}
      <Container size={isAuthPage ? 'xs' : 'sm'} py="xl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Outlet />
      </Container>
    </>
  );
}
