import { useEffect, useRef } from 'react';
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, useNavigation, useFetcher, useRevalidator } from '@remix-run/react';
import { ActionIcon, Alert, Badge, Button, Group, Loader, Progress, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
  LightningIcon,
  WarningCircleIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';
import dayjs from 'dayjs';

import { getAuthenticatedClient } from '~/utils/auth.server';

interface AnchorItem {
  id: string;
  merkleRoot: string;
  leafCount: number;
  chainType: 'encounters' | 'access_logs';
  status: 'pending' | 'confirmed' | 'failed';
  txSignature: string | null;
  slot: number | null;
  network: string;
  batchStartDate: string;
  batchEndDate: string;
  errorMessage: string | null;
  retryCount: number;
  verificationStatus: 'unverified' | 'verified' | 'inconclusive' | 'mismatch';
  verifiedAt: string | null;
  verificationError: string | null;
  createdAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);

  const response = await client.service('solana-anchors').find({
    query: {
      $sort: { createdAt: -1 },
      $limit: 100,
    },
  });

  const anchors = Array.isArray(response) ? response : (response as any)?.data || [];

  return json({ anchors });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  if (intent === 'trigger') {
    try {
      const result = (await client.service('solana-anchors').create({ intent: 'trigger' })) as any;
      return json({
        intent: 'trigger',
        ok: result?.ok ?? false,
        error: result?.error || null,
        balance: result?.balance ?? null,
      });
    } catch (error: any) {
      return json({ intent: 'trigger', ok: false, error: error?.message || 'Unknown error' });
    }
  }

  if (intent === 'verify-all') {
    try {
      const result = (await client.service('solana-anchors').create({ intent: 'verify-all' })) as any;
      return json({ intent: 'verify-all', ok: true, total: result?.total ?? 0 });
    } catch (error: any) {
      return json({ intent: 'verify-all', ok: false, error: error?.message || 'Unknown error' });
    }
  }

  if (intent === 'verify-one') {
    const anchorId = String(formData.get('anchorId') || '');
    try {
      await client.service('solana-anchors').create({ intent: 'verify-one', anchorId });
      return json({ intent: 'verify-one', ok: true, anchorId });
    } catch (error: any) {
      return json({ intent: 'verify-one', ok: false, error: error?.message || 'Unknown error' });
    }
  }

  return json({ intent: '', results: [] });
};

const statusColor: Record<string, string> = {
  pending: 'yellow',
  confirmed: 'green',
  failed: 'red',
};

function getChainLabel(chainType: string): string {
  return chainType === 'encounters' ? 'Consultas' : 'Accesos';
}

const statusLabels = {
  pending: 'admin.anchors_status_pending',
  confirmed: 'admin.anchors_status_confirmed',
  failed: 'admin.anchors_status_failed',
} as const;

function TruncatedHash({ hash }: { hash: string }) {
  const short = `${hash.slice(0, 8)}…${hash.slice(-8)}`;
  return (
    <Tooltip label={hash} withArrow>
      <Text size="xs" ff="monospace" style={{ cursor: 'default' }}>
        {short}
      </Text>
    </Tooltip>
  );
}

function ExplorerLink({ signature, network }: { signature: string; network: string }) {
  const short = `${signature.slice(0, 8)}…${signature.slice(-8)}`;
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  const href = `https://explorer.solana.com/tx/${signature}${cluster}`;

  return (
    <Tooltip label={signature} withArrow>
      <Text
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        size="xs"
        ff="monospace"
        c="teal"
        td="underline"
      >
        {short}
      </Text>
    </Tooltip>
  );
}

