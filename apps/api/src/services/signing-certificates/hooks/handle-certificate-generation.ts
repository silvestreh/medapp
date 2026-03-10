import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import forge from 'node-forge';

export const handleCertificateGeneration = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.data?.action !== 'generate') {
    return context;
  }

  const { password } = context.data;
  if (!password || typeof password !== 'string') {
    throw new BadRequest('Password is required to generate a certificate');
  }

  const user = context.params.user;
  if (!user) {
    throw new BadRequest('User not found');
  }

  // Fetch full user data to get personalData (may not be on params.user)
  const fullUser = await context.app.service('users').get(user.id, { provider: undefined } as any) as any;
  const personalData = fullUser.personalData || {};
  const firstName = personalData.firstName || '';
  const lastName = personalData.lastName || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || fullUser.username || 'Unknown';

  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: `Dr. ${fullName}` },
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: 'Athelas' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
    },
    {
      name: 'extKeyUsage',
      emailProtection: true,
    },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: '3des',
    friendlyName: `Dr. ${fullName}`,
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Base64 = forge.util.encode64(p12Der);

  context.data = {
    ...context.data,
    certificate: p12Base64,
    fileName: `certificate-${user.id}.p12`,
    isClientEncrypted: false,
    userId: context.data.userId || user.id,
  };

  // Remove transient fields that must never be persisted
  delete context.data.action;
  delete context.data.password;

  return context;
};
