import { useCallback, useMemo, useState } from 'react';
import { ActionIcon, Button, Drawer, Flex, Group, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { useFetcher, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon, LockSimpleIcon, PencilSimpleIcon, CheckIcon, XIcon } from '@phosphor-icons/react';

import { FormCard, FieldRow } from '~/components/forms/styles';
import { PrepagaSelector } from '~/components/prepaga-selector';
import type { Practice, InsurerCode } from './types';

interface PracticeDrawerProps {
  practice: Practice | null;
  codes: InsurerCode[];
  opened: boolean;
  onClose: () => void;
  isCreateMode?: boolean;
  onCreated?: (practiceId: string) => void;
  selectedMedicId?: string;
}

export function PracticeDrawer({
  practice,
  codes,
  opened,
  onClose,
  isCreateMode,
  onCreated,
  selectedMedicId,
}: PracticeDrawerProps) {
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

  useMemo(() => {
    const data = fetcher.data as any;
    if (data?.ok && data?.intent === 'create-practice' && data?.practiceId) {
      setCreatedPracticeId(data.practiceId);
      onCreated?.(data.practiceId);
    }
  }, [fetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const codeData: Record<string, string> = {
      practiceId: effectivePracticeId,
      insurerId: newInsurerId,
      code: newCode.trim(),
    };
    if (selectedMedicId) {
      codeData.userId = selectedMedicId;
    }
    fetcher.submit({ intent: 'save-code', data: JSON.stringify(codeData) }, { method: 'post' });
    setNewInsurerId('');
    setNewCode('');
    setTimeout(() => revalidator.revalidate(), 300);
  }, [effectivePracticeId, newInsurerId, newCode, selectedMedicId, fetcher, revalidator]);

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
    ? t('settings.practices_new_title')
    : isSystem
      ? practice?.title
      : t('settings.practices_edit');

  if (!isCreateMode && !practice) return null;

  return (
    <Drawer opened={opened} onClose={onClose} title={drawerTitle} position="right" size="lg">
      <Stack gap="md">
        <FormCard>
          <FieldRow label={`${t('settings.practices_title')}:`}>
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
                placeholder={t('settings.practices_title_placeholder')}
                style={{ flex: 1 }}
                styles={{ input: { minHeight: '1.5rem', height: 'auto', lineHeight: 1.75 } }}
              />
            )}
          </FieldRow>
          <FieldRow label={`${t('settings.practices_description')}:`}>
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
                placeholder={t('settings.practices_description_placeholder')}
                autosize
                style={{ flex: 1 }}
                styles={{ input: { lineHeight: 1.75 } }}
              />
            )}
          </FieldRow>
        </FormCard>

        {isNew && (
          <Button
            onClick={handleCreatePractice}
            disabled={!editTitle.trim() || !editDescription.trim()}
            loading={fetcher.state !== 'idle'}
          >
            {t('settings.practices_create_and_continue')}
          </Button>
        )}

        {!isNew && (
          <>
            <div>
              <Text size="sm" fw={600} mb="xs">
                {t('settings.practices_insurer_codes')}
              </Text>
              <FormCard>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th fw={400}>{t('settings.practices_col_insurer')}</Table.Th>
                      <Table.Th fw={400}>{t('settings.practices_col_code')}</Table.Th>
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
                                  placeholder={t('settings.practices_insurer_placeholder')}
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
                                style={{ flex: 1 }}
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
                            {t('settings.practices_no_codes')}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </FormCard>
            </div>

            <Flex gap="sm" align="flex-end" wrap="wrap">
              <TextInput
                placeholder={t('settings.practices_code_placeholder')}
                value={newCode}
                onChange={handleNewCodeChange}
                style={{ flex: '0 0 120px' }}
                size="sm"
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <PrepagaSelector
                  value={newInsurerId}
                  onChange={handleNewInsurerChange}
                  placeholder={t('settings.practices_insurer_placeholder')}
                  variant="default"
                  size="sm"
                />
              </div>
              <Button
                size="sm"
                leftSection={<PlusIcon size={14} />}
                onClick={handleAddCode}
                disabled={!newInsurerId || !newCode.trim() || existingInsurerIds.includes(newInsurerId)}
                loading={fetcher.state !== 'idle'}
              >
                {t('settings.practices_add_code')}
              </Button>
            </Flex>
          </>
        )}

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
              {t('settings.practices_delete')}
            </Button>
          </Flex>
        )}
      </Stack>
    </Drawer>
  );
}
