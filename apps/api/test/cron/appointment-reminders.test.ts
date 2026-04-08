import assert from 'assert';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Sequelize } from 'sequelize';
import app from '../../src/app';
import createAppointmentRemindersModel from '../../src/models/appointment-reminders.model';
import { sendAppointmentReminders } from '../../src/cron/appointment-reminders';
import { normalizePhone } from '../../src/utils/normalize-ar-phone';
import { createTestOrganization, createTestUser } from '../test-helpers';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'America/Argentina/Buenos_Aires';

describe('normalizePhone', () => {
  // Well-formed Argentine numbers
  it('handles +54 prefix', () => {
    assert.equal(normalizePhone('+542214567890'), '542214567890');
  });

  it('handles 0054 prefix', () => {
    assert.equal(normalizePhone('00542214567890'), '542214567890');
  });

  it('handles 54 prefix already present', () => {
    assert.equal(normalizePhone('542214567890'), '542214567890');
  });

  it('handles 10-digit local number without country code', () => {
    assert.equal(normalizePhone('2214567890'), '542214567890');
  });

  // Leading 0 on area code
  it('strips leading 0 on area code (domestic format)', () => {
    assert.equal(normalizePhone('02214567890'), '542214567890');
  });

  // Embedded 15 — 2-digit area code (CABA): 11 + 15 + 45678901 = 12 digits
  it('strips embedded 15 after 2-digit area code', () => {
    assert.equal(normalizePhone('111545678901'), '5491145678901');
  });

  it('strips embedded 15 after 2-digit area code with country code', () => {
    assert.equal(normalizePhone('54111545678901'), '5491145678901');
  });

  // Embedded 15 — 3-digit area code: 221 + 15 + 4567890 = 12 digits
  it('strips embedded 15 after 3-digit area code', () => {
    assert.equal(normalizePhone('221154567890'), '5492214567890');
  });

  it('strips embedded 15 after 3-digit area code with country code', () => {
    assert.equal(normalizePhone('54221154567890'), '5492214567890');
  });

  // Embedded 15 — 4-digit area code: 2944 + 15 + 456789 = 12 digits
  it('strips embedded 15 after 4-digit area code', () => {
    assert.equal(normalizePhone('294415456789'), '542944456789');
  });

  // cel:/tel: prefixes
  it('strips cel: prefix', () => {
    assert.equal(normalizePhone('cel:2214567890'), '542214567890');
  });

  it('strips tel: prefix', () => {
    assert.equal(normalizePhone('tel:+542214567890'), '542214567890');
  });

  it('strips cel: with +54', () => {
    assert.equal(normalizePhone('cel:+542214567890'), '542214567890');
  });

  // Non-Argentine country codes
  it('passes through Chilean numbers (56)', () => {
    assert.equal(normalizePhone('56912345678'), '56912345678');
  });

  it('passes through Brazilian numbers (55)', () => {
    assert.equal(normalizePhone('5511912345678'), '5511912345678');
  });

  it('passes through Paraguayan numbers (595)', () => {
    assert.equal(normalizePhone('595981234567'), '595981234567');
  });

  it('passes through Uruguayan numbers (598)', () => {
    assert.equal(normalizePhone('59891234567'), '59891234567');
  });

  it('strips 00 prefix for non-AR numbers', () => {
    assert.equal(normalizePhone('0056912345678'), '56912345678');
  });

  // Returns null for unfixable numbers
  it('returns null for too-short number', () => {
    assert.equal(normalizePhone('4567890'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(normalizePhone(''), null);
  });
});

describe('Appointment reminders cron', function () {
  this.timeout(30000);

  let sequelize: Sequelize;
  let orgId: string;
  let orgName: string;
  let medicId: string;
  let patientId: string;
  let patientNoPhoneId: string;

  const whatsappCalls: any[] = [];
  let originalWhatsappCreate: any;

  before(async () => {
    sequelize = app.get('sequelizeClient');

    // Register and sync the appointment_reminders model
    createAppointmentRemindersModel(app);
    await sequelize.models.appointment_reminders.sync({ alter: true });

    // Create test org with WhatsApp connected
    const org = await createTestOrganization({ name: 'Reminder Test Org' });
    orgId = String(org.id);
    orgName = 'Reminder Test Org';

    await sequelize.models.organizations.update(
      {
        settings: {
          whatsapp: {
            instanceName: 'test-instance',
            instanceId: 'test-id',
            connected: true,
            connectedPhone: '5411000000000',
          },
        },
      },
      { where: { id: orgId } }
    );

    // Create medic with personal data and md_settings
    const suffix = Date.now().toString(36);
    const medic = await createTestUser({
      username: `reminder.medic.${suffix}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: orgId,
    });
    medicId = String(medic.id);

    // Add personal data for medic
    const medicPersonalData = await sequelize.models.personal_data.create({
      firstName: 'Carlos',
      lastName: 'García',
      documentValue: `medic-doc-${suffix}`,
    }) as any;
    await sequelize.models.user_personal_data.create({
      ownerId: medicId,
      personalDataId: medicPersonalData.id,
    });

    // Add md_settings for medic
    await app.service('md-settings').create({
      userId: medicId,
      organizationId: orgId,
      encounterDuration: 20,
      title: 'Dr.',
    } as any);

    // Create patient with phone number
    const patient = await app.service('patients').create({
      personalData: {
        firstName: 'Laura',
        lastName: 'Martinez',
        documentValue: `rem-test-${suffix}`,
      },
      contactData: {
        phoneNumber: '2214567890',
      },
    } as any);
    patientId = String((patient as any).id);

    // Create patient without phone number
    const patientNoPhone = await app.service('patients').create({
      personalData: {
        firstName: 'Juan',
        lastName: 'Perez',
        documentValue: `rem-nophone-${suffix}`,
      },
    } as any);
    patientNoPhoneId = String((patientNoPhone as any).id);

    // Mock WhatsApp service (bypasses hooks including the verify hook)
    originalWhatsappCreate = app.service('whatsapp').create.bind(app.service('whatsapp'));
    (app.service('whatsapp') as any).create = async (data: any) => {
      whatsappCalls.push(data);
      return { sent: true, messageId: 'test-msg-id' };
    };
  });

  beforeEach(async () => {
    whatsappCalls.length = 0;
    // Clean up between tests to avoid interference from other test suites
    await sequelize.models.appointment_reminders.destroy({ where: {} });
    await sequelize.models.appointments.destroy({ where: {} });
  });

  after(async () => {
    (app.service('whatsapp') as any).create = originalWhatsappCreate;
  });

  async function createAppointmentForTomorrow(pId: string): Promise<string> {
    const tomorrow = dayjs().tz(TIMEZONE).add(1, 'day').hour(10).minute(0).second(0);
    const appt = await sequelize.models.appointments.create({
      organizationId: orgId,
      medicId,
      patientId: pId,
      startDate: tomorrow.toDate(),
      extra: false,
    }) as any;
    return appt.id;
  }

  it('sends a reminder for tomorrow\'s appointment', async () => {
    const apptId = await createAppointmentForTomorrow(patientId);

    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });

    assert.equal(whatsappCalls.length, 1);
    assert.equal(whatsappCalls[0].type, 'text');
    assert.equal(whatsappCalls[0].organizationId, orgId);
    assert.ok(whatsappCalls[0].to.includes('2214567890'));
    assert.ok(whatsappCalls[0].body.includes('Laura'));
    assert.ok(whatsappCalls[0].body.includes(orgName));

    // Verify reminder record was created
    const reminder = await sequelize.models.appointment_reminders.findOne({
      where: { appointmentId: apptId },
      raw: true,
    }) as any;
    assert.ok(reminder);
    assert.equal(reminder.status, 'sent');
    assert.equal(reminder.messageId, 'test-msg-id');
  });

  it('does not send duplicate reminders', async () => {
    await createAppointmentForTomorrow(patientId);

    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });
    assert.equal(whatsappCalls.length, 1);

    whatsappCalls.length = 0;
    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });
    assert.equal(whatsappCalls.length, 0);
  });

  it('skips patients without a phone number', async () => {
    const apptId = await createAppointmentForTomorrow(patientNoPhoneId);

    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });

    assert.equal(whatsappCalls.length, 0);

    const reminder = await sequelize.models.appointment_reminders.findOne({
      where: { appointmentId: apptId },
      raw: true,
    }) as any;
    assert.ok(reminder);
    assert.equal(reminder.status, 'skipped');
  });

  it('skips organizations without WhatsApp connected', async () => {
    await sequelize.models.organizations.update(
      { settings: { whatsapp: { connected: false } } },
      { where: { id: orgId } }
    );

    await createAppointmentForTomorrow(patientId);
    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });

    assert.equal(whatsappCalls.length, 0);

    // Restore connection
    await sequelize.models.organizations.update(
      {
        settings: {
          whatsapp: {
            instanceName: 'test-instance',
            instanceId: 'test-id',
            connected: true,
            connectedPhone: '5411000000000',
          },
        },
      },
      { where: { id: orgId } }
    );
  });

  it('handles WhatsApp send failure gracefully', async () => {
    (app.service('whatsapp') as any).create = async () => {
      throw new Error('Connection lost');
    };

    const apptId = await createAppointmentForTomorrow(patientId);
    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });

    const reminder = await sequelize.models.appointment_reminders.findOne({
      where: { appointmentId: apptId },
      raw: true,
    }) as any;
    assert.ok(reminder);
    assert.equal(reminder.status, 'failed');
    assert.ok(reminder.errorMessage.includes('Connection lost'));

    // Restore mock
    (app.service('whatsapp') as any).create = async (data: any) => {
      whatsappCalls.push(data);
      return { sent: true, messageId: 'test-msg-id' };
    };
  });

  it('records skipped when WhatsApp returns no-whatsapp-account', async () => {
    (app.service('whatsapp') as any).create = async () => {
      return { sent: false, reason: 'no-whatsapp-account' };
    };

    const apptId = await createAppointmentForTomorrow(patientId);
    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });

    const reminder = await sequelize.models.appointment_reminders.findOne({
      where: { appointmentId: apptId },
      raw: true,
    }) as any;
    assert.ok(reminder);
    assert.equal(reminder.status, 'skipped');
    assert.ok(reminder.errorMessage.includes('No WhatsApp account'));

    // Restore mock
    (app.service('whatsapp') as any).create = async (data: any) => {
      whatsappCalls.push(data);
      return { sent: true, messageId: 'test-msg-id' };
    };
  });

  it('does not send reminders for past appointments', async () => {
    const yesterday = dayjs().tz(TIMEZONE).subtract(1, 'day').hour(10).minute(0).second(0);
    await sequelize.models.appointments.create({
      organizationId: orgId,
      medicId,
      patientId,
      startDate: yesterday.toDate(),
      extra: false,
    });

    await sendAppointmentReminders(app, { delayMin: 0, delayMax: 0 });

    assert.equal(whatsappCalls.length, 0);
  });
});
