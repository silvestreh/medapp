import dayjs from 'dayjs';
import type { Sequelize, Transaction } from 'sequelize';
import { withXactLock } from '../../utils/advisory-lock';

// Per-slot serialization shared by booking create() and webhook processing.
// Both paths MUST derive the key from this one function: if the formats drift
// they silently stop serializing against each other.
export const bookingSlotLockKey = (medicId: string, startDate: Date | string): string =>
  `booking:${medicId}:${dayjs(startDate).toISOString()}`;

export function withSlotLock<T>(
  sequelize: Sequelize,
  medicId: string,
  startDate: Date | string,
  fn: (transaction: Transaction) => Promise<T>
): Promise<T> {
  return withXactLock(sequelize, bookingSlotLockKey(medicId, startDate), fn);
}
