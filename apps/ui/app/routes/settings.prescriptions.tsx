import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useRevalidator, useRouteLoaderData } from '@remix-run/react';
import { Alert, Button, FileButton, Group, Image, Select, Switch, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { ClipboardTextIcon, PencilIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient, getCurrentOrgRoleIds, authenticatedLoader } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import type { loader as settingsLoader } from '~/routes/settings';
import { SignatureCanvas } from '~/components/signature-canvas';
import { FormCard, FieldRow, SectionTitle, FormHeader } from '~/components/forms/styles';

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const orgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, orgId);
  const isMedic = orgRoleIds.includes('medic');
  const isPrescriber = orgRoleIds.includes('prescriber');

  // Fetch existing delegations for this user
  const delegationsResponse = await client.service('prescription-delegations' as any).find({
    query: { $limit: 200 },
  });
  const delegations = Array.isArray(delegationsResponse)
    ? delegationsResponse
    : ((delegationsResponse as any)?.data ?? []);

  // Fetch org members (populated) to resolve user names
  const membersResponse = await client.service('organization-users').find({
    query: { $populate: true, $limit: 200 },
  });
  const allMembers = Array.isArray(membersResponse) ? membersResponse : ((membersResponse as any)?.data ?? []);

  // Build a userId → name map
  const userNameMap = new Map<string, string>();
  for (const m of allMembers) {
    if (!m.user) continue;
    const pd = m.user.personalData;
    const name = pd ? [pd.firstName, pd.lastName].filter(Boolean).join(' ') : '';
    userNameMap.set(m.userId, name || m.user.username || m.userId);
  }

  // Enrich delegations with user names
  const enrichedDelegations = delegations.map((d: any) => ({
    id: d.id,
    medicId: d.medicId,
    prescriberId: d.prescriberId,
    medicName: userNameMap.get(d.medicId) || d.medicId,
    prescriberName: userNameMap.get(d.prescriberId) || d.prescriberId,
  }));

  // If user is a medic, build the list of prescribers available to add
  let orgPrescribers: Array<{ id: string; name: string }> = [];
  if (isMedic) {
    const userRolesResponse = await client.service('user-roles').find({
      query: { roleId: 'prescriber', $limit: 500 },
    });
    const prescriberRoles = Array.isArray(userRolesResponse)
      ? userRolesResponse
      : ((userRolesResponse as any)?.data ?? []);
    const prescriberUserIds = new Set(prescriberRoles.map((ur: any) => ur.userId));

    const existingPrescriberIds = new Set(
      delegations.filter((d: any) => d.medicId === user.id).map((d: any) => d.prescriberId)
    );

    orgPrescribers = allMembers
      .filter((m: any) => m.user && prescriberUserIds.has(m.userId) && !existingPrescriberIds.has(m.userId))
      .map((m: any) => ({
        id: m.user.id,
        name: userNameMap.get(m.user.id) || m.user.id,
      }));
  }

  return json({
    delegations: enrichedDelegations,
    orgPrescribers,
    isMedic,
    isPrescriber,
    userId: user.id,
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
      const recetarioProvince = String(formData.get('recetarioProvince') || '');
      const signatureImage = String(formData.get('signatureImage') || '');
      await client.service('profile').create({
        action: 'update-profile',
        mdSettings: {
          recetarioProvince: recetarioProvince || undefined,
          signatureImage: signatureImage || undefined,
        },
      });
      return json({ ok: true, intent });
    }

    if (intent === 'create-delegation') {
      const prescriberId = String(formData.get('prescriberId') || '');
      if (!prescriberId) {
        return json({ ok: false, intent, error: 'Prescriber is required' }, { status: 400 });
      }
      await client.service('prescription-delegations' as any).create({ prescriberId });
      return json({ ok: true, intent });
    }

    if (intent === 'remove-delegation') {
      const delegationId = String(formData.get('delegationId') || '');
      if (!delegationId) {
        return json({ ok: false, intent, error: 'Delegation ID is required' }, { status: 400 });
      }
      await client.service('prescription-delegations' as any).remove(delegationId);
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function SettingsPrescriptionsRoute() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const loaderData = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<typeof action>();
  const lastHandledData = useRef(fetcher.data);

  const currentOrg = parentData?.currentOrg;
  const mdSettings = parentData?.mdSettings;
  const isOrgOwner = parentData?.isOrgOwner;
  const [recetarioEnabled, setRecetarioEnabled] = useState(!!currentOrg?.settings?.recetario?.enabled);
  const healthCenterId = currentOrg?.settings?.recetario?.healthCenterId
    ? String(currentOrg.settings.recetario.healthCenterId)
    : '';

  const recetarioProvince = mdSettings?.stateLicense || '';
  const [signatureBase64, setSignatureBase64] = useState<string>(mdSettings?.signatureImage ?? '');
  const [showCanvas, setShowCanvas] = useState(false);

  const { delegations, orgPrescribers, isMedic, isPrescriber, userId } = loaderData;
  const myDelegations = useMemo(() => delegations.filter(d => d.medicId === userId), [delegations, userId]);
  const grantedToMe = useMemo(() => delegations.filter(d => d.prescriberId === userId), [delegations, userId]);

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
      const intent = fetcher.data.intent;
      let msg = t('profile.org_saved');
      if (intent === 'create-delegation') msg = t('recetario.delegations_added');
      else if (intent === 'remove-delegation') msg = t('recetario.delegations_revoked');
      notifications.show({ message: msg, color: 'green' });
      revalidator.revalidate();
    }
    if (fetcher.data && !fetcher.data.ok) {
      notifications.show({ message: fetcher.data.error || t('profile.org_save_error'), color: 'red' });
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
        recetarioProvince,
        signatureImage: signatureBase64,
      },
      { method: 'post' }
    );
  }, [fetcher, recetarioProvince, signatureBase64]);

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

  const handleAddDelegation = useCallback(
    (prescriberId: string | null) => {
      if (!prescriberId) return;
      fetcher.submit({ intent: 'create-delegation', prescriberId }, { method: 'post' });
    },
    [fetcher]
  );

  const handleRemoveDelegation = useCallback(
    (delegationId: string) => {
      fetcher.submit({ intent: 'remove-delegation', delegationId }, { method: 'post' });
    },
    [fetcher]
  );

  return (
    <Stack gap={0}>
      {isOrgOwner && currentOrg && (
        <>
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
        </>
      )}

      {parentData?.isMedic && (
        <>
          <FormHeader style={{ marginTop: '2rem' }}>
            <SectionTitle id="prescriptions-signature" icon={<ClipboardTextIcon />}>
              {t('recetario.prescriber_settings')}
            </SectionTitle>
          </FormHeader>
          <FormCard>
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

      {isMedic && (
        <>
          <FormHeader style={{ marginTop: '2rem' }}>
            <SectionTitle id="prescriptions-delegations">{t('recetario.delegations_medic_title')}</SectionTitle>
          </FormHeader>
          <FormCard>
            {myDelegations.length === 0 && (
              <FieldRow>
                <Text c="dimmed" size="sm">
                  {t('recetario.delegations_empty_medic')}
                </Text>
              </FieldRow>
            )}
            {myDelegations.map(d => (
              <FieldRow key={d.id}>
                <Group justify="space-between" w="100%">
                  <Text size="sm">{d.prescriberName}</Text>
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    leftSection={<TrashIcon size={14} />}
                    onClick={() => handleRemoveDelegation(d.id)}
                    loading={fetcher.state !== 'idle'}
                  >
                    {t('recetario.delegations_revoke')}
                  </Button>
                </Group>
              </FieldRow>
            ))}
          </FormCard>
          {orgPrescribers.length > 0 && (
            <Group mt="sm">
              <Select
                placeholder={t('recetario.delegations_add')}
                data={orgPrescribers.map(p => ({ value: p.id, label: p.name }))}
                onChange={handleAddDelegation}
                searchable
                clearable
                style={{ flex: 1 }}
              />
            </Group>
          )}
        </>
      )}

      {isPrescriber && !isMedic && (
        <>
          <FormHeader style={{ marginTop: '2rem' }}>
            <SectionTitle id="prescriptions-delegations-granted">
              {t('recetario.delegations_prescriber_title')}
            </SectionTitle>
          </FormHeader>
          <FormCard>
            {grantedToMe.length === 0 && (
              <FieldRow>
                <Text c="dimmed" size="sm">
                  {t('recetario.delegations_empty_prescriber')}
                </Text>
              </FieldRow>
            )}
            {grantedToMe.map(d => (
              <FieldRow key={d.id}>
                <Text size="sm">{d.medicName}</Text>
              </FieldRow>
            ))}
          </FormCard>
        </>
      )}
    </Stack>
  );
}
