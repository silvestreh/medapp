import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FileArrowDownIcon, InfoIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useFeathers } from '~/components/provider';
import { DateRangeFilterState, DateRangePopover, resolveDateRange } from '~/components/date-range-popover';
import { trackAction, trackFeature } from '~/utils/breadcrumbs';

type ExportContent = 'encounters' | 'studies' | 'both';

interface ExportSignedPdfDialogProps {
  opened: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  hasCertificate: boolean;
  isCertificateEncrypted: boolean;
  dateRange: { min: Date | null; max: Date | null };
}

export function ExportSignedPdfDialog({
  opened,
  onClose,
  patientId,
  patientName,
  hasCertificate,
  isCertificateEncrypted,
  dateRange,
}: ExportSignedPdfDialogProps) {
  const { t, i18n } = useTranslation();
  const client = useFeathers();
  const prevOpenedRef = useRef(false);
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
  const [signDigitally, setSignDigitally] = useState(hasCertificate);
  const [encryptionPin, setEncryptionPin] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
  const [delivery, setDelivery] = useState<string>('download');
  const [emailTo, setEmailTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleApplyRange = useCallback((nextState: DateRangeFilterState) => {
    setRangeFilter(nextState);
  }, []);

  useEffect(() => {
    if (opened && !prevOpenedRef.current) {
      trackAction('Opened export signed PDF dialog', { patientId });
    }
    prevOpenedRef.current = opened;
  }, [opened, patientId]);

  const isValid = useMemo(() => {
    if (!resolvedRange) return false;
    if (signDigitally && !certificatePassword) return false;
    if (signDigitally && isCertificateEncrypted && !encryptionPin) return false;
    if (delivery === 'email' && !emailTo) return false;
    return true;
  }, [resolvedRange, signDigitally, certificatePassword, isCertificateEncrypted, encryptionPin, delivery, emailTo]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || !client) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        patientId,
        startDate: resolvedRange!.from.format('YYYY-MM-DD'),
        endDate: resolvedRange!.to.format('YYYY-MM-DD'),
        content,
        delivery,
        locale: i18n.language,
      };

      if (signDigitally && certificatePassword) {
        payload.certificatePassword = certificatePassword;
      }

      if (signDigitally && isCertificateEncrypted && encryptionPin) {
        payload.encryptionPin = encryptionPin;
      }

      if (delivery === 'email') {
        payload.emailTo = emailTo;
      }

      const result = await client.service('signed-exports' as any).create(payload);
      trackFeature('Exported signed PDF', { patientId });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isValid,
    client,
    patientId,
    resolvedRange,
    signDigitally,
    encryptionPin,
    certificatePassword,
    isCertificateEncrypted,
    delivery,
    emailTo,
    patientName,
    onClose,
  ]);

  const buttonLabel = useMemo(() => {
    if (signDigitally) {
      return delivery === 'email' ? t('export_pdf.sign_and_send') : t('export_pdf.sign_and_download');
    }
    return delivery === 'email' ? t('export_pdf.send') : t('export_pdf.download');
  }, [signDigitally, delivery, t]);

  return (
    <Modal opened={opened} onClose={onClose} title={t('export_pdf.title')} size="md">
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

        {hasCertificate && (
          <Stack gap="xs">
            <Checkbox
              label={t('export_pdf.sign_digitally')}
              checked={signDigitally}
              onChange={event => setSignDigitally(event.currentTarget.checked)}
            />
            {signDigitally && (
              <Stack gap="xs">
                {isCertificateEncrypted && (
                  <PasswordInput
                    label={t('export_pdf.encryption_pin_label')}
                    description={t('export_pdf.encryption_pin_description')}
                    placeholder={t('export_pdf.encryption_pin_placeholder')}
                    value={encryptionPin}
                    onChange={event => setEncryptionPin(event.currentTarget.value)}
                    required
                  />
                )}
                <PasswordInput
                  label={t('export_pdf.certificate_password_label')}
                  description={t('export_pdf.certificate_password_description')}
                  placeholder={t('export_pdf.certificate_password_placeholder')}
                  value={certificatePassword}
                  onChange={event => setCertificatePassword(event.currentTarget.value)}
                  required
                />
              </Stack>
            )}
          </Stack>
        )}

        {!hasCertificate && (
          <Alert variant="light" color="gray" icon={<InfoIcon size={16} />}>
            <Text size="sm">
              {t('export_pdf.no_certificate_notice')}{' '}
              <Text component="a" href="/settings" size="sm" c="var(--mantine-primary-color-4)" td="underline">
                {t('export_pdf.upload_certificate_link')}
              </Text>
            </Text>
          </Alert>
        )}

        <Radio.Group label={t('export_pdf.delivery_label')} value={delivery} onChange={setDelivery}>
          <Group mt="xs">
            <Radio value="download" label={t('export_pdf.delivery_download')} />
            <Radio value="email" label={t('export_pdf.delivery_email')} />
          </Group>
        </Radio.Group>

        {delivery === 'email' && (
          <TextInput
            label={t('export_pdf.recipient_email_label')}
            placeholder={t('export_pdf.recipient_email_placeholder')}
            type="email"
            value={emailTo}
            onChange={event => setEmailTo(event.currentTarget.value)}
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
          leftSection={<FileArrowDownIcon size={16} />}
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
