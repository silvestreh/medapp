import { useCallback, useMemo, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useRevalidator } from '@remix-run/react';
import {
  ActionIcon,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Badge,
  Flex,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  TrashIcon,
  LockSimpleIcon,
} from '@phosphor-icons/react';

import { getAuthenticatedClient, getCurrentOrgRoleIds } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormCard, FieldRow, Label } from '~/components/forms/styles';
import { PrepagaSelector } from '~/components/prepaga-selector';
import { parseFormJson } from '~/utils/parse-form-json';
import { toPricingConfig, type InsurerPrices } from '~/utils/accounting';
import { styled } from '~/styled-system/jsx';

interface Practice {
  id: string;
  title: string;
  description: string;
  isSystem: boolean;
  systemKey: string | null;
}

interface Prepaga {
  id: string;
  shortName: string;
  denomination: string;
}

interface InsurerCode {
  insurerId: string;
  insurerName: string;
  code: string;
}

function getPracticeKey(practice: Practice): string {
  return practice.isSystem && practice.systemKey ? practice.systemKey : `custom_${practice.id}`;
}

function extractCodesForPractice(
  insurerPrices: InsurerPrices,
  practiceKey: string,
  prepagas: Prepaga[]
): InsurerCode[] {
  const codes: InsurerCode[] = [];
  const prepagaMap = new Map(prepagas.map(p => [p.id, p]));

  for (const [insurerId, practices] of Object.entries(insurerPrices)) {
    const config = practices[practiceKey];
    if (!config) continue;
    const pricing = toPricingConfig(config);
    if (pricing.code) {
      const prepaga = prepagaMap.get(insurerId);
      codes.push({
        insurerId,
        insurerName: prepaga ? `${prepaga.shortName} / ${prepaga.denomination}` : insurerId,
        code: pricing.code,
      });
    }
  }

  return codes;
}

const CodeRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const orgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, orgId);

  if (!orgRoleIds.includes('medic')) {
    throw json({ error: 'Not authorized' }, { status: 403 });
  }

  const practicesResponse = await client.service('practices' as any).find({
    query: { $limit: 200 },
  });
  const practices = Array.isArray(practicesResponse)
    ? practicesResponse
    : ((practicesResponse as any)?.data ?? []);

  // Fetch accounting settings for this medic to get codes
  const accountingResponse = await client.service('accounting-settings' as any).find({
    query: { userId: user.id, $limit: 1 },
  });
  const accountingList = Array.isArray(accountingResponse)
    ? accountingResponse
    : ((accountingResponse as any)?.data ?? []);
  const accountingSettings = accountingList[0] || null;
  const insurerPrices: InsurerPrices = accountingSettings?.insurerPrices || {};

  // Fetch prepagas that have been configured (to resolve names)
  const insurerIds = Object.keys(insurerPrices).filter(id => id !== '_particular');
  let prepagas: Prepaga[] = [];
  if (insurerIds.length > 0) {
    const prepagasResponse = await client.service('prepagas').find({
      query: { id: { $in: insurerIds }, $limit: 200 },
    });
    prepagas = Array.isArray(prepagasResponse)
      ? prepagasResponse
      : ((prepagasResponse as any)?.data ?? []);
  }

  return json({
    practices: practices as Practice[],
    insurerPrices,
    accountingSettingsId: accountingSettings?.id || null,
    prepagas,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  try {
    if (intent === 'create-practice') {
      const data = parseFormJson<{ title: string; description: string }>(formData.get('data'));
      await client.service('practices' as any).create(data);
      return json({ ok: true, intent });
    }

    if (intent === 'update-practice') {
      const data = parseFormJson<{ id: string; title?: string; description?: string }>(formData.get('data'));
      const { id, ...patch } = data;
      await client.service('practices' as any).patch(id, patch);
      return json({ ok: true, intent });
    }

    if (intent === 'delete-practice') {
      const id = formData.get('id') as string;
      await client.service('practices' as any).remove(id);
      return json({ ok: true, intent });
    }

    if (intent === 'save-code') {
      const data = parseFormJson<{
        accountingSettingsId: string | null;
        insurerId: string;
        practiceKey: string;
        code: string;
      }>(formData.get('data'));

      if (!data.accountingSettingsId) {
        // Create accounting-settings record first
        const newSettings = await client.service('accounting-settings' as any).create({
          userId: user.id,
          insurerPrices: {
            [data.insurerId]: {
              [data.practiceKey]: { type: 'fixed', code: data.code },
            },
          },
        });
        return json({ ok: true, intent, accountingSettingsId: newSettings.id });
      }

      // Fetch current settings to merge
      const current = await client.service('accounting-settings' as any).get(data.accountingSettingsId);
      const prices = { ...(current.insurerPrices || {}) };
      const insurerPricing = { ...(prices[data.insurerId] || {}) };
      const existingConfig = toPricingConfig(insurerPricing[data.practiceKey]);
      insurerPricing[data.practiceKey] = { ...existingConfig, code: data.code };
      prices[data.insurerId] = insurerPricing;

      await client.service('accounting-settings' as any).patch(data.accountingSettingsId, {
        insurerPrices: prices,
      });

      return json({ ok: true, intent });
    }

    if (intent === 'remove-code') {
      const data = parseFormJson<{
        accountingSettingsId: string;
        insurerId: string;
        practiceKey: string;
      }>(formData.get('data'));

      const current = await client.service('accounting-settings' as any).get(data.accountingSettingsId);
      const prices = { ...(current.insurerPrices || {}) };
      const insurerPricing = { ...(prices[data.insurerId] || {}) };
      const existingConfig = toPricingConfig(insurerPricing[data.practiceKey]);
      delete existingConfig.code;
      insurerPricing[data.practiceKey] = existingConfig;
      prices[data.insurerId] = insurerPricing;

      await client.service('accounting-settings' as any).patch(data.accountingSettingsId, {
        insurerPrices: prices,
      });

      return json({ ok: true, intent });
    }

    return json({ ok: false, error: 'Unknown intent' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error.message || 'Unknown error' }, { status: 500 });
  }
};

function AddCodeForm({
  practiceKey,
  accountingSettingsId,
  existingInsurerIds,
}: {
  practiceKey: string;
  accountingSettingsId: string | null;
  existingInsurerIds: string[];
}) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [insurerId, setInsurerId] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = useCallback(() => {
    if (!insurerId || !code.trim()) return;

    fetcher.submit(
      {
        intent: 'save-code',
        data: JSON.stringify({ accountingSettingsId, insurerId, practiceKey, code: code.trim() }),
      },
      { method: 'post' }
    );

    setInsurerId('');
    setCode('');
    setTimeout(() => revalidator.revalidate(), 300);
  }, [accountingSettingsId, insurerId, practiceKey, code, fetcher, revalidator]);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.currentTarget.value);
  }, []);

  const handleInsurerChange = useCallback((id: string) => {
    setInsurerId(id);
  }, []);

  return (
    <Flex gap="sm" align="flex-end" p="sm" wrap="wrap">
      <TextInput
        placeholder={t('settings.practices_code_placeholder', 'Código')}
        value={code}
        onChange={handleCodeChange}
        style={{ flex: '0 0 120px' }}
        size="sm"
      />
      <div style={{ flex: 1, minWidth: 200 }}>
        <PrepagaSelector
          value={insurerId}
          onChange={handleInsurerChange}
          placeholder={t('settings.practices_insurer_placeholder', 'Buscar prepaga...')}
          variant="default"
        />
      </div>
      <Button
        size="sm"
        leftSection={<PlusIcon size={14} />}
        onClick={handleSubmit}
        disabled={!insurerId || !code.trim() || existingInsurerIds.includes(insurerId)}
        loading={fetcher.state !== 'idle'}
      >
        {t('settings.practices_add_code', 'Agregar')}
      </Button>
    </Flex>
  );
}

