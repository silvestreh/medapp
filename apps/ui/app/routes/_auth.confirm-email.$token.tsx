import { json, type ActionFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData, Link } from '@remix-run/react';
import { Button, Paper, Title, Text, Container, Anchor } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import createFeathersClient from '~/feathers';

export async function loader({ params }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) {
    return json({ confirmed: false, error: 'invalid' });
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
  const client = createFeathersClient(apiUrl);

  try {
    await client.service('confirmations').patch(null, {
      action: 'confirm-email',
      token,
    });
    return json({ confirmed: true, error: null });
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.data?.message || error?.message || '';
    const errorKey = message.includes('expired') ? 'auth.confirmation_link_expired' : 'auth.confirmation_link_invalid';
    return json({ confirmed: false, error: errorKey });
  }
}

export default function ConfirmEmail() {
  const { confirmed, error } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.email_confirmed_title')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        {confirmed && (
          <>
            <Text ta="center" mb="lg">
              {t('auth.email_confirmed_description')}
            </Text>
            <Button component={Link} to="/login" fullWidth>
              {t('auth.sign_in')}
            </Button>
          </>
        )}

        {!confirmed && (
          <>
            <Text ta="center" c="red" mb="lg">
              {t(error || 'auth.confirmation_link_invalid')}
            </Text>
            <Text c="dimmed" size="sm" ta="center">
              <Anchor component={Link} to="/login" fw={600}>
                {t('auth.back_to_login')}
              </Anchor>
            </Text>
          </>
        )}
      </Paper>
    </Container>
  );
}
