import { useCallback, useRef, useState } from 'react';
import { Alert, Button, FileInput, Group, Stack, Text } from '@mantine/core';
import { FileSignature, Trash2, Upload, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFeathers } from '~/components/provider';

interface CertificateInfo {
  id: string;
  fileName: string | null;
  createdAt: string;
}

interface ProfileDigitalSignatureProps {
  certificate: CertificateInfo | null;
  onCertificateChange: () => void;
}

export function ProfileDigitalSignature({ certificate, onCertificateChange }: ProfileDigitalSignatureProps) {
  const { t } = useTranslation();
  const client = useFeathers();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLButtonElement>(null);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !client) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('certificate', selectedFile);

      const token = await (client as any).authentication?.getAccessToken?.();
      const baseUrl = '/api';
      const orgId = (client as any).organizationId;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (orgId) headers['organization-id'] = orgId;

      const response = await fetch(`${baseUrl}/signing-certificates`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || t('digital_signature.upload_error'));
      }

      setSelectedFile(null);
      onCertificateChange();
    } catch (err: any) {
      setError(err.message || t('digital_signature.upload_error'));
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, client, onCertificateChange]);

  const handleRemove = useCallback(async () => {
    if (!certificate || !client) return;

    setIsRemoving(true);
    setError(null);

    try {
      await client.service('signing-certificates' as any).remove(certificate.id);
      onCertificateChange();
    } catch (err: any) {
      setError(err.message || t('digital_signature.remove_error'));
    } finally {
      setIsRemoving(false);
    }
  }, [certificate, client, onCertificateChange]);

  return (
    <Stack gap="md">
      <Group gap="xs">
        <FileSignature size={20} />
        <Text fw={600} size="lg">{t('digital_signature.title')}</Text>
      </Group>

      <Alert variant="light" color="blue" icon={<Info size={16} />}>
        {t('digital_signature.info_notice')}
      </Alert>

      {error && (
        <Alert color="red" variant="light" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      {certificate && (
        <Alert variant="light" color="green" icon={<FileSignature size={16} />}>
          <Group justify="space-between" align="center">
            <div>
              <Text size="sm" fw={500}>{t('digital_signature.certificate_loaded')}</Text>
              <Text size="xs" c="dimmed">{certificate.fileName || 'certificado.pfx'}</Text>
            </div>
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<Trash2 size={14} />}
              loading={isRemoving}
              onClick={handleRemove}
            >
              {t('digital_signature.remove')}
            </Button>
          </Group>
        </Alert>
      )}

      {!certificate && (
        <Stack gap="sm">
          <FileInput
            ref={fileInputRef}
            label={t('digital_signature.file_label')}
            placeholder={t('digital_signature.file_placeholder')}
            accept=".pfx,.p12"
            value={selectedFile}
            onChange={setSelectedFile}
          />
          <Button
            leftSection={<Upload size={16} />}
            loading={isUploading}
            disabled={!selectedFile}
            onClick={handleUpload}
          >
            {t('digital_signature.upload')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
