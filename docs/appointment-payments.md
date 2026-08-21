# Appointment payments (Mercado Pago)

Optional, per-professional collection of payment when a patient books through
`apps/booking`. This note records the architecture and — more importantly —
the constraints that must never be broken.

## The regulatory boundary (read this first)

**Athelas never touches the money.** Funds move directly from the patient to
the professional's own Mercado Pago account, via OAuth-delegated credentials.
Athelas creates the charge *on behalf of* the professional, receives webhooks,
and records state. Concretely, and non-negotiably:

- No funds ever pass through an Athelas-controlled account. Collecting and
  remitting would classify Athelas as a payment aggregator / sub-acquirer
  under BCRA's PSP regime.
- No CBU, CVU, alias, IBAN, bank account, or card data is ever stored.
- No fee, commission, split, or marketplace mechanics — the Mercado Pago
  preference must never carry `marketplace_fee` / application-fee fields.
- No fiscal documents. Invoicing (ARCA) is the professional's obligation.
  Anything patient-facing is an internal, clearly **non-fiscal** receipt.
- **No "plus médico" vector**: there is no free-text amount anywhere. Phase 1
  charges only the private consultation fee; a future coseguro (Phase 2) must
  be resolved from configured insurer price lists, never typed at booking.

If a change seems to require crossing any of these lines, stop.

## Where the amount comes from

There is deliberately **no fee field** in payment settings. The amount is
resolved server-side by `apps/api/src/services/payments/amount-resolver.ts`:

- Resolver `private_fee` (Phase 1): `accounting_settings.insurerPrices`
  → `_particular` → `encounter`, resolved in pesos with the shared helpers in
  `src/utils/cost-resolution.ts`, converted to **integer minor units**
  (centavos — never floats), then multiplied by the configured charge portion
  (25/50/100 %).
- The resolver registry is the Phase-2 seam: an insurer-derived coseguro is a
  new resolver file plus a registry entry, not a booking-path change.
- Fee, portion, and computed amount are **snapshotted** onto
  `appointment_payments` at booking time; later price changes never mutate an
  existing payment. Any client-supplied amount is rejected as an attack
  (`services/booking/hooks/reject-client-amount.ts` + a class-level check).

## Scoping

- **Connection** (`payment_connections`): `userId`-scoped, unique per
  `(userId, provider)`. The MP account is personal; funds always land there.
- **Settings** (`payment_settings`): `(userId, organizationId)`-scoped, like
  `accounting_settings` (where the price itself lives).
- Effective "collect now" = settings enabled AND connection `connected` AND
  organization active AND resolved amount > 0. **Any leg failing degrades to
  the classic unpaid booking — never a broken flow.**

## State machines

Appointment: `pending_payment → confirmed | expired | cancelled`,
`confirmed → cancelled`, `expired → confirmed` (late-payment resurrect).
Only `required` mode creates `pending_payment` holds; `optional` mode confirms
immediately and the payment rides alongside (`appointments.paidAt` marks a
paid booking). Payment: `pending → in_process → approved | rejected |
cancelled | expired`, `approved → refunded | charged_back` — guarded
monotonically in `services/payments/payment-state-machine.ts` so duplicate /
out-of-order webhooks are no-ops.

## Concurrency

- Every `booking.create()` runs inside a transaction holding
  `pg_advisory_xact_lock(hashtext('booking:{medicId}:{startDateISO}'))`; the
  partial unique index `appointments_medic_slot_active_unique`
  (`(medicId, startDate) WHERE status IN ('pending_payment','confirmed') AND
  extra = false`) is the DB-level backstop.
- Provider HTTP calls happen strictly **after commit** — never hold a lock or
  transaction across the network.
- Hold expiry is enforced at read time (booking create, slot grid, patient
  status poll) *and* swept by `cron/payment-hold-expiry.ts`. Expired hold rows
  are kept 24 h (so a late approved webhook can resurrect a still-free slot),
  then deleted — the payment row survives via its denormalized snapshot and
  `SET NULL` FK.

## Webhooks

