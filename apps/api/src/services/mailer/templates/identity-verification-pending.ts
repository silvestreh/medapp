import escape from 'escape-html';

export interface IdentityVerificationPendingData {
  userName: string;
  userId: string;
}

export function render(data: IdentityVerificationPendingData): string {
  const name = escape(data.userName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Identity Verification</title>
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
    <h1>New Identity Verification Pending</h1>
    <p><strong>${name}</strong> has submitted identity verification documents and is waiting for review.</p>
    <p>Please review the submitted ID photos and selfie in the admin panel.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${escape(process.env.APP_URL || 'https://app.athel.as')}/admin" class="btn">Review Verification</a>
    </p>
    <p class="footer">This is an automated notification from Athelas.</p>
  </div>
</body>
</html>`;
}
