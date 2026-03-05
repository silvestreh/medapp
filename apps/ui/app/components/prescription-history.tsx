import { useTranslation } from 'react-i18next';
import { Stack, Text, Badge, Group, Anchor, Divider } from '@mantine/core';
import { ClipboardPen, FileText } from 'lucide-react';
import dayjs from 'dayjs';

interface PrescriptionRecord {
  id: string;
  type: 'prescription' | 'order';
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  recetarioDocumentIds: { id: number; type: string; url: string }[];
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  completed: 'green',
  cancelled: 'red',
  expired: 'gray',
};

export function PrescriptionHistory({ prescriptions }: { prescriptions: PrescriptionRecord[] }) {
  const { t } = useTranslation();

  return (
    <Stack gap="xs" p="md">
      <Divider />
      <Group gap="xs">
        <ClipboardPen size={16} />
        <Text fw={600} size="sm">
          {t('recetario.history_title')}
        </Text>
      </Group>
      {prescriptions.map(rx => (
        <Group key={rx.id} gap="xs" wrap="nowrap" justify="space-between" style={{ fontSize: '0.8rem' }}>
          <Group gap={4} wrap="nowrap">
            <FileText size={14} />
            <Text size="xs" c="dimmed">
              {dayjs(rx.createdAt).format('DD/MM/YY')}
            </Text>
            <Badge size="xs" variant="light" color={statusColors[rx.status] || 'gray'}>
              {t(`recetario.status_${rx.status}` as any)}
            </Badge>
            <Badge size="xs" variant="outline">
              {t(`recetario.type_${rx.type}` as any)}
            </Badge>
          </Group>
          {rx.recetarioDocumentIds?.length > 0 && rx.recetarioDocumentIds[0].url && (
            <Anchor href={rx.recetarioDocumentIds[0].url} target="_blank" size="xs">
              {t('recetario.view_pdf')}
            </Anchor>
          )}
        </Group>
      ))}
    </Stack>
  );
}
