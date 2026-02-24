import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useActionData, useRouteLoaderData } from '@remix-run/react';
import QRCode from 'qrcode';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { parseFormJson } from '~/utils/parse-form-json';
import { ProfileSecurity } from '~/components/profile-security';
import type { loader as profileLoader } from '~/routes/profile';

const buildTwoFactorSetupPayload = async (result: { secret: string; otpauthUri: string }) => {
  const qrCodeDataUrl = await QRCode.toDataURL(result.otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });

  return {
    secret: result.secret,
    otpauthUri: result.otpauthUri,
    qrCodeDataUrl,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  let client;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch (error) {
    throw redirect('/login');
  }

  try {
    if (intent === 'setup-2fa') {
      const result = await client.service('profile').create({ action: 'setup-2fa' });
      const setup = await buildTwoFactorSetupPayload(result);
      return json({ ok: true, intent, result: setup });
    }

    if (intent === 'enable-2fa') {
      const twoFactorCode = String(formData.get('twoFactorCode') || '');
      const result = await client.service('profile').create({ action: 'enable-2fa', twoFactorCode });
      return json({ ok: true, intent, result });
    }

    if (intent === 'change-password') {
      const currentPassword = String(formData.get('currentPassword') || '');
      const newPassword = String(formData.get('newPassword') || '');
      const twoFactorCode = String(formData.get('twoFactorCode') || '');

      const result = await client.service('profile').create({
        action: 'change-password',
        currentPassword,
        newPassword,
        twoFactorCode,
      });

      return json({ ok: true, intent, result });
    }

    if (intent === 'passkey-register-options') {
      const result = await client.service('webauthn').create({
        action: 'generate-registration-options',
      });
      return json({ ok: true, intent, result });
    }

    if (intent === 'passkey-register-verify') {
      const credential = parseFormJson(formData.get('credential'));
      const deviceName = String(formData.get('deviceName') || '');
      const result = await client.service('webauthn').create({
        action: 'verify-registration',
        credential,
        deviceName,
      });
      return json({ ok: true, intent, result });
    }

    if (intent === 'passkey-remove') {
      const passkeyId = String(formData.get('passkeyId') || '');
      await client.service('passkey-credentials').remove(passkeyId);
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function ProfileSecurityRoute() {
  const parentData = useRouteLoaderData<typeof profileLoader>('routes/profile');
  const actionData = useActionData<typeof action>();

  if (!parentData) return null;

  return (
    <ProfileSecurity
      username={parentData.username}
      twoFactorEnabled={parentData.twoFactorEnabled}
      actionData={actionData}
      passkeys={parentData.passkeys}
    />
  );
}
