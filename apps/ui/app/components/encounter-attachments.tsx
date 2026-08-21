import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, Text, Image, ActionIcon, Group, Anchor, Tooltip, Paper, Loader, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { DownloadSimpleIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react';

import { useFeathers } from '~/components/provider';
import { styled } from '~/styled-system/jsx';
import { trackAction } from '~/utils/breadcrumbs';

export interface AttachmentData {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,application/dicom';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Viewer component (content area, like forms/studies) ---

interface AttachmentViewerProps {
  attachment: AttachmentData;
  /** Encounter the attachment belongs to — required to mint a signed link for encrypted files. */
  encounterId?: string | number;
}

const ENCRYPTED_UPLOAD_URL = /^\/api\/uploads\/[^/?#]+\.enc$/;

/**
 * Encrypted uploads can't be fetched with the bare capability URL any more:
 * `attachment-links` checks encounter access, logs it, and returns a
 * short-lived signed URL that `<img>` / `<iframe>` / `<a download>` can load.
 * Non-encrypted urls (Cloudinary, legacy disk) are used as-is.
 */
function useSignedAttachmentUrl(attachment: AttachmentData, encounterId?: string | number) {
  const client = useFeathers();
  const needsSigning = ENCRYPTED_UPLOAD_URL.test(attachment.url);
  const [signedUrl, setSignedUrl] = useState<string | null>(needsSigning ? null : attachment.url);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(async (): Promise<string | null> => {
    if (!needsSigning) return attachment.url;
    if (!encounterId) {
      setError('missing-encounter');
      return null;
    }
    try {
      const link = await client.service('attachment-links').create({ encounterId, url: attachment.url });
      setSignedUrl(link.url);
      setError(null);
      return link.url as string;
    } catch (err: any) {
      setError(err?.message || 'error');
      return null;
    }
  }, [client, attachment.url, encounterId, needsSigning]);

  useEffect(() => {
    if (!needsSigning) {
      setSignedUrl(attachment.url);
      return;
    }
    setSignedUrl(null);
    mint();
  }, [mint, needsSigning, attachment.url]);

  return { signedUrl, error, mint };
}

export function AttachmentViewer({ attachment, encounterId }: AttachmentViewerProps) {
  const { t } = useTranslation();
  const { signedUrl, error, mint } = useSignedAttachmentUrl(attachment, encounterId);

  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';

  // Links expire: mint a fresh one on every download click instead of trusting
  // whatever is currently rendered.
  const handleDownload = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const url = await mint();
      if (url) window.location.assign(url);
    },
    [mint]
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600} size="lg">
            {attachment.fileName}
          </Text>
          <Text size="sm" c="dimmed">
            {formatSize(attachment.fileSize)}
          </Text>
        </div>
        <Tooltip label={t('common.download')}>
          <ActionIcon
            variant="light"
            component="a"
            href={signedUrl ?? '#'}
            download={attachment.fileName}
            disabled={!signedUrl}
            onClick={handleDownload}
          >
            <DownloadSimpleIcon size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && <Alert color="red">{t('common.error_unexpected')}</Alert>}

      {!error && !signedUrl && (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      )}

      {signedUrl && isImage && <Image src={signedUrl} alt={attachment.fileName} fit="contain" mah={600} radius="sm" />}

      {signedUrl && isPdf && (
        <iframe
          src={signedUrl}
          title={attachment.fileName}
          style={{ width: '100%', height: '80vh', border: 'none', borderRadius: '4px' }}
        />
      )}

      {signedUrl && !isImage && !isPdf && (
        <Stack align="center" gap="sm" py="xl">
          <Text c="dimmed">{t('encounters.no_preview')}</Text>
          <Anchor href={signedUrl} download={attachment.fileName} onClick={handleDownload}>
            {t('common.download')}
          </Anchor>
        </Stack>
      )}
    </Stack>
  );
}

// --- Upload hook ---

export function useAttachmentUpload(onAttached: (attachment: AttachmentData) => void) {
  const client = useFeathers();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      setUploading(true);
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

        trackAction('Uploaded attachment', { fileName: file.name, mimeType: file.type });
        onAttached({
          url,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        notifications.show({ message: t('encounters.attachment_uploaded'), color: 'green' });
      } catch (err: any) {
        notifications.show({ message: err.message || t('common.error_unexpected'), color: 'red' });
      } finally {
        setUploading(false);
      }
    },
    [client, onAttached, t]
  );

  const FileInputElement = (
    <input ref={fileInputRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={handleUpload} />
  );

  return { openFilePicker, uploading, FileInputElement };
}

// --- Floating attachments list (bottom-right, for new encounter screen) ---

const FloatingContainer = styled('div', {
  base: {
    position: 'fixed',
    bottom: '6rem',
    right: '2rem',
    zIndex: 100,
    width: '320px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
});

interface FloatingAttachmentsListProps {
  attachments: AttachmentData[];
  onRemove: (index: number) => void;
}

export function FloatingAttachmentsList({ attachments, onRemove }: FloatingAttachmentsListProps) {
  const { t } = useTranslation();

  if (attachments.length === 0) return null;

  return (
    <FloatingContainer>
      <Paper shadow="md" p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Group gap="xs">
            <PaperclipIcon size={14} />
            <Text size="sm" fw={600}>
              {t('encounters.attachments')} ({attachments.length})
            </Text>
          </Group>
          {attachments.map((att, i) => (
            <Group key={`${att.url}-${i}`} justify="space-between" gap="xs">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" truncate>
                  {att.fileName}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatSize(att.fileSize)}
                </Text>
              </div>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onRemove(i)}>
                <XIcon size={12} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      </Paper>
    </FloatingContainer>
  );
}
