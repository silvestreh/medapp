import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, FileInput, Group, PasswordInput, Text, Stack } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { FileSignature, Trash2, Upload, Info, ShieldCheck, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Portal from '~/components/portal';
import { useFeathers } from '~/components/provider';
import { encryptWithPin } from '~/lib/client-crypto';
import { FormCard, FieldRow, SectionTitle, FormHeader } from '~/components/forms/styles';

interface CertificateInfo {
  id: string;
  fileName: string | null;
  isClientEncrypted?: boolean;
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
  const [pinProtect, setPinProtect] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const fileInputRef = useRef<HTMLButtonElement>(null);

  const pinError = useMemo(() => {
    if (!pinProtect || !pinConfirm) return null;
    if (pin !== pinConfirm) return t('digital_signature.pin_mismatch');
    return null;
  }, [pinProtect, pin, pinConfirm, t]);

  const canUpload = useMemo(() => {
    if (!selectedFile) return false;
    if (pinProtect) {
      return pin.length > 0 && pin === pinConfirm;
    }
    return true;
  }, [selectedFile, pinProtect, pin, pinConfirm]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !client) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      if (pinProtect && pin) {
        const fileBuffer = await selectedFile.arrayBuffer();
        const encryptedBuffer = await encryptWithPin(fileBuffer, pin);
        const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        formData.append('certificate', encryptedBlob, selectedFile.name);
        formData.append('isClientEncrypted', 'true');
      } else {
        formData.append('certificate', selectedFile);
      }

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
      setPin('');
      setPinConfirm('');
      setPinProtect(false);
      onCertificateChange();
    } catch (err: any) {
      setError(err.message || t('digital_signature.upload_error'));
    } finally {
      setIsUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, client, onCertificateChange, pinProtect, pin]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificate, client, onCertificateChange]);

  useHotkeys(
    [
      [
        'mod+S',
        () => {
          if (canUpload) handleUpload();
        },
      ],
    ],
    []
  );

  return (
    <Stack gap={0}>
      <FormHeader>
        <SectionTitle icon={<FileSignature />}>{t('digital_signature.title')}</SectionTitle>
      </FormHeader>
      <Alert variant="light" color="blue" icon={<Info size={16} />} style={{ flex: 1, marginBottom: '1rem' }}>
        {t('digital_signature.info_notice')}
      </Alert>
      <FormCard>
        {error && (
          <FieldRow label="" variant="stacked">
            <Alert color="red" variant="light" onClose={() => setError(null)} withCloseButton style={{ flex: 1 }}>
              {error}
            </Alert>
          </FieldRow>
        )}

        {certificate && (
          <FieldRow label={`${t('digital_signature.certificate_loaded')}:`} variant="stacked">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Text size="sm">{certificate.fileName || 'certificado.pfx'}</Text>
                {certificate.isClientEncrypted && (
                  <Group gap={4}>
                    <Lock size={12} color="var(--mantine-color-blue-6)" />
                    <Text size="xs" c="blue.6" fw={500}>
                      {t('digital_signature.certificate_pin_protected')}
                    </Text>
                  </Group>
                )}
              </Group>
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
          </FieldRow>
        )}

        {!certificate && (
          <>
            <FieldRow label={`${t('digital_signature.file_label')}:`} variant="stacked">
              <FileInput
                ref={fileInputRef}
                placeholder={t('digital_signature.file_placeholder')}
                accept=".pfx,.p12"
                value={selectedFile}
                onChange={setSelectedFile}
              />
            </FieldRow>

            {selectedFile && (
              <>
                <FieldRow label="" variant="stacked">
                  <Checkbox
                    label={t('digital_signature.pin_protect_label')}
                    description={t('digital_signature.pin_protect_description')}
                    checked={pinProtect}
                    onChange={event => setPinProtect(event.currentTarget.checked)}
                  />
                </FieldRow>

                {pinProtect && (
                  <>
                    <FieldRow label={`${t('digital_signature.pin_label')}:`} variant="stacked">
                      <Group grow>
                        <PasswordInput
                          placeholder={t('digital_signature.pin_placeholder')}
                          value={pin}
                          onChange={event => setPin(event.currentTarget.value)}
                        />
                        <PasswordInput
                          placeholder={t('digital_signature.pin_confirm_placeholder')}
                          value={pinConfirm}
                          onChange={event => setPinConfirm(event.currentTarget.value)}
                          error={pinError}
                        />
                      </Group>
                      <Alert
                        variant="light"
                        color="orange"
                        icon={<Info size={14} />}
                        py="xs"
                        style={{ flex: 1, marginTop: '1rem' }}
                      >
                        <Text size="xs">{t('digital_signature.pin_warning')}</Text>
                      </Alert>
                    </FieldRow>
                  </>
                )}
              </>
            )}
          </>
        )}
      </FormCard>
      <Portal id="form-actions">
        <Button leftSection={<Upload size={16} />} loading={isUploading} disabled={!canUpload} onClick={handleUpload}>
          {t('digital_signature.upload')}
        </Button>
      </Portal>
      <Alert variant="light" color="yellow" icon={<ShieldCheck size={16} />} style={{ flex: 1, marginTop: '1rem' }}>
        {t('digital_signature.security_notice')}
      </Alert>
    </Stack>
  );
}
