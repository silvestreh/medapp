import { useEffect, useCallback, useState } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useNavigation, Form } from '@remix-run/react';
import { Card, Title, TextInput, Button, PinInput, Stack, Text, Anchor } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
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
  errorKey?: string;
  errorMessage?: string;
  documentNumber?: string;
  maskedPhone?: string;
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const step = formData.get('step') as string;
  const documentNumber = formData.get('documentNumber') as string;

  if (!documentNumber) {
    return json<ActionResult>({ errorKey: 'auth.document_required', step: 'document' }, { status: 400 });
  }

  if (step === 'request-otp') {
    try {
      const result = await requestOtp(documentNumber, params.slug!);

      if (result.status === 'otp_sent') {
        return json<ActionResult>({ step: 'otp', documentNumber, maskedPhone: result.maskedPhone });
      }

      const errorKeys: Record<string, string> = {
        not_found: 'auth.not_found',
        no_phone: 'auth.no_phone',
        rate_limited: 'auth.rate_limited',
      };

      return json<ActionResult>({
        errorKey: errorKeys[result.status] || 'auth.something_went_wrong',
        step: 'document',
      });
    } catch {
      return json<ActionResult>({ errorKey: 'auth.server_error', step: 'document' }, { status: 500 });
    }
  }

  if (step === 'verify-otp') {
    const code = formData.get('code') as string;

    if (!code || code.length !== 6) {
      return json<ActionResult>({ errorKey: 'auth.enter_code', step: 'otp', documentNumber }, { status: 400 });
    }

    try {
      const result = await verifyOtp(documentNumber, code, params.slug!);
      const cookieHeader = await setPatientToken(request, result.accessToken);
      return redirect(`/${params.slug}`, {
        headers: { 'Set-Cookie': cookieHeader },
      });
    } catch (err: any) {
      const serverMessage = err?.message;
      return json<ActionResult>({
        errorKey: serverMessage ? undefined : 'auth.invalid_code',
        errorMessage: serverMessage,
        step: 'otp',
        documentNumber,
      }, { status: 401 });
    }
  }

  return json<ActionResult>({ errorKey: 'auth.something_went_wrong', step: 'document' }, { status: 400 });
};

export default function AuthPage() {
  const { t } = useTranslation();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [otp, setOtp] = useState('');

  const currentStep = actionData?.step === 'otp' ? 'otp' : 'document';

  useEffect(() => {
    if (actionData?.errorKey || actionData?.errorMessage) {
      notifications.show({
        title: t('auth.error'),
        message: actionData.errorMessage || t(actionData.errorKey as any),
        color: 'red',
      });
    }
  }, [actionData, t]);

  const handleReset = useCallback(() => {
    setOtp('');
  }, []);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={3} ta="center">{t('auth.title')}</Title>

        {currentStep === 'document' && (
          <Form method="post">
            <Stack gap="md">
              <input type="hidden" name="step" value="request-otp" />
              <TextInput
                label={t('auth.document_label')}
                name="documentNumber"
                placeholder={t('auth.document_placeholder')}
                required
                autoFocus
              />
              <Button type="submit" fullWidth loading={isSubmitting}>
                {t('auth.continue')}
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
                {t('auth.otp_sent', { phone: actionData?.maskedPhone || '' })}
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
                {t('auth.verify')}
              </Button>
              <Anchor size="sm" onClick={handleReset} component="a" href="">
                {t('auth.use_different_document')}
              </Anchor>
            </Stack>
          </Form>
        )}
      </Stack>
    </Card>
  );
}
