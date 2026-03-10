import { useCallback, useRef, useState } from 'react';
import { Alert, Badge, Button, Group, Image, Stack, Text, Paper } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { Camera, CreditCard, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';

import { useFeathers } from '~/components/provider';
import { SectionTitle, FormCard } from '~/components/forms/styles';

type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface IdentityVerificationFormProps {
  currentStatus: VerificationStatus;
  rejectionReason?: string | null;
  onSubmitted: () => void;
}

type UploadSlot = 'idFront' | 'idBack' | 'selfie';

interface UploadedFile {
  url: string;
  fileName: string;
  preview?: string;
}

const ACCEPT_IMAGES = 'image/png,image/jpeg,image/webp';

export function IdentityVerificationForm({
  currentStatus,
  rejectionReason,
  onSubmitted,
}: IdentityVerificationFormProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const [uploads, setUploads] = useState<Record<UploadSlot, UploadedFile | null>>({
    idFront: null,
    idBack: null,
    selfie: null,
  });
  const [uploading, setUploading] = useState<UploadSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<UploadSlot>('idFront');

  const handlePickFile = useCallback((slot: UploadSlot) => {
    activeSlotRef.current = slot;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      const slot = activeSlotRef.current;
      setUploading(slot);

      try {
        const token = await (client as any).authentication?.getAccessToken?.();
        const orgId = (client as any).organizationId;
        const authHeaders: Record<string, string> = {};
        if (token) authHeaders['Authorization'] = `Bearer ${token}`;
        if (orgId) authHeaders['organization-id'] = orgId;

        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/file-uploads?encrypted=true', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Upload failed');
        }

        const { url } = await res.json();
        const preview = URL.createObjectURL(file);

        setUploads((prev) => ({
          ...prev,
          [slot]: { url, fileName: file.name, preview },
        }));
      } catch (err: any) {
        notifications.show({ message: err.message || t('common.something_went_wrong'), color: 'red' });
      } finally {
        setUploading(null);
      }
    },
    [client, t]
  );

  const handleSubmit = useCallback(async () => {
    if (!uploads.idFront || !uploads.idBack || !uploads.selfie) return;

    setSubmitting(true);
    try {
      const token = await (client as any).authentication?.getAccessToken?.();
      const orgId = (client as any).organizationId;
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      if (orgId) authHeaders['organization-id'] = orgId;

      const res = await fetch('/api/identity-verifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          idFrontUrl: uploads.idFront.url,
          idBackUrl: uploads.idBack.url,
          selfieUrl: uploads.selfie.url,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Submission failed');
      }

      notifications.show({
        message: t('identity_verification.submitted_success'),
        color: 'green',
      });
      onSubmitted();
    } catch (err: any) {
      notifications.show({ message: err.message || t('common.something_went_wrong'), color: 'red' });
    } finally {
      setSubmitting(false);
    }
  }, [uploads, client, t, onSubmitted]);

  const allUploaded = uploads.idFront && uploads.idBack && uploads.selfie;

  return (
    <Stack gap="md">
      <SectionTitle id="identity-verification" icon={<CreditCard />}>
        {t('identity_verification.title')}
      </SectionTitle>

      {currentStatus === 'verified' && (
        <Alert icon={<CheckCircle size={18} />} color="green">
          {t('identity_verification.status_verified')}
        </Alert>
      )}

      {currentStatus === 'pending' && (
        <Alert icon={<Clock size={18} />} color="yellow">
          {t('identity_verification.status_pending')}
        </Alert>
      )}

      {currentStatus === 'rejected' && (
        <Alert icon={<XCircle size={18} />} color="red">
          {t('identity_verification.status_rejected')}
          {rejectionReason && (
            <Text size="sm" mt="xs">
              {t('identity_verification.rejection_reason')}: {rejectionReason}
            </Text>
          )}
        </Alert>
      )}

      {(currentStatus === 'none' || currentStatus === 'rejected') && (
        <>
          <Text size="sm" c="dimmed">
            {t('identity_verification.instructions')}
          </Text>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_IMAGES}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <FormCard>
            <Stack gap="md" p="md">
              <UploadSlotButton
                label={t('identity_verification.id_front')}
                file={uploads.idFront}
                loading={uploading === 'idFront'}
                onClick={() => handlePickFile('idFront')}
              />
              <UploadSlotButton
                label={t('identity_verification.id_back')}
                file={uploads.idBack}
                loading={uploading === 'idBack'}
                onClick={() => handlePickFile('idBack')}
              />
              <UploadSlotButton
                label={t('identity_verification.selfie')}
                file={uploads.selfie}
                loading={uploading === 'selfie'}
                onClick={() => handlePickFile('selfie')}
              />
            </Stack>
          </FormCard>

          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!allUploaded}
            leftSection={<Upload size={16} />}
          >
            {t('identity_verification.submit_button')}
          </Button>
        </>
      )}
    </Stack>
  );
}

function UploadSlotButton({
  label,
  file,
  loading,
  onClick,
}: {
  label: string;
  file: UploadedFile | null;
  loading: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Paper withBorder p="sm" radius="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={500} size="sm">
            {label}
          </Text>
          {file && (
            <Badge color="green" variant="light" size="sm" mt={4}>
              {file.fileName}
            </Badge>
          )}
        </div>
        <Button
          variant={file ? 'light' : 'outline'}
          size="xs"
          loading={loading}
          onClick={onClick}
          leftSection={<Camera size={14} />}
        >
          {file ? t('identity_verification.change_photo') : t('identity_verification.upload_photo')}
        </Button>
      </Group>
      {file?.preview && (
        <Image src={file.preview} alt={label} mah={120} mt="xs" radius="sm" fit="contain" />
      )}
    </Paper>
  );
}
