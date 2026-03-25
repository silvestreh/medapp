import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, useNavigation } from '@remix-run/react';
import { Alert, Badge, Button, Group, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, XCircleIcon, ArrowsClockwiseIcon, LightningIcon } from '@phosphor-icons/react';
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
  createdAt: string;
}

interface VerifyResult {
  anchorId: string;
  merkleRoot: string;
  onChainMatch: boolean;
  error?: string;
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

  if (intent === 'verify-all') {
    const response = await client.service('solana-anchors').find({
      query: {
        status: 'confirmed',
        $sort: { createdAt: -1 },
        $limit: 100,
      },
    });

    const anchors: AnchorItem[] = Array.isArray(response)
      ? response
      : (response as any)?.data || [];

    const results: VerifyResult[] = [];

    for (const anchor of anchors) {
      if (!anchor.txSignature) continue;

      try {
        const verification = await client.service('solana-anchor-verification').find({
          query: { anchorId: anchor.id },
        });

        results.push({
          anchorId: anchor.id,
          merkleRoot: anchor.merkleRoot,
          onChainMatch: (verification as any)?.solanaVerified === true,
        });
      } catch (error: any) {
        results.push({
          anchorId: anchor.id,
          merkleRoot: anchor.merkleRoot,
          onChainMatch: false,
          error: error?.message || 'Verification failed',
        });
      }
    }

    return json({ intent: 'verify-all', results });
  }

  if (intent === 'trigger') {
    try {
      const result = await client.service('solana-anchors').create({ intent: 'trigger' }) as any;
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

export default function AdminAnchors() {
  const { anchors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const submittingIntent = navigation.state === 'submitting' ? navigation.formData?.get('intent') : null;
  const isVerifying = submittingIntent === 'verify-all';
  const isTriggering = submittingIntent === 'trigger';

  const verifyResults = actionData?.intent === 'verify-all' ? (actionData as any).results as VerifyResult[] : null;
  const verifyMap = new Map(verifyResults?.map((r) => [r.anchorId, r]) || []);
  const triggerResult = actionData?.intent === 'trigger' ? actionData as any : null;

  const confirmedCount = anchors.filter((a: AnchorItem) => a.status === 'confirmed').length;
  const failedCount = anchors.filter((a: AnchorItem) => a.status === 'failed').length;
  const pendingCount = anchors.filter((a: AnchorItem) => a.status === 'pending').length;
  const totalRecords = anchors.reduce((sum: number, a: AnchorItem) => sum + a.leafCount, 0);

  const verifiedOk = verifyResults?.filter((r) => r.onChainMatch).length ?? 0;
  const verifiedFail = verifyResults?.filter((r) => !r.onChainMatch).length ?? 0;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={3}>{t('admin.anchors_title')}</Title>

        <Group gap="xs">
          {confirmedCount > 0 && (
            <Badge variant="light" color="green" size="lg">{confirmedCount} {t('admin.anchors_status_confirmed')}</Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="light" color="yellow" size="lg">{pendingCount} {t('admin.anchors_status_pending')}</Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="light" color="red" size="lg">{failedCount} {t('admin.anchors_status_failed')}</Badge>
          )}
          <Badge variant="light" color="gray" size="lg">{totalRecords} {t('admin.anchors_col_records')}</Badge>
        </Group>
      </Group>

      <Group gap="sm">
        {confirmedCount > 0 && (
          <Form method="post">
            <input type="hidden" name="intent" value="verify-all" />
            <Button
              type="submit"
              variant="light"
              leftSection={<ArrowsClockwiseIcon size={16} />}
              loading={isVerifying}
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
            {triggerResult.ok ? t('admin.anchors_trigger_success') : (triggerResult.error || t('admin.anchors_trigger_error'))}
          </Text>
        </Alert>
      )}

      {verifyResults && !isVerifying && (
        <Alert
          color={verifiedFail === 0 ? 'green' : 'red'}
          icon={verifiedFail === 0 ? <CheckCircleIcon size={20} /> : <XCircleIcon size={20} />}
          title={verifiedFail === 0 ? t('admin.anchors_verify_ok') : t('admin.anchors_verify_mismatch')}
        >
          {verifiedFail === 0 && (
            <Text size="sm">
              {t('admin.anchors_verify_ok_detail', { count: verifiedOk })}
            </Text>
          )}
          {verifiedFail > 0 && (
            <Text size="sm">
              {t('admin.anchors_verify_mismatch_detail', { ok: verifiedOk, fail: verifiedFail })}
            </Text>
          )}
        </Alert>
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
              {verifyResults && <Table.Th>{t('admin.anchors_col_onchain')}</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {anchors.map((anchor: AnchorItem) => {
              const vr = verifyMap.get(anchor.id);
              return (
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
                    <Text size="sm" fw={500}>{anchor.leafCount}</Text>
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
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  {verifyResults && (
                    <Table.Td>
                      {vr ? (
                        vr.onChainMatch ? (
                          <Badge color="green" variant="light" leftSection={<CheckCircleIcon size={12} />}>
                            {t('admin.anchors_match')}
                          </Badge>
                        ) : (
                          <Tooltip label={vr.error || t('admin.anchors_no_match')} withArrow>
                            <Badge color="red" variant="light" leftSection={<XCircleIcon size={12} />}>
                              {t('admin.anchors_no_match')}
                            </Badge>
                          </Tooltip>
                        )
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
