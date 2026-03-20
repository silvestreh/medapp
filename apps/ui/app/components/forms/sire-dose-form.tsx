import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

interface SireDoseFormProps {
  treatmentId: string;
  onSubmit: (data: Record<string, any>) => void;
}

export function SireDoseForm({ treatmentId, onSubmit }: SireDoseFormProps) {
  const form = useForm({
    initialValues: {
      startDate: new Date(),
      monday: 0.5 as number | '',
      tuesday: 0.25 as number | '',
      wednesday: 0.5 as number | '',
      thursday: 0.25 as number | '',
      friday: 0.25 as number | '',
      saturday: 0.5 as number | '',
      sunday: '' as number | '',
      notes: '',
    },
  });

  const handleSubmit = useCallback(() => {
    const schedule: Record<string, number | null> = {};
    for (const day of DAYS) {
      const val = form.values[day.key];
      schedule[day.key] = val !== '' ? Number(val) : null;
    }

    onSubmit({
      treatmentId,
      startDate:
        form.values.startDate instanceof Date
          ? form.values.startDate.toISOString().split('T')[0]
          : form.values.startDate,
      schedule,
      notes: form.values.notes || null,
    });
  }, [form.values, treatmentId, onSubmit]);

  return (
    <Stack gap="md">
      <DateInput label="Fecha de inicio" valueFormat="YYYY-MM-DD" {...form.getInputProps('startDate')} />

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

      <Textarea
        label="Notas"
        autosize
        minRows={2}
        placeholder="Observaciones sobre el esquema..."
        {...form.getInputProps('notes')}
      />

      <Button onClick={handleSubmit} fullWidth>
        Guardar esquema
      </Button>
    </Stack>
  );
}
