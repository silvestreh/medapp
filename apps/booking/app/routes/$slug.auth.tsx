import { useEffect, useCallback, useState } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useNavigation, Form } from '@remix-run/react';
import { Card, Title, TextInput, Button, PinInput, Stack, Text, Anchor } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { requestOtp, verifyOtp } from '~/api.server';
import { getPatientToken, setPatientToken } from '~/session.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const token = await getPatientToken(request);
  if (token) {
    return redirect(`/${params.slug}`);
  }
  return json({});
};

interface ActionResult {
  step: 'document' | 'otp';
  error?: string;
  documentNumber?: string;
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const step = formData.get('step') as string;
  const documentNumber = formData.get('documentNumber') as string;

  if (!documentNumber) {
    return json<ActionResult>({ error: 'Document number is required', step: 'document' }, { status: 400 });
  }

  if (step === 'request-otp') {
    try {
      const result = await requestOtp(documentNumber);

      if (result.status === 'otp_sent') {
        return json<ActionResult>({ step: 'otp', documentNumber });
      }

      const messages: Record<string, string> = {
        not_found: 'No patient found with that document number.',
        no_phone: 'No phone number on record. Please contact the clinic to add one.',
        rate_limited: 'Too many attempts. Please try again later.',
      };

      return json<ActionResult>({
        error: messages[result.status] || 'Something went wrong.',
        step: 'document',
      });
    } catch {
      return json<ActionResult>({ error: 'Could not connect to the server. Please try again.', step: 'document' }, { status: 500 });
    }
  }

  if (step === 'verify-otp') {
    const code = formData.get('code') as string;

    if (!code || code.length !== 6) {
      return json<ActionResult>({ error: 'Please enter the 6-digit code.', step: 'otp', documentNumber }, { status: 400 });
    }

    try {
      const result = await verifyOtp(documentNumber, code);
      const cookieHeader = await setPatientToken(request, result.accessToken);
      return redirect(`/${params.slug}/booking`, {
        headers: { 'Set-Cookie': cookieHeader },
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Invalid or expired code.';
      return json<ActionResult>({ error: message, step: 'otp', documentNumber }, { status: 401 });
    }
  }

  return json<ActionResult>({ error: 'Invalid step', step: 'document' }, { status: 400 });
};

export default function AuthPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [otp, setOtp] = useState('');

  const currentStep = actionData?.step === 'otp' ? 'otp' : 'document';

  useEffect(() => {
    if (actionData?.error) {
      notifications.show({
        title: 'Error',
        message: actionData.error,
        color: 'red',
      });
    }
  }, [actionData]);

  const handleReset = useCallback(() => {
    setOtp('');
  }, []);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={3} ta="center">Patient Login</Title>

        {currentStep === 'document' && (
          <Form method="post">
            <Stack gap="md">
              <input type="hidden" name="step" value="request-otp" />
              <TextInput
                label="Document Number"
                name="documentNumber"
                placeholder="Enter your document number"
                required
                autoFocus
              />
              <Button type="submit" fullWidth loading={isSubmitting}>
                Continue
              </Button>
            </Stack>
          </Form>
        )}

        {currentStep === 'otp' && (
          <Form method="post">
            <Stack gap="md" align="center">
              <input type="hidden" name="step" value="verify-otp" />
              <input type="hidden" name="documentNumber" value={actionData?.documentNumber || ''} />
              <Text size="sm" c="dimmed" ta="center">
                We sent a verification code to your phone number on record.
              </Text>
              <PinInput
                length={6}
                type="number"
                value={otp}
                onChange={setOtp}
                autoFocus
              />
              <input type="hidden" name="code" value={otp} />
              <Button type="submit" fullWidth loading={isSubmitting} disabled={otp.length !== 6}>
                Verify
              </Button>
              <Anchor size="sm" onClick={handleReset} component="a" href="">
                Use a different document
              </Anchor>
            </Stack>
          </Form>
        )}
      </Stack>
    </Card>
  );
}
