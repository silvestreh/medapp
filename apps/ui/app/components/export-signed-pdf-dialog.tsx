import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Radio,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { FileDown, Info, Send, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useFeathers } from '~/components/provider';

type ExportContent = 'encounters' | 'studies' | 'both';

interface ExportSignedPdfDialogProps {
  opened: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  hasCertificate: boolean;
  dateRange: { min: Date | null; max: Date | null };
}

export function ExportSignedPdfDialog({
  opened,
  onClose,
  patientId,
  patientName,
  hasCertificate,
  dateRange,
}: ExportSignedPdfDialogProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const [content, setContent] = useState<ExportContent>('both');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [signDigitally, setSignDigitally] = useState(hasCertificate);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [delivery, setDelivery] = useState<string>('download');
  const [emailTo, setEmailTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSelectAll = useCallback(() => {
    setStartDate(dateRange.min ? dayjs(dateRange.min).startOf('month').toDate() : null);
    setEndDate(dateRange.max ? dayjs(dateRange.max).startOf('month').toDate() : dayjs().startOf('month').toDate());
  }, [dateRange]);

  const isValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (signDigitally && !certificatePassword) return false;
    if (delivery === 'email' && !emailTo) return false;
    return true;
  }, [startDate, endDate, signDigitally, certificatePassword, delivery, emailTo]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || !client) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        patientId,
        startDate: dayjs(startDate).startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs(endDate).endOf('month').format('YYYY-MM-DD'),
        content,
        delivery,
      };

      if (signDigitally && certificatePassword) {
        payload.certificatePassword = certificatePassword;
      }

      if (delivery === 'email') {
        payload.emailTo = emailTo;
      }

      const result = await client.service('signed-exports' as any).create(payload);

      if (delivery === 'download' && result.pdf) {
        const pdfData = result.pdf.data || result.pdf;
        let blob: Blob;

        if (Array.isArray(pdfData)) {
          blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
        } else if (typeof pdfData === 'string') {
          const binaryString = atob(pdfData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: 'application/pdf' });
        } else {
          blob = new Blob([pdfData], { type: 'application/pdf' });
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName || `historia_clinica_${patientName.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onClose();
      } else if (delivery === 'email') {
        setSuccess(result.message || t('export_pdf.pdf_sent', { email: emailTo }));
        setTimeout(() => onClose(), 2000);
      }
    } catch (err: any) {
      setError(err.message || t('export_pdf.error_generating'));
    } finally {
      setIsLoading(false);
    }
  }, [isValid, client, patientId, startDate, endDate, signDigitally, certificatePassword, delivery, emailTo, patientName, onClose]);

  const buttonLabel = useMemo(() => {
    if (signDigitally) {
      return delivery === 'email' ? t('export_pdf.sign_and_send') : t('export_pdf.sign_and_download');
    }
    return delivery === 'email' ? t('export_pdf.send') : t('export_pdf.download');
  }, [signDigitally, delivery, t]);

  return (
    <Modal opened={opened} onClose={onClose} title={t('export_pdf.title')} size="md">
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
          onChange={(val) => setContent(val as ExportContent)}
          data={[
            { label: t('export_pdf.content_encounters'), value: 'encounters' },
            { label: t('export_pdf.content_studies'), value: 'studies' },
            { label: t('export_pdf.content_both'), value: 'both' },
          ]}
          fullWidth
        />

        {hasCertificate && (
          <Stack gap="xs">
            <Checkbox
              label={t('export_pdf.sign_digitally')}
              checked={signDigitally}
              onChange={(event) => setSignDigitally(event.currentTarget.checked)}
            />
            {signDigitally && (
              <PasswordInput
                label={t('export_pdf.certificate_password_label')}
                description={t('export_pdf.certificate_password_description')}
                placeholder={t('export_pdf.certificate_password_placeholder')}
                value={certificatePassword}
                onChange={(event) => setCertificatePassword(event.currentTarget.value)}
                required
              />
            )}
          </Stack>
        )}

        {!hasCertificate && (
          <Alert variant="light" color="gray" icon={<Info size={16} />}>
            <Text size="sm">
              {t('export_pdf.no_certificate_notice')}{' '}
              <Text component="a" href="/profile" size="sm" c="blue" td="underline">
                {t('export_pdf.upload_certificate_link')}
              </Text>
            </Text>
          </Alert>
        )}

        <Radio.Group
          label={t('export_pdf.delivery_label')}
          value={delivery}
          onChange={setDelivery}
        >
          <Group mt="xs">
            <Radio value="download" label={t('export_pdf.delivery_download')} icon={() => <Download size={12} />} />
            <Radio value="email" label={t('export_pdf.delivery_email')} icon={() => <Send size={12} />} />
          </Group>
        </Radio.Group>

        {delivery === 'email' && (
          <TextInput
            label={t('export_pdf.recipient_email_label')}
            placeholder={t('export_pdf.recipient_email_placeholder')}
            type="email"
            value={emailTo}
            onChange={(event) => setEmailTo(event.currentTarget.value)}
            required
          />
        )}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {success && (
          <Alert color="green" variant="light">
            {success}
          </Alert>
        )}

        <Button
          leftSection={<FileDown size={16} />}
          loading={isLoading}
          disabled={!isValid}
          onClick={handleSubmit}
          fullWidth
        >
          {buttonLabel}
        </Button>
      </Stack>
    </Modal>
  );
}
