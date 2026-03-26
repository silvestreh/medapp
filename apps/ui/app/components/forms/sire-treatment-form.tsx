import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, TextInput, Textarea, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';

interface SireTreatmentFormProps {
  patientId: string;
  initialData?: any;
  onSubmit: (data: Record<string, any>) => void;
}

export function SireTreatmentForm({ patientId, initialData, onSubmit }: SireTreatmentFormProps) {
  const form = useForm({
    initialValues: {
      medication: initialData?.medication || 'Acenocumarol',
      tabletDoseMg: initialData?.tabletDoseMg || 4,
      targetInrMin: initialData?.targetInrMin || 2.0,
      targetInrMax: initialData?.targetInrMax || 3.0,
      indication: initialData?.indication || '',
      startDate: initialData?.startDate ? new Date(initialData.startDate) : new Date(),
      nextControlDate: initialData?.nextControlDate ? new Date(initialData.nextControlDate) : (null as Date | null),
      status: initialData?.status || 'active',
      notes: initialData?.notes || '',
    },
  });

  const handleSubmit = useCallback(() => {
    const formatDate = (d: Date | string | null) => (d instanceof Date ? d.toISOString().split('T')[0] : d);

    onSubmit({
      ...form.values,
      patientId,
      startDate: formatDate(form.values.startDate),
      nextControlDate: formatDate(form.values.nextControlDate),
    });
  }, [form.values, patientId, onSubmit]);

  return (
    <Stack gap="md">
      <Select
        label="Medicación"
        data={[
          { value: 'Acenocumarol', label: 'Acenocumarol (Sintrom)' },
          { value: 'Warfarina', label: 'Warfarina (Circuvit)' },
          { value: 'Apixabán', label: 'Apixabán (Eliquis)' },
          { value: 'Rivaroxabán', label: 'Rivaroxabán (Xarelto)' },
          { value: 'Dabigatrán', label: 'Dabigatrán (Pradaxa)' },
        ]}
        {...form.getInputProps('medication')}
      />

      <NumberInput
        label="Dosis por comprimido (mg)"
        min={0.5}
        step={0.5}
        decimalScale={1}
        {...form.getInputProps('tabletDoseMg')}
      />

      <Group grow>
        <NumberInput
          label="RIN mínimo objetivo"
          min={0.5}
          max={5}
          step={0.1}
          decimalScale={1}
          {...form.getInputProps('targetInrMin')}
        />
        <NumberInput
          label="RIN máximo objetivo"
          min={0.5}
          max={5}
          step={0.1}
          decimalScale={1}
          {...form.getInputProps('targetInrMax')}
        />
      </Group>

      <TextInput label="Indicación" placeholder="Ej: Fibrilación auricular" {...form.getInputProps('indication')} />

      <Group grow>
        <DateInput label="Fecha de inicio" valueFormat="YYYY-MM-DD" {...form.getInputProps('startDate')} />
        <DateInput
          label="Próximo control"
          valueFormat="YYYY-MM-DD"
          clearable
          placeholder="Sin fecha"
          {...form.getInputProps('nextControlDate')}
        />
      </Group>

      <Textarea label="Notas" autosize minRows={2} {...form.getInputProps('notes')} />

      <Button onClick={handleSubmit} fullWidth>
        {initialData ? 'Actualizar tratamiento' : 'Crear tratamiento'}
      </Button>
    </Stack>
  );
}
