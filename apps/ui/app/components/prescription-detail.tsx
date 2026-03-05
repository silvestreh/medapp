import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Group, Popover, Text } from '@mantine/core';
import { useFetcher } from '@remix-run/react';
import { showNotification } from '@mantine/notifications';
import { Send } from 'lucide-react';
import { FormContainer, FormCard, FieldRow, StyledTitle, ItemHeader } from '~/components/forms/styles';
import { PrescribeModal, type PrescriptionResult } from '~/components/prescribe-modal';

interface Medicine {
  text: string;
  quantity: number;
  posology?: string;
  longTerm: boolean;
  genericOnly?: boolean;
  medicationId?: string;
}

interface PrescriptionDetailProps {
  prescription: {
    id: string;
    type: 'prescription' | 'order';
    status: string;
    content: {
      diagnosis?: string;
      medicines?: Medicine[];
      orderText?: string;
    } | null;
    recetarioDocumentIds?: { id: number; type: string; url: string }[];
  };
  onCancelled?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  completed: 'green',
  cancelled: 'red',
  expired: 'gray',
};

export function PrescriptionDetail({ prescription: rx, onCancelled }: PrescriptionDetailProps) {
  const { t } = useTranslation();
  const cancelFetcher = useFetcher<any>();
  const [confirming, setConfirming] = useState(false);
  const [shareOpened, setShareOpened] = useState(false);
  const cancelling = cancelFetcher.state !== 'idle';

  const handleCancelConfirm = () => {
    const recetarioDocumentId = rx.recetarioDocumentIds?.[0]?.id ?? null;
    cancelFetcher.submit(
      {
        intent: 'cancel-prescription',
        data: JSON.stringify({ prescriptionId: rx.id, recetarioDocumentId }),
      },
      { method: 'post' }
    );
    setConfirming(false);
  };

  // Watch for cancel success
  useEffect(() => {
    if (cancelFetcher.state !== 'idle' || !cancelFetcher.data?.success) return;
    showNotification({ color: 'green', message: t('recetario.cancel_success') });
    onCancelled?.();
  }, [cancelFetcher.state, cancelFetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const canCancel = rx.status !== 'cancelled' && rx.status !== 'expired';

  const sharePrescriptionResult: PrescriptionResult = {
    prescriptionId: rx.id,
    recetarioDocumentId: rx.recetarioDocumentIds?.[0]?.id ?? null,
    url: rx.recetarioDocumentIds?.[0]?.url ?? null,
    type: rx.type,
    diagnosis: rx.content?.diagnosis || '',
  };

  return (
    <FormContainer>
      <ItemHeader>
        <Group gap="sm" align="center" style={{ width: '100%' }}>
          <StyledTitle>{t(`recetario.type_${rx.type}` as any)}</StyledTitle>
          <Badge color={statusColors[rx.status] || 'gray'} variant="light">
            {t(`recetario.status_${rx.status}` as any)}
          </Badge>
          <Group gap="xs" style={{ marginLeft: 'auto', marginRight: '2.5rem' }}>
            {rx.recetarioDocumentIds?.[0]?.url && (
              <Button component="a" href={rx.recetarioDocumentIds[0].url} target="_blank" variant="light" size="xs">
                {t('recetario.view_pdf')}
              </Button>
            )}
            {rx.status === 'completed' && (
              <Button variant="light" size="xs" leftSection={<Send size={14} />} onClick={() => setShareOpened(true)}>
                {t('recetario.send_via')}
              </Button>
            )}
            {canCancel && (
              <Popover opened={confirming} onChange={setConfirming} withArrow shadow="md" position="bottom-end">
                <Popover.Target>
                  <Button variant="light" color="red" size="xs" onClick={() => setConfirming(true)}>
                    {t('recetario.cancel')}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Text size="sm" mb="sm">
                    {t('recetario.cancel_confirm')}
                  </Text>
                  <Group gap="xs" justify="flex-end">
                    <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
                      {t('common.no')}
                    </Button>
                    <Button size="xs" color="red" loading={cancelling} onClick={handleCancelConfirm}>
                      {t('common.yes')}
                    </Button>
                  </Group>
                </Popover.Dropdown>
              </Popover>
            )}
          </Group>
        </Group>
      </ItemHeader>
      <FormCard>
        {rx.content?.diagnosis && (
          <FieldRow label={t('recetario.diagnosis')}>
            <Text size="sm">{rx.content.diagnosis}</Text>
          </FieldRow>
        )}

        {rx.content?.medicines && rx.content.medicines.length > 0 && (
          <FieldRow label={t('recetario.medicines')}>
            {rx.content.medicines.map((m, i) => (
              <div key={i}>
                <Text size="sm" fw={500}>
                  {m.text}
                </Text>
                {(m.quantity || m.posology) && (
                  <Text size="xs" c="dimmed">
                    {[m.quantity && `×${m.quantity}`, m.posology].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </div>
            ))}
          </FieldRow>
        )}

        {rx.content?.orderText && (
          <FieldRow label={t('recetario.order_content')}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {rx.content.orderText}
            </Text>
          </FieldRow>
        )}
      </FormCard>
      <PrescribeModal
        opened={shareOpened}
        onClose={() => setShareOpened(false)}
        onSuccess={() => {}}
        initialPrescriptionResult={sharePrescriptionResult}
      />
    </FormContainer>
  );
}
