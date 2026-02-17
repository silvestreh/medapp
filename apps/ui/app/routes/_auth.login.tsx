import { redirect, type ActionFunction, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { TextInput, PasswordInput, Button, Paper, Title, Container } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import createFeathersClient from '~/feathers';
import { getSession, commitSession, destroySession } from '~/session';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'login') }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const token = session.get('feathers-jwt');

  if (token) {
    try {
      const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');
      await client.authenticate({
        strategy: 'jwt',
        accessToken: token,
      });
      return redirect('/');
    } catch (error) {
      await destroySession(session);
    }
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
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect') || '/';

  try {
    const { accessToken } = await client.authenticate({
      strategy: 'local',
      username,
      password,
    });

    session.set('feathers-jwt', accessToken);

    return redirect(redirectTo, {
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
        {t('auth.welcome_back')}
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
            {t('auth.sign_in')}
          </Button>
        </Form>
      </Paper>
    </Container>
  );
}
