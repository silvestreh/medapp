import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Modal, SegmentedControl, Stack } from '@mantine/core';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useFeathers } from '~/components/provider';
import { pdfDataToBlob, printPdfBlob } from '~/utils/print-pdf';
import { DateRangeFilterState, DateRangePopover, resolveDateRange } from '~/components/date-range-popover';

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
  const [rangeFilter, setRangeFilter] = useState<DateRangeFilterState>({
    mode: 'between',
    lastAmount: 12,
    lastUnit: 'month',
    singleDate: dayjs().format('YYYY-MM-DD'),
    betweenRange: [
      dateRange.min ? dayjs(dateRange.min).startOf('month').format('YYYY-MM-DD') : null,
      dateRange.max ? dayjs(dateRange.max).startOf('month').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    ],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedRange = useMemo(
    () =>
      resolveDateRange(rangeFilter, {
        minRangeStart: dateRange.min ? dayjs(dateRange.min).startOf('month').format('YYYY-MM-DD') : '1900-01-01',
        maxDate: dayjs().format('YYYY-MM-DD'),
        precision: 'month',
      }),
    [dateRange.min, rangeFilter]
  );

  const handleSelectAll = useCallback(() => {
    setRangeFilter({
      mode: 'between',
      lastAmount: 12,
      lastUnit: 'month',
      singleDate: dayjs().format('YYYY-MM-DD'),
      betweenRange: [
        dateRange.min ? dayjs(dateRange.min).startOf('month').format('YYYY-MM-DD') : null,
        dateRange.max ? dayjs(dateRange.max).startOf('month').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      ],
    });
  }, [dateRange]);

  const isValid = useMemo(() => Boolean(resolvedRange), [resolvedRange]);

  const handleApplyRange = useCallback((nextState: DateRangeFilterState) => {
    setRangeFilter(nextState);
  }, []);

  const handlePrint = useCallback(async () => {
    if (!isValid || !client) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.service('signed-exports' as any).create({
        patientId,
        startDate: resolvedRange!.from.format('YYYY-MM-DD'),
        endDate: resolvedRange!.to.format('YYYY-MM-DD'),
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
  }, [isValid, client, patientId, resolvedRange, content, patientName, onClose]);

  return (
    <Modal opened={opened} onClose={onClose} title={t('print_pdf.title')} size="md">
      <Stack gap="md">
        <DateRangePopover
          value={rangeFilter}
          onApply={handleApplyRange}
          minRangeStart={dateRange.min ? dayjs(dateRange.min).startOf('month').format('YYYY-MM-DD') : '1900-01-01'}
          maxDate={dayjs().format('YYYY-MM-DD')}
          precision="month"
          fullWidth
        />

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
