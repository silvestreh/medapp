import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Select } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';

interface SireReadingFormProps {
  treatmentId: string;
  patientId: string;
  organizationId: string;
  onSubmit: (data: Record<string, any>) => void;
}

export function SireReadingForm({ treatmentId, patientId, organizationId, onSubmit }: SireReadingFormProps) {
  const form = useForm({
    initialValues: {
      date: new Date(),
      inr: '' as number | '',
      quick: '' as number | '',
      percentage: '' as number | '',
      source: 'provider' as string,
    },
    validate: {
      inr: (value) => (value === '' ? 'RIN es requerido' : null),
    },
  });

  const handleSubmit = useCallback(() => {
    if (form.validate().hasErrors) return;

    onSubmit({
      treatmentId,
      patientId,
      organizationId,
      date: form.values.date instanceof Date
        ? form.values.date.toISOString().split('T')[0]
        : form.values.date,
      inr: Number(form.values.inr),
      quick: form.values.quick !== '' ? Number(form.values.quick) : null,
      percentage: form.values.percentage !== '' ? Number(form.values.percentage) : null,
      source: form.values.source,
    });
  }, [form, treatmentId, patientId, organizationId, onSubmit]);

  return (
    <Stack gap="md">
      <DateInput
        label="Fecha de lectura"
        valueFormat="YYYY-MM-DD"
        {...form.getInputProps('date')}
      />

      <NumberInput
        label="RIN"
        required
        min={0}
        max={20}
        step={0.1}
        decimalScale={1}
        placeholder="Ej: 2.4"
        {...form.getInputProps('inr')}
      />

      <Group grow>
        <NumberInput
          label="Quick (seg)"
          min={0}
          step={0.1}
          decimalScale={1}
          placeholder="Ej: 1.2"
          {...form.getInputProps('quick')}
        />
        <NumberInput
          label="Porcentaje (%)"
          min={0}
          max={200}
          step={1}
          decimalScale={0}
          placeholder="Ej: 48"
          {...form.getInputProps('percentage')}
        />
      </Group>

      <Select
        label="Fuente"
        data={[
          { value: 'provider', label: 'Profesional' },
          { value: 'patient', label: 'Paciente' },
          { value: 'lab', label: 'Laboratorio' },
        ]}
        {...form.getInputProps('source')}
      />

      <Button onClick={handleSubmit} fullWidth>
        Guardar lectura
      </Button>
    </Stack>
  );
}
