import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, SegmentedControl, Stack } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useFeathers } from '~/components/provider';
import { pdfDataToBlob, printPdfBlob } from '~/utils/print-pdf';

type ExportContent = 'encounters' | 'studies' | 'both';

interface PrintPdfDialogProps {
  opened: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  dateRange: { min: Date | null; max: Date | null };
}

export function PrintPdfDialog({ opened, onClose, patientId, patientName, dateRange }: PrintPdfDialogProps) {
  const { t, i18n } = useTranslation();
  const client = useFeathers();
  const [content, setContent] = useState<ExportContent>('both');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectAll = useCallback(() => {
    setStartDate(dateRange.min ? dayjs(dateRange.min).startOf('month').toISOString() : null);
    setEndDate(
      dateRange.max ? dayjs(dateRange.max).startOf('month').toISOString() : dayjs().startOf('month').toISOString()
    );
  }, [dateRange]);

  const isValid = useMemo(() => {
    return Boolean(startDate && endDate);
  }, [startDate, endDate]);

  const handlePrint = useCallback(async () => {
    if (!isValid || !client) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.service('signed-exports' as any).create({
        patientId,
        startDate: dayjs(startDate).startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs(endDate).endOf('month').format('YYYY-MM-DD'),
        content,
        delivery: 'download',
        locale: i18n.language,
      });

      if (!result.pdf) {
        throw new Error(t('print_pdf.error_generating'));
      }

      printPdfBlob(pdfDataToBlob(result));
      onClose();
    } catch (err: any) {
      setError(err.message || t('print_pdf.error_generating'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, client, patientId, startDate, endDate, content, patientName, onClose]);

  return (
    <Modal opened={opened} onClose={onClose} title={t('print_pdf.title')} size="md">
      <Stack gap="md">
        <Group gap="sm" grow>
          <MonthPickerInput
            label={t('export_pdf.from')}
            placeholder={t('export_pdf.month_placeholder')}
            value={startDate}
            onChange={setStartDate}
            valueFormat="MM/YYYY"
            maxDate={endDate || undefined}
          />
          <MonthPickerInput
            label={t('export_pdf.to')}
            placeholder={t('export_pdf.month_placeholder')}
            value={endDate}
            onChange={setEndDate}
            valueFormat="MM/YYYY"
            minDate={startDate || undefined}
          />
        </Group>

        <Button variant="light" size="xs" onClick={handleSelectAll}>
          {t('export_pdf.all_history')}
        </Button>

        <SegmentedControl
          value={content}
          onChange={val => setContent(val as ExportContent)}
          data={[
            { label: t('export_pdf.content_encounters'), value: 'encounters' },
            { label: t('export_pdf.content_studies'), value: 'studies' },
            { label: t('export_pdf.content_both'), value: 'both' },
          ]}
          fullWidth
        />

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <Button
          leftSection={<Printer size={16} />}
          loading={isLoading}
          disabled={!isValid}
          onClick={handlePrint}
          fullWidth
        >
          {t('print_pdf.print')}
        </Button>
      </Stack>
    </Modal>
  );
}
