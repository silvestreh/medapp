import { useCallback, useMemo, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useRevalidator } from '@remix-run/react';
import { Button, Group, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { PlusIcon, LockSimpleIcon, FirstAidKitIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient, getCurrentOrgRoleIds, authenticatedLoader } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormCard, SectionTitle } from '~/components/forms/styles';
import Portal from '~/components/portal';
import { parseFormJson } from '~/utils/parse-form-json';
import { styled } from '~/styled-system/jsx';
import type { Practice, PracticeCodeRecord, Prepaga, InsurerCode } from '~/components/practices/types';
import { InsurerTags } from '~/components/practices/insurer-tags';
import { PracticeDrawer } from '~/components/practices/practice-drawer';

const ClickableRow = styled('tr', {
  base: {
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-0)',
    },
  },
});

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
              <Table.Th fw={400} py="xs" pl="lg">
                {t('settings.practices_col_name', 'Nombre')}
              </Table.Th>
              <Table.Th fw={400} py="xs">
                {t('settings.practices_col_insurers', 'Prepagas')}
              </Table.Th>
              <Table.Th fw={400} py="xs" pr="lg" style={{ width: 40 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allPractices.map((practice: Practice) => {
              const practiceCodes = codesByPracticeId.get(practice.id) || [];
              return (
                <ClickableRow key={practice.id} onClick={() => handleRowClick(practice)}>
                  <Table.Td pl="lg">
                    <Group gap="xs">
                      <Text size="sm">{practice.title}</Text>
                      {practice.isSystem && <LockSimpleIcon size={12} color="var(--mantine-color-gray-5)" />}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <InsurerTags codes={practiceCodes} />
                  </Table.Td>
                  <Table.Td pr="lg">
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