function VerificationBadge({ anchor, fetcher }: { anchor: AnchorItem; fetcher: ReturnType<typeof useFetcher> }) {
  const { t } = useTranslation();

  const isVerifying = fetcher.state !== 'idle' && fetcher.formData?.get('anchorId') === anchor.id;

  if (isVerifying) {
    return <Loader size="xs" />;
  }

  if (anchor.status !== 'confirmed' || !anchor.txSignature) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }

  const handleVerify = () => {
    fetcher.submit({ intent: 'verify-one', anchorId: anchor.id }, { method: 'post' });
  };

  switch (anchor.verificationStatus) {
    case 'verified':
      return (
        <Tooltip
          label={t('admin.anchors_verified_at', {
            date: anchor.verifiedAt ? dayjs(anchor.verifiedAt).format('DD/MM/YY HH:mm') : '—',
            interpolation: { escapeValue: false },
          })}
          withArrow
        >
          <Badge color="green" variant="light" leftSection={<CheckCircleIcon size={12} />}>
            {t('admin.anchors_match')}
          </Badge>
        </Tooltip>
      );

    case 'inconclusive':
      return (
        <Group gap={4} wrap="nowrap">
          <Tooltip label={anchor.verificationError || 'RPC unavailable'} withArrow>
            <Badge color="yellow" variant="light" leftSection={<WarningCircleIcon size={12} />}>
              {t('admin.anchors_inconclusive')}
            </Badge>
          </Tooltip>
          <Tooltip label={t('admin.anchors_verify_all')} withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={handleVerify}>
              <ArrowsClockwiseIcon size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      );

    case 'mismatch':
      return (
        <Group gap={4} wrap="nowrap">
          <Tooltip label={anchor.verificationError || t('admin.anchors_no_match')} withArrow>
            <Badge color="red" variant="light" leftSection={<XCircleIcon size={12} />}>
              {t('admin.anchors_no_match')}
            </Badge>
          </Tooltip>
          <Tooltip label={t('admin.anchors_verify_all')} withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={handleVerify}>
              <ArrowsClockwiseIcon size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      );

    default:
      return (
        <Group gap={4} wrap="nowrap">
          <Badge color="gray" variant="light">
            {t('admin.anchors_unverified')}
          </Badge>
          <Tooltip label={t('admin.anchors_verify_all')} withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={handleVerify}>
              <ShieldCheckIcon size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      );
  }
}

