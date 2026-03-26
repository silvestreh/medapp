import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Select, Title, Divider } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';

const DAYS = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mié' },
  { key: 'thursday', label: 'Jue' },
  { key: 'friday', label: 'Vie' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
] as const;

interface SireInitialTreatmentFormProps {
  onSubmit: (data: {
    treatment: Record<string, any>;
    reading: Record<string, any>;
    schedule: Record<string, any>;
    nextControlDate: string | null;
  }) => void;
  prefill?: { inr?: number; percentage?: number } | null;
}

export function SireInitialTreatmentForm({ onSubmit, prefill }: SireInitialTreatmentFormProps) {
  const form = useForm({
    initialValues: {
      medication: 'Acenocumarol',
      tabletDoseMg: 4 as number,
      targetInrMin: 2.0 as number,
      targetInrMax: 3.0 as number,
      startDate: new Date(),
      // Initial reading
      inr: (prefill?.inr ?? '') as number | '',
      percentage: (prefill?.percentage ?? '') as number | '',
      // Dose schedule
      monday: '' as number | '',
      tuesday: '' as number | '',
      wednesday: '' as number | '',
      thursday: '' as number | '',
      friday: '' as number | '',
      saturday: '' as number | '',
      sunday: '' as number | '',
      nextControlDate: null as Date | null,
    },
    validate: {
      inr: value => (value === '' ? 'RIN es requerido' : null),
      percentage: value => (value === '' ? 'Porcentaje es requerido' : null),
      monday: value => (value === '' ? 'Requerido' : null),
      tuesday: value => (value === '' ? 'Requerido' : null),
      wednesday: value => (value === '' ? 'Requerido' : null),
      thursday: value => (value === '' ? 'Requerido' : null),
      friday: value => (value === '' ? 'Requerido' : null),
      saturday: value => (value === '' ? 'Requerido' : null),
      sunday: value => (value === '' ? 'Requerido' : null),
      nextControlDate: value => (value === null ? 'Próximo control es requerido' : null),
    },
  });

  const handleSubmit = useCallback(() => {
    if (form.validate().hasErrors) return;

    const formatDate = (d: Date | string | null) => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d);
    };
    const startDate = formatDate(form.values.startDate)!;

    const weekSchedule: Record<string, number | null> = {};
    for (const day of DAYS) {
      const val = form.values[day.key];
      weekSchedule[day.key] = val !== '' ? Number(val) : null;
    }

    onSubmit({
      treatment: {
        medication: form.values.medication,
        tabletDoseMg: form.values.tabletDoseMg,
        targetInrMin: form.values.targetInrMin,
        targetInrMax: form.values.targetInrMax,
        startDate,
        status: 'active',
      },
      reading: {
        date: startDate,
        inr: Number(form.values.inr),
        percentage: form.values.percentage !== '' ? Number(form.values.percentage) : null,
      },
      schedule: {
        startDate,
        schedule: weekSchedule,
      },
      nextControlDate: formatDate(form.values.nextControlDate),
    });
  }, [form, onSubmit]);

  return (
    <Stack gap="md">
      <Title order={5}>Tratamiento</Title>

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

      <DateInput label="Fecha de inicio" valueFormat="YYYY-MM-DD" {...form.getInputProps('startDate')} />

      <Divider />

      <Title order={5}>Control inicial</Title>

      <Group grow>
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
        <NumberInput
          label="Porcentaje (%)"
          required
          min={0}
          max={200}
          step={1}
          decimalScale={0}
          placeholder="Ej: 48"
          {...form.getInputProps('percentage')}
        />
      </Group>

      <Divider />

      <Title order={5}>Esquema de dosis</Title>

      <Group grow>
        {DAYS.map(day => (
          <NumberInput
            key={day.key}
            label={day.label}
            min={0}
            max={4}
            step={0.25}
            decimalScale={2}
            placeholder="—"
            size="sm"
            {...form.getInputProps(day.key)}
          />
        ))}
      </Group>

      <Divider />

      <DateInput
        label="Próximo control"
        required
        valueFormat="YYYY-MM-DD"
        placeholder="Sin fecha"
        {...form.getInputProps('nextControlDate')}
      />

      <Button onClick={handleSubmit} fullWidth>
        Iniciar tratamiento
      </Button>
    </Stack>
  );
}
