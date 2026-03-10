import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Group, Image, Loader, Paper, SegmentedControl, Stack, Stepper, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { Camera, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

import { useFeathers } from '~/components/provider';
import { SectionTitle, FormCard } from '~/components/forms/styles';
import { CameraCapture } from '~/components/camera-capture';
import { QrVerificationSession } from '~/components/qr-verification-session';
import { getVerificationApiUrl } from '~/verification-feathers';

type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface IdentityVerificationFormProps {
  currentStatus: VerificationStatus;
  rejectionReason?: string | null;
  onSubmitted: () => void;
  autoChecksRunning?: boolean;
}

type UploadSlot = 'idFront' | 'idBack' | 'selfie';

interface UploadedFile {
  url: string;
  fileName: string;
  preview?: string;
}

interface PhotoValidation {
  hasBarcode: boolean;
  hasFace: boolean;
}

type CaptureMode = 'intro' | 'camera' | 'qr';

const ACCEPT_IMAGES = 'image/png,image/jpeg,image/webp';

const SLOT_FACING_MODE: Record<UploadSlot, 'environment' | 'user'> = {
  idFront: 'environment',
  idBack: 'environment',
  selfie: 'user',
};

const SLOT_AUTO_DETECT: Record<UploadSlot, 'barcode' | 'face' | 'text'> = {
  idFront: 'barcode',
  idBack: 'text',
  selfie: 'face',
};

const SLOT_ORDER: UploadSlot[] = ['idFront', 'idBack', 'selfie'];

function slotToTranslationKey(slot: UploadSlot): string {
  if (slot === 'idFront') return 'id_front';
  if (slot === 'idBack') return 'id_back';
  return 'selfie';
}

export function IdentityVerificationForm({
  currentStatus,
  rejectionReason,
  onSubmitted,
  autoChecksRunning = false,
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
  const [captureMode, setCaptureMode] = useState<CaptureMode>('intro');
  const [activeStep, setActiveStep] = useState(0);
  const [validating, setValidating] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const translatedRejectionReason = useMemo(() => {
    if (!rejectionReason) return null;
    return rejectionReason
      .split('\n')
      .map((line) => {
        const [key, ...rest] = line.split(':');
        const details = rest.join(':').trim();
        if (key === 'dni_mismatch') {
          return t('identity_verification.rejection_dni_mismatch', { details });
        }
        if (key === 'face_mismatch') {
          return t('identity_verification.rejection_face_mismatch', { score: details });
        }
        if (key === 'selfie_not_recent') {
          return t('identity_verification.rejection_selfie_not_recent');
        }
        return t('identity_verification.rejection_unknown', { reason: line });
      })
      .join('\n\n');
  }, [rejectionReason, t]);

  const handleStartCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCaptureMode('camera');
    } catch {
      setCaptureMode('qr');
    }
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await (client as any).authentication?.getAccessToken?.();
    const orgId = (client as any).organizationId;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['organization-id'] = orgId;
    return headers;
  }, [client]);

  const validateIdFrontPhoto = useCallback(
    async (blob: Blob): Promise<PhotoValidation | null> => {
      try {
        const headers = await getAuthHeaders();
        const formData = new FormData();
        formData.append('file', blob, 'idFront.jpg');

        const verificationUrl = getVerificationApiUrl();
        const res = await fetch(`${verificationUrl}/validate-photo`, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    [getAuthHeaders]
  );

  const submitVerification = useCallback(
    async (urls: { idFrontUrl: string; idBackUrl: string; selfieUrl: string }) => {
      setSubmitting(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/identity-verifications', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(urls),
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('common.something_went_wrong');
        notifications.show({ message, color: 'red' });
      } finally {
        setSubmitting(false);
      }
    },
    [getAuthHeaders, t, onSubmitted]
  );

  const uploadBlob = useCallback(
    async (blob: Blob, slot: UploadSlot) => {
      setUploading(slot);
      setValidationWarning(null);
      try {
        const headers = await getAuthHeaders();

        const formData = new FormData();
        formData.append('file', blob, `${slot}.jpg`);
        const res = await fetch('/api/file-uploads?encrypted=true', {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Upload failed');
        }

        const { url } = await res.json();
        const preview = URL.createObjectURL(blob);

        const newUploads = {
          ...uploads,
          [slot]: { url, fileName: `${slot}.jpg`, preview },
        };
        setUploads(newUploads);

        // Validate ID front photo
        if (slot === 'idFront') {
          setValidating(true);
          const validation = await validateIdFrontPhoto(blob);
          setValidating(false);

          if (validation) {
            const warnings: string[] = [];
            if (!validation.hasBarcode) {
              warnings.push(t('identity_verification.no_barcode_warning'));
            }
            if (!validation.hasFace) {
              warnings.push(t('identity_verification.no_face_warning'));
            }

            if (warnings.length > 0) {
              setValidationWarning(warnings.join(' '));
              // Don't auto-advance — let user retake or manually continue
              return;
            }
          }
          // Validation passed or unavailable — auto-advance
          setActiveStep(1);
        } else if (slot === 'idBack') {
          // Auto-advance to selfie
          setActiveStep(2);
        } else if (slot === 'selfie') {
          // All photos uploaded — auto-submit
          const finalUploads = newUploads as Record<UploadSlot, UploadedFile>;
          if (finalUploads.idFront && finalUploads.idBack && finalUploads.selfie) {
            await submitVerification({
              idFrontUrl: finalUploads.idFront.url,
              idBackUrl: finalUploads.idBack.url,
              selfieUrl: finalUploads.selfie.url,
            });
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('common.something_went_wrong');
        notifications.show({ message, color: 'red' });
      } finally {
        setUploading(null);
      }
    },
    [client, t, uploads, getAuthHeaders, validateIdFrontPhoto, submitVerification]
  );

  const handleCameraCapture = useCallback(
    (blob: Blob) => {
      const slot = SLOT_ORDER[activeStep];
      if (slot) {
        uploadBlob(blob, slot);
      }
    },
    [activeStep, uploadBlob]
  );

  const handleCancelCapture = useCallback(() => {
    // no-op: camera is always visible in current step
  }, []);

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      const slot = SLOT_ORDER[activeStep];
      if (slot) {
        await uploadBlob(file, slot);
      }
    },
    [activeStep, uploadBlob]
  );

  const handleForceAdvance = useCallback(() => {
    setValidationWarning(null);
    setActiveStep((s) => Math.min(s + 1, 2));
  }, []);

  const handleRetake = useCallback(() => {
    const slot = SLOT_ORDER[activeStep];
    if (slot) {
      setUploads((prev) => ({ ...prev, [slot]: null }));
      setValidationWarning(null);
    }
  }, [activeStep]);

  const handleQrCompleted = useCallback(
    (urls: { idFrontUrl: string; idBackUrl: string; selfieUrl: string }) => {
      submitVerification(urls);
    },
    [submitVerification]
  );

  const currentSlot = SLOT_ORDER[activeStep];
  const currentUpload = currentSlot ? uploads[currentSlot] : null;

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
        <Alert
          icon={autoChecksRunning ? <Loader size={18} /> : <Clock size={18} />}
          color={autoChecksRunning ? 'blue' : 'yellow'}
        >
          {autoChecksRunning
            ? t('identity_verification.auto_checking')
            : t('identity_verification.status_pending')
          }
        </Alert>
      )}

      {currentStatus === 'rejected' && (
        <Alert icon={<XCircle size={18} />} color="red">
          {t('identity_verification.status_rejected')}
          {translatedRejectionReason && (
            <Text size="sm" mt="xs" component="div">
              <strong>{t('identity_verification.rejection_reason')}:</strong>
              <Markdown>{translatedRejectionReason}</Markdown>
            </Text>
          )}
        </Alert>
      )}

      {(currentStatus === 'none' || currentStatus === 'rejected') && (
        <>
          {/* Intro: explain the process before accessing camera */}
          {captureMode === 'intro' && (
            <FormCard>
              <Stack gap="md" p="md">
                <Text fw={600}>{t('identity_verification.intro_title')}</Text>
                <Text size="sm" c="dimmed">{t('identity_verification.intro_subtitle')}</Text>
                <Stack gap="xs">
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={700} c="blue" size="lg" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>1</Text>
                    <div>
                      <Text size="sm" fw={600}>{t('identity_verification.id_front')}</Text>
                      <Text size="xs" c="dimmed">{t('identity_verification.intro_step1_desc')}</Text>
                    </div>
                  </Group>
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={700} c="blue" size="lg" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>2</Text>
                    <div>
                      <Text size="sm" fw={600}>{t('identity_verification.id_back')}</Text>
                      <Text size="xs" c="dimmed">{t('identity_verification.intro_step2_desc')}</Text>
                    </div>
                  </Group>
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={700} c="blue" size="lg" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>3</Text>
                    <div>
                      <Text size="sm" fw={600}>{t('identity_verification.selfie')}</Text>
                      <Text size="xs" c="dimmed">{t('identity_verification.intro_step3_desc')}</Text>
                    </div>
                  </Group>
                </Stack>
                <Button onClick={handleStartCamera}>{t('identity_verification.start_button')}</Button>
                <Button variant="subtle" size="sm" onClick={() => setCaptureMode('qr')}>
                  {t('identity_verification.mode_qr')}
                </Button>
              </Stack>
            </FormCard>
          )}

          {/* Mode switcher */}
          {(captureMode === 'camera' || captureMode === 'qr') && (
            <SegmentedControl
              value={captureMode}
              onChange={(value) => setCaptureMode(value as CaptureMode)}
              data={[
                { label: t('identity_verification.mode_camera'), value: 'camera' },
                { label: t('identity_verification.mode_qr'), value: 'qr' },
              ]}
              size="sm"
            />
          )}

          {/* QR Mode */}
          {captureMode === 'qr' && (
            <QrVerificationSession onCompleted={handleQrCompleted} />
          )}

          {/* Camera Mode */}
          {captureMode === 'camera' && (
            <>
              <Stepper active={activeStep} size="sm">
                <Stepper.Step
                  label={t('identity_verification.id_front')}
                  description={uploads.idFront ? t('identity_verification.step_done') : undefined}
                />
                <Stepper.Step
                  label={t('identity_verification.id_back')}
                  description={uploads.idBack ? t('identity_verification.step_done') : undefined}
                />
                <Stepper.Step
                  label={t('identity_verification.selfie')}
                  description={uploads.selfie ? t('identity_verification.step_done') : undefined}
                />
              </Stepper>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_IMAGES}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Submitting state */}
              {submitting && (
                <Paper withBorder p="xl" radius="md">
                  <Stack align="center" gap="sm">
                    <Loader size="md" />
                    <Text size="sm" c="dimmed">
                      {t('identity_verification.submitting')}
                    </Text>
                  </Stack>
                </Paper>
              )}

              {/* Current step content */}
              {!submitting && currentSlot && (
                <FormCard>
                  <Stack gap="md" p="md">
                    <Text fw={600}>
                      {t(`identity_verification.${slotToTranslationKey(currentSlot)}` as 'identity_verification.id_front')}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t(`identity_verification.${slotToTranslationKey(currentSlot)}_hint` as 'identity_verification.id_front_hint')}
                    </Text>

                    {/* Show preview of already-captured photo */}
                    {currentUpload?.preview && (
                      <Image
                        src={currentUpload.preview}
                        alt={currentSlot}
                        mah={200}
                        radius="sm"
                        fit="contain"
                      />
                    )}

                    {/* Validating spinner */}
                    {validating && (
                      <Paper withBorder p="md" radius="md">
                        <Group gap="sm" justify="center">
                          <Loader size="sm" />
                          <Text size="sm" c="dimmed">
                            {t('identity_verification.validating_photo')}
                          </Text>
                        </Group>
                      </Paper>
                    )}

                    {/* Validation warning */}
                    {validationWarning && (
                      <Alert icon={<AlertTriangle size={16} />} color="orange" withCloseButton={false}>
                        <Text size="sm">{validationWarning}</Text>
                        <Group gap="xs" mt="sm">
                          <Button size="xs" variant="outline" color="orange" onClick={handleRetake}>
                            {t('identity_verification.retake')}
                          </Button>
                          <Button size="xs" variant="light" onClick={handleForceAdvance}>
                            {t('identity_verification.continue_anyway')}
                          </Button>
                        </Group>
                      </Alert>
                    )}

                    {/* Camera viewfinder or upload button */}
                    {!currentUpload && !validating && (
                      <>
                        <CameraCapture
                          key={currentSlot}
                          facingMode={SLOT_FACING_MODE[currentSlot]}
                          autoDetect={SLOT_AUTO_DETECT[currentSlot]}
                          onCapture={handleCameraCapture}
                          onCancel={handleCancelCapture}
                          label={t(`identity_verification.${slotToTranslationKey(currentSlot)}` as 'identity_verification.id_front')}
                        />
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={handlePickFile}
                          disabled={!!uploading}
                        >
                          {t('identity_verification.upload_file')}
                        </Button>
                      </>
                    )}

                    {/* Retake button when photo is captured but no warning */}
                    {currentUpload && !validating && !validationWarning && (
                      <Group gap="xs">
                        <Button
                          variant="light"
                          size="sm"
                          leftSection={<Camera size={14} />}
                          onClick={handleRetake}
                        >
                          {t('identity_verification.retake')}
                        </Button>
                      </Group>
                    )}

                    {/* Loading indicator while uploading */}
                    {uploading === currentSlot && (
                      <Group gap="sm" justify="center">
                        <Loader size="sm" />
                        <Text size="sm" c="dimmed">
                          {t('identity_verification.uploading')}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </FormCard>
              )}
            </>
          )}

          {/* Detecting state */}
          {captureMode === 'detecting' && (
            <Paper withBorder p="xl" radius="md">
              <Text ta="center" c="dimmed" size="sm">
                {t('identity_verification.detecting_camera')}
              </Text>
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}
