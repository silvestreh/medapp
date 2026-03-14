import { Fragment, useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Group, Button, Table, Badge, Text, Popover, Loader, Pagination, SegmentedControl } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { ClipboardTextIcon, PlusIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';

import { getAuthenticatedClient, authenticatedLoader, getCurrentOrgRoleIds } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import { useFind } from '~/components/provider';
import MedicList from '~/components/medic-list';
import Portal from '~/components/portal';
import { media } from '~/media';
import { Fab } from '~/components/fab';
import { PrescribeModal, type RepeatData } from '~/components/prescribe-modal';
import { PrescriptionDetail } from '~/components/prescription-detail';
import PatientSearch from '~/components/patient-search';
import { getPageTitle } from '~/utils/meta';
import RouteErrorFallback from '~/components/route-error-fallback';
import { styled } from '~/styled-system/jsx';

const statusColors: Record<string, string> = {
  pending: 'yellow',
  completed: 'green',
  cancelled: 'red',
  expired: 'gray',
};

// ---------------------------------------------------------------------------
// Styled components (matching studies-table pattern)
// ---------------------------------------------------------------------------

const CellText = styled('span', {
  base: {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'block',
    padding: 'var(--mantine-spacing-xs)',
    fontSize: 'var(--mantine-font-size-sm)',
  },
});

const EmptyState = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: '4px',
    padding: 'var(--mantine-spacing-xl)',
  },
});

const Card = styled('div', {
  base: {
    background: 'white',
    boxShadow: '0 0 0 1px var(--mantine-color-gray-2)',
    padding: 'var(--mantine-spacing-sm)',
    cursor: 'pointer',
    '&:active': {
      background: 'var(--mantine-color-gray-0)',
    },
  },
});

const CardRow = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
});

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFBFB',

    sm: {
      padding: '1em',
    },
    md: {
      padding: '2em 2em 1em',
    },
  },
});

const Title = styled('h1', {
  base: {
    fontSize: '1.5rem',
    lineHeight: 1,
    fontWeight: 700,
    flex: 1,
    margin: 0,

    md: {
      fontSize: '2rem',
    },

    lg: {
      fontSize: '2.25rem',
    },
  },
});

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'prescriptions') }];
};

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const loaderOrgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, loaderOrgId);
  const isMedic = orgRoleIds.includes('medic');

  // Fetch medics in the org
  const membersResponse = await client.service('organization-users').find({
    query: { $populate: true, $limit: 200 },
  });
  const allMembers = Array.isArray(membersResponse) ? membersResponse : ((membersResponse as any)?.data ?? []);

  const userRolesResponse = await client.service('user-roles').find({
    query: { roleId: 'medic', $limit: 500 },
  });
  const medicUserRoles = Array.isArray(userRolesResponse)
    ? userRolesResponse
    : ((userRolesResponse as any)?.data ?? []);
  const medicUserIds = new Set(medicUserRoles.map((ur: any) => ur.userId));

  const medics = allMembers.filter((m: any) => m.user && medicUserIds.has(m.userId)).map((m: any) => m.user);

  const defaultMedicId = isMedic ? user.id : medics[0]?.id || null;

  return { medics, defaultMedicId, isMedic, userId: user.id };
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'get-patient-data') {
    const raw = formData.get('data');
    const patientId = raw ? (parseFormJson(raw) as any).patientId : null;
    if (!patientId) {
      return json({ intent: 'get-patient-data', recetarioData: null, matchedPrepagaId: null, mhsPatientData: null });
    }
    const result = await client.service('recetario' as any).create({
      action: 'get-patient-data',
      patientId,
    });
    return json({
      intent: 'get-patient-data',
      recetarioData: (result as any).recetarioData,
      matchedPrepagaId: (result as any).matchedPrepagaId,
      mhsPatientData: (result as any).mhsPatientData,
    });
  }

  if (intent === 'search-recetario-medications') {
    const { search } = parseFormJson(formData.get('data')) as any;
    const result = await client.service('recetario' as any).create({ action: 'search-medications', search });
    return json({
      intent: 'search-recetario-medications',
      medications: (result as any).medications,
    });
  }

  if (intent === 'create-prescription') {
    const { diagnosis, medications, hiv, patientData, patientId, medicId } = parseFormJson(formData.get('data')) as any;
    const result = await client.service('recetario' as any).create({
      action: 'prescribe',
      patientId,
      diagnosis,
      medications,
      hiv,
      patientData,
      medicId,
    });
    return json({
      intent: 'create-prescription',
      success: true,
      url: (result as any).url ?? null,
      prescriptionId: (result as any).prescriptionId ?? null,
      recetarioDocumentId: (result as any).recetarioDocumentId ?? null,
    });
  }

  if (intent === 'create-order') {
    const { diagnosis, content, patientData, patientId, medicId } = parseFormJson(formData.get('data')) as any;
    const result = await client.service('recetario' as any).create({
      action: 'order',
      patientId,
      diagnosis,
      content,
      patientData,
      medicId,
    });
    return json({
      intent: 'create-order',
      success: true,
      url: (result as any).url ?? null,
      prescriptionId: (result as any).prescriptionId ?? null,
      recetarioDocumentId: (result as any).recetarioDocumentId ?? null,
    });
  }

  if (intent === 'cancel-prescription') {
    const { prescriptionId, recetarioDocumentId } = parseFormJson(formData.get('data')) as any;
    await client.service('recetario' as any).create({ action: 'cancel', prescriptionId, recetarioDocumentId });
    return json({ intent: 'cancel-prescription', success: true });
  }

  if (intent === 'share-prescription') {
    const { prescriptionId, documentIds, shareChannel, shareRecipient, pdfUrl } = parseFormJson(
      formData.get('data')
    ) as any;
    await client.service('recetario' as any).create({
      action: 'share',
      prescriptionId,
      documentIds,
      shareChannel,
      shareRecipient,
      pdfUrl,
    });
    return json({ intent: 'share-prescription', success: true });
  }

  return json({ error: 'Unknown intent' }, { status: 400 });
};

