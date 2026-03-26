import { useCallback } from 'react';
import { Stack, Group, Button, NumberInput, Textarea, Title, Divider } from '@mantine/core';
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

interface SireControlFormProps {
  treatmentId: string;
  /** When editing an existing entry */
  initialReading?: any;
  initialSchedule?: any;
  nextControlDate?: string | null;
  onSubmit: (data: {
    reading: Record<string, any>;
    schedule: Record<string, any> | null;
    nextControlDate: string | null;
  }) => void;
  onDelete?: () => void;
  prefill?: { inr?: number; percentage?: number } | null;
}

export function SireControlForm({
  treatmentId,
  initialReading,
  initialSchedule,
  nextControlDate,
  onSubmit,
  onDelete,
  prefill,
}: SireControlFormProps) {
  const form = useForm({
    initialValues: {
      // Reading fields
      date: initialReading?.date ? new Date(initialReading.date) : new Date(),
      inr: (initialReading?.inr ?? prefill?.inr ?? '') as number | '',
      percentage: (initialReading?.percentage ?? prefill?.percentage ?? '') as number | '',
      // Dose schedule fields
      includeDose: !!initialSchedule,
      monday: (initialSchedule?.schedule?.monday ?? '') as number | '',
      tuesday: (initialSchedule?.schedule?.tuesday ?? '') as number | '',
      wednesday: (initialSchedule?.schedule?.wednesday ?? '') as number | '',
      thursday: (initialSchedule?.schedule?.thursday ?? '') as number | '',
      friday: (initialSchedule?.schedule?.friday ?? '') as number | '',
      saturday: (initialSchedule?.schedule?.saturday ?? '') as number | '',
      sunday: (initialSchedule?.schedule?.sunday ?? '') as number | '',
      doseNotes: initialSchedule?.notes || '',
      // Next control
      nextControlDate: nextControlDate ? new Date(nextControlDate) : (null as Date | null),
    },
    validate: {
      inr: value => (value === '' ? 'RIN es requerido' : null),
    },
  });

  const formatDate = useCallback((d: Date | string | null) => {
    if (!d) return null;
    return d instanceof Date ? d.toISOString().split('T')[0] : d;
  }, []);

  const handleSubmit = useCallback(() => {
    if (form.validate().hasErrors) return;

    const reading = {
      treatmentId,
      date: formatDate(form.values.date),
      inr: Number(form.values.inr),
      percentage: form.values.percentage !== '' ? Number(form.values.percentage) : null,
      ...(initialReading?.id ? { id: initialReading.id } : {}),
    };

    let schedule: Record<string, any> | null = null;
    if (form.values.includeDose) {
      const weekSchedule: Record<string, number | null> = {};
      for (const day of DAYS) {
        const val = form.values[day.key];
        weekSchedule[day.key] = val !== '' ? Number(val) : null;
      }
      schedule = {
        treatmentId,
        startDate: formatDate(form.values.date),
        schedule: weekSchedule,
        notes: form.values.doseNotes || null,
        ...(initialSchedule?.id ? { id: initialSchedule.id } : {}),
      };
    }

    onSubmit({
      reading,
      schedule,
      nextControlDate: formatDate(form.values.nextControlDate),
    });
  }, [form, treatmentId, initialReading, initialSchedule, formatDate, onSubmit]);

  const handleToggleDose = useCallback(() => {
    form.setFieldValue('includeDose', !form.values.includeDose);
  }, [form]);

  const isEditing = !!initialReading?.id;

  return (
    <Stack gap="md">
      <Title order={5}>Lectura</Title>

      <DateInput label="Fecha" valueFormat="YYYY-MM-DD" {...form.getInputProps('date')} />

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
        min={0}
        max={200}
        step={1}
        decimalScale={0}
        placeholder="Ej: 48"
        {...form.getInputProps('percentage')}
      />

      <Divider />

      <Group justify="space-between">
        <Title order={5}>Esquema de dosis</Title>
        <Button variant="subtle" size="xs" onClick={handleToggleDose}>
          {form.values.includeDose ? 'Quitar esquema' : 'Agregar esquema'}
        </Button>
      </Group>

      {form.values.includeDose && (
        <>
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
            label="Notas del esquema"
            autosize
            minRows={2}
            placeholder="Observaciones..."
            {...form.getInputProps('doseNotes')}
          />
        </>
      )}

      <Divider />

      <DateInput
        label="Próximo control"
        valueFormat="YYYY-MM-DD"
        clearable
        placeholder="Sin fecha"
        {...form.getInputProps('nextControlDate')}
      />

      <Group grow>
        <Button onClick={handleSubmit} fullWidth>
          {isEditing ? 'Actualizar' : 'Guardar'}
        </Button>
        {isEditing && onDelete && (
          <Button onClick={onDelete} color="red" variant="light" fullWidth>
            Eliminar
          </Button>
        )}
      </Group>
    </Stack>
  );
}
