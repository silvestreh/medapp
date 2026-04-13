import { useCallback, useState } from 'react';
import { json, redirect, type ActionFunction, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Container } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import createFeathersClient from '~/feathers';
import { getSession, commitSession } from '~/session';
import { PasswordChecklist } from '~/components/password-checklist';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  if (session.has('feathers-jwt')) {
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
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  const organizationName = formData.get('organizationName');
  const client = createFeathersClient(process.env.API_URL ?? 'http://localhost:3030');

  try {
    await client.service('users').create({
      email,
      password,
      signupOrganization: organizationName,
    });

    return json({ success: true });
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.data?.message || error?.message || '';
    return json({ success: false, errorMessage: message });
  }
};

export default function Signup() {
  const { error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.currentTarget.value);
  }, []);

  const success = actionData?.success ?? false;

  if (success) {
    return (
      <Container size={420} my={40}>
        <Title ta="center" order={1}>
          {t('auth.check_your_email')}
        </Title>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <Text ta="center">{t('auth.check_your_email_description')}</Text>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" order={1}>
        {t('auth.create_account')}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Form method="post">
          <TextInput
            label={t('auth.organization_name')}
            name="organizationName"
            placeholder={t('auth.organization_name_placeholder')}
            required
            mb="md"
          />
          <TextInput
            label={t('auth.email')}
            name="email"
            type="email"
            placeholder={t('auth.email_placeholder')}
            required
            mb="md"
          />
          <PasswordInput
            label={t('auth.password')}
            name="password"
            placeholder={t('auth.password_placeholder')}
            required
            value={password}
            onChange={handlePasswordChange}
            mb="xs"
          />
          <PasswordChecklist password={password} onValidityChange={setIsPasswordValid} />

          {(error || actionData?.errorMessage) && (
            <Text c="red" size="sm" mb="md">
              {actionData?.errorMessage || t('auth.invalid_credentials')}
            </Text>
          )}

          <Button type="submit" fullWidth disabled={!isPasswordValid} mt="md">
            {t('auth.sign_up')}
          </Button>
        </Form>
      </Paper>
    </Container>
  );
}
