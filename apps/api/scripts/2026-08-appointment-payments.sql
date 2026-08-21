-- Appointment payments — production migration
-- The whole file is safe to run as-is (transaction-friendly, idempotent):
--   psql "$DB_URL" -f apps/api/scripts/2026-08-appointment-payments.sql
-- New tables (payment_settings, payment_connections, payment_oauth_states,
-- appointment_payments, payment_webhook_events) need nothing here:
-- sequelize.sync() creates them on deploy. This script covers what sync()
-- cannot do on an existing database.
--
-- Runbook (full detail in docs/appointment-payments.md):
--   0. Set env vars: PAYMENTS_ENCRYPTION_KEY (NEW key, distinct from
--      ENCRYPTION_KEY), MP_CLIENT_ID, MP_CLIENT_SECRET, MP_WEBHOOK_SECRET,
--      API_PUBLIC_URL (= UI origin + /api — the API is never public; MP
--      reaches it through the apps/ui proxy), BOOKING_PUBLIC_URL
--      (= https://{slug}.athelas.cloud), APP_URL.
--   1. Run section 1's SELECT first; it must return zero rows (duplicates
--      would make section 4 fail).
--   2. Run this file.
--   3. Deploy (sync creates the new tables; the boot check validates keys).
--   4. Register the OAuth redirect URI and webhook URL in the Mercado Pago
--      application: {API_PUBLIC_URL}/payments/oauth/callback and
--      {API_PUBLIC_URL}/webhooks/payments/mercado-pago.
--
-- PRODUCTION NOTE on section 4: the plain CREATE INDEX below briefly
-- write-locks `appointments`. Fine for staging or a quiet window. For a busy
-- production database, SKIP it here and instead run the lock-free variant
-- separately with autocommit (CONCURRENTLY refuses to run inside any
-- transaction, so it cannot live in this file):
--   psql "$DB_URL" -c "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS appointments_medic_slot_active_unique ON appointments (\"medicId\", \"startDate\") WHERE status IN ('pending_payment', 'confirmed') AND extra = false;"

-- ---------------------------------------------------------------------------
-- 1. Pre-check: active-slot duplicates would break the unique index.
--    Resolve any rows this returns (mark one as extra=true or delete) first.
-- ---------------------------------------------------------------------------
SELECT "medicId", "startDate", count(*)
FROM appointments
WHERE extra = false
GROUP BY 1, 2
HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- 2. Appointment status machine (fast default backfills legacy rows).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "enum_appointments_status" AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "status" "enum_appointments_status" NOT NULL DEFAULT 'confirmed';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "holdExpiresAt" timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "paidAt" timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Access-log resource enum values.
-- ---------------------------------------------------------------------------
ALTER TYPE "enum_access_logs_resource" ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE "enum_access_logs_resource" ADD VALUE IF NOT EXISTS 'payment-connection';

-- ---------------------------------------------------------------------------
-- 4. Slot uniqueness backstop. Briefly write-locks appointments — see the
--    PRODUCTION NOTE in the header for the lock-free CONCURRENTLY variant.
--    Only pending_payment/confirmed non-sobreturno rows occupy a slot.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS appointments_medic_slot_active_unique
  ON appointments ("medicId", "startDate")
  WHERE status IN ('pending_payment', 'confirmed') AND extra = false;

-- Hold-expiry sweep (cron/payment-hold-expiry.ts, every minute) — partial index
-- so the minute job never scans the whole appointments table.
CREATE INDEX IF NOT EXISTS appointments_hold_expiry_idx
  ON appointments ("holdExpiresAt")
  WHERE status IN ('pending_payment', 'expired');

-- ---------------------------------------------------------------------------
-- 5. Medic role permissions (skip if roles are re-seeded from
--    scripts/seeds/roles.json, which already contains these).
-- ---------------------------------------------------------------------------
UPDATE roles
SET permissions = (
  SELECT array_agg(DISTINCT p)
  FROM unnest(
    permissions || ARRAY[
      'payment-settings:create',
      'payment-settings:get',
      'payment-settings:patch',
      'payment-settings:find',
      'appointment-payments:find',
      'appointment-payments:get'
    ]
  ) AS p
)
WHERE id = 'medic';
