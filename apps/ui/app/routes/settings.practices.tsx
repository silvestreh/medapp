import { useCallback, useMemo, useState } from 'react';
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useNavigate, useRevalidator } from '@remix-run/react';
import { Button, Group, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { PlusIcon, LockSimpleIcon, FirstAidKitIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient, getCurrentOrgRoleIds, authenticatedLoader } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormCard, SectionTitle } from '~/components/forms/styles';
import Portal from '~/components/portal';
import MedicList from '~/components/medic-list';
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

  const isMedic = orgRoleIds.includes('medic');
  const isPrescriber = orgRoleIds.includes('prescriber');
  const isAdmin = orgRoleIds.includes('admin');
  const isAccounting = orgRoleIds.includes('accounting');
  const canAccess = isMedic || isPrescriber || isAdmin || isAccounting;
  if (!canAccess) {
    throw json({ error: 'Not authorized' }, { status: 403 });
  }

  // For non-medic users: build the list of medics they can manage codes for
  let delegatedMedics: any[] = [];
  let selectedMedicId = user.id;

  if (!isMedic) {
    const url = new URL(request.url);
    const medicIdParam = url.searchParams.get('medicId');
    const validMedicIds = new Set<string>();

    // 1. Prescribers: fetch medics via delegation records
    if (isPrescriber) {
      const delegationsResponse = await client.service('prescription-delegations' as any).find({
        query: { $limit: 200 },
      });
      const delegations = Array.isArray(delegationsResponse)
        ? delegationsResponse
        : ((delegationsResponse as any)?.data ?? []);

      for (const d of delegations) validMedicIds.add(d.medicId);
    }

    // 2. Accounting users: fetch ALL medics in the org (access via accounting:find permission)
    if (isAccounting && validMedicIds.size === 0) {
      const userRolesResponse = await client.service('user-roles').find({
        query: { roleId: 'medic', $limit: 500 },
      });
      const medicUserRoles = Array.isArray(userRolesResponse)
        ? userRolesResponse
        : ((userRolesResponse as any)?.data ?? []);

      for (const ur of medicUserRoles) validMedicIds.add(ur.userId);
    }

    if (validMedicIds.size > 0) {
      const membersResponse = await client.service('organization-users').find({
        query: { $populate: true, $limit: 200 },
      });
      const allMembers = Array.isArray(membersResponse) ? membersResponse : ((membersResponse as any)?.data ?? []);

      delegatedMedics = allMembers.filter((m: any) => m.user && validMedicIds.has(m.userId)).map((m: any) => m.user);

      const firstMedicId = delegatedMedics[0]?.id;
      selectedMedicId = medicIdParam && validMedicIds.has(medicIdParam) ? medicIdParam : firstMedicId || user.id;
    }
  }

  const codesQuery: Record<string, any> = { $limit: 500 };
  if (selectedMedicId && selectedMedicId !== user.id) {
    codesQuery.userId = selectedMedicId;
  }

  const [practicesResponse, codesResponse] = await Promise.all([
    client.service('practices' as any).find({ query: { $limit: 200 } }),
    client.service('practice-codes' as any).find({ query: codesQuery }),
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

  return json({ practices, codes, prepagas, delegatedMedics, selectedMedicId, isMedic, isAdmin });
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
      const data = parseFormJson<{ practiceId: string; insurerId: string; code: string; userId?: string }>(formData.get('data'));
      await client.service('practice-codes' as any).create({
        practiceId: data.practiceId,
        insurerId: data.insurerId,
        code: data.code,
        ...(data.userId ? { userId: data.userId } : {}),
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
  const { practices, codes, prepagas, delegatedMedics, selectedMedicId, isMedic, isAdmin } =
    useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createdPracticeId, setCreatedPracticeId] = useState<string | null>(null);

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
    setCreatedPracticeId(null);
    openDrawer();
  }, [openDrawer]);

  const handlePracticeCreated = useCallback((practiceId: string) => {
    setCreatedPracticeId(practiceId);
  }, []);

  const handleDrawerClose = useCallback(() => {
    closeDrawer();
    setIsCreateMode(false);
    setCreatedPracticeId(null);
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
          {t('settings.practices_add')}
        </Button>
      </Portal>

      <SectionTitle id="practices" icon={<FirstAidKitIcon />} mb="md">
        {t('settings.practices_heading')}
      </SectionTitle>

      {!isMedic && delegatedMedics.length > 0 && (
        <Portal id="toolbar">
          <Group gap="sm">
            <MedicList
              medics={delegatedMedics}
              value={selectedMedicId}
              onChange={v => v && navigate(`/settings/practices?medicId=${v}`)}
            />
          </Group>
        </Portal>
      )}

      <FormCard>
        <Table highlightOnHover verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th fw={400} py="xs" pl="lg">
                {t('settings.practices_col_name')}
              </Table.Th>
              <Table.Th fw={400} py="xs">
                {t('settings.practices_col_insurers')}
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
                    {t('settings.practices_empty')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </FormCard>

      <PracticeDrawer
        practice={selectedPractice}
        codes={codesByPracticeId.get(selectedPractice?.id || createdPracticeId || '') || []}
        opened={drawerOpened}
        onClose={handleDrawerClose}
        isCreateMode={isCreateMode}
        onCreated={handlePracticeCreated}
        selectedMedicId={selectedMedicId}
      />
    </Stack>
  );
}
