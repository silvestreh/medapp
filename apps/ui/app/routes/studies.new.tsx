import { useState, useCallback } from 'react';
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useFetcher, useNavigate } from '@remix-run/react';
import { Stack, Group, Button, Checkbox, Text } from '@mantine/core';
import { FlaskConical } from 'lucide-react';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import { useGet } from '~/components/provider';
import PatientSearch from '~/components/patient-search';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import {
  FormCard,
  FieldRow,
  Label,
  StyledTextInput,
  StyledTextarea,
  StyledDateInput,
  StyledTitle,
} from '~/components/forms/styles';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Nuevo Estudio' }];
};

export const loader = authenticatedLoader();

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get('data') as string);

  const study = await client.service('studies').create({
    ...payload,
    medicId: user.id,
  });

  return redirect(`/studies/${study.id}`);
};

// ---------------------------------------------------------------------------
// Study type definitions
// ---------------------------------------------------------------------------

const STUDY_TYPES: { key: string; label: string }[] = [
  { key: 'anemia', label: 'Estudio de Anemia' },
  { key: 'anticoagulation', label: 'Anticoagulación' },
  { key: 'compatibility', label: 'Compatibilidad Matrimonial' },
  { key: 'hemostasis', label: 'Hemostasia' },
  { key: 'myelogram', label: 'Mielograma Descriptivo' },
  { key: 'thrombophilia', label: 'Estudio de Trombofilia' },
];

// ---------------------------------------------------------------------------
// Page-level layout
// ---------------------------------------------------------------------------

const PageContainer = styled('div', {
  base: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',

    lg: {
      padding: '2rem',
    },
  },
});

const TypeGrid = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.75rem',

    sm: {
      gridTemplateColumns: '1fr 1fr',
    },

    lg: {
      gridTemplateColumns: '1fr 1fr 1fr',
    },
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NewStudy() {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [medic, setMedic] = useState('');
  const [comment, setComment] = useState('');
  const [noOrder, setNoOrder] = useState(false);
  const [selectedStudies, setSelectedStudies] = useState<string[]>([]);

  const { data: patient } = useGet('patients', patientId!, { enabled: !!patientId });

  const toggleStudy = useCallback((key: string) => {
    setSelectedStudies(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  }, []);

  const canSave = patientId && selectedStudies.length > 0 && date;
  const isSaving = fetcher.state !== 'idle';

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const payload = {
      patientId,
      date: date.toISOString(),
      studies: selectedStudies,
      noOrder,
      comment: comment || undefined,
    };

    fetcher.submit(
      { data: JSON.stringify(payload) },
      { method: 'post' }
    );
  }, [canSave, patientId, date, selectedStudies, noOrder, comment, fetcher]);

  return (
    <PageContainer>
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%">
          <StyledTitle order={2}>Nuevo Estudio</StyledTitle>
        </Group>
      </Portal>

      <StyledTitle order={3}>Datos del estudio</StyledTitle>
      <FormCard>
        <FieldRow>
          <Label>Paciente *</Label>
          <PatientSearch
            onChange={id => setPatientId(id)}
            onBlur={() => {}}
            placeholder="Buscar por nombre, apellido o documento..."
            autoFocus
          />
        </FieldRow>
        <FieldRow>
          <Label>Médico derivante</Label>
          <StyledTextInput
            placeholder="Nombre del médico"
            value={medic}
            onChange={e => setMedic(e.currentTarget.value)}
          />
        </FieldRow>
        <FieldRow>
          <Label>Obra Social</Label>
          <StyledTextInput
            placeholder="Obra social del paciente"
            value={(patient as any)?.medicare || ''}
            readOnly
            disabled={!patientId}
          />
        </FieldRow>
        <FieldRow>
          <Label>Fecha de extracción</Label>
          <StyledDateInput
            value={date}
            onChange={setDate}
            valueFormat="DD/MM/YYYY"
          />
        </FieldRow>
        <FieldRow checkbox>
          <Checkbox
            label="Falta orden / Particular no pago"
            checked={noOrder}
            onChange={e => setNoOrder(e.currentTarget.checked)}
            color="blue"
          />
        </FieldRow>
        <FieldRow>
          <Label>Observaciones</Label>
          <StyledTextarea
            placeholder="Comentarios u observaciones..."
            value={comment}
            onChange={e => setComment(e.currentTarget.value)}
            autosize
            minRows={2}
          />
        </FieldRow>
      </FormCard>

      <StyledTitle order={3}>Estudios solicitados</StyledTitle>
      <FormCard>
        <FieldRow stacked>
          <TypeGrid>
            {STUDY_TYPES.map(({ key, label }) => (
              <Checkbox
                key={key}
                label={label}
                checked={selectedStudies.includes(key)}
                onChange={() => toggleStudy(key)}
                color="blue"
              />
            ))}
          </TypeGrid>

          {selectedStudies.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" mt="sm">
              Seleccione al menos un tipo de estudio.
            </Text>
          )}
        </FieldRow>
      </FormCard>

      <Group justify="flex-end">
        <Button variant="subtle" color="gray" onClick={() => navigate('/studies')}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canSave}
          loading={isSaving}
          leftSection={<FlaskConical size={16} />}
        >
          Guardar
        </Button>
      </Group>
    </PageContainer>
  );
}
