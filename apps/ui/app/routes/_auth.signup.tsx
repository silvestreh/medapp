import { redirect, type ActionFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { TextInput, PasswordInput, Button, Paper, Title, Container } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import createFeathersClient from '~/feathers';
import { getSession, commitSession } from '~/session';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  if (session.has('feathers-jwt')) {
    // Redirect to the home page if they are already signed in.
    return redirect('/');
  }

  const data = { error: session.get('error') };

  return new Response(JSON.stringify(data), {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  });
}

export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request.headers.get('Cookie'));
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');
  const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');

  try {
    await client.service('users').create({ username, password });
    const { accessToken } = await client.service('users').create({
      strategy: 'local',
      username,
      password,
      roleId: 'receptionist',
    });

    session.set('feathers-jwt', accessToken);

    return redirect('/', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch (error) {
    session.flash('error', 'Invalid username/password');

    return redirect('/login', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  }
};

export default function Login() {
  const { error } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.create_account')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Form method="post">
          <TextInput
            label={t('auth.username')}
            name="username"
            placeholder={t('auth.username_placeholder')}
            required
            mb="md"
          />
          <PasswordInput
            label={t('auth.password')}
            name="password"
            placeholder={t('auth.password_placeholder')}
            required
            mb="xl"
          />

          {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{t('auth.invalid_credentials')}</div>}

          <Button type="submit" fullWidth>
            {t('auth.sign_up')}
          </Button>
        </Form>
      </Paper>
    </Container>
  );
}