`POST /webhooks/payments/mercado-pago` (`middleware/payment-webhook-handler.ts`):

1. HMAC signature verification (`x-signature`, `timingSafeEqual`, 5-min
   freshness) inside the adapter.
2. Durable idempotency: insert-first into `payment_webhook_events` with a
   unique `(provider, providerEventId)`.
3. Respond 200 immediately; process async in
   `services/payments/process-payment-event.ts`.
4. **The payload is never trusted**: the payment is re-fetched from the
   provider with the professional's credentials and reconciled against the
   snapshot. Amount mismatch ⇒ flagged, NOT confirmed.
5. Late approved payment: slot still free ⇒ resurrect; slot retaken ⇒ flag
   `late_payment_slot_retaken`, auto-refund attempt with the professional's
   credentials, email notification (`payment-flagged` template).

The API is never public: Mercado Pago reaches it through the UI app's `/api`
proxy (`apps/ui/app/routes/api.$.tsx`), which allowlists `webhooks` and
`payments` and forwards `x-signature` / `x-request-id` with `redirect:
'manual'` so the OAuth callback's 302 reaches the browser. `API_PUBLIC_URL`
is therefore the UI origin plus `/api`, e.g. `https://app.athel.as/api`.

## Refund policy (Phase 1)

Manual and professional-initiated, with one automatic exception: a payment
that lands after its hold expired **and** the slot was retaken triggers an
automatic refund attempt. Patient cancellation and no-shows retain the
deposit (`flagReason: 'patient_cancelled'` marks paid-then-cancelled rows in
the reconciliation list) unless the professional refunds through their own
account.

## Credential security

- Tokens are pgcrypto-encrypted (`@athelas/encryption` `makeDefine`) with
  **`PAYMENTS_ENCRYPTION_KEY` — a separate key from the clinical
  `ENCRYPTION_KEY`**; `utils/validate-payments-config.ts` fails the boot if
  payments are configured without it (or with the same key).
- OAuth is authorization-code + PKCE; the `state` is random, single-use
  (atomic claim), 10-min TTL, and the callback identity comes **only** from
  the stored state row. `client_secret` never leaves `apps/api`.
  MP application panel prerequisites: **enable the PKCE authorization-code
  flow** on the application (once enabled, MP requires `code_challenge`), and
  ensure the granted scope includes **`offline_access`** — without it MP
  issues no refresh token and the 180-day renewal breaks (the adapter logs a
  warning when the exchanged scope lacks it).
- Ciphertext is never selected on an external path
  (`payment-connections.class.ts`, llm-api-keys style); `hooks/
  strip-payment-secrets.ts` is the defense-in-depth layer; `hooks/
  redact-payment-secrets.ts` + the Sentry `beforeSend` scrub keep tokens out
  of errors and telemetry.
- Token refresh: `cron/payment-token-refresh.ts` (hourly, jittered, exponential
  backoff; `invalid_grant` or exhausted retries ⇒ `disconnected` ⇒ collection
  auto-disables and booking degrades to unpaid).

## Environment variables

| Variable | Purpose |
|---|---|
| `PAYMENTS_ENCRYPTION_KEY` | pgcrypto key for payment credentials. Generate a strong random value; **must differ from `ENCRYPTION_KEY`**. Never committed. |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | Mercado Pago application credentials (API only). Setting `MP_CLIENT_ID` is what turns the feature on. |
| `MP_WEBHOOK_SECRET` | Webhook signing secret from the MP application. |
| `API_PUBLIC_URL` | Public API base URL — builds the OAuth callback and webhook URLs. |
| `BOOKING_PUBLIC_URL` | Patient booking app base URL for checkout `back_urls`; supports `{slug}` (e.g. `https://{slug}.turnos.athel.as`). |
| `APP_URL` | Professional UI base URL (post-OAuth redirect). |
| `PAYMENT_TOKEN_REFRESH_CRON` / `PAYMENT_HOLD_EXPIRY_CRON` | Optional cron overrides (default hourly / every minute). |

Migration/runbook: `apps/api/scripts/2026-08-appointment-payments.sql`.
