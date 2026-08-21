import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { QueryTypes, Sequelize } from 'sequelize';
import { BadRequest } from '@feathersjs/errors';
import type { Application, AppointmentPayment, PaymentSettings } from '../../declarations';
import { getProvider } from '../payments/provider-registry';
import { resolveAmount, ResolvedAmount } from '../payments/amount-resolver';
import { getPaymentsConfig } from '../../utils/payments-config';
import type { DecryptedConnection, PaymentConnections } from '../payment-connections/payment-connections.class';
import logger from '../../logger';

// Appointment rows in these states occupy their slot; cancelled/expired rows
// don't. Must stay in sync with the partial unique index
// appointments_medic_slot_active_unique.
const SLOT_HOLDING_STATUSES = ['pending_payment', 'confirmed'];

const isUniqueViolation = (error: any): boolean =>
  error?.name === 'SequelizeUniqueConstraintError' ||
  error?.errors?.some?.((e: any) => e?.type === 'unique violation') ||
  // feathers-sequelize wraps SequelizeUniqueConstraintError into a BadRequest
  // before it reaches us
  (error?.code === 400 && error?.message === 'Validation error');

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface MedicData {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  title: string;
  isActive?: boolean;
  payment?: PatientPaymentInfo;
}

// What the semi-public booking surface may learn about a professional's
// payment setup: the amount and terms, nothing else.
interface PatientPaymentInfo {
  amount: number;
  currency: string;
  feeMinor: number;
  chargePortion: number;
  requirementMode: 'optional' | 'required';
}

interface PaymentPlan {
  settings: PaymentSettings;
  connection: DecryptedConnection;
  resolved: ResolvedAmount;
  orgSlug: string;
}

const AMOUNT_FIELDS = ['amount', 'amountMinor', 'fee', 'feeMinor', 'price', 'currency', 'chargePortion', 'payment'];

interface AnonymizedSlot {
  date: string;
  taken: boolean;
  extra?: boolean;
}

export class Booking {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any) {
    const patientId = params.patient?.id;
    const intent = params.query?.intent;

    if (intent === 'find-medics') {
      return this.findMedics(params);
    }

    if (intent === 'find-appointments') {
      return this.findAppointments(params);
    }

    if (intent === 'find-bookings') {
      return this.findBookings(params);
    }

    if (intent === 'get-payment-status') {
      return this.getPaymentStatus(params);
    }

