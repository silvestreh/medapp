import { useState, useCallback, useMemo } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Stack, Group, Button, Modal, Title, Text, Table, Badge, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PlusIcon, PillIcon, PencilSimpleIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { parseFormJson } from '~/utils/parse-form-json';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { ToolbarTitle } from '~/components/toolbar-title';
import { SireTreatmentForm } from '~/components/forms/sire-treatment-form';
import { SireControlForm } from '~/components/forms/sire-control-form';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'sire') }];
};

export const loader = authenticatedLoader(async ({ params, request }: LoaderFunctionArgs) => {
  const { patientId } = params;
  if (!patientId) throw new Response('Patient ID is required', { status: 400 });

  const { client } = await getAuthenticatedClient(request);

  const [patient, treatmentsResult, readingsResult, schedulesResult] = await Promise.all([
    client.service('patients').get(patientId),
    client.service('sire-treatments').find({ query: { patientId, $sort: { createdAt: -1 } } }),
    client.service('sire-readings').find({ query: { patientId, $sort: { date: -1, createdAt: -1 }, $limit: 50 } }),
    client.service('sire-dose-schedules').find({ query: { $sort: { startDate: -1, createdAt: -1 }, $limit: 50 } }),
  ]);

  return {
    patient,
    treatments: (treatmentsResult as any).data || treatmentsResult,
    readings: (readingsResult as any).data || readingsResult,
    schedules: (schedulesResult as any).data || schedulesResult,
  };
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { patientId } = params;
  if (!patientId) throw new Response('Patient ID is required', { status: 400 });

  const { client, user } = await getAuthenticatedClient(request);
  const organizationId = await getCurrentOrganizationId(request);
  const formData = await request.formData();
  const payload = parseFormJson<Record<string, any>>(formData.get('data'));
  const intent = payload.intent;

  switch (intent) {
  case 'create-treatment':
    await client.service('sire-treatments').create({
      ...payload.data,
      patientId,
      organizationId,
      medicId: user.id,
    });
    return json({ ok: true });

  case 'patch-treatment':
    await client.service('sire-treatments').patch(payload.id, payload.data);
    return json({ ok: true });

  case 'save-control': {
    const { reading, schedule, nextControlDate, treatmentId } = payload;

    // Create or patch reading
    let readingId = reading.id;
    if (reading.id) {
      const { id, ...readingData } = reading;
      await client.service('sire-readings').patch(id, readingData);
    } else {
      const created = await client.service('sire-readings').create({
        ...reading,
        patientId,
        organizationId,
      });
      readingId = (created as any).id;
    }

    // Create or patch schedule, linked to the reading
    if (schedule) {
      if (schedule.id) {
        const { id, ...scheduleData } = schedule;
        await client.service('sire-dose-schedules').patch(id, {
          schedule: scheduleData.schedule,
          notes: scheduleData.notes,
          startDate: scheduleData.startDate,
        });
      } else {
        await client.service('sire-dose-schedules').create({
          ...schedule,
          readingId,
          createdById: user.id,
        });
      }
    }

    // Update next control date on treatment
    if (treatmentId) {
      await client.service('sire-treatments').patch(treatmentId, { nextControlDate });
    }

    return json({ ok: true });
  }

  case 'delete-reading':
    await client.service('sire-readings').remove(payload.id);
    return json({ ok: true });

  case 'delete-schedule':
    await client.service('sire-dose-schedules').remove(payload.id);
    return json({ ok: true });

  default:
    return json({ error: 'Unknown intent' }, { status: 400 });
  }
};

const Container = styled('div', {
  base: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
});

const Section = styled('div', {
  base: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid var(--mantine-color-gray-2)',
    padding: '1.5rem',
  },
});

function getInrStatus(inr: number, min: number, max: number) {
  if (inr < min) return { label: 'Bajo', color: 'orange' };
  if (inr > max) return { label: 'Alto', color: 'red' };
  return { label: 'Normal', color: 'green' };
}

