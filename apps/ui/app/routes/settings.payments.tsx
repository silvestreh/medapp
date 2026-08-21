import { useCallback, useEffect, useRef, useState } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from '@remix-run/react';
import { Alert, Anchor, Button, NumberInput, Radio, SegmentedControl, Stack, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { CurrencyDollarIcon, InfoIcon, WalletIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { FormCard, FieldRow, SectionTitle, FormHeader } from '~/components/forms/styles';
import ConnectionCard, { type PaymentConnection } from '~/components/payments/connection-card';
import { formatMoneyMinor } from '~/utils/money';

interface PaymentSettingsRecord {
  id: string;
  enabled: boolean;
  chargePortion: 25 | 50 | 100;
  requirementMode: 'optional' | 'required';
  holdWindowMinutes: number;
  resolvedFee?: { amount: number; feeMinor: number; currency: string } | null;
}

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const url = new URL(request.url);

  const [settingsResponse, connection] = await Promise.all([
    client.service('payment-settings' as any).find({ query: { $limit: 1 } }),
    client.service('payment-connections' as any).get('current') as Promise<PaymentConnection>,
  ]);
  const rows = Array.isArray(settingsResponse) ? settingsResponse : (settingsResponse as any)?.data || [];
  const settings: PaymentSettingsRecord | null = rows[0] || null;

  return json({
    settings,
    connection,
    connected: url.searchParams.get('connected'),
    connectError: url.searchParams.get('connect_error'),
  });
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  let client;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch (error) {
    throw redirect('/login');
  }

  try {
    if (intent === 'start-oauth') {
      const result = (await client.service('payment-connections' as any).create({ action: 'start' })) as {
        authorizationUrl: string;
      };
      return json({ ok: true, intent, authorizationUrl: result.authorizationUrl });
    }

    if (intent === 'disconnect') {
      await client.service('payment-connections' as any).remove('current');
      return json({ ok: true, intent });
    }

    if (intent === 'save-payment-config') {
      const payload = {
        enabled: formData.get('enabled') === 'true',
        chargePortion: Number(formData.get('chargePortion') || 100),
        requirementMode: String(formData.get('requirementMode') || 'optional'),
        holdWindowMinutes: Number(formData.get('holdWindowMinutes') || 20),
      };

      const existingResponse = await client.service('payment-settings' as any).find({ query: { $limit: 1 } });
      const rows = Array.isArray(existingResponse) ? existingResponse : (existingResponse as any)?.data || [];

      if (rows[0]) {
        await client.service('payment-settings' as any).patch(rows[0].id, payload);
      } else {
        await client.service('payment-settings' as any).create(payload);
      }

      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'unknown-intent' });
  } catch (error: any) {
    return json({ ok: false, intent, error: error?.message || 'unknown-error' });
  }
};