    return { patientId, data: [] };
  }

  // Patient polls this after returning from checkout. Always reflects the
  // server's truth (never the checkout redirect's query params) and enforces
  // hold expiry at read time — the cron is only the proactive sweep.
  async getPaymentStatus(params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;
    const appointmentId = params.query?.appointmentId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    if (!appointmentId) {
      throw new BadRequest('appointmentId is required');
    }

    const internal = { provider: undefined } as const;

    let appointment: any = null;
    try {
      appointment = await this.app.service('appointments').get(appointmentId, internal);
    } catch {
      appointment = null;
    }

    if (appointment && appointment.patientId !== patientId) {
      throw new BadRequest('Appointment not found');
    }

    if (
      appointment?.status === 'pending_payment' &&
      appointment.holdExpiresAt &&
      dayjs(appointment.holdExpiresAt).isBefore(dayjs())
    ) {
      await (this.app.service('appointments') as any)
        .patch(appointment.id, { status: 'expired' }, internal);
      await this.app.service('appointment-payments').patch(null, { status: 'expired' }, {
        query: { appointmentId, status: { $in: ['pending', 'in_process'] } },
        provider: undefined,
      });
      appointment.status = 'expired';
    }

    const paymentsResult = await this.app.service('appointment-payments').find({
      query: { appointmentId, patientId, $sort: { createdAt: -1 }, $limit: 1 },
      provider: undefined,
    }) as any;
    const payment = ((paymentsResult.data || paymentsResult) as AppointmentPayment[])[0] ?? null;

    return {
      appointmentStatus: appointment?.status ?? 'expired',
      appointment: appointment && {
        id: appointment.id,
        startDate: appointment.startDate,
        paidAt: appointment.paidAt,
      },
      payment: payment && this.toPatientPayment(
        payment,
        appointment?.status === 'pending_payment' ? 'required' : 'optional'
      ),
    };
  }

  // Optional-mode escape hatch: the patient explicitly chooses to pay in
  // person, so the still-open payment offer is cancelled for a clean
  // reconciliation trail. Required-mode bookings cannot skip.
  async patch(id: string, data: any, params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    if (data?.action !== 'skip-payment') {
      throw new BadRequest('Unknown action');
    }

    if (!id) {
      throw new BadRequest('Appointment ID is required');
    }

    const internal = { provider: undefined } as const;
    const appointment = await this.app.service('appointments').get(id, internal) as any;

    if (!appointment || appointment.patientId !== patientId) {
      throw new BadRequest('Appointment not found');
    }

    if (appointment.status === 'pending_payment') {
      throw new BadRequest('Payment is required for this booking');
    }

    await this.app.service('appointment-payments').patch(null, { status: 'cancelled' }, {
      query: { appointmentId: id, status: { $in: ['pending', 'in_process'] } },
      provider: undefined,
    });

    return { ok: true };
  }

  async create(data: any, params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    const { medicId, startDate } = data;

    if (!medicId || !startDate) {
      throw new BadRequest('medicId and startDate are required');
    }

    // Verify the medic belongs to this organization
    const userRolesResult = await this.app.service('user-roles').find({
      query: { userId: medicId, organizationId, roleId: 'medic', $limit: 1 },
    }) as any;
    const userRoles = userRolesResult.data || userRolesResult;

    if (userRoles.length === 0) {
      throw new BadRequest('Invalid medic');
    }

    const targetDate = dayjs(startDate);
    if (!targetDate.isValid()) {
      throw new BadRequest('Invalid startDate');
    }

    // The class re-checks what the reject-client-amount hook already blocks.
    for (const field of AMOUNT_FIELDS) {
      if (field in data) {
        throw new BadRequest('Payment amounts are computed server-side');
      }
    }

    // Payments are strictly opt-in: any missing/failed leg resolves to null
    // and the booking proceeds exactly as it always has.
    const paymentPlan = await this.resolvePaymentPlan(medicId, organizationId);
    const requirementMode = paymentPlan?.settings.requirementMode ?? 'optional';
    const isRequired = Boolean(paymentPlan) && requirementMode === 'required';
    const holdWindowMinutes = paymentPlan?.settings.holdWindowMinutes ?? 20;
    const paymentExpiresAt = paymentPlan
      ? new Date(Date.now() + holdWindowMinutes * 60 * 1000)
      : null;

    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const transaction = await sequelize.transaction();
    let appointment: any;
    let paymentRow: AppointmentPayment | null = null;

    try {
      // Serialize concurrent bookings of the same slot: the lock, the
      // free-slot check, and the INSERT share one transaction (same primitives
      // as studies/hooks/auto-protocol.ts). The partial unique index is the
      // backstop for writers that don't take this lock.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:lockKey))', {
        replacements: { lockKey: `booking:${medicId}:${targetDate.toISOString()}` },
        type: QueryTypes.SELECT,
        transaction,
      });

      // A lapsed hold still occupies the unique index until the expiry job
      // runs; expire it here so the slot is genuinely free at booking time.
      await (this.app.service('appointments') as any).patch(null, { status: 'expired' }, {
        query: {
          medicId,
          startDate: targetDate.toISOString(),
          status: 'pending_payment',
          holdExpiresAt: { $lt: new Date().toISOString() },
        },
        provider: undefined,
        sequelize: { transaction },
      });

      // No organizationId filter on purpose: a medic can't be in two places at
      // once, and the unique index is cross-org for the same reason.
      const existingResult = await this.app.service('appointments').find({
        query: {
          medicId,
          startDate: targetDate.toISOString(),
          status: { $in: SLOT_HOLDING_STATUSES },
          $limit: 1,
        },
        provider: undefined,
        sequelize: { transaction },
      }) as any;
      const existing = existingResult.data || existingResult;

      if (existing.length > 0) {
        throw new BadRequest('This slot is already taken');
      }

      appointment = await (this.app.service('appointments') as any).create(
        {
          patientId,
          medicId,
          organizationId,
          startDate: targetDate.toDate(),
          extra: false,
          // Only `required` mode holds the slot behind the payment; optional
          // mode confirms immediately and the payment rides alongside.
          status: isRequired ? 'pending_payment' : 'confirmed',
          holdExpiresAt: isRequired ? paymentExpiresAt : null,
        },
        { provider: undefined, sequelize: { transaction } }
      );

      if (paymentPlan) {
        paymentRow = await this.app.service('appointment-payments').create({
          appointmentId: appointment.id,
          medicId,
          patientId,
          organizationId,
          appointmentStartDate: targetDate.toDate(),
          provider: paymentPlan.connection.provider,
          providerAccountId: paymentPlan.connection.providerAccountId || null,
          status: 'pending',
          amountResolver: paymentPlan.resolved.resolverId,
          feeMinorSnapshot: paymentPlan.resolved.feeMinor,
          chargePortionSnapshot: paymentPlan.resolved.chargePortion,
          amount: paymentPlan.resolved.amount,
          currency: paymentPlan.resolved.currency,
          idempotencyKey: `mp:${appointment.id}`,
          expiresAt: paymentExpiresAt,
        }, { provider: undefined, sequelize: { transaction } }) as AppointmentPayment;
      }

      // Commit BEFORE any provider HTTP call — never hold the slot lock (or a
      // DB transaction) across the network.
      await transaction.commit();
    } catch (error: any) {
      await transaction.rollback().catch(() => undefined);

      if (isUniqueViolation(error)) {
        throw new BadRequest('This slot is already taken');
      }
      throw error;
    }

    if (!paymentPlan || !paymentRow) {
      return { ok: true, appointmentId: appointment.id };
    }

    const internal = { provider: undefined } as const;

    try {
      const config = getPaymentsConfig(this.app);
      const returnUrl = this.buildBookingReturnUrl(paymentPlan.orgSlug, appointment.id);
      const charge = await getProvider(paymentPlan.connection.provider).createCharge({
        credentials: paymentPlan.connection,
        amount: { amount: paymentPlan.resolved.amount, currency: paymentPlan.resolved.currency },
        externalReference: String(paymentRow.id),
        idempotencyKey: String(paymentRow.idempotencyKey),
        // Generic title on purpose: no patient PII ever reaches the provider.
        title: 'Consulta médica',
        backUrls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
        notificationUrl: `${config.publicUrl}/webhooks/payments/mercado-pago`,
        expiresAt: paymentExpiresAt,
      });

      paymentRow = await this.app.service('appointment-payments').patch(paymentRow.id, {
        providerPreferenceId: charge.providerChargeId,
        checkoutUrl: charge.checkoutUrl,
      }, internal) as AppointmentPayment;

      this.logPaymentEvent(paymentRow, 'charge_created');
    } catch (error: any) {
      logger.error('Payment charge creation failed: %s', error?.message);
      await this.app.service('appointment-payments').patch(paymentRow.id, { status: 'cancelled' }, internal)
        .catch(() => undefined);

      if (isRequired) {
        // A required-mode booking without a payable charge is not a booking:
        // release the slot and tell the patient the provider is unavailable.
        await (this.app.service('appointments') as any)
          .patch(appointment.id, { status: 'expired' }, internal)
          .catch(() => undefined);
        throw new BadRequest('payment_provider_unavailable');
      }

      // Optional mode degrades to a normal confirmed, unpaid booking.
      return { ok: true, appointmentId: appointment.id, paymentUnavailable: true };
    }

    return {
      ok: true,
      appointmentId: appointment.id,
      payment: this.toPatientPayment(paymentRow, requirementMode),
    };
  }

  private toPatientPayment(payment: AppointmentPayment, requirementMode: 'optional' | 'required') {
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      feeMinor: payment.feeMinorSnapshot,
      chargePortion: payment.chargePortionSnapshot,
      isDeposit: payment.chargePortionSnapshot < 100,
      remainderAmount: payment.feeMinorSnapshot - payment.amount,
      checkoutUrl: payment.checkoutUrl,
      expiresAt: payment.expiresAt,
      refundStatus: payment.refundStatus,
      slotLost: payment.flagReason === 'late_payment_slot_retaken',
      requirementMode,
    };
  }

  private buildBookingReturnUrl(orgSlug: string, appointmentId: string): string {
    const base = (getPaymentsConfig(this.app).bookingUrl ?? '').replace('{slug}', orgSlug);
    return `${base.replace(/\/$/, '')}/appointment/${appointmentId}/payment`;
  }

  private logPaymentEvent(payment: AppointmentPayment, event: string): void {
    this.app.service('access-logs').create({
      userId: payment.medicId,
      organizationId: payment.organizationId,
      resource: 'payment',
      action: 'write',
      purpose: 'billing',
      patientId: payment.patientId,
      metadata: { event, appointmentPaymentId: payment.id },
    }, { provider: undefined }).catch(() => undefined);
  }

  // Effective "collect payment now" check. Every leg failing (no settings,
  // disabled, no live connection, inactive org, no usable price) returns null
  // and the booking degrades to the classic unpaid path — never breaks.
  private async resolvePaymentPlan(medicId: string, organizationId: string): Promise<PaymentPlan | null> {
    try {
      const settingsResult = await this.app.service('payment-settings').find({
        query: { userId: medicId, organizationId, $limit: 1 },
        provider: undefined,
      }) as any;
      const settings = (settingsResult.data || settingsResult)[0] as PaymentSettings | undefined;

      if (!settings?.enabled) {
        return null;
      }

      const org = await this.app.service('organizations').get(organizationId, { provider: undefined }) as any;

      if (org?.isActive === false) {
        return null;
      }

      const connections = this.app.service('payment-connections') as unknown as PaymentConnections;
      const connection = await connections.getDecryptedCredentials(medicId);

      if (!connection || connection.status !== 'connected') {
        return null;
      }

      const resolved = await resolveAmount('private_fee', {
        app: this.app,
        medicId,
        organizationId,
        chargePortion: settings.chargePortion,
      });

      if (!resolved) {
        return null;
      }

      return { settings, connection, resolved, orgSlug: org?.slug ?? '' };
    } catch (error: any) {
      logger.warn('Payment plan resolution failed, degrading to unpaid booking: %s', error?.message);
      return null;
    }
  }

  async remove(id: string, params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    if (!id) {
      throw new BadRequest('Appointment ID is required');
    }

    // Verify the appointment belongs to this patient and organization
    const appointment = await this.app.service('appointments').get(id, {
      provider: undefined,
    }) as any;

    if (!appointment || appointment.patientId !== patientId) {
      throw new BadRequest('Appointment not found');
    }

    // Only allow cancelling future appointments
    if (dayjs(appointment.startDate).isBefore(dayjs())) {
      throw new BadRequest('Cannot cancel past appointments');
    }

    // The financial trail survives cancellation: appointment_payments keeps a
    // denormalized snapshot and its appointmentId FK is SET NULL on delete.
    const paymentsResult = await this.app.service('appointment-payments').find({
      query: { appointmentId: id, $limit: 10 },
      provider: undefined,
    }) as any;
    const payments = (paymentsResult.data || paymentsResult) as AppointmentPayment[];

    await this.app.service('appointments').remove(id, { provider: undefined });

    for (const payment of payments) {
      if (payment.status === 'pending' || payment.status === 'in_process') {
        await this.app.service('appointment-payments')
          .patch(payment.id, { status: 'cancelled' }, { provider: undefined })
          .catch(() => undefined);
      } else if (payment.status === 'approved') {
        // Policy: the deposit is retained unless the professional refunds it
        // manually — flag the row so it stands out in the reconciliation list.
        await this.app.service('appointment-payments')
          .patch(payment.id, { flagged: true, flagReason: 'patient_cancelled' }, { provider: undefined })
          .catch(() => undefined);
        this.logPaymentEvent(payment, 'patient_cancelled_paid_appointment');
      }
    }

    return { ok: true };
  }

  async findMedics(params: any) {
    const organizationId = params.patient?.organizationId;

    if (!organizationId) {
      throw new BadRequest('Organization ID is required');
    }

    const userRolesResult = await this.app.service('user-roles').find({
      query: {
        organizationId,
        roleId: 'medic',
        $select: ['userId'],
        $limit: 100,
      },
    }) as any;
    const userRoles = userRolesResult.data || userRolesResult;

    const medics: MedicData[] = await Promise.all(
      userRoles.map(async (role: any) => {
        const user = await this.app.service('users').get(role.userId) as any;

        return {
          id: role.userId,
          firstName: user.personalData?.firstName || '',
          lastName: user.personalData?.lastName || '',
          specialty: user.settings?.medicalSpecialty || '',
          title: user.settings?.title || (user.personalData?.gender === 'female' ? 'Dra.' : 'Dr.'),
          isActive: user.settings?.isVerified,
        };
      }),
    );

    const activeMedics = medics.filter((medic: MedicData) => medic.isActive);
    await this.attachPaymentInfo(activeMedics, organizationId);

    return activeMedics;
  }

  // Adds the server-computed payment block (amount, portion, mode) to medics
  // with payments effectively enabled, so the patient sees the amount before
  // committing. Failures degrade silently to "no payment info".
  private async attachPaymentInfo(medics: MedicData[], organizationId: string): Promise<void> {
    if (medics.length === 0) {
      return;
    }

    try {
      const settingsRows = await this.app.service('payment-settings').find({
        query: {
          userId: { $in: medics.map((medic) => medic.id) },
          organizationId,
          enabled: true,
        },
        provider: undefined,
        paginate: false,
      }) as unknown as PaymentSettings[];

      if (!settingsRows.length) {
        return;
      }

      const org = await this.app.service('organizations').get(organizationId, { provider: undefined }) as any;

      if (org?.isActive === false) {
        return;
      }

      const byId = new Map(medics.map((medic) => [medic.id, medic]));
      const connections = this.app.service('payment-connections') as unknown as PaymentConnections;

      for (const settings of settingsRows) {
        const medic = byId.get(String(settings.userId));

        if (!medic) {
          continue;
        }

        const connection = await connections.getDecryptedCredentials(String(settings.userId));

        if (!connection || connection.status !== 'connected') {
          continue;
        }

        const resolved = await resolveAmount('private_fee', {
          app: this.app,
          medicId: String(settings.userId),
          organizationId,
          chargePortion: settings.chargePortion,
        });

        if (!resolved) {
          continue;
        }

        medic.payment = {
          amount: resolved.amount,
          currency: resolved.currency,
          feeMinor: resolved.feeMinor,
          chargePortion: settings.chargePortion,
          requirementMode: settings.requirementMode,
        };
      }
    } catch (error: any) {
      logger.warn('Payment info enrichment failed: %s', error?.message);
    }
  }

  async findAppointments(params: any) {
    const organizationId = params.patient?.organizationId;
    const { medicId, date } = params.query || {};

    if (!organizationId) {
      throw new BadRequest('Organization ID is required');
    }

    if (!medicId) {
      throw new BadRequest('medicId is required');
    }

    const targetDate = dayjs(date || undefined);
    if (!targetDate.isValid()) {
      throw new BadRequest('Invalid date');
    }

    // Fetch medic's schedule settings
    const settingsResult = await this.app.service('md-settings').find({
      query: { userId: medicId, $limit: 1 },
      provider: undefined,
    }) as any;
    const settings = (settingsResult.data || settingsResult)[0];

    if (!settings) {
      return [];
    }

    // Generate empty slots from schedule
    const day = WEEKDAY_NAMES[targetDate.day()];
    const dayStart = settings[`${day}Start`];
    const dayEnd = settings[`${day}End`];
    const duration = settings.encounterDuration ?? 20;

    const slots: AnonymizedSlot[] = [];

    if (dayStart && dayEnd) {
      const startTime = dayjs.tz(targetDate.format('YYYY-MM-DD') + 'T' + dayStart, 'America/Argentina/Buenos_Aires');
      const endTime = dayjs.tz(targetDate.format('YYYY-MM-DD') + 'T' + dayEnd, 'America/Argentina/Buenos_Aires');

      if (startTime.isValid() && endTime.isValid() && !startTime.isAfter(endTime)) {
        let current = startTime;
        while (current.isSameOrBefore(endTime)) {
          slots.push({ date: current.toISOString(), taken: false });
          current = current.add(duration, 'minute');
        }
      }
    }

    // Fetch ALL appointments for this medic on this date (across orgs — a medic
    // can't be in two places at once, and some legacy rows lack organizationId).
    const dayStartISO = targetDate.startOf('day').toISOString();
    const dayEndISO = targetDate.endOf('day').toISOString();

    const appointmentsResult = await this.app.service('appointments').find({
      query: {
        medicId,
        startDate: { $gte: dayStartISO, $lte: dayEndISO },
        status: { $in: SLOT_HOLDING_STATUSES },
        $limit: 100,
      },
      provider: undefined,
    }) as any;
    const appointments = appointmentsResult.data || appointmentsResult;

    // Mark taken slots
    const now = dayjs();
    for (const appt of appointments) {
      // Read-time expiry: a lapsed hold frees its slot even if the expiry job
      // hasn't run yet.
      if (appt.status === 'pending_payment' && appt.holdExpiresAt && dayjs(appt.holdExpiresAt).isBefore(now)) {
        continue;
      }

      const apptMs = dayjs(appt.startDate).valueOf();

      if (appt.extra) {
        slots.push({ date: dayjs(appt.startDate).toISOString(), taken: true, extra: true });
        continue;
      }

      // Match by closest minute (tolerance of 60 s) to handle ms/tz drift
      const slotIndex = slots.findIndex(
        slot => Math.abs(dayjs(slot.date).valueOf() - apptMs) < 60_000
      );
      if (slotIndex !== -1) {
        slots[slotIndex].taken = true;
      }
    }

    return slots;
  }

  async findBookings(params: any) {
    const patientId = params.patient?.id;
    const organizationId = params.patient?.organizationId;

    if (!patientId || !organizationId) {
      throw new BadRequest('Patient context is required');
    }

    const appointmentsResult = await this.app.service('appointments').find({
      query: {
        patientId,
        organizationId,
        startDate: { $gte: dayjs().startOf('day').toISOString() },
        status: { $in: SLOT_HOLDING_STATUSES },
        $sort: { startDate: 1 },
        $limit: 50,
      },
      provider: undefined,
    }) as any;
    const appointments = appointmentsResult.data || appointmentsResult;

    // Attach payment summaries (paid/deposit/pending pills in the patient UI).
    const paymentsByAppointment = new Map<string, AppointmentPayment>();
    if (appointments.length > 0) {
      try {
        const paymentsResult = await this.app.service('appointment-payments').find({
          query: {
            appointmentId: { $in: appointments.map((appt: any) => appt.id) },
            $limit: 100,
          },
          provider: undefined,
          paginate: false,
        }) as unknown as AppointmentPayment[];

        for (const payment of paymentsResult) {
          if (payment.appointmentId) {
            paymentsByAppointment.set(String(payment.appointmentId), payment);
          }
        }
      } catch (error: any) {
        logger.warn('Booking payment summary enrichment failed: %s', error?.message);
      }
    }

    // Enrich with medic info
    const medicCache = new Map<string, { firstName: string; lastName: string; specialty: string }>();

    return Promise.all(
      appointments.map(async (appt: any) => {
        let medic = medicCache.get(appt.medicId);
        if (!medic) {
          const user = await this.app.service('users').get(appt.medicId) as any;
          medic = {
            firstName: user.personalData?.firstName || '',
            lastName: user.personalData?.lastName || '',
            specialty: user.settings?.medicalSpecialty || '',
          };
          medicCache.set(appt.medicId, medic);
        }

        const payment = paymentsByAppointment.get(String(appt.id));

        return {
          id: appt.id,
          startDate: appt.startDate,
          status: appt.status,
          medic,
          payment: payment
            ? this.toPatientPayment(payment, appt.status === 'pending_payment' ? 'required' : 'optional')
            : null,
        };
      })
    );
  }
}
