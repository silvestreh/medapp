import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useFetcher, useRevalidator, useRouteLoaderData } from '@remix-run/react';
import { Alert, Button, FileButton, Group, Image, Switch, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { ClipboardTextIcon, PencilIcon, WarningIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import type { loader as settingsLoader } from '~/routes/settings';
import { SignatureCanvas } from '~/components/signature-canvas';
import { FormCard, FieldRow, StyledSelect, SectionTitle, FormHeader } from '~/components/forms/styles';

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
    if (intent === 'update-recetario-settings') {
      const orgId = String(formData.get('orgId') || '');
      const enabled = formData.get('enabled') === 'true';
      const org = await client.service('organizations').get(orgId);
      const settings = { ...((org as any)?.settings || {}) };
      settings.recetario = {
        ...settings.recetario,
        enabled,
      };
      await client.service('organizations').patch(orgId, { settings });
      return json({ ok: true, intent });
    }

    if (intent === 'update-recetario-profile') {
      const recetarioTitle = String(formData.get('recetarioTitle') || '');
      const recetarioProvince = String(formData.get('recetarioProvince') || '');
      const signatureImage = String(formData.get('signatureImage') || '');
      await client.service('profile').create({
        action: 'update-profile',
        mdSettings: {
          recetarioTitle: recetarioTitle || undefined,
          recetarioProvince: recetarioProvince || undefined,
          signatureImage: signatureImage || undefined,
        },
      });
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function SettingsPrescriptionsRoute() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<typeof action>();
  const lastHandledData = useRef(fetcher.data);

  const currentOrg = parentData?.currentOrg;
  const mdSettings = parentData?.mdSettings;
  const [recetarioEnabled, setRecetarioEnabled] = useState(!!currentOrg?.settings?.recetario?.enabled);
  const healthCenterId = currentOrg?.settings?.recetario?.healthCenterId
    ? String(currentOrg.settings.recetario.healthCenterId)
    : '';

  const gender = (parentData?.user as any)?.personalData?.gender as string | null | undefined;
  const canInferTitle = gender === 'male' || gender === 'female';
  const inferredTitle = gender === 'male' ? 'Dr' : gender === 'female' ? 'Dra' : null;
  const [recetarioTitle, setRecetarioTitle] = useState(mdSettings?.recetarioTitle ?? inferredTitle ?? '');
  const effectiveTitle = canInferTitle ? (inferredTitle as string) : recetarioTitle;
  const recetarioProvince = mdSettings?.stateLicense || '';
  const [signatureBase64, setSignatureBase64] = useState<string>(mdSettings?.signatureImage ?? '');
  const [showCanvas, setShowCanvas] = useState(false);

  const missingOrgFields = useMemo(() => {
    const missing: string[] = [];
    if (!currentOrg?.address) missing.push(t('recetario.field_address'));
    if (!currentOrg?.phone) missing.push(t('recetario.field_phone'));
    if (!currentOrg?.email) missing.push(t('recetario.field_email'));
    if (!currentOrg?.logoUrl) missing.push(t('recetario.field_logo'));
    return missing;
  }, [currentOrg, t]);
  const canEnable = missingOrgFields.length === 0;

  useEffect(() => {
    if (fetcher.data === lastHandledData.current) return;
    lastHandledData.current = fetcher.data;

    if (fetcher.data?.ok) {
      notifications.show({ message: t('profile.org_saved'), color: 'green' });
      revalidator.revalidate();
    }
    if (fetcher.data && !fetcher.data.ok) {
      notifications.show({ message: t('profile.org_save_error'), color: 'red' });
    }
  }, [fetcher.data, revalidator, t]);

  const handleSaveOrg = useCallback(() => {
    if (!currentOrg) return;
    fetcher.submit(
      {
        intent: 'update-recetario-settings',
        orgId: currentOrg.id,
        enabled: recetarioEnabled ? 'true' : 'false',
      },
      { method: 'post' }
    );
  }, [currentOrg, fetcher, recetarioEnabled]);

  const handleSaveProfile = useCallback(() => {
    fetcher.submit(
      {
        intent: 'update-recetario-profile',
        recetarioTitle: effectiveTitle,
        recetarioProvince,
        signatureImage: signatureBase64,
      },
      { method: 'post' }
    );
  }, [fetcher, effectiveTitle, recetarioProvince, signatureBase64]);

  const handleSignatureUpload = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      setSignatureBase64(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  if (!parentData?.isOrgOwner || !currentOrg) return null;

  return (
    <Stack gap={0}>
      <FormHeader>
        <SectionTitle id="prescriptions-toggle" icon={<ClipboardTextIcon />}>
          {t('recetario.enabled')}
        </SectionTitle>
      </FormHeader>
      <FormCard>
        {!canEnable && (
          <Alert icon={<WarningIcon size={16} />} color="yellow" mb="md">
            {t('recetario.missing_org_fields', { fields: missingOrgFields.join(', ') })}
          </Alert>
        )}
        <FieldRow label={`${t('recetario.enabled_description')}:`} variant="stacked">
          <Switch
            checked={recetarioEnabled}
            disabled={!canEnable && !recetarioEnabled}
            onChange={e => setRecetarioEnabled(e.currentTarget.checked)}
          />
        </FieldRow>
        {recetarioEnabled && healthCenterId && (
          <FieldRow label={`${t('recetario.health_center_id')}:`} variant="stacked">
            <Text size="sm">{healthCenterId}</Text>
          </FieldRow>
        )}
      </FormCard>
      <Button
        size="sm"
        onClick={handleSaveOrg}
        loading={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'update-recetario-settings'}
        mt="1rem"
        ml="auto"
      >
        {t('common.save')}
      </Button>

      {parentData.isMedic && (
        <>
          <FormHeader style={{ marginTop: '2rem' }}>
            <SectionTitle id="prescriptions-signature" icon={<ClipboardTextIcon />}>
              {t('recetario.prescriber_settings')}
            </SectionTitle>
          </FormHeader>
          <FormCard>
            {!canInferTitle && (
              <FieldRow label={`${t('recetario.title_label')}:`} variant="stacked">
                <StyledSelect
                  data={[
                    { value: 'Dr', label: t('recetario.title_dr') },
                    { value: 'Dra', label: t('recetario.title_dra') },
                  ]}
                  value={recetarioTitle}
                  onChange={val => setRecetarioTitle(val ?? '')}
                />
              </FieldRow>
            )}
            <FieldRow label={`${t('recetario.signature_label')}:`} variant="stacked">
              <Group gap="sm">
                <FileButton onChange={handleSignatureUpload} accept="image/png,image/jpeg">
                  {props => (
                    <Button variant="light" size="xs" {...props}>
                      {t('recetario.signature_upload')}
                    </Button>
                  )}
                </FileButton>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<PencilIcon size={14} />}
                  onClick={() => setShowCanvas(v => !v)}
                >
                  {t('recetario.signature_draw')}
                </Button>
                {signatureBase64 && (
                  <>
                    <Image
                      src={`data:image/png;base64,${signatureBase64}`}
                      alt="Signature"
                      h={40}
                      w="auto"
                      fit="contain"
                    />
                    <Button variant="subtle" color="red" size="xs" onClick={() => setSignatureBase64('')}>
                      {t('recetario.signature_remove')}
                    </Button>
                  </>
                )}
              </Group>
              {showCanvas && (
                <SignatureCanvas
                  onSave={base64 => {
                    setSignatureBase64(base64);
                    setShowCanvas(false);
                  }}
                  onCancel={() => setShowCanvas(false)}
                />
              )}
            </FieldRow>
          </FormCard>
          <Button
            size="sm"
            onClick={handleSaveProfile}
            loading={fetcher.state === 'submitting' && fetcher.formData?.get('intent') === 'update-recetario-profile'}
            mt="1rem"
            ml="auto"
          >
            {t('common.save')}
          </Button>
        </>
      )}
    </Stack>
  );
}
