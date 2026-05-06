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

async function sendPasswordResetEmail({ toEmail, firstName, resetUrl, expiresMinutes = 60 }) {
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
  const safeUrl = escapeHtml(resetUrl);

  const payload = {
    sender: {
      email: emailFrom,
      name: senderName,
    },
    to: [{ email: toEmail, name: firstName || toEmail }],
    subject: 'Reset your SmartRoute password',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="margin-bottom:12px;">Reset your SmartRoute password</h2>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your password.</p>
        <p style="margin:24px 0;">
          <a href="${safeUrl}" style="background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;">Reset Password</a>
        </p>
        <p>This link expires in ${expiresMinutes} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
    textContent: `Hi ${firstName || 'there'},\n\nReset your SmartRoute password:\n${resetUrl}\n\nThis link expires in ${expiresMinutes} minutes.`,
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
        requestName: 'brevo_send_password_reset_email',
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

async function sendAccountSuspendedEmail({ toEmail, firstName }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const emailFrom = (process.env.EMAIL_FROM || '').trim();

  if (!apiKey || !emailFrom) {
    return { sent: false, skipped: true, reason: 'Missing BREVO_API_KEY or EMAIL_FROM' };
  }

  const senderName = process.env.EMAIL_FROM_NAME || 'SmartRoute';
  const safeName = escapeHtml(firstName || 'there');

  const payload = {
    sender: { email: emailFrom, name: senderName },
    to: [{ email: toEmail, name: firstName || toEmail }],
    subject: 'Your SmartRoute account has been suspended',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;margin-bottom:12px;">Account Suspended</h2>
        <p>Hi ${safeName},</p>
        <p>We're writing to inform you that your SmartRoute account has been <strong>suspended</strong> due to a violation of our terms of service.</p>
        <p>While your account is suspended, you will not be able to sign in or access any SmartRoute services.</p>
        <p>If you believe this was a mistake or would like to appeal this decision, please contact our support team by replying to this email.</p>
        <p style="margin-top:24px;">We're sorry for the inconvenience.</p>
        <p>— The SmartRoute Team</p>
      </div>
    `,
    textContent: `Hi ${firstName || 'there'},\n\nYour SmartRoute account has been suspended due to a violation of our terms of service.\n\nWhile suspended, you will not be able to sign in or access SmartRoute services.\n\nIf you believe this was a mistake, please reply to this email to appeal.\n\n— The SmartRoute Team`,
  };

  try {
    await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload),
    }, { requestName: 'brevo_send_suspended_email', maxAttempts: 3, baseDelayMs: 750, timeoutMs: 10000 });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message || 'Brevo send failed' };
  }
}

async function sendAccountDeletedEmail({ toEmail, firstName }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const emailFrom = (process.env.EMAIL_FROM || '').trim();

  if (!apiKey || !emailFrom) {
    return { sent: false, skipped: true, reason: 'Missing BREVO_API_KEY or EMAIL_FROM' };
  }

  const senderName = process.env.EMAIL_FROM_NAME || 'SmartRoute';
  const safeName = escapeHtml(firstName || 'there');

  const payload = {
    sender: { email: emailFrom, name: senderName },
    to: [{ email: toEmail, name: firstName || toEmail }],
    subject: 'Your SmartRoute account has been deleted',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;margin-bottom:12px;">Account Deleted</h2>
        <p>Hi ${safeName},</p>
        <p>Your SmartRoute account has been <strong>permanently deleted</strong> by an administrator.</p>
        <p>All your data, including your route history and profile, has been removed from our system.</p>
        <p>If you believe this was done in error, please contact support by replying to this email. Note that account recovery may not be possible after deletion.</p>
        <p style="margin-top:24px;">— The SmartRoute Team</p>
      </div>
    `,
    textContent: `Hi ${firstName || 'there'},\n\nYour SmartRoute account has been permanently deleted by an administrator.\n\nAll your data has been removed from our system.\n\nIf you believe this was done in error, please reply to this email.\n\n— The SmartRoute Team`,
  };

  try {
    await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload),
    }, { requestName: 'brevo_send_deleted_email', maxAttempts: 3, baseDelayMs: 750, timeoutMs: 10000 });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message || 'Brevo send failed' };
  }
}

async function sendAccountPromotedEmail({ toEmail, firstName, role = 'admin' }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const emailFrom = (process.env.EMAIL_FROM || '').trim();

  if (!apiKey || !emailFrom) {
    return { sent: false, skipped: true, reason: 'Missing BREVO_API_KEY or EMAIL_FROM' };
  }

  const senderName = process.env.EMAIL_FROM_NAME || 'SmartRoute';
  const safeName = escapeHtml(firstName || 'there');

  const payload = {
    sender: { email: emailFrom, name: senderName },
    to: [{ email: toEmail, name: firstName || toEmail }],
    subject: `Your SmartRoute account has been granted ${role} access`,
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#7c3aed;margin-bottom:12px;">${role === 'admin' ? 'Admin' : 'Researcher'} Access Granted</h2>
        <p>Hi ${safeName},</p>
        <p>Your SmartRoute account has been <strong>granted ${role} access</strong>.</p>
        ${role === 'admin'
          ? '<p>You now have full access to the admin panel, where you can manage users, view login activity, and maintain the platform.</p>'
          : '<p>You now have access to the Research Analytics dashboard, where you can view statistical analysis of route data.</p>'
        }
        <p>Please use this access responsibly.</p>
        <p style="margin-top:24px;">Welcome to the team.</p>
        <p>— The SmartRoute Team</p>
      </div>
    `,
    textContent: `Hi ${firstName || 'there'},\n\nYour SmartRoute account has been granted ${role} access.\n\nPlease use this access responsibly.\n\nWelcome to the team.\n\n— The SmartRoute Team`,
  };

  try {
    await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload),
    }, { requestName: 'brevo_send_promoted_email', maxAttempts: 3, baseDelayMs: 750, timeoutMs: 10000 });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error.message || 'Brevo send failed' };
  }
}

module.exports = {
  isBrevoConfigured,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountSuspendedEmail,
  sendAccountDeletedEmail,
  sendAccountPromotedEmail,
};
