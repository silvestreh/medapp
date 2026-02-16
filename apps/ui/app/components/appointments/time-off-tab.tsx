import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, Card, Group, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

export interface TimeOffEvent {
  id: string;
  medicId: string;
  startDate: string;
  endDate: string;
  type: 'vacation' | 'cancelDay' | 'other';
  notes: string | null;
}

interface TimeOffTabProps {
  events: TimeOffEvent[];
  isLoading: boolean;
  removingId?: string | null;
  onCreate: (payload: { startDate: string; endDate: string; type: 'vacation' | 'cancelDay' | 'other' }) => void;
  onRemove: (id: string) => void;
}

const formatDateForInput = (value: string | Date): string => dayjs(value).format('YYYY-MM-DD');

export function TimeOffTab({ events, isLoading, removingId, onCreate, onRemove }: TimeOffTabProps) {
  const { t } = useTranslation();
  const [newTimeOff, setNewTimeOff] = useState({
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    type: 'vacation' as 'vacation' | 'cancelDay' | 'other',
  });

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf()),
    [events]
  );

  const handleCreate = () => {
    if (dayjs(newTimeOff.startDate).isAfter(dayjs(newTimeOff.endDate))) {
      showNotification({
        color: 'red',
        title: t('appointments.invalid_range_title'),
        message: t('appointments.invalid_range_message'),
      });
      return;
    }

    onCreate(newTimeOff);
  };

  const handleRemove = (id: string) => onRemove(id);

  return (
    <Stack gap="md">
      <Text fw={600}>{t('appointments.time_off_section_title')}</Text>
      <SimpleGrid cols={3}>
        <TextInput
          label={t('common.from')}
          type="date"
          value={newTimeOff.startDate}
          onChange={event => setNewTimeOff(current => ({ ...current, startDate: event.currentTarget.value }))}
        />
        <TextInput
          label={t('common.to')}
          type="date"
          value={newTimeOff.endDate}
          onChange={event => setNewTimeOff(current => ({ ...current, endDate: event.currentTarget.value }))}
        />
        <Select
          label={t('appointments.type_label')}
          value={newTimeOff.type}
          onChange={value => setNewTimeOff(current => ({ ...current, type: (value || 'vacation') as 'vacation' | 'cancelDay' | 'other' }))}
          data={[
            { value: 'vacation', label: t('appointments.type_vacation') },
            { value: 'cancelDay', label: t('appointments.type_cancel_day') },
            { value: 'other', label: t('appointments.type_other') },
          ]}
        />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button onClick={handleCreate} loading={isLoading}>
          {t('common.add')}
        </Button>
      </Group>

      {sortedEvents.length === 0 && (
        <Alert color="gray" title={t('appointments.no_time_off_events_title')}>
          {t('appointments.no_time_off_events_message')}
        </Alert>
      )}

      {sortedEvents.map(event => (
        <Card key={event.id} withBorder>
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text fw={500}>
                {event.type === 'vacation'
                  ? t('appointments.type_vacation')
                  : event.type === 'cancelDay'
                    ? t('appointments.type_cancel_day')
                    : t('appointments.type_other')}
              </Text>
              <Text size="sm" c="dimmed">
                {formatDateForInput(event.startDate)} - {formatDateForInput(event.endDate)}
              </Text>
            </Stack>
            <Button color="red" variant="light" size="xs" loading={removingId === event.id} onClick={() => handleRemove(event.id)}>
              {t('common.delete')}
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
