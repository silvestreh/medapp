import { useCallback, useState } from 'react';
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useActionData, useLoaderData, useNavigation, useRevalidator, Form } from '@remix-run/react';
import { Alert, Badge, Button, Group, Image, Modal, Paper, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  SpinnerGapIcon,
  ScanIcon,
  FingerprintIcon,
  WarningIcon,
} from '@phosphor-icons/react';

import { getAuthenticatedClient } from '~/utils/auth.server';

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

interface VerificationItem {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  dniScanData: DniScanData | null;
  dniScanMatch: boolean | null;
  dniScanErrors: string | null;
  faceMatchConfidence: string | null;
  faceMatch: boolean | null;
  faceMatchError: string | null;
  autoCheckCompletedAt: string | null;
  user?: {
    id: string;
    username: string;
    personal_datum?: {
      firstName: string | null;
      lastName: string | null;
      documentType: string | null;
      documentValue: string | null;
    };
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'pending';

  try {
    const response = await client.service('identity-verifications' as any).find({
      query: {
        status: statusFilter,
        $sort: { createdAt: -1 },
        $limit: 50,
      },
    });

    const verifications = Array.isArray(response) ? response : (response as any)?.data || [];

    return json({ verifications, statusFilter, error: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin.verifications] loader error:', message);
    return json({ verifications: [], statusFilter, error: message });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');
  const verificationId = String(formData.get('verificationId') || '');

  try {
    if (intent === 'approve') {
      const notes = String(formData.get('notes') || '');
      await client.service('identity-verifications' as any).patch(verificationId, {
        status: 'verified',
        notes: notes || null,
      });
      return json({ ok: true, intent });
    }

    if (intent === 'reject') {
      const rejectionReason = String(formData.get('rejectionReason') || '');
      const notes = String(formData.get('notes') || '');
      await client.service('identity-verifications' as any).patch(verificationId, {
        status: 'rejected',
        rejectionReason,
        notes: notes || null,
      });
      return json({ ok: true, intent });
    }

    return json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

const statusColors: Record<string, string> = {
  pending: 'yellow',
  verified: 'green',
  rejected: 'red',
};

export default function AdminVerifications() {
  const { verifications, statusFilter, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [selected, setSelected] = useState<VerificationItem | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const handleView = useCallback(
    (v: VerificationItem) => {
      setSelected(v);
      setNotes(v.notes || '');
      setRejectionReason('');
      open();
    },
    [open]
  );

  const handleClose = useCallback(() => {
    close();
    setSelected(null);
    // Revalidate to refresh the list after potential changes
    if (actionData?.ok) {
      revalidator.revalidate();
    }
  }, [close, actionData, revalidator]);

  const isSubmitting = navigation.state === 'submitting';

  const userName = (v: VerificationItem) => {
    const pd = v.user?.personal_datum;
    if (pd?.firstName || pd?.lastName) {
      return [pd.firstName, pd.lastName].filter(Boolean).join(' ');
    }
    return v.user?.username || v.userId;
  };

  const userDoc = (v: VerificationItem) => {
    const pd = v.user?.personal_datum;
    if (pd?.documentType && pd?.documentValue) {
      return `${pd.documentType} ${pd.documentValue}`;
    }
    return '-';
  };

  const autoCheckBadge = useCallback((match: boolean | null, label: string) => {
    if (match === null) {
      return (
        <Badge color="gray" variant="light" size="xs" leftSection={<SpinnerGapIcon size={10} />}>
          {label}
        </Badge>
      );
    }
    if (match) {
      return (
        <Badge color="green" variant="light" size="xs" leftSection={<CheckCircleIcon size={10} />}>
          {label}
        </Badge>
      );
    }
    return (
      <Badge color="red" variant="light" size="xs" leftSection={<XCircleIcon size={10} />}>
        {label}
      </Badge>
    );
  }, []);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={3}>{t('admin.verifications_title')}</Title>
        <Group gap="xs">
          {['pending', 'verified', 'rejected'].map(s => (
            <Button
              key={s}
              component="a"
              href={`/admin?status=${s}`}
              variant={statusFilter === s ? 'filled' : 'light'}
              color={statusColors[s]}
              size="xs"
            >
              {t(`admin.status_${s as 'pending' | 'verified' | 'rejected'}`)}
            </Button>
          ))}
        </Group>
      </Group>

      {error && (
        <Alert icon={<WarningIcon size={16} />} color="red" variant="light" title={t('common.something_went_wrong')}>
          <Text size="sm">{error}</Text>
        </Alert>
      )}

      {!error && verifications.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          {t('admin.no_verifications')}
        </Text>
      )}

      {verifications.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.col_user')}</Table.Th>
              <Table.Th>{t('admin.col_document')}</Table.Th>
              <Table.Th>{t('admin.col_status')}</Table.Th>
              <Table.Th>{t('admin.col_auto_checks')}</Table.Th>
              <Table.Th>{t('admin.col_date')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {verifications.map((v: VerificationItem) => (
              <Table.Tr key={v.id}>
                <Table.Td>{userName(v)}</Table.Td>
                <Table.Td>{userDoc(v)}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[v.status]} variant="light">
                    {t(`admin.status_${v.status}`)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {!v.autoCheckCompletedAt && (
                    <Badge color="gray" variant="light" size="xs" leftSection={<SpinnerGapIcon size={10} />}>
                      {t('admin.processing')}
                    </Badge>
                  )}
                  {v.autoCheckCompletedAt && (
                    <Group gap={4}>
                      {autoCheckBadge(v.dniScanMatch, 'DNI')}
                      {autoCheckBadge(v.faceMatch, t('admin.face'))}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>{new Date(v.createdAt).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  <Button variant="subtle" size="xs" leftSection={<EyeIcon size={14} />} onClick={() => handleView(v)}>
                    {t('common.view')}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} size="xl" title={t('admin.verification_details')}>
        {selected && (
          <Stack gap="md">
            <Group gap="lg">
              <div>
                <Text fw={600}>{userName(selected)}</Text>
                <Text size="sm" c="dimmed">
                  {userDoc(selected)}
                </Text>
              </div>
              <Badge color={statusColors[selected.status]} variant="light" size="lg">
                {t(`admin.status_${selected.status}`)}
              </Badge>
            </Group>

            <Text fw={600} size="sm">
              {t('identity_verification.id_front')}
            </Text>
            <Paper withBorder p="xs" radius="md">
              <Image src={selected.idFrontUrl} alt="ID Front" mah={300} fit="contain" radius="sm" />
            </Paper>

            <Text fw={600} size="sm">
              {t('identity_verification.id_back')}
            </Text>
            <Paper withBorder p="xs" radius="md">
              <Image src={selected.idBackUrl} alt="ID Back" mah={300} fit="contain" radius="sm" />
            </Paper>

            <Text fw={600} size="sm">
              {t('identity_verification.selfie')}
            </Text>
            <Paper withBorder p="xs" radius="md">
              <Image src={selected.selfieUrl} alt="Selfie" mah={300} fit="contain" radius="sm" />
            </Paper>

            {/* Automated Checks Section */}
            <Text fw={700} size="md" mt="sm">
              {t('admin.auto_checks_title')}
            </Text>

            {!selected.autoCheckCompletedAt && (
              <Paper withBorder p="sm" radius="md" bg="gray.0">
                <Group gap="xs">
                  <SpinnerGapIcon size={16} />
                  <Text size="sm" c="dimmed">
                    {t('admin.auto_checks_processing')}
                  </Text>
                </Group>
              </Paper>
            )}

            {selected.autoCheckCompletedAt && (
              <Stack gap="sm">
                {/* PDF417 Barcode Results */}
                <Paper withBorder p="sm" radius="md">
                  <Group gap="xs" mb="xs">
                    <ScanIcon size={16} />
                    <Text fw={600} size="sm">
                      {t('admin.dni_scan_title')}
                    </Text>
                    {selected.dniScanMatch !== null && (
                      <Badge color={selected.dniScanMatch ? 'green' : 'red'} variant="light" size="sm">
                        {selected.dniScanMatch ? t('admin.match') : t('admin.mismatch')}
                      </Badge>
                    )}
                  </Group>
                  {selected.dniScanData && (
                    <Table withRowBorders={false} horizontalSpacing={4} verticalSpacing={2}>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {t('admin.dni_number')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{selected.dniScanData.dniNumber}</Text>
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {t('admin.dni_name')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">
                              {selected.dniScanData.lastName}, {selected.dniScanData.firstName}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {t('admin.dni_birth_date')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{selected.dniScanData.birthDate}</Text>
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {t('admin.dni_gender')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{selected.dniScanData.gender}</Text>
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {t('admin.dni_tramite')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{selected.dniScanData.tramiteNumber}</Text>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  )}
                  {selected.dniScanErrors && (
                    <Text size="xs" c="red" mt="xs">
                      {selected.dniScanErrors}
                    </Text>
                  )}
                  {!selected.dniScanData && !selected.dniScanErrors && (
                    <Text size="xs" c="dimmed">
                      {t('admin.no_data')}
                    </Text>
                  )}
                </Paper>

                {/* Face Comparison Results */}
                <Paper withBorder p="sm" radius="md">
                  <Group gap="xs" mb="xs">
                    <FingerprintIcon size={16} />
                    <Text fw={600} size="sm">
                      {t('admin.face_comparison_title')}
                    </Text>
                    {selected.faceMatch !== null && (
                      <Badge color={selected.faceMatch ? 'green' : 'red'} variant="light" size="sm">
                        {selected.faceMatch ? t('admin.match') : t('admin.mismatch')}
                      </Badge>
                    )}
                  </Group>
                  {selected.faceMatchConfidence !== null && (
                    <Text size="sm">
                      {t('admin.face_similarity')}:{' '}
                      <Text span fw={600}>
                        {selected.faceMatchConfidence}
                      </Text>
                    </Text>
                  )}
                  {selected.faceMatchError && (
                    <Text size="xs" c="red" mt="xs">
                      {selected.faceMatchError}
                    </Text>
                  )}
                  {selected.faceMatchConfidence === null && !selected.faceMatchError && (
                    <Text size="xs" c="dimmed">
                      {t('admin.no_data')}
                    </Text>
                  )}
                </Paper>
              </Stack>
            )}

            {selected.status === 'pending' && (
              <Form method="post">
                <input type="hidden" name="verificationId" value={selected.id} />
                <Stack gap="sm">
                  <Textarea
                    label={t('admin.notes_label')}
                    placeholder={t('admin.notes_placeholder')}
                    value={notes}
                    onChange={e => setNotes(e.currentTarget.value)}
                    name="notes"
                    autosize
                    minRows={2}
                  />
                  <Textarea
                    label={t('admin.rejection_reason_label')}
                    placeholder={t('admin.rejection_reason_placeholder')}
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.currentTarget.value)}
                    name="rejectionReason"
                    autosize
                    minRows={2}
                  />
                  <Group>
                    <Button
                      type="submit"
                      name="intent"
                      value="approve"
                      color="green"
                      leftSection={<CheckCircleIcon size={16} />}
                      loading={isSubmitting}
                    >
                      {t('admin.approve')}
                    </Button>
                    <Button
                      type="submit"
                      name="intent"
                      value="reject"
                      color="red"
                      variant="outline"
                      leftSection={<XCircleIcon size={16} />}
                      loading={isSubmitting}
                      disabled={!rejectionReason.trim()}
                    >
                      {t('admin.reject')}
                    </Button>
                  </Group>
                </Stack>
              </Form>
            )}

            {selected.notes && (
              <Paper withBorder p="sm" radius="md" bg="gray.0">
                <Text size="sm" fw={600} mb={4}>
                  {t('admin.notes_label')}
                </Text>
                <Text size="sm">{selected.notes}</Text>
              </Paper>
            )}

            {selected.rejectionReason && (
              <Paper withBorder p="sm" radius="md" bg="red.0">
                <Text size="sm" fw={600} mb={4} c="red">
                  {t('admin.rejection_reason_label')}
                </Text>
                <Text size="sm">{selected.rejectionReason}</Text>
              </Paper>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