function PracticeCard({
  practice,
  codes,
  accountingSettingsId,
  practiceKey,
}: {
  practice: Practice;
  codes: InsurerCode[];
  accountingSettingsId: string | null;
  practiceKey: string;
}) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const handleRemoveCode = useCallback(
    (insurerId: string) => {
      if (!accountingSettingsId) return;
      fetcher.submit(
        {
          intent: 'remove-code',
          data: JSON.stringify({ accountingSettingsId, insurerId, practiceKey }),
        },
        { method: 'post' }
      );
      setTimeout(() => revalidator.revalidate(), 300);
    },
    [accountingSettingsId, practiceKey, fetcher, revalidator]
  );

  const handleUpdatePractice = useCallback(
    (field: 'title' | 'description', value: string) => {
      if (practice.isSystem) return;
      fetcher.submit(
        {
          intent: 'update-practice',
          data: JSON.stringify({ id: practice.id, [field]: value }),
        },
        { method: 'post' }
      );
    },
    [practice.id, practice.isSystem, fetcher]
  );

  const handleDeletePractice = useCallback(() => {
    fetcher.submit(
      { intent: 'delete-practice', id: practice.id },
      { method: 'post' }
    );
    setTimeout(() => revalidator.revalidate(), 300);
  }, [practice.id, fetcher, revalidator]);

  const [editTitle, setEditTitle] = useState(practice.title);
  const [editDescription, setEditDescription] = useState(practice.description);

  const handleTitleBlur = useCallback(() => {
    if (editTitle.trim() && editTitle !== practice.title) {
      handleUpdatePractice('title', editTitle.trim());
    }
  }, [editTitle, practice.title, handleUpdatePractice]);

  const handleDescriptionBlur = useCallback(() => {
    if (editDescription.trim() && editDescription !== practice.description) {
      handleUpdatePractice('description', editDescription.trim());
    }
  }, [editDescription, practice.description, handleUpdatePractice]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.currentTarget.value);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditDescription(e.currentTarget.value);
  }, []);

  const existingInsurerIds = useMemo(() => codes.map(c => c.insurerId), [codes]);

  return (
    <FormCard>
      <FieldRow>
        <Label>{t('settings.practices_title', 'Título')}:</Label>
        {practice.isSystem && (
          <Group gap="xs" style={{ flex: 1 }}>
            <Text size="sm">{practice.title}</Text>
            <LockSimpleIcon size={14} color="var(--mantine-color-gray-5)" />
          </Group>
        )}
        {!practice.isSystem && (
          <TextInput
            variant="unstyled"
            value={editTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            style={{ flex: 1 }}
            styles={{ input: { minHeight: '1.5rem', height: 'auto', lineHeight: 1.75 } }}
          />
        )}
      </FieldRow>

      <FieldRow>
        <Label>{t('settings.practices_description', 'Descripción')}:</Label>
        {practice.isSystem && (
          <Group gap="xs" style={{ flex: 1 }}>
            <Text size="sm">{practice.description}</Text>
            <LockSimpleIcon size={14} color="var(--mantine-color-gray-5)" />
          </Group>
        )}
        {!practice.isSystem && (
          <Textarea
            variant="unstyled"
            value={editDescription}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            autosize
            style={{ flex: 1 }}
            styles={{ input: { minHeight: '1.5rem', lineHeight: 1.75 } }}
          />
        )}
      </FieldRow>

      {codes.length > 0 && (
        <div>
          <Text size="xs" fw={600} c="dimmed" px="md" pt="xs">
            {t('settings.practices_insurer_codes', 'Códigos por prepaga')}
          </Text>
          {codes.map(c => (
            <CodeRow key={c.insurerId}>
              <Text size="sm" style={{ flex: 1 }}>
                {c.insurerName}
              </Text>
              <Badge variant="light" size="lg">
                {c.code}
              </Badge>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => handleRemoveCode(c.insurerId)}
              >
                <TrashIcon size={14} />
              </ActionIcon>
            </CodeRow>
          ))}
        </div>
      )}

      <AddCodeForm
        practiceKey={practiceKey}
        accountingSettingsId={accountingSettingsId}
        existingInsurerIds={existingInsurerIds}
      />

      {!practice.isSystem && (
        <Flex justify="flex-end" p="sm">
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<TrashIcon size={14} />}
            onClick={handleDeletePractice}
            loading={fetcher.state !== 'idle'}
          >
            {t('settings.practices_delete', 'Eliminar práctica')}
          </Button>
        </Flex>
      )}
    </FormCard>
  );
}