export default function PaymentsSettingsRoute() {
  const { settings, connection, connected, connectError } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const oauthFetcher = useFetcher<typeof action>();
  const disconnectFetcher = useFetcher<typeof action>();
  const configFetcher = useFetcher<typeof action>();

  const [enabled, setEnabled] = useState(Boolean(settings?.enabled));
  const [chargePortion, setChargePortion] = useState(String(settings?.chargePortion ?? 100));
  const [requirementMode, setRequirementMode] = useState(settings?.requirementMode ?? 'optional');
  const [holdWindowMinutes, setHoldWindowMinutes] = useState<number | string>(settings?.holdWindowMinutes ?? 20);

  // OAuth return: toast once and strip the query so refresh doesn't re-toast.
  const toastedRef = useRef(false);
  useEffect(() => {
    if (toastedRef.current || (!connected && !connectError)) return;
    toastedRef.current = true;

    if (connected) {
      notifications.show({ color: 'green', message: t('payments.connection.oauth_success') });
    }
    if (connectError) {
      const key = `payments.connection.oauth_${connectError}`;
      notifications.show({ color: 'red', message: t(key as any, t('payments.connection.error')) });
    }

    navigate('/settings/payments', { replace: true });
  }, [connected, connectError, navigate, t]);

  // Full-page redirect to the provider's authorization URL.
  const handledOauthRef = useRef<unknown>(null);
  useEffect(() => {
    const data = oauthFetcher.data as { ok?: boolean; authorizationUrl?: string; error?: string } | undefined;
    if (!data || handledOauthRef.current === data) return;
    handledOauthRef.current = data;

    if (data.ok && data.authorizationUrl) {
      window.location.assign(data.authorizationUrl);
    } else if (data.error) {
      notifications.show({ color: 'red', message: t('payments.connection.error') });
    }
  }, [oauthFetcher.data, t]);

  const handledDisconnectRef = useRef<unknown>(null);
  useEffect(() => {
    const data = disconnectFetcher.data as { ok?: boolean } | undefined;
    if (!data || handledDisconnectRef.current === data) return;
    handledDisconnectRef.current = data;

    if (data.ok) {
      notifications.show({ color: 'green', message: t('payments.connection.disconnected') });
      revalidator.revalidate();
    }
  }, [disconnectFetcher.data, revalidator, t]);

  const handledConfigRef = useRef<unknown>(null);
  useEffect(() => {
    const data = configFetcher.data as { ok?: boolean; intent?: string; error?: string } | undefined;
    if (!data || data.intent !== 'save-payment-config' || handledConfigRef.current === data) return;
    handledConfigRef.current = data;

    if (data.ok) {
      notifications.show({ color: 'green', message: t('payments.config.saved') });
      revalidator.revalidate();
    } else {
      notifications.show({ color: 'red', message: t('payments.config.save_error') });
    }
  }, [configFetcher.data, revalidator, t]);

  const handleConnect = useCallback(() => {
    oauthFetcher.submit({ intent: 'start-oauth' }, { method: 'post' });
  }, [oauthFetcher]);

  const handleDisconnect = useCallback(() => {
    disconnectFetcher.submit({ intent: 'disconnect' }, { method: 'post' });
  }, [disconnectFetcher]);

  const handleSave = useCallback(() => {
    configFetcher.submit(
      {
        intent: 'save-payment-config',
        enabled: String(enabled),
        chargePortion,
        requirementMode,
        holdWindowMinutes: String(holdWindowMinutes || 20),
      },
      { method: 'post' }
    );
  }, [configFetcher, enabled, chargePortion, requirementMode, holdWindowMinutes]);

  const handleEnabledChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setEnabled(event.currentTarget.checked);
  }, []);

  const handleModeChange = useCallback((value: string) => {
    setRequirementMode(value as 'optional' | 'required');
  }, []);

  const isConnected = Boolean(connection?.connected);
  // Before the first save there is no settings row to carry the fee — the
  // connection response provides it so the gate reflects reality.
  const resolvedFee = settings?.resolvedFee ?? connection?.resolvedFee ?? null;
  const hasFee = Boolean(resolvedFee && resolvedFee.feeMinor > 0);
  const canEnable = isConnected && hasFee;
  const portionNumber = Number(chargePortion);
  const previewCharge = resolvedFee ? Math.round((resolvedFee.feeMinor * portionNumber) / 100) : 0;
  const previewRemainder = resolvedFee ? resolvedFee.feeMinor - previewCharge : 0;

  return (
    <>
      <FormHeader>
        <SectionTitle icon={<WalletIcon />}>{t('payments.title')}</SectionTitle>
      </FormHeader>

      <Text c="dimmed" size="sm" mb="md">
        {t('payments.description')}
      </Text>

      <ConnectionCard
        connection={connection}
        settingsEnabled={Boolean(settings?.enabled)}
        connecting={oauthFetcher.state !== 'idle'}
        disconnecting={disconnectFetcher.state !== 'idle'}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {isConnected && (
        <>
          <FormHeader>
            <SectionTitle icon={<CurrencyDollarIcon />}>{t('payments.config.section_title')}</SectionTitle>
          </FormHeader>

          {!hasFee && (
            <Alert color="yellow" icon={<InfoIcon />} mb="md">
              {t('payments.config.fee_missing_alert')}{' '}
              <Anchor href="/accounting" size="sm">
                {t('payments.config.fee_missing_link')}
              </Anchor>
            </Alert>
          )}

          <FormCard>
            <FieldRow label={t('payments.config.fee_label')}>
              <Text fw={500} py={8}>
                {hasFee && resolvedFee && formatMoneyMinor(resolvedFee.feeMinor, resolvedFee.currency)}
                {!hasFee && '—'}
              </Text>
            </FieldRow>

            <FieldRow label={t('payments.config.enabled_label')}>
              <Switch checked={enabled} onChange={handleEnabledChange} disabled={!canEnable && !enabled} py={8} />
            </FieldRow>

            <FieldRow label={t('payments.config.portion_label')} variant="stacked">
              <Stack gap={6}>
                <SegmentedControl
                  value={chargePortion}
                  onChange={setChargePortion}
                  data={[
                    { value: '25', label: '25%' },
                    { value: '50', label: '50%' },
                    { value: '100', label: '100%' },
                  ]}
                  w="fit-content"
                />
                {hasFee && portionNumber === 100 && (
                  <Text size="sm" c="dimmed">
                    {t('payments.config.portion_full_preview', { charge: formatMoneyMinor(previewCharge) })}
                  </Text>
                )}
                {hasFee && portionNumber < 100 && (
                  <Text size="sm" c="dimmed">
                    {t('payments.config.portion_deposit_preview', {
                      charge: formatMoneyMinor(previewCharge),
                      remainder: formatMoneyMinor(previewRemainder),
                    })}
                  </Text>
                )}
              </Stack>
            </FieldRow>

            <FieldRow label={t('payments.config.mode_label')} variant="stacked">
              <Radio.Group value={requirementMode} onChange={handleModeChange}>
                <Stack gap="xs" py={4}>
                  <Radio
                    value="optional"
                    label={t('payments.config.mode_optional')}
                    description={t('payments.config.mode_optional_desc')}
                  />
                  <Radio
                    value="required"
                    label={t('payments.config.mode_required')}
                    description={t('payments.config.mode_required_desc')}
                  />
                </Stack>
              </Radio.Group>
            </FieldRow>

            {requirementMode === 'required' && (
              <FieldRow label={t('payments.config.hold_label')}>
                <NumberInput
                  value={holdWindowMinutes}
                  onChange={setHoldWindowMinutes}
                  min={5}
                  max={120}
                  suffix=" min"
                  w={120}
                  hideControls
                />
              </FieldRow>
            )}
          </FormCard>

          <Text size="xs" c="dimmed" mt="xs">
            {t('payments.config.hold_hint')}
          </Text>

          <Text size="xs" c="dimmed" mt={4}>
            {t('payments.config.non_fiscal_note')}
          </Text>

          <Button mt="md" onClick={handleSave} loading={configFetcher.state !== 'idle'} disabled={enabled && !hasFee}>
            {t('common.save')}
          </Button>
        </>
      )}
    </>
  );
}