export default function AdminAnchors() {
  const { anchors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTriggering = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'trigger';
  const isVerifyingAll = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'verify-all';
  const triggerResult = actionData?.intent === 'trigger' ? (actionData as any) : null;
  const verifyAllResult = actionData?.intent === 'verify-all' ? (actionData as any) : null;

  const confirmedAnchors = anchors.filter((a: AnchorItem) => a.status === 'confirmed' && a.txSignature);
  const confirmedCount = anchors.filter((a: AnchorItem) => a.status === 'confirmed').length;
  const failedCount = anchors.filter((a: AnchorItem) => a.status === 'failed').length;
  const pendingCount = anchors.filter((a: AnchorItem) => a.status === 'pending').length;
  const totalRecords = anchors.reduce((sum: number, a: AnchorItem) => sum + a.leafCount, 0);

  const unverifiedCount = confirmedAnchors.filter((a: AnchorItem) => a.verificationStatus === 'unverified').length;
  const hasUnverified = unverifiedCount > 0;
  const verifiedSoFar = confirmedAnchors.length - unverifiedCount;

  const verifiedCount = confirmedAnchors.filter((a: AnchorItem) => a.verificationStatus === 'verified').length;
  const inconclusiveCount = confirmedAnchors.filter((a: AnchorItem) => a.verificationStatus === 'inconclusive').length;
  const mismatchCount = confirmedAnchors.filter((a: AnchorItem) => a.verificationStatus === 'mismatch').length;
  const hasAnyVerification = verifiedCount > 0 || inconclusiveCount > 0 || mismatchCount > 0;

  // Poll for updates while there are unverified confirmed anchors (background verify-all in progress)
  // Poll while any confirmed anchor is still unverified (background verify-all in progress)
  useEffect(() => {
    if (hasUnverified) {
      intervalRef.current = setInterval(() => {
        if (revalidator.state === 'idle') {
          revalidator.revalidate();
        }
      }, 1500);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasUnverified, revalidator]);

  // Revalidate after a single verify completes
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={3}>{t('admin.anchors_title')}</Title>

        <Group gap="xs">
          {confirmedCount > 0 && (
            <Badge variant="light" color="green" size="lg">
              {confirmedCount} {t('admin.anchors_status_confirmed')}
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="light" color="yellow" size="lg">
              {pendingCount} {t('admin.anchors_status_pending')}
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="light" color="red" size="lg">
              {failedCount} {t('admin.anchors_status_failed')}
            </Badge>
          )}
          <Badge variant="light" color="gray" size="lg">
            {totalRecords} {t('admin.anchors_col_records')}
          </Badge>
        </Group>
      </Group>

      <Group gap="sm">
        {confirmedAnchors.length > 0 && (
          <Form method="post">
            <input type="hidden" name="intent" value="verify-all" />
            <Button
              type="submit"
              variant="light"
              leftSection={<ArrowsClockwiseIcon size={16} />}
              loading={isVerifyingAll}
            >
              {t('admin.anchors_verify_all')}
            </Button>
          </Form>
        )}
        <Form method="post">
          <input type="hidden" name="intent" value="trigger" />
          <Button
            type="submit"
            variant="light"
            color="teal"
            leftSection={<LightningIcon size={16} />}
            loading={isTriggering}
          >
            {t('admin.anchors_trigger')}
          </Button>
        </Form>
      </Group>

      {triggerResult && !isTriggering && (
        <Alert
          color={triggerResult.ok ? 'green' : 'red'}
          icon={triggerResult.ok ? <CheckCircleIcon size={20} /> : <XCircleIcon size={20} />}
        >
          <Text size="sm">
            {triggerResult.ok
              ? t('admin.anchors_trigger_success')
              : triggerResult.error || t('admin.anchors_trigger_error')}
          </Text>
        </Alert>
      )}

      {hasUnverified && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {t('admin.anchors_verifying_progress', {
              completed: verifiedSoFar,
              total: confirmedAnchors.length,
            })}
          </Text>
          <Progress
            value={confirmedAnchors.length > 0 ? (verifiedSoFar / confirmedAnchors.length) * 100 : 0}
            animated
            size="lg"
          />
        </Stack>
      )}

      {hasAnyVerification && !hasUnverified && (
        <>
          {mismatchCount === 0 && inconclusiveCount === 0 && (
            <Alert color="green" icon={<CheckCircleIcon size={20} />} title={t('admin.anchors_verify_ok')}>
              <Text size="sm">{t('admin.anchors_verify_ok_detail', { count: verifiedCount })}</Text>
            </Alert>
          )}
          {mismatchCount === 0 && inconclusiveCount > 0 && (
            <Alert color="yellow" icon={<WarningCircleIcon size={20} />} title={t('admin.anchors_verify_ok')}>
              <Text size="sm">
                {t('admin.anchors_verify_inconclusive_detail', {
                  ok: verifiedCount,
                  inconclusive: inconclusiveCount,
                  fail: mismatchCount,
                })}
              </Text>
            </Alert>
          )}
          {mismatchCount > 0 && (
            <Alert color="red" icon={<XCircleIcon size={20} />} title={t('admin.anchors_verify_mismatch')}>
              <Text size="sm">
                {inconclusiveCount > 0
                  ? t('admin.anchors_verify_inconclusive_detail', {
                      ok: verifiedCount,
                      inconclusive: inconclusiveCount,
                      fail: mismatchCount,
                    })
                  : t('admin.anchors_verify_mismatch_detail', { ok: verifiedCount, fail: mismatchCount })}
              </Text>
            </Alert>
          )}
        </>
      )}

      {anchors.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          {t('admin.anchors_empty')}
        </Text>
      )}

      {anchors.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.col_date')}</Table.Th>
              <Table.Th>{t('admin.anchors_col_chain')}</Table.Th>
              <Table.Th>{t('admin.anchors_col_records')}</Table.Th>
              <Table.Th>{t('admin.anchors_col_merkle_root')}</Table.Th>
              <Table.Th>{t('admin.col_status')}</Table.Th>
              <Table.Th>{t('admin.anchors_col_tx')}</Table.Th>
              <Table.Th>{t('admin.anchors_col_onchain')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {anchors.map((anchor: AnchorItem) => (
              <Table.Tr key={anchor.id}>
                <Table.Td>
                  <Text size="sm">{dayjs(anchor.createdAt).format('DD/MM/YY HH:mm')}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={anchor.chainType === 'encounters' ? 'blue' : 'grape'} size="sm">
                    {getChainLabel(anchor.chainType)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {anchor.leafCount}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <TruncatedHash hash={anchor.merkleRoot} />
                </Table.Td>
                <Table.Td>
                  {anchor.status === 'failed' && anchor.errorMessage ? (
                    <Tooltip label={anchor.errorMessage} withArrow>
                      <Badge color={statusColor[anchor.status]} variant="light">
                        {t(statusLabels[anchor.status])}
                        {anchor.retryCount > 0 && ` (${anchor.retryCount})`}
                      </Badge>
                    </Tooltip>
                  ) : (
                    <Badge color={statusColor[anchor.status]} variant="light">
                      {t(statusLabels[anchor.status])}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {anchor.txSignature ? (
                    <ExplorerLink signature={anchor.txSignature} network={anchor.network} />
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <VerificationBadge anchor={anchor} fetcher={fetcher} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
