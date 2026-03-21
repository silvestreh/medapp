import { useCallback, useMemo, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useRevalidator } from '@remix-run/react';
import { ActionIcon, Badge, Button, Drawer, Flex, Group, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  TrashIcon,
  LockSimpleIcon,
  FirstAidKitIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
} from '@phosphor-icons/react';

import { getAuthenticatedClient, getCurrentOrgRoleIds, authenticatedLoader } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormCard, FieldRow, SectionTitle } from '~/components/forms/styles';
import { PrepagaSelector } from '~/components/prepaga-selector';
import Portal from '~/components/portal';
import { parseFormJson } from '~/utils/parse-form-json';
import { styled } from '~/styled-system/jsx';

interface Practice {
  id: string;
  title: string;
  description: string;
  isSystem: boolean;
  systemKey: string | null;
}

interface PracticeCodeRecord {
  id: string;
  practiceId: string;
  userId: string;
  insurerId: string;
  code: string;
}

interface Prepaga {
  id: string;
  shortName: string;
  denomination: string;
}

interface InsurerCode {
  id: string;
  insurerId: string;
  insurerShortName: string;
  code: string;
}

const MAX_VISIBLE_TAGS = 5;

const ClickableRow = styled('tr', {
  base: {
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-0)',
    },
  },
});

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const orgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, orgId);

  const canAccess =
    orgRoleIds.includes('medic') || orgRoleIds.includes('prescriber') || orgRoleIds.includes('accounting');
  if (!canAccess) {
    throw json({ error: 'Not authorized' }, { status: 403 });
  }

  const [practicesResponse, codesResponse] = await Promise.all([
    client.service('practices' as any).find({ query: { $limit: 200 } }),
    client.service('practice-codes' as any).find({ query: { $limit: 500 } }),
  ]);

  const practices: Practice[] = Array.isArray(practicesResponse)
    ? practicesResponse
    : ((practicesResponse as any)?.data ?? []);

  const codes: PracticeCodeRecord[] = Array.isArray(codesResponse)
    ? codesResponse
    : ((codesResponse as any)?.data ?? []);

  const insurerIdSet = new Set(codes.map(c => c.insurerId));
  let prepagas: Prepaga[] = [];
  if (insurerIdSet.size > 0) {
    const prepagasResponse = await client.service('prepagas').find({
      query: { id: { $in: [...insurerIdSet] }, $limit: 200 },
    });
    prepagas = Array.isArray(prepagasResponse) ? prepagasResponse : ((prepagasResponse as any)?.data ?? []);
  }

  return json({ practices, codes, prepagas });
});

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  try {
    if (intent === 'create-practice') {
      const data = parseFormJson<{ title: string; description: string }>(formData.get('data'));
      const created: any = await client.service('practices' as any).create(data);
      return json({ ok: true, intent, practiceId: created.id });
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
      const data = parseFormJson<{ practiceId: string; insurerId: string; code: string }>(formData.get('data'));
      await client.service('practice-codes' as any).create({
        practiceId: data.practiceId,
        insurerId: data.insurerId,
        code: data.code,
      });
      return json({ ok: true, intent });
    }

    if (intent === 'update-code') {
      const data = parseFormJson<{ codeId: string; code?: string; insurerId?: string }>(formData.get('data'));
      const { codeId, ...patch } = data;
      await client.service('practice-codes' as any).patch(codeId, patch);
      return json({ ok: true, intent });
    }

    if (intent === 'remove-code') {
      const data = parseFormJson<{ codeId: string }>(formData.get('data'));
      await client.service('practice-codes' as any).remove(data.codeId);
      return json({ ok: true, intent });
    }

    return json({ ok: false, error: 'Unknown intent' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error.message || 'Unknown error' }, { status: 500 });
  }
};

// ---------------------------------------------------------------------------
// Insurer tags for table rows
// ---------------------------------------------------------------------------

