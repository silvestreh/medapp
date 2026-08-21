import { Badge, type BadgeProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export type PaymentBadgeStatus =
  | 'pending'
  | 'in_process'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'charged_back';

interface PaymentStatusBadgeProps {
  status: PaymentBadgeStatus;
  chargePortion?: number;
  flagged?: boolean;
  size?: BadgeProps['size'];
}

const STATUS_COLOR: Record<PaymentBadgeStatus, string> = {
  approved: 'green',
  pending: 'yellow',
  in_process: 'yellow',
  rejected: 'gray',
  cancelled: 'gray',
  expired: 'gray',
  refunded: 'blue',
  charged_back: 'red',
};

export default function PaymentStatusBadge({ status, chargePortion, flagged, size = 'sm' }: PaymentStatusBadgeProps) {
  const { t } = useTranslation();

  const isDeposit = status === 'approved' && typeof chargePortion === 'number' && chargePortion < 100;
  const labelKey = isDeposit ? 'payments.status.deposit_paid' : `payments.status.${status}`;
  const color = flagged ? 'red' : isDeposit ? 'teal' : (STATUS_COLOR[status] ?? 'gray');

  return (
    <Badge variant="light" color={color} size={size}>
      {flagged && t('payments.status.flagged')}
      {!flagged && t(labelKey as any)}
    </Badge>
  );
}
