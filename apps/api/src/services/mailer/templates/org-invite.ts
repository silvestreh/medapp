import escape from 'escape-html';

export interface OrgInviteData {
  organizationName: string;
  inviteUrl: string;
  inviterName: string;
}

export function render(data: OrgInviteData): string {
  const orgName = escape(data.organizationName);
  const inviter = escape(data.inviterName);
  const url = escape(data.inviteUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; }
    h1 { font-size: 22px; color: #1a1a1a; margin: 0 0 16px; }
    p { font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #228be6; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 500; }
    .footer { margin-top: 32px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You've been invited to ${orgName}</h1>
    <p><strong>${inviter}</strong> has invited you to join <strong>${orgName}</strong> on MedApp.</p>
    <p>Click the button below to accept the invitation:</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${url}" class="btn">Accept Invitation</a>
    </p>
    <p class="footer">If you didn't expect this invitation, you can safely ignore this email.</p>
  </div>
</body>
</html>`;
}
