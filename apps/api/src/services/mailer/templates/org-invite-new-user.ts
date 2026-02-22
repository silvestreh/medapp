export interface OrgInviteNewUserData {
  organizationName: string;
  inviteUrl: string;
  inviterName: string;
  username: string;
}

export function render(data: OrgInviteNewUserData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MedApp</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; }
    h1 { font-size: 22px; color: #1a1a1a; margin: 0 0 16px; }
    p { font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #228be6; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 500; }
    .info { background: #f0f4ff; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .info strong { color: #1a1a1a; }
    .footer { margin-top: 32px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to MedApp</h1>
    <p><strong>${data.inviterName}</strong> has created an account for you at <strong>${data.organizationName}</strong>.</p>
    <div class="info">
      <p style="margin:0"><strong>Username:</strong> ${data.username}</p>
    </div>
    <p>Click the button below to set your password and get started:</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${data.inviteUrl}" class="btn">Set Password &amp; Join</a>
    </p>
    <p class="footer">If you didn't expect this invitation, you can safely ignore this email.</p>
  </div>
</body>
</html>`;
}