function InsurerTags({ codes }: { codes: InsurerCode[] }) {
  if (codes.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }

  const visible = codes.slice(0, MAX_VISIBLE_TAGS);
  const remaining = codes.length - MAX_VISIBLE_TAGS;

  return (
    <Group gap={4} wrap="wrap">
      {visible.map(c => (
        <Badge key={c.id} variant="light" size="sm">
          {c.insurerShortName}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="light" size="sm" color="gray">
          +{remaining} más
        </Badge>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Practice detail drawer
// ---------------------------------------------------------------------------

function PracticeDrawer({
  practice,
  codes,
  opened,
  onClose,
  isCreateMode,
}: {
  practice: Practice | null;
  codes: InsurerCode[];
  opened: boolean;
  onClose: () => void;
  isCreateMode?: boolean;
}) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newInsurerId, setNewInsurerId] = useState('');
  const [newCode, setNewCode] = useState('');
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState('');
  const [editingInsurerId, setEditingInsurerId] = useState<string | null>(null);
  const [editingInsurerValue, setEditingInsurerValue] = useState('');
  const [createdPracticeId, setCreatedPracticeId] = useState<string | null>(null);

  // Sync local state when practice changes or create mode
  const practiceId = practice?.id;
  useMemo(() => {
    if (isCreateMode) {
      setEditTitle('');
      setEditDescription('');
      setCreatedPracticeId(null);
    } else if (practice) {
      setEditTitle(practice.title);
      setEditDescription(practice.description);
    }
    setNewInsurerId('');
    setNewCode('');
    setEditingCodeId(null);
    setEditingInsurerId(null);
  }, [practiceId, isCreateMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture the new practice ID after creation so codes can be added
  useMemo(() => {
    const data = fetcher.data as any;
    if (data?.ok && data?.intent === 'create-practice' && data?.practiceId) {
      setCreatedPracticeId(data.practiceId);
    }
  }, [fetcher.data]);

  const effectivePracticeId = practice?.id || createdPracticeId;
  const isSystem = practice?.isSystem ?? false;
  const isNew = isCreateMode && !createdPracticeId;

  const handleTitleBlur = useCallback(() => {
    if (isSystem || !effectivePracticeId) return;
    if (editTitle.trim() && editTitle !== practice?.title) {
      fetcher.submit(
        { intent: 'update-practice', data: JSON.stringify({ id: effectivePracticeId, title: editTitle.trim() }) },
        { method: 'post' }
      );
      setTimeout(() => revalidator.revalidate(), 300);
    }
  }, [isSystem, effectivePracticeId, practice?.title, editTitle, fetcher, revalidator]);

  const handleDescriptionBlur = useCallback(() => {
    if (isSystem || !effectivePracticeId) return;
    if (editDescription.trim() && editDescription !== practice?.description) {
      fetcher.submit(
        {
          intent: 'update-practice',
          data: JSON.stringify({ id: effectivePracticeId, description: editDescription.trim() }),
        },
        { method: 'post' }
      );
      setTimeout(() => revalidator.revalidate(), 300);
    }
  }, [isSystem, effectivePracticeId, practice?.description, editDescription, fetcher, revalidator]);

  const handleCreatePractice = useCallback(() => {
    if (!editTitle.trim() || !editDescription.trim()) return;
    fetcher.submit(
      {
        intent: 'create-practice',
        data: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
      },
      { method: 'post' }
    );
    setTimeout(() => revalidator.revalidate(), 300);
  }, [editTitle, editDescription, fetcher, revalidator]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.currentTarget.value);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditDescription(e.currentTarget.value);
  }, []);

  const handleAddCode = useCallback(() => {
    if (!effectivePracticeId || !newInsurerId || !newCode.trim()) return;
    fetcher.submit(
      {
        intent: 'save-code',
        data: JSON.stringify({ practiceId: effectivePracticeId, insurerId: newInsurerId, code: newCode.trim() }),
      },
      { method: 'post' }
    );
    setNewInsurerId('');
    setNewCode('');
    setTimeout(() => revalidator.revalidate(), 300);
  }, [effectivePracticeId, newInsurerId, newCode, fetcher, revalidator]);

  const handleRemoveCode = useCallback(
    (codeId: string) => {
      fetcher.submit({ intent: 'remove-code', data: JSON.stringify({ codeId }) }, { method: 'post' });
      setTimeout(() => revalidator.revalidate(), 300);
    },
    [fetcher, revalidator]
  );

  const handleDelete = useCallback(() => {
    if (!effectivePracticeId) return;
    fetcher.submit({ intent: 'delete-practice', id: effectivePracticeId }, { method: 'post' });
    setTimeout(() => {
      revalidator.revalidate();
      onClose();
    }, 300);
  }, [effectivePracticeId, fetcher, revalidator, onClose]);

  const handleNewCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCode(e.currentTarget.value);
  }, []);

  const handleNewInsurerChange = useCallback((id: string) => {
    setNewInsurerId(id);
  }, []);

  const handleStartEditCode = useCallback((code: InsurerCode) => {
    setEditingCodeId(code.id);
    setEditingCodeValue(code.code);
  }, []);

  const handleCancelEditCode = useCallback(() => {
    setEditingCodeId(null);
    setEditingCodeValue('');
  }, []);

  const handleSaveEditCode = useCallback(() => {
    if (!editingCodeId || !editingCodeValue.trim()) return;
    fetcher.submit(
      { intent: 'update-code', data: JSON.stringify({ codeId: editingCodeId, code: editingCodeValue.trim() }) },
      { method: 'post' }
    );
    setEditingCodeId(null);
    setEditingCodeValue('');
    setTimeout(() => revalidator.revalidate(), 300);
  }, [editingCodeId, editingCodeValue, fetcher, revalidator]);

  const handleEditCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingCodeValue(e.currentTarget.value);
  }, []);

  const handleEditCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSaveEditCode();
      if (e.key === 'Escape') handleCancelEditCode();
    },
    [handleSaveEditCode, handleCancelEditCode]
  );

  const handleStartEditInsurer = useCallback((code: InsurerCode) => {
    setEditingInsurerId(code.id);
    setEditingInsurerValue(code.insurerId);
  }, []);

  const handleCancelEditInsurer = useCallback(() => {
    setEditingInsurerId(null);
    setEditingInsurerValue('');
  }, []);

  const handleSaveEditInsurer = useCallback(() => {
    if (!editingInsurerId || !editingInsurerValue) return;
    fetcher.submit(
      { intent: 'update-code', data: JSON.stringify({ codeId: editingInsurerId, insurerId: editingInsurerValue }) },
      { method: 'post' }
    );
    setEditingInsurerId(null);
    setEditingInsurerValue('');
    setTimeout(() => revalidator.revalidate(), 300);
  }, [editingInsurerId, editingInsurerValue, fetcher, revalidator]);

  const handleEditInsurerChange = useCallback((id: string) => {
    setEditingInsurerValue(id);
  }, []);

  const existingInsurerIds = useMemo(() => codes.map(c => c.insurerId), [codes]);

  const drawerTitle = isCreateMode
    ? t('settings.practices_new_title', 'Nueva práctica')
    : isSystem
      ? practice?.title
      : t('settings.practices_edit', 'Editar práctica');

  if (!isCreateMode && !practice) return null;

  return (
    <Drawer opened={opened} onClose={onClose} title={drawerTitle} position="right" size="lg">
      <Stack gap="md">
        {/* Title & Description */}
        <FormCard>
          <FieldRow label={`${t('settings.practices_title', 'Título')}:`}>
            {isSystem && (
              <Group gap="xs" style={{ flex: 1 }}>
                <Text size="sm">{practice?.title}</Text>
                <LockSimpleIcon size={14} color="var(--mantine-color-gray-5)" />
              </Group>
            )}
            {!isSystem && (
              <TextInput
                variant="unstyled"
                value={editTitle}
                onChange={handleTitleChange}
                onBlur={isNew ? undefined : handleTitleBlur}
                placeholder={t('settings.practices_title_placeholder', 'Nombre de la práctica')}
                style={{ flex: 1 }}
                styles={{ input: { minHeight: '1.5rem', height: 'auto', lineHeight: 1.75 } }}
              />
            )}
          </FieldRow>
          <FieldRow label={`${t('settings.practices_description', 'Descripción')}:`}>
            {isSystem && (
              <Group gap="xs" style={{ flex: 1 }}>
                <Text size="sm">{practice?.description}</Text>
                <LockSimpleIcon size={14} color="var(--mantine-color-gray-5)" />
              </Group>
            )}
            {!isSystem && (
              <Textarea
                variant="unstyled"
                value={editDescription}
                onChange={handleDescriptionChange}
                onBlur={isNew ? undefined : handleDescriptionBlur}
                placeholder={t('settings.practices_description_placeholder', 'Descripción de la práctica')}
                autosize
                style={{ flex: 1 }}
                styles={{ input: { lineHeight: 1.75 } }}
              />
            )}
          </FieldRow>
        </FormCard>

        {/* Create button — only in create mode before practice is saved */}
        {isNew && (
          <Button
            onClick={handleCreatePractice}
            disabled={!editTitle.trim() || !editDescription.trim()}
            loading={fetcher.state !== 'idle'}
          >
            {t('settings.practices_create_and_continue', 'Crear práctica')}
          </Button>
        )}

        {/* Insurer codes — only after practice exists */}
        {!isNew && (
          <>
            <div>
              <Text size="sm" fw={600} mb="xs">
                {t('settings.practices_insurer_codes', 'Códigos por prepaga')}
              </Text>
              <FormCard>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th fw={400}>{t('settings.practices_col_insurer', 'Prepaga')}</Table.Th>
                      <Table.Th fw={400}>{t('settings.practices_col_code', 'Código')}</Table.Th>
                      <Table.Th fw={400} style={{ width: 80 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {codes.map(c => (
                      <Table.Tr key={c.id}>
                        <Table.Td>
                          {editingInsurerId === c.id && (
                            <Group gap={4}>
                              <div style={{ flex: 1, minWidth: 180 }}>
                                <PrepagaSelector
                                  value={editingInsurerValue}
                                  onChange={handleEditInsurerChange}
                                  placeholder={t('settings.practices_insurer_placeholder', 'Buscar prepaga...')}
                                  variant="default"
                                />
                              </div>
                              <ActionIcon variant="subtle" color="teal" size="sm" onClick={handleSaveEditInsurer}>
                                <CheckIcon size={14} />
                              </ActionIcon>
                              <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleCancelEditInsurer}>
                                <XIcon size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                          {editingInsurerId !== c.id && (
                            <Group gap={4}>
                              <Text size="sm">{c.insurerShortName}</Text>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={() => handleStartEditInsurer(c)}
                              >
                                <PencilSimpleIcon size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {editingCodeId === c.id && (
                            <Group gap={4}>
                              <TextInput
                                size="xs"
                                value={editingCodeValue}
                                onChange={handleEditCodeChange}
                                onKeyDown={handleEditCodeKeyDown}
                                autoFocus
                                style={{ maxWidth: 160 }}
                              />
                              <ActionIcon variant="subtle" color="teal" size="sm" onClick={handleSaveEditCode}>
                                <CheckIcon size={14} />
                              </ActionIcon>
                              <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleCancelEditCode}>
                                <XIcon size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                          {editingCodeId !== c.id && (
                            <Group gap={4}>
                              <Text size="sm">{c.code}</Text>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={() => handleStartEditCode(c)}
                              >
                                <PencilSimpleIcon size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemoveCode(c.id)}>
                            <TrashIcon size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {codes.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={3}>
                          <Text size="sm" c="dimmed" ta="center" py="md">
                            {t('settings.practices_no_codes', 'Sin códigos asignados.')}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </FormCard>
            </div>

            {/* Add code form */}
            <Flex gap="sm" align="flex-end" wrap="wrap">
              <TextInput
                placeholder={t('settings.practices_code_placeholder', 'Código')}
                value={newCode}
                onChange={handleNewCodeChange}
                style={{ flex: '0 0 120px' }}
                size="sm"
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <PrepagaSelector
                  value={newInsurerId}
                  onChange={handleNewInsurerChange}
                  placeholder={t('settings.practices_insurer_placeholder', 'Buscar prepaga...')}
                  variant="default"
                />
              </div>
              <Button
                size="sm"
                leftSection={<PlusIcon size={14} />}
                onClick={handleAddCode}
                disabled={!newInsurerId || !newCode.trim() || existingInsurerIds.includes(newInsurerId)}
                loading={fetcher.state !== 'idle'}
              >
                {t('settings.practices_add_code', 'Agregar')}
              </Button>
            </Flex>
          </>
        )}

        {/* Delete (custom only) */}
        {!isNew && !isSystem && (
          <Flex justify="flex-end" mt="md">
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<TrashIcon size={14} />}
              onClick={handleDelete}
              loading={fetcher.state !== 'idle'}
            >
              {t('settings.practices_delete', 'Eliminar práctica')}
            </Button>
          </Flex>
        )}
      </Stack>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SettingsPracticesPage() {
  const { t } = useTranslation();
  const { practices, codes, prepagas } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const prepagaMap = useMemo(() => new Map(prepagas.map((p: Prepaga) => [p.id, p])), [prepagas]);

  const codesByPracticeId = useMemo(() => {
    const map = new Map<string, InsurerCode[]>();
    for (const c of codes) {
      const prepaga = prepagaMap.get(c.insurerId);
      const entry: InsurerCode = {
        id: c.id,
        insurerId: c.insurerId,
        insurerShortName: (prepaga as Prepaga)?.shortName || c.insurerId,
        code: c.code,
      };
      const list = map.get(c.practiceId) || [];
      list.push(entry);
      map.set(c.practiceId, list);
    }
    return map;
  }, [codes, prepagaMap]);

  const handleRowClick = useCallback(
    (practice: Practice) => {
      setSelectedPractice(practice);
      setIsCreateMode(false);
      openDrawer();
    },
    [openDrawer]
  );

  const handleNewPractice = useCallback(() => {
    setSelectedPractice(null);
    setIsCreateMode(true);
    openDrawer();
  }, [openDrawer]);

  const handleDrawerClose = useCallback(() => {
    closeDrawer();
    setIsCreateMode(false);
    setTimeout(() => revalidator.revalidate(), 300);
  }, [closeDrawer, revalidator]);

  const allPractices = useMemo(() => {
    const system = practices.filter((p: Practice) => p.isSystem);
    const custom = practices.filter((p: Practice) => !p.isSystem);
    return [...system, ...custom];
  }, [practices]);

  return (
    <Stack gap={0}>
      <Portal id="form-actions">
        <Button
          size="xs"
          leftSection={<PlusIcon size={14} />}
          onClick={handleNewPractice}
          style={{ marginLeft: 'auto' }}
        >
          {t('settings.practices_add', 'Nueva práctica')}
        </Button>
      </Portal>

      <SectionTitle id="practices" icon={<FirstAidKitIcon />} mb="md">
        {t('settings.practices_heading', 'Prácticas')}
      </SectionTitle>

      <FormCard>
        <Table highlightOnHover verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th fw={400} py="xs">
                {t('settings.practices_col_name', 'Nombre')}
              </Table.Th>
              <Table.Th fw={400} py="xs">
                {t('settings.practices_col_insurers', 'Prepagas')}
              </Table.Th>
              <Table.Th fw={400} py="xs" style={{ width: 40 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allPractices.map((practice: Practice) => {
              const practiceCodes = codesByPracticeId.get(practice.id) || [];
              return (
                <ClickableRow key={practice.id} onClick={() => handleRowClick(practice)}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm">{practice.title}</Text>
                      {practice.isSystem && <LockSimpleIcon size={12} color="var(--mantine-color-gray-5)" />}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <InsurerTags codes={practiceCodes} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {practiceCodes.length}
                    </Text>
                  </Table.Td>
                </ClickableRow>
              );
            })}
            {allPractices.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    {t('settings.practices_empty', 'No hay prácticas aún.')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </FormCard>

      <PracticeDrawer
        practice={selectedPractice}
        codes={selectedPractice ? codesByPracticeId.get(selectedPractice.id) || [] : []}
        opened={drawerOpened}
        onClose={handleDrawerClose}
        isCreateMode={isCreateMode}
      />
    </Stack>
  );
}
