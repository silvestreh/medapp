import { useState, useCallback } from 'react';
import { json, type ActionFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, Link } from '@remix-run/react';
import { TextInput, Button, Paper, Title, Text, Container, Anchor } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import createFeathersClient from '~/feathers';
import { getSession } from '~/session';
import { redirect } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  if (session.has('feathers-jwt')) {
    return redirect('/');
  }

  return json(null);
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim();
  const apiUrl = process.env.API_URL ?? 'http://localhost:3030';
  const client = createFeathersClient(apiUrl);

  if (!email) {
    return json({ error: true, sent: false });
  }

  try {
    await client.service('password-resets').create({ email });
  } catch {
    // Silently succeed to avoid email enumeration
  }

  return json({ sent: true, error: false });
};

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.currentTarget.value);
  }, []);

  const sent = actionData?.sent ?? false;

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.forgot_password_title')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        {!sent && (
          <Form method="post">
            <Text size="sm" c="dimmed" mb="lg">
              {t('auth.forgot_password_description')}
            </Text>
            <TextInput
              label={t('auth.email')}
              name="email"
              type="email"
              placeholder={t('auth.email_placeholder')}
              required
              value={email}
              onChange={handleEmailChange}
              mb="xl"
            />
            <Button type="submit" fullWidth disabled={!email}>
              {t('auth.send_reset_link')}
            </Button>
          </Form>
        )}

        {sent && (
          <Text size="sm" ta="center">
            {t('auth.reset_link_sent')}
          </Text>
        )}
      </Paper>

      <Text c="dimmed" size="sm" ta="center" mt="md">
        <Anchor component={Link} to="/login" fw={600}>
          {t('auth.back_to_login')}
        </Anchor>
      </Text>
    </Container>
  );
}