export default function SireManagement() {
  const { patient, treatments, readings, schedules } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const { t } = useTranslation();

  const [treatmentModalOpened, treatmentModal] = useDisclosure(false);
  const [controlModalOpened, controlModal] = useDisclosure(false);
  const [editingReading, setEditingReading] = useState<any>(null);

  const activeTreatment = useMemo(() => {
    return (treatments as any[]).find((tr: any) => tr.status === 'active') || null;
  }, [treatments]);

  // Find the schedule associated with a reading (same startDate as reading date)
  const findScheduleForReading = useCallback((reading: any) => {
    return (schedules as any[]).find((s: any) => s.readingId === reading.id) || null;
  }, [schedules]);

  const handleSubmitTreatment = useCallback((data: Record<string, any>) => {
    const intent = activeTreatment ? 'patch-treatment' : 'create-treatment';
    const payload = activeTreatment
      ? { intent, id: activeTreatment.id, data }
      : { intent, data };
    fetcher.submit(
      { data: JSON.stringify(payload) },
      { method: 'post' },
    );
    treatmentModal.close();
  }, [fetcher, treatmentModal, activeTreatment]);

  const handleSubmitControl = useCallback((data: {
    reading: Record<string, any>;
    schedule: Record<string, any> | null;
    nextControlDate: string | null;
  }) => {
    fetcher.submit(
      { data: JSON.stringify({ intent: 'save-control', ...data, treatmentId: activeTreatment?.id }) },
      { method: 'post' },
    );
    controlModal.close();
    setEditingReading(null);
  }, [fetcher, controlModal, activeTreatment]);

  const handleDeleteReading = useCallback(() => {
    if (!editingReading?.id) return;
    const schedule = findScheduleForReading(editingReading);
    // Delete reading (and its schedule if any)
    fetcher.submit(
      { data: JSON.stringify({ intent: 'delete-reading', id: editingReading.id }) },
      { method: 'post' },
    );
    if (schedule) {
      fetcher.submit(
        { data: JSON.stringify({ intent: 'delete-schedule', id: schedule.id }) },
        { method: 'post' },
      );
    }
    controlModal.close();
    setEditingReading(null);
  }, [editingReading, findScheduleForReading, fetcher, controlModal]);

  const handleOpenNew = useCallback(() => {
    setEditingReading(null);
    controlModal.open();
  }, [controlModal]);

  const handleOpenEdit = useCallback((reading: any) => {
    setEditingReading(reading);
    controlModal.open();
  }, [controlModal]);

  const patientName = `${(patient as any).personalData?.firstName || ''} ${(patient as any).personalData?.lastName || ''}`.trim();

  return (
    <>
      <Portal id="toolbar">
        <ToolbarTitle>{patientName} — Anticoagulación</ToolbarTitle>
      </Portal>

      <Container>
        {/* Treatment Summary */}
        <Section>
          <Group justify="space-between" mb="md">
            <Title order={4}>Tratamiento</Title>
            <Button
              leftSection={activeTreatment ? <PencilSimpleIcon size={16} /> : <PlusIcon size={16} />}
              size="xs"
              variant="light"
              onClick={treatmentModal.open}
            >
              {activeTreatment ? 'Editar' : 'Nuevo tratamiento'}
            </Button>
          </Group>

          {activeTreatment && (
            <Stack gap="xs">
              <Group>
                <PillIcon size={20} />
                <Text fw={600}>{activeTreatment.medication} {activeTreatment.tabletDoseMg} mg</Text>
                <Badge color="green" variant="light">Activo</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                RIN objetivo: {activeTreatment.targetInrMin} – {activeTreatment.targetInrMax}
              </Text>
              {activeTreatment.indication && (
                <Text size="sm" c="dimmed">Indicación: {activeTreatment.indication}</Text>
              )}
              {activeTreatment.nextControlDate && (
                <Text size="sm" c="dimmed">Próximo control: {activeTreatment.nextControlDate}</Text>
              )}
            </Stack>
          )}

          {!activeTreatment && (
            <Text c="dimmed" size="sm">No hay tratamiento activo configurado.</Text>
          )}
        </Section>

        {/* Controls (readings + dose schedules) */}
        <Section>
          <Group justify="space-between" mb="md">
            <Title order={4}>Controles</Title>
            {activeTreatment && (
              <Button
                leftSection={<PlusIcon size={16} />}
                size="xs"
                variant="light"
                onClick={handleOpenNew}
              >
                Nuevo control
              </Button>
            )}
          </Group>

          {(readings as any[]).length > 0 && (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>%</Table.Th>
                  <Table.Th>RIN</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Esquema</Table.Th>
                  <Table.Th w={40}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(readings as any[]).map((reading: any) => {
                  const status = activeTreatment
                    ? getInrStatus(reading.inr, activeTreatment.targetInrMin, activeTreatment.targetInrMax)
                    : { label: '—', color: 'gray' };
                  const schedule = findScheduleForReading(reading);
                  const doseLabel = schedule
                    ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                      .map((d) => schedule.schedule[d] ?? '—')
                      .join(' / ')
                    : '—';

                  return (
                    <Table.Tr key={reading.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenEdit(reading)}>
                      <Table.Td>{reading.date}</Table.Td>
                      <Table.Td>{reading.percentage ?? '—'}</Table.Td>
                      <Table.Td fw={700}>{reading.inr}</Table.Td>
                      <Table.Td>
                        <Badge color={status.color} variant="light">{status.label}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={1}>{doseLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon variant="subtle" size="sm">
                          <PencilSimpleIcon size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}

          {(readings as any[]).length === 0 && (
            <Text c="dimmed" size="sm">No hay controles registrados.</Text>
          )}
        </Section>
      </Container>

      {/* Treatment Modal */}
      <Modal opened={treatmentModalOpened} onClose={treatmentModal.close} title="Tratamiento de anticoagulación" size="lg">
        <SireTreatmentForm
          patientId={String((patient as any).id)}
          initialData={activeTreatment}
          onSubmit={handleSubmitTreatment}
        />
      </Modal>

      {/* Combined Control Modal (reading + dose + next control) */}
      <Modal
        opened={controlModalOpened}
        onClose={() => { controlModal.close(); setEditingReading(null); }}
        title={editingReading ? 'Editar control' : 'Nuevo control'}
        size="lg"
      >
        {activeTreatment && (
          <SireControlForm
            treatmentId={activeTreatment.id}
            initialReading={editingReading}
            initialSchedule={editingReading ? findScheduleForReading(editingReading) : null}
            nextControlDate={activeTreatment.nextControlDate}
            onSubmit={handleSubmitControl}
            onDelete={editingReading?.id ? handleDeleteReading : undefined}
          />
        )}
      </Modal>
    </>
  );
}