export default function SettingsPracticesPage() {
  const { t } = useTranslation();
  const { practices, insurerPrices, accountingSettingsId, prepagas } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const fetcher = useFetcher();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const createForm = useForm({
    initialValues: { title: '', description: '' },
    validate: {
      title: v => (v.trim() ? null : t('settings.practices_title_required', 'Título requerido')),
      description: v => (v.trim() ? null : t('settings.practices_description_required', 'Descripción requerida')),
    },
  });

  const handleCreate = useCallback(
    (values: { title: string; description: string }) => {
      fetcher.submit(
        {
          intent: 'create-practice',
          data: JSON.stringify(values),
        },
        { method: 'post' }
      );
      closeCreate();
      createForm.reset();
      setTimeout(() => revalidator.revalidate(), 300);
    },
    [fetcher, closeCreate, createForm, revalidator]
  );

  const systemPractices = useMemo(
    () => practices.filter((p: Practice) => p.isSystem),
    [practices]
  );
  const customPractices = useMemo(
    () => practices.filter((p: Practice) => !p.isSystem),
    [practices]
  );

  return (
    <Stack gap="lg">
      <Title order={3}>{t('settings.practices_heading', 'Prácticas')}</Title>

      {systemPractices.length > 0 && (
        <Stack gap="sm">
          <Text size="sm" fw={600} c="dimmed">
            {t('settings.practices_system', 'Prácticas del sistema')}
          </Text>
          {systemPractices.map((practice: Practice) => {
            const key = getPracticeKey(practice);
            const codes = extractCodesForPractice(insurerPrices, key, prepagas);
            return (
              <PracticeCard
                key={practice.id}
                practice={practice}
                codes={codes}
                accountingSettingsId={accountingSettingsId}
                practiceKey={key}
              />
            );
          })}
        </Stack>
      )}

      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={600} c="dimmed">
            {t('settings.practices_custom', 'Prácticas personalizadas')}
          </Text>
          <Button size="xs" leftSection={<PlusIcon size={14} />} onClick={openCreate}>
            {t('settings.practices_add', 'Nueva práctica')}
          </Button>
        </Group>
        {customPractices.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            {t('settings.practices_empty', 'No hay prácticas personalizadas aún.')}
          </Text>
        )}
        {customPractices.map((practice: Practice) => {
          const key = getPracticeKey(practice);
          const codes = extractCodesForPractice(insurerPrices, key, prepagas);
          return (
            <PracticeCard
              key={practice.id}
              practice={practice}
              codes={codes}
              accountingSettingsId={accountingSettingsId}
              practiceKey={key}
            />
          );
        })}
      </Stack>

      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title={t('settings.practices_new_title', 'Nueva práctica')}
      >
        <form onSubmit={createForm.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput
              label={t('settings.practices_title', 'Título')}
              placeholder={t('settings.practices_title_placeholder', 'Nombre de la práctica')}
              {...createForm.getInputProps('title')}
            />
            <Textarea
              label={t('settings.practices_description', 'Descripción')}
              placeholder={t('settings.practices_description_placeholder', 'Descripción de la práctica')}
              autosize
              minRows={2}
              {...createForm.getInputProps('description')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeCreate}>
                {t('common.cancel', 'Cancelar')}
              </Button>
              <Button type="submit" loading={fetcher.state !== 'idle'}>
                {t('common.create', 'Crear')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
