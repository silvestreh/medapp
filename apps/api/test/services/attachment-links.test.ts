import assert from 'assert';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import app from '../../src/app';
import { createTestClient } from '../test-client';
import { createTestOrganization, createTestUser } from '../test-helpers';
import { encryptToDisk } from '../../src/services/file-uploads/hooks/handle-file-upload';
import { resolveUploadsDir } from '../../src/middleware/encrypted-uploads';
import {
  getUploadSigningSecret,
  signUploadUrl,
  verifyUploadSignature,
} from '../../src/utils/signed-upload-url';

const PASSWORD = 'SuperSecret1!';
const PDF_BYTES = Buffer.from('%PDF-1.4\n% attachment-links test fixture\n');

async function login(client: any, username: string) {
  await client.authenticate({ strategy: 'local', username, password: PASSWORD });
  return client;
}

function baseUrl(): string {
  return `http://localhost:${app.get('port')}`;
}

describe('\'attachment-links\' service + /uploads signed access', () => {
  let server: any;
  let org: any;
  let owner: any;
  let otherMedic: any;
  let grantedMedic: any;
  let patient: any;
  let encounter: any;
  let attachmentUrl: string;
  let filename: string;
  let ownerClient: any;
  let otherClient: any;
  let grantedClient: any;

  before(async () => {
    server = await app.listen(app.get('port'));
    org = await createTestOrganization();
    const suffix = `${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;

    owner = await createTestUser({
      username: `test.attlink.owner.${suffix}`,
      password: PASSWORD,
      roleIds: ['medic'],
      organizationId: org.id,
    });
    otherMedic = await createTestUser({
      username: `test.attlink.other.${suffix}`,
      password: PASSWORD,
      roleIds: ['medic'],
      organizationId: org.id,
    });
    grantedMedic = await createTestUser({
      username: `test.attlink.granted.${suffix}`,
      password: PASSWORD,
      roleIds: ['medic'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      medicare: `ATTLINK_${suffix}`,
      medicareNumber: '99887766',
    });

    attachmentUrl = encryptToDisk(PDF_BYTES, '.pdf', app.get('uploads').dir);
    filename = attachmentUrl.replace('/api/uploads/', '');

    encounter = await app.service('encounters').create({
      data: {
        attachments: [
          { url: attachmentUrl, fileName: 'report.pdf', mimeType: 'application/pdf', fileSize: PDF_BYTES.length },
        ],
      },
      date: new Date(),
      medicId: owner.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    await app.service('shared-encounter-access').create({
      grantingMedicId: owner.id,
      grantedMedicId: grantedMedic.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    ownerClient = await login(createTestClient(org.id), owner.username);
    otherClient = await login(createTestClient(org.id), otherMedic.username);
    grantedClient = await login(createTestClient(org.id), grantedMedic.username);
  });

  after(async () => {
    const filePath = path.join(resolveUploadsDir(app), filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await new Promise(resolve => server.close(resolve));
  });

  describe('signature helpers', () => {
    it('round-trips a valid signature and rejects tampering / expiry', () => {
      const secret = getUploadSigningSecret()!;
      assert.ok(secret, 'signing secret derives from ENCRYPTION_KEY');

      const { url } = signUploadUrl(secret, 'a.pdf.enc', 60, 1_000_000_000);
      const params = new URL(url, 'http://x').searchParams;
      const exp = params.get('exp')!;
      const sig = params.get('sig')!;

      assert.ok(verifyUploadSignature(secret, 'a.pdf.enc', exp, sig, 1_000_000_000));
      assert.ok(!verifyUploadSignature(secret, 'b.pdf.enc', exp, sig, 1_000_000_000), 'other file');
      assert.ok(!verifyUploadSignature(secret, 'a.pdf.enc', String(Number(exp) + 1), sig, 1_000_000_000), 'exp tampered');
      assert.ok(!verifyUploadSignature(secret, 'a.pdf.enc', exp, sig.replace(/^./, c => (c === '0' ? '1' : '0')), 1_000_000_000), 'sig tampered');
      assert.ok(!verifyUploadSignature(secret, 'a.pdf.enc', exp, sig, 1_000_000_000 + 61_000), 'expired');
      assert.ok(!verifyUploadSignature(secret, 'a.pdf.enc', undefined, sig), 'missing exp');
    });
  });

  describe('minting links', () => {
    it('rejects unauthenticated requests', async () => {
      const anon = createTestClient(org.id);
      await assert.rejects(
        anon.service('attachment-links').create({ encounterId: encounter.id, url: attachmentUrl }),
        (err: any) => err.code === 401
      );
    });

    it('lets the owning medic mint a link that the /uploads handler accepts', async () => {
      const link = await ownerClient.service('attachment-links').create({
        encounterId: encounter.id,
        url: attachmentUrl,
      });

      assert.ok(link.url.startsWith(`/api/uploads/${filename}?exp=`), link.url);
      assert.ok(/&sig=[0-9a-f]{64}$/.test(link.url));
      assert.strictEqual(link.patientId, patient.id);
      assert.strictEqual(link.fileName, 'report.pdf');
      assert.ok(new Date(link.expiresAt).getTime() > Date.now());

      const res = await axios.get(`${baseUrl()}${link.url.replace('/api', '')}`, {
        responseType: 'arraybuffer',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['content-type'], 'application/pdf');
      assert.strictEqual(res.headers['cache-control'], 'private, no-store');
      assert.ok(Buffer.from(res.data).equals(PDF_BYTES), 'decrypted bytes match the upload');
    });

    it('lets a medic with a shared-access grant mint a link', async () => {
      const link = await grantedClient.service('attachment-links').create({
        encounterId: encounter.id,
        url: attachmentUrl,
      });
      assert.ok(link.url.includes('sig='));
    });

    it('refuses a medic without access to the encounter', async () => {
      await assert.rejects(
        otherClient.service('attachment-links').create({ encounterId: encounter.id, url: attachmentUrl }),
        (err: any) => err.code === 403
      );
    });

    it('refuses a url that is not one of the encounter attachments', async () => {
      const foreign = encryptToDisk(PDF_BYTES, '.pdf', app.get('uploads').dir);
      try {
        await assert.rejects(
          ownerClient.service('attachment-links').create({ encounterId: encounter.id, url: foreign }),
          (err: any) => err.code === 404
        );
      } finally {
        fs.unlinkSync(path.join(resolveUploadsDir(app), foreign.replace('/api/uploads/', '')));
      }
    });

    it('validates input', async () => {
      await assert.rejects(
        ownerClient.service('attachment-links').create({ url: attachmentUrl }),
        (err: any) => err.code === 400
      );
      await assert.rejects(
        ownerClient.service('attachment-links').create({ encounterId: encounter.id, url: 'https://res.cloudinary.com/x/y.png' }),
        (err: any) => err.code === 400
      );
      await assert.rejects(
        ownerClient.service('attachment-links').create({ encounterId: encounter.id, url: '/api/uploads/../../etc/passwd.enc' }),
        (err: any) => err.code === 400
      );
    });

    it('writes an access-log entry identifying the attachment', async () => {
      await ownerClient.service('attachment-links').create({ encounterId: encounter.id, url: attachmentUrl });
      await new Promise(resolve => setTimeout(resolve, 300));

      const logs = (await app.service('access-logs').find({
        query: { userId: String(owner.id), patientId: String(patient.id), resource: 'encounters', action: 'read' },
        paginate: false,
      } as any)) as any[];

      const entry = logs.find(l => l.metadata?.via === 'attachment-link');
      assert.ok(entry, 'attachment-link access log entry exists');
      assert.strictEqual(entry.metadata.attachment, filename);
      assert.strictEqual(entry.metadata.attachmentFileName, 'report.pdf');
      assert.strictEqual(String(entry.organizationId), String(org.id));
    });
  });

  describe('/uploads handler', () => {
    const expectStatus = async (url: string, status: number) => {
      const res = await axios.get(url, { validateStatus: () => true, responseType: 'arraybuffer' });
      assert.strictEqual(res.status, status, `${url} → ${res.status}`);
      return res;
    };

    it('rejects the bare capability URL (no signature)', async () => {
      const res = await expectStatus(`${baseUrl()}/uploads/${filename}`, 401);
      assert.ok(!Buffer.from(res.data).includes('%PDF'), 'no plaintext leaked');
    });

    it('rejects a tampered signature and an expired link', async () => {
      const secret = getUploadSigningSecret()!;
      const good = signUploadUrl(secret, filename, 60).url.replace('/api', '');
      const tampered = good.replace(/sig=([0-9a-f])/, (_m, c) => `sig=${c === '0' ? '1' : '0'}`);
      await expectStatus(`${baseUrl()}${tampered}`, 401);

      const expired = signUploadUrl(secret, filename, 60, Date.now() - 120_000).url.replace('/api', '');
      await expectStatus(`${baseUrl()}${expired}`, 401);
    });

    it('never serves ciphertext through static fallthrough', async () => {
      const res = await expectStatus(`${baseUrl()}/uploads/${filename}`, 401);
      const onDisk = fs.readFileSync(path.join(resolveUploadsDir(app), filename));
      assert.ok(!Buffer.from(res.data).equals(onDisk), 'raw encrypted bytes are not returned');
    });

    it('returns 404 for a signed link to a missing file', async () => {
      const secret = getUploadSigningSecret()!;
      const missing = `${'0'.repeat(8)}-0000-0000-0000-000000000000.pdf.enc`;
      await expectStatus(`${baseUrl()}${signUploadUrl(secret, missing, 60).url.replace('/api', '')}`, 404);
    });

    it('leaves legacy unencrypted uploads on the static path untouched', async () => {
      const dir = resolveUploadsDir(app);
      fs.mkdirSync(dir, { recursive: true });
      const legacy = path.join(dir, `legacy-${Date.now()}.txt`);
      fs.writeFileSync(legacy, 'plain');
      try {
        const res = await expectStatus(`${baseUrl()}/uploads/${path.basename(legacy)}`, 200);
        assert.strictEqual(Buffer.from(res.data).toString(), 'plain');
      } finally {
        fs.unlinkSync(legacy);
      }
    });
  });
});
