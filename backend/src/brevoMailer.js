const { fetchWithRetry } = require('./resilientFetch');

function isBrevoConfigured() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const emailFrom = (process.env.EMAIL_FROM || '').trim();
  return Boolean(apiKey && emailFrom);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendVerificationEmail({ toEmail, firstName, verificationUrl }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const emailFrom = (process.env.EMAIL_FROM || '').trim();

  if (!apiKey || !emailFrom) {
    return {
      sent: false,
      skipped: true,
      reason: 'Missing BREVO_API_KEY or EMAIL_FROM',
    };
  }

  const senderName = process.env.EMAIL_FROM_NAME || 'SmartRoute';
  const safeName = escapeHtml(firstName || 'there');
  const safeUrl = escapeHtml(verificationUrl);

  const payload = {
    sender: {
      email: emailFrom,
      name: senderName,
    },
    to: [{ email: toEmail, name: firstName || toEmail }],
    subject: 'Verify your SmartRoute account',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="margin-bottom:12px;">Verify your SmartRoute email</h2>
        <p>Hi ${safeName},</p>
        <p>Thanks for signing up. Please verify your email to activate your account.</p>
        <p style="margin:24px 0;">
          <a href="${safeUrl}" style="background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;">Verify Email</a>
        </p>
        <p>This link expires in 24 hours.</p>
        <p>If you did not sign up, you can ignore this email.</p>
      </div>
    `,
    textContent: `Hi ${firstName || 'there'},\n\nVerify your SmartRoute account:\n${verificationUrl}\n\nThis link expires in 24 hours.`,
  };

  let response;
  try {
    response = await fetchWithRetry(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
      },
      {
        requestName: 'brevo_send_verification_email',
        maxAttempts: parseInt(process.env.BREVO_RETRY_ATTEMPTS || '3', 10),
        baseDelayMs: parseInt(process.env.BREVO_RETRY_DELAY_MS || '750', 10),
        timeoutMs: parseInt(process.env.BREVO_TIMEOUT_MS || '10000', 10),
      }
    );
  } catch (error) {
    return {
      sent: false,
      error: error.message || 'Brevo send failed',
    };
  }

  let body = null;
  try {
    body = await response.json();
  } catch (_) {
    body = null;
  }

  return {
    sent: true,
    messageId: body && body.messageId ? body.messageId : null,
  };
}

module.exports = {
  isBrevoConfigured,
  sendVerificationEmail,
};
