import { redirect, type ActionFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { TextInput, PasswordInput, Button, Paper, Title, Container } from '@mantine/core';

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

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        Create an account
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Form method="post">
          <TextInput label="Username" name="username" placeholder="Your username" required mb="md" />
          <PasswordInput label="Password" name="password" placeholder="Your password" required mb="xl" />

          {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

          <Button type="submit" fullWidth>
            Sign up
          </Button>
        </Form>
      </Paper>
    </Container>
  );
}
