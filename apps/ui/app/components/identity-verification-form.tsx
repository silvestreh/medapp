import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Image,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Stepper,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  CameraIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  WarningIcon,
  ArrowsClockwiseIcon,
} from '@phosphor-icons/react';

import { useFeathers } from '~/components/provider';
import { SectionTitle, FormCard } from '~/components/forms/styles';
import { CameraCapture } from '~/components/camera-capture';
import { QrVerificationSession } from '~/components/qr-verification-session';
import { getVerificationApiUrl } from '~/verification-feathers';

type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface AutoCheckProgress {
  step: string;
  current: number | null;
  total: number | null;
  position: number | null;
}

interface DniScanData {
  tramiteNumber: string;
  lastName: string;
  firstName: string;
  gender: string;
  dniNumber: string;
  exemplar: string;
  birthDate: string;
  issueDate: string;
}

interface IdentityVerificationFormProps {
  currentStatus: VerificationStatus;
  rejectionReason?: string | null;
  autoCheckProgress?: AutoCheckProgress | null;
  dniScanData?: DniScanData | null;
  userId?: string;
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

type CaptureMode = 'intro' | 'camera' | 'qr' | 'detecting';

const ACCEPT_IMAGES = 'image/png,image/jpeg,image/webp';
const ACCEPT_VIDEO = 'video/webm,video/mp4';

const SLOT_FACING_MODE: Record<UploadSlot, 'environment' | 'user'> = {
  idFront: 'environment',
  idBack: 'environment',
  selfie: 'user',
};

const SLOT_AUTO_DETECT: Record<UploadSlot, 'barcode' | 'face' | 'text' | 'none'> = {
  idFront: 'barcode',
  idBack: 'text',
  selfie: 'face',
};

const SLOT_ORDER: UploadSlot[] = ['idFront', 'idBack', 'selfie'];

const PROGRESS_STEP_KEYS = [
  'scanning_barcode',
  'submitting_face_compare',
  'downloading_files',
  'extracting_frames',
  'comparing_frame',
] as const;

type ProgressStepKey = (typeof PROGRESS_STEP_KEYS)[number];

function slotToTranslationKey(slot: UploadSlot): string {
  if (slot === 'idFront') return 'id_front';
  if (slot === 'idBack') return 'id_back';
  return 'selfie';
}

dayjs.extend(customParseFormat);

export function IdentityVerificationForm({
  currentStatus,
  rejectionReason,
  autoCheckProgress,
  dniScanData,
  userId,
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

  const [updatingRecords, setUpdatingRecords] = useState(false);

  const isDniMismatch = useMemo(() => {
    if (!rejectionReason) return false;
    return rejectionReason.split('\n').some(line => line.startsWith('dni_mismatch'));
  }, [rejectionReason]);

  const translatedRejectionReason = useMemo(() => {
    if (!rejectionReason) return null;
    return rejectionReason
      .split('\n')
      .map(line => {
        const [key] = line.split(':');
        if (key === 'dni_mismatch') {
          return t('identity_verification.rejection_dni_mismatch');
        }
        if (key === 'dni_scan_failed') {
          return t('identity_verification.rejection_unknown', { reason: line });
        }
        if (key === 'face_mismatch') {
          return t('identity_verification.rejection_face_mismatch');
        }
        if (key === 'selfie_not_recent') {
          return t('identity_verification.rejection_selfie_not_recent');
        }
        if (key === 'license_invalid') {
          return t('identity_verification.rejection_license_invalid');
        }
        return t('identity_verification.rejection_unknown', { reason: line });
      })
      .join('\n\n');
  }, [rejectionReason, t]);

  const handleUpdateRecordsFromDni = useCallback(async () => {
    if (!dniScanData) return;
    setUpdatingRecords(true);
    try {
      const genderMap: Record<string, string> = { M: 'male', F: 'female' };
      const birthDate = dayjs(dniScanData.birthDate, 'DD/MM/YYYY', true);

      await (client as any).service('users').patch(userId, {
        personalData: {
          firstName: dniScanData.firstName,
          lastName: dniScanData.lastName,
          documentValue: dniScanData.dniNumber,
          birthDate: birthDate.isValid() ? birthDate.format('YYYY-MM-DD') : undefined,
          gender: genderMap[dniScanData.gender.toUpperCase()] || 'other',
        },
      });
      notifications.show({
        message: t('identity_verification.records_updated_success'),
        color: 'green',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.something_went_wrong');
      notifications.show({ message, color: 'red' });
    } finally {
      setUpdatingRecords(false);
    }
  }, [dniScanData, client, t, userId]);

  const handleStartCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
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
        const fileName = slot === 'selfie' ? 'selfie.webm' : `${slot}.jpg`;
        formData.append('file', blob, fileName);
        const verificationUrl = getVerificationApiUrl();
        const res = await fetch(`${verificationUrl}/upload`, {
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
    [t, uploads, getAuthHeaders, validateIdFrontPhoto, submitVerification]
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
    setActiveStep(s => Math.min(s + 1, 2));
  }, []);

  const handleRetake = useCallback(() => {
    const slot = SLOT_ORDER[activeStep];
    if (slot) {
      setUploads(prev => ({ ...prev, [slot]: null }));
      setValidationWarning(null);
    }
  }, [activeStep]);

  const handleQrCompleted = useCallback(() => {
    // Verification API auto-creates identity verification on session completion
    notifications.show({
      message: t('identity_verification.submitted_success'),
      color: 'green',
    });
    onSubmitted();
  }, [t, onSubmitted]);

  const currentSlot = SLOT_ORDER[activeStep];
  const currentUpload = currentSlot ? uploads[currentSlot] : null;

  return (
    <Stack gap="md">
      <SectionTitle id="identity-verification" icon={<CreditCardIcon />}>
        {t('identity_verification.title')}
      </SectionTitle>

      {currentStatus === 'verified' && (
        <Alert icon={<CheckCircleIcon size={18} />} color="green">
          {t('identity_verification.status_verified')}
        </Alert>
      )}

      {currentStatus === 'pending' && (
        <Alert
          icon={autoChecksRunning ? <Loader size={18} /> : <ClockIcon size={18} />}
          color={autoChecksRunning ? 'blue' : 'yellow'}
        >
          {autoChecksRunning ? t('identity_verification.auto_checking') : t('identity_verification.status_pending')}
          {autoChecksRunning && autoCheckProgress && (
            <Stack gap="xs" mt="sm">
              <Text size="sm">
                {autoCheckProgress.step === 'queued' &&
                  autoCheckProgress.position != null &&
                  (autoCheckProgress.position === 0
                    ? t('identity_verification.progress_queued_next')
                    : t('identity_verification.progress_queued', { position: autoCheckProgress.position }))}
                {autoCheckProgress.step !== 'queued' &&
                  PROGRESS_STEP_KEYS.includes(autoCheckProgress.step as ProgressStepKey) &&
                  t(
                    `identity_verification.progress_${autoCheckProgress.step}` as `identity_verification.progress_${ProgressStepKey}`
                  )}
              </Text>
              {autoCheckProgress.step === 'comparing_frame' &&
                autoCheckProgress.current != null &&
                autoCheckProgress.total != null && (
                  <Progress value={(autoCheckProgress.current / autoCheckProgress.total) * 100} size="sm" animated />
                )}
            </Stack>
          )}
        </Alert>
      )}

      {currentStatus === 'rejected' && (
        <Alert icon={<XCircleIcon size={18} />} color="red">
          {t('identity_verification.status_rejected')}
          {translatedRejectionReason && (
            <Text size="sm" mt="xs" component="div">
              <strong>{t('identity_verification.rejection_reason')}:</strong>
              <Markdown>{translatedRejectionReason}</Markdown>
            </Text>
          )}
          {isDniMismatch && dniScanData && (
            <Button
              variant="light"
              color="red"
              size="xs"
              mt="sm"
              leftSection={<ArrowsClockwiseIcon size={14} />}
              loading={updatingRecords}
              onClick={handleUpdateRecordsFromDni}
            >
              {t('identity_verification.update_records_from_dni')}
            </Button>
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
                <Text size="sm" c="dimmed">
                  {t('identity_verification.intro_subtitle')}
                </Text>
                <Stack gap="xs">
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={700} c="blue" size="lg" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                      1
                    </Text>
                    <div>
                      <Text size="sm" fw={600}>
                        {t('identity_verification.id_front')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('identity_verification.intro_step1_desc')}
                      </Text>
                    </div>
                  </Group>
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={700} c="blue" size="lg" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                      2
                    </Text>
                    <div>
                      <Text size="sm" fw={600}>
                        {t('identity_verification.id_back')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('identity_verification.intro_step2_desc')}
                      </Text>
                    </div>
                  </Group>
                  <Group gap="sm" wrap="nowrap">
                    <Text fw={700} c="blue" size="lg" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                      3
                    </Text>
                    <div>
                      <Text size="sm" fw={600}>
                        {t('identity_verification.selfie')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('identity_verification.intro_step3_desc')}
                      </Text>
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
              onChange={value => setCaptureMode(value as CaptureMode)}
              data={[
                { label: t('identity_verification.mode_camera'), value: 'camera' },
                { label: t('identity_verification.mode_qr'), value: 'qr' },
              ]}
              size="sm"
            />
          )}

          {/* QR Mode */}
          {captureMode === 'qr' && <QrVerificationSession onCompleted={handleQrCompleted} />}

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
                accept={currentSlot === 'selfie' ? ACCEPT_VIDEO : ACCEPT_IMAGES}
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
                      {t(
                        `identity_verification.${slotToTranslationKey(currentSlot)}` as 'identity_verification.id_front'
                      )}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t(
                        `identity_verification.${slotToTranslationKey(currentSlot)}_hint` as 'identity_verification.id_front_hint'
                      )}
                    </Text>

                    {/* Show preview of already-captured photo/video */}
                    {currentUpload?.preview && currentSlot === 'selfie' && (
                      <video
                        src={currentUpload.preview}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                          maxHeight: 200,
                          borderRadius: 'var(--mantine-radius-sm)',
                          objectFit: 'contain',
                          width: '100%',
                        }}
                      />
                    )}
                    {currentUpload?.preview && currentSlot !== 'selfie' && (
                      <Image src={currentUpload.preview} alt={currentSlot} mah={200} radius="sm" fit="contain" />
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
                      <Alert icon={<WarningIcon size={16} />} color="orange" withCloseButton={false}>
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
                          label={t(
                            `identity_verification.${slotToTranslationKey(currentSlot)}` as 'identity_verification.id_front'
                          )}
                        />
                        <Button variant="subtle" size="sm" onClick={handlePickFile} disabled={!!uploading}>
                          {t('identity_verification.upload_file')}
                        </Button>
                      </>
                    )}

                    {/* Retake button when photo is captured but no warning */}
                    {currentUpload && !validating && !validationWarning && (
                      <Group gap="xs">
                        <Button variant="light" size="sm" leftSection={<CameraIcon size={14} />} onClick={handleRetake}>
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