const PAGE_SIZE = 25;

const stickyHeaderStyle = {
  position: 'sticky' as const,
  top: '4.8em',
  zIndex: 3,
  background: 'var(--mantine-primary-color-0)',
};

export default function PrescriptionsPage() {
  const { medics, defaultMedicId } = useLoaderData<typeof loader>();
  const { t } = useTranslation();
  const isDesktop = useMediaQuery(media.md);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedMedicId = searchParams.get('medicId') || defaultMedicId;
  const selectedPatientId = searchParams.get('patientId') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [prescribeOpened, { open: openPrescribe, close: closePrescribe }] = useDisclosure(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [repeatPrescription, setRepeatPrescription] = useState<any>(null);

  const selectedType = searchParams.get('type') || 'all';

  const query = useMemo(() => {
    const q: Record<string, any> = {
      $sort: { createdAt: -1 },
      $limit: PAGE_SIZE,
      $skip: (page - 1) * PAGE_SIZE,
    };
    if (selectedMedicId) q.medicId = selectedMedicId;
    if (selectedPatientId) q.patientId = selectedPatientId;
    if (selectedType !== 'all') q.type = selectedType;
    return q;
  }, [selectedMedicId, selectedPatientId, selectedType, page]);

  const { response: prescriptionsResult, status } = useFind('prescriptions', query, { enabled: !!selectedMedicId });

  const prescriptions: any[] = useMemo(() => {
    if (!prescriptionsResult) return [];
    return Array.isArray(prescriptionsResult) ? prescriptionsResult : (prescriptionsResult as any).data || [];
  }, [prescriptionsResult]);

  const total = (prescriptionsResult as any)?.total ?? prescriptions.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handlePatientSelected = useCallback(
    (patientId: string) => {
      setSearchParams(prev => {
        prev.set('patientId', patientId);
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams]
  );

  const handlePatientCleared = useCallback(() => {
    setSearchParams(prev => {
      prev.delete('patientId');
      prev.delete('page');
      return prev;
    });
  }, [setSearchParams]);

  const handleMedicChange = useCallback(
    (value: string | null) => {
      setSearchParams(prev => {
        if (value) prev.set('medicId', value);
        else prev.delete('medicId');
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      setSearchParams(prev => {
        if (value && value !== 'all') prev.set('type', value);
        else prev.delete('type');
        prev.delete('page');
        return prev;
      });
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setSearchParams(prev => {
        prev.set('page', String(p));
        return prev;
      });
    },
    [setSearchParams]
  );

  const handleRepeat = useCallback(
    (rx: any) => {
      setRepeatPrescription(rx);
      openPrescribe();
    },
    [openPrescribe]
  );

  const handlePrescribeClose = useCallback(() => {
    closePrescribe();
    setRepeatPrescription(null);
  }, [closePrescribe]);

  const getPatientName = (rx: any) => {
    const pd = rx.patient?.personalData;
    if (pd) return `${pd.firstName || ''} ${pd.lastName || ''}`.trim();
    return rx.patientId || '';
  };

  const getMedicineSummary = (rx: any) => {
    if (rx.content?.medicines?.length) {
      return rx.content.medicines.map((m: any) => m.text).join(', ');
    }
    if (rx.content?.orderText) {
      return rx.content.orderText.length > 60 ? rx.content.orderText.slice(0, 60) + '...' : rx.content.orderText;
    }
    return '';
  };

  // Use populated patient data from the prescription for repeating
  const repeatPatient = repeatPrescription?.patient ?? undefined;

  const repeatData: RepeatData | undefined = useMemo(() => {
    if (!repeatPrescription?.content) return undefined;
    const c = repeatPrescription.content;
    return {
      diagnosis: c.diagnosis || '',
      medicines: (c.medicines || []).map((m: any) => ({
        medication: m.text
          ? { externalId: m.externalId || '', text: m.text, requiresDuplicate: m.requiresDuplicate || false }
          : null,
        quantity: m.quantity || 1,
        posology: m.posology || '',
        longTerm: m.longTermTreatment || false,
        genericOnly: m.genericOnly || false,
      })),
    };
  }, [repeatPrescription]);

  const typeFilterData = [
    { value: 'all', label: t('common.all') },
    { value: 'prescription', label: t('recetario.type_prescription') },
    { value: 'order', label: t('recetario.type_order') },
  ];

  const thStyle = (extra?: React.CSSProperties) => ({
    ...stickyHeaderStyle,
    border: '1px solid var(--mantine-primary-color-1)',
    ...extra,
  });

  return (
    <>
      <Portal id="toolbar">
        <Group gap="sm">
          <MedicList onChange={handleMedicChange} medics={medics} value={selectedMedicId} />
        </Group>
      </Portal>

      {isDesktop && (
        <Portal id="form-actions">
          <Group gap="sm">
            <SegmentedControl value={selectedType} onChange={handleTypeChange} data={typeFilterData} size="sm" />
            <PatientSearch onChange={handlePatientSelected} onBlur={handlePatientCleared} variant="filled" />
            <Button leftSection={<PlusIcon size={16} />} onClick={openPrescribe} disabled={!selectedMedicId}>
              {t('recetario.new_prescription')}
            </Button>
          </Group>
        </Portal>
      )}

      {!isDesktop && <Fab onClick={openPrescribe} />}

      {!isDesktop && (
        <Group gap="sm" p="sm">
          <SegmentedControl
            value={selectedType}
            onChange={handleTypeChange}
            data={typeFilterData}
            size="xs"
            style={{ flex: 1 }}
          />
          <PatientSearch onChange={handlePatientSelected} onBlur={handlePatientCleared} variant="filled" />
        </Group>
      )}

      <HeaderContainer>
        <Title>{t('navigation.prescriptions')}</Title>
      </HeaderContainer>

      {status === 'loading' && (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      )}

      {status === 'success' && prescriptions.length === 0 && (
        <EmptyState>
          <ClipboardTextIcon size={48} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed">{t('recetario.history_empty')}</Text>
        </EmptyState>
      )}

      {status === 'success' && prescriptions.length > 0 && isDesktop && (
        <Table highlightOnHover layout="fixed" bg="white">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={140} style={thStyle({ borderLeft: 'none' })} fw={500} fz="md" py="0.5em">
                {t('common.date')}
              </Table.Th>
              <Table.Th style={thStyle()} fw={500} fz="md" py="0.5em">
                {t('recetario.step_patient')}
              </Table.Th>
              <Table.Th w={120} style={thStyle()} fw={500} fz="md" py="0.5em">
                {t('recetario.type')}
              </Table.Th>
              <Table.Th w={120} style={thStyle()} fw={500} fz="md" py="0.5em">
                {t('common.status')}
              </Table.Th>
              <Table.Th style={thStyle()} fw={500} fz="md" py="0.5em">
                {t('recetario.medicines')}
              </Table.Th>
              <Table.Th w={120} style={thStyle({ borderRight: 'none' })} fw={500} fz="md" py="0.5em" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {prescriptions.map((rx: any) => (
              <Fragment key={rx.id}>
                <Table.Tr
                  style={{ cursor: 'pointer' }}
                  styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
                  onClick={() => setExpandedId(expandedId === rx.id ? null : rx.id)}
                >
                  <Table.Td>
                    <CellText>{dayjs(rx.createdAt).format('DD/MM/YYYY')}</CellText>
                  </Table.Td>
                  <Table.Td>
                    <CellText style={{ fontWeight: 600 }}>{getPatientName(rx)}</CellText>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="outline" color={rx.type === 'prescription' ? 'green' : 'blue'}>
                      {t(`recetario.type_${rx.type}` as any)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color={statusColors[rx.status] || 'gray'}>
                      {t(`recetario.status_${rx.status}` as any)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <CellText style={{ color: 'var(--mantine-color-dimmed)' }}>{getMedicineSummary(rx)}</CellText>
                  </Table.Td>
                  <Table.Td>
                    {rx.status === 'completed' && rx.type === 'prescription' && (
                      <RepeatButton rx={rx} onRepeat={handleRepeat} />
                    )}
                  </Table.Td>
                </Table.Tr>
                {expandedId === rx.id && (
                  <Table.Tr style={{ '--tr-hover-bg': 'transparent', background: 'var(--mantine-color-gray-0)' }}>
                    <Table.Td colSpan={6} p="xl">
                      <PrescriptionDetail prescription={rx} onCancelled={() => setExpandedId(null)} />
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {status === 'success' && prescriptions.length > 0 && !isDesktop && (
        <>
          {prescriptions.map((rx: any) => (
            <Card key={rx.id} onClick={() => setExpandedId(expandedId === rx.id ? null : rx.id)}>
              <CardRow>
                <Text fw={600} size="sm">
                  {getPatientName(rx)}
                </Text>
                <Text size="xs" c="dimmed">
                  {dayjs(rx.createdAt).format('DD/MM/YY')}
                </Text>
              </CardRow>
              <CardRow style={{ marginTop: 4 }}>
                <Badge size="xs" variant="outline">
                  {t(`recetario.type_${rx.type}` as any)}
                </Badge>
                <Badge size="xs" variant="light" color={statusColors[rx.status] || 'gray'}>
                  {t(`recetario.status_${rx.status}` as any)}
                </Badge>
              </CardRow>
              {getMedicineSummary(rx) && (
                <Text size="xs" c="dimmed" lineClamp={1} mt={4}>
                  {getMedicineSummary(rx)}
                </Text>
              )}
              {expandedId === rx.id && (
                <div role="presentation" style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <PrescriptionDetail prescription={rx} onCancelled={() => setExpandedId(null)} />
                  {rx.status === 'completed' && rx.type === 'prescription' && (
                    <Group justify="flex-end" mt="xs">
                      <RepeatButton rx={rx} onRepeat={handleRepeat} />
                    </Group>
                  )}
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {totalPages > 1 && (
        <Group
          justify="center"
          pos="sticky"
          bottom="0"
          bg="white"
          py="lg"
          style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}
        >
          <Pagination total={totalPages} value={page} onChange={handlePageChange} size={isDesktop ? 'md' : 'sm'} />
        </Group>
      )}

      <PrescribeModal
        opened={prescribeOpened}
        onClose={handlePrescribeClose}
        onSuccess={() => {
          showNotification({
            color: 'green',
            message: t('recetario.created_success'),
          });
        }}
        medicId={selectedMedicId || undefined}
        patient={repeatPatient}
        repeatData={repeatData}
      />
    </>
  );
}

function RepeatButton({ rx, onRepeat }: { rx: any; onRepeat: (rx: any) => void }) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  return (
    <Popover opened={opened} onChange={setOpened} withArrow shadow="md" position="bottom-end">
      <Popover.Target>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<ArrowCounterClockwiseIcon size={14} />}
          onClick={e => {
            e.stopPropagation();
            setOpened(true);
          }}
        >
          {t('recetario.repeat')}
        </Button>
      </Popover.Target>
      <Popover.Dropdown onClick={e => e.stopPropagation()}>
        <Text size="sm" mb="sm">
          {t('recetario.repeat_confirm')}
        </Text>
        <Group gap="xs" justify="flex-end">
          <Button size="xs" variant="default" onClick={() => setOpened(false)}>
            {t('common.no')}
          </Button>
          <Button
            size="xs"
            onClick={() => {
              setOpened(false);
              onRepeat(rx);
            }}
          >
            {t('common.yes')}
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}

export const ErrorBoundary = RouteErrorFallback;
