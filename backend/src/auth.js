// ============================================
// AUTH ROUTES - Signup, Login, Pepper Rotation
// ============================================

const crypto = require('crypto');
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { sendMakeEvent } = require('./makeNotifier');
const { logToNotionAsync } = require('./notionLogger');
const { sendVerificationEmail, isBrevoConfigured } = require('./brevoMailer');
const {
  encryptEmail,
  hmacEmail,
  hashPassword,
  verifyWithPepperRotation,
} = require('./crypto');

const router = express.Router();

// Max login attempts before account lockout (Availability protection)
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_MINUTES || '15');
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
const EMAIL_VERIFICATION_TTL_MINUTES = parseInt(
  process.env.EMAIL_VERIFICATION_TTL_MINUTES || '1440'
);
const VERIFY_API_BASE_URL = (
  process.env.EMAIL_VERIFY_URL_BASE ||
  (process.env.NODE_ENV === 'production'
    ? 'https://traffic-backend-api.azurewebsites.net'
    : `http://localhost:${process.env.PORT || 3001}`)
).replace(/\/+$/, '');
const FRONTEND_URL = (
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://www.navocs.com' : 'http://localhost:5173')
).replace(/\/+$/, '');

function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60000).toISOString();

  return { token, tokenHash, expiresAt };
}

function buildLoginRedirectUrl(params = {}) {
  const search = new URLSearchParams(params).toString();
  return `${FRONTEND_URL}/login${search ? `?${search}` : ''}`;
}

function sendVerifyResponse(req, res, statusCode, payload) {
  const wantsJson = String(req.query.format || '').toLowerCase() === 'json';
  if (wantsJson) {
    return res.status(statusCode).json(payload);
  }

  if (payload.verified) {
    return res.redirect(302, buildLoginRedirectUrl({ verified: '1' }));
  }

  return res.redirect(302, buildLoginRedirectUrl({
    verified: '0',
    reason: payload.reason || 'verification_failed',
  }));
}

// ---- SIGNUP ----
router.post(
  '/signup',
  [
    body('firstName').trim().isLength({ min: 1, max: 100 }).escape(),
    body('lastName').trim().isLength({ min: 1, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 128 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must have uppercase, lowercase, and number'),
    body('role').isIn(['driver', 'researcher', 'admin']),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const valPayload = { message: 'Signup validation failed', path: '/api/auth/signup', ip: req.ip, fields: errors.array().map(e => e.path).join(', ') };
        logToNotionAsync('auth_validation_error', valPayload);
        sendMakeEvent('auth_validation_error', valPayload).catch(() => {});
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { firstName, lastName, email, password, role } = req.body;
      const pepper = process.env.PASSWORD_PEPPER;
      const encKey = process.env.EMAIL_ENCRYPTION_KEY;
      const hmacKey = process.env.EMAIL_HMAC_KEY;
      const nowIso = new Date().toISOString();

      if (REQUIRE_EMAIL_VERIFICATION && !isBrevoConfigured()) {
        return res.status(503).json({
          error: 'Email verification service is not configured. Please try again later.',
        });
      }

      // Check if email already exists (using HMAC lookup — no decryption needed)
      const emailHash = hmacEmail(email, hmacKey);
      const existingUser = await db.getUserByEmailHmac(emailHash);
      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Encrypt email (Confidentiality)
      const { encrypted, iv, authTag } = encryptEmail(email, encKey);

      // Hash password with Argon2id + salt + pepper (Confidentiality + Integrity)
      const passwordHash = await hashPassword(password, pepper);

      // Get current pepper version
      const pepperRow = await db.getCurrentPepperVersion();
      const verificationState = REQUIRE_EMAIL_VERIFICATION ? createEmailVerificationToken() : null;

      // Insert user
      const userId = uuidv4();
      await db.createUser({
        id: userId,
        email_encrypted: encrypted,
        email_hmac: emailHash,
        email_iv: iv,
        email_auth_tag: authTag,
        password_hash: passwordHash,
        pepper_version: pepperRow.version,
        first_name: firstName,
        last_name: lastName,
        role,
        created_at: nowIso,
        updated_at: nowIso,
        login_attempts: 0,
        locked_until: null,
        email_verified: !REQUIRE_EMAIL_VERIFICATION,
        email_verified_at: REQUIRE_EMAIL_VERIFICATION ? null : nowIso,
        email_verification_token_hash: verificationState ? verificationState.tokenHash : null,
        email_verification_expires_at: verificationState ? verificationState.expiresAt : null,
      });

      // Audit log (Integrity — tracking all security events)
      await db.addAuditLog({
        user_id: userId,
        action: 'SIGNUP',
        ip_address: req.ip,
        details: JSON.stringify({ role }),
      });

      let verificationEmailSent = false;
      if (REQUIRE_EMAIL_VERIFICATION && verificationState) {
        const verificationUrl = `${VERIFY_API_BASE_URL}/api/auth/verify-email?token=${verificationState.token}`;
        const emailResult = await sendVerificationEmail({
          toEmail: email,
          firstName,
          verificationUrl,
        });

        if (!emailResult.sent) {
          await db.deleteUser(userId).catch(() => {});
          return res.status(503).json({
            error: 'Unable to send verification email right now. Please try again.',
          });
        }

        verificationEmailSent = emailResult.sent === true;
        const verificationPayload = {
          userId,
          email,
          verificationEmailSent,
          verificationUrl,
          skipped: Boolean(emailResult.skipped),
        };
        sendMakeEvent('auth_verification_email_dispatched', verificationPayload).catch(() => {});
        logToNotionAsync('auth_verification_email_dispatched', verificationPayload);
      }

      res.status(201).json({
        message: REQUIRE_EMAIL_VERIFICATION
          ? 'Account created. Check your email to verify before login.'
          : 'Account created successfully',
        requiresEmailVerification: REQUIRE_EMAIL_VERIFICATION,
        verificationEmailSent,
        user: { id: userId, firstName, lastName, role },
      });
    } catch (err) {
      console.error('Signup error:', err);
      const signupErrPayload = { message: err.message, path: '/api/auth/signup', ip: req.ip };
      await sendMakeEvent('auth_signup_error', signupErrPayload);
      logToNotionAsync('auth_signup_error', signupErrPayload);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ---- EMAIL VERIFICATION ----
router.get('/verify-email', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return sendVerifyResponse(req, res, 400, {
        verified: false,
        reason: 'missing_token',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db.getUserByVerificationTokenHash(tokenHash);

    if (!user) {
      return sendVerifyResponse(req, res, 400, {
        verified: false,
        reason: 'invalid_token',
      });
    }

    if (user.email_verified === true) {
      return sendVerifyResponse(req, res, 200, {
        verified: true,
        reason: 'already_verified',
      });
    }

    const expiresAt = user.email_verification_expires_at
      ? new Date(user.email_verification_expires_at).getTime()
      : 0;

    if (!expiresAt || Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      return sendVerifyResponse(req, res, 410, {
        verified: false,
        reason: 'expired_token',
      });
    }

    await db.markUserEmailVerified(user.id);
    await db.addAuditLog({
      user_id: user.id,
      action: 'EMAIL_VERIFIED',
      ip_address: req.ip,
    });

    const verifiedPayload = { userId: user.id };
    sendMakeEvent('auth_email_verified', verifiedPayload).catch(() => {});
    logToNotionAsync('auth_email_verified', verifiedPayload);

    return sendVerifyResponse(req, res, 200, {
      verified: true,
      reason: 'verified',
    });
  } catch (err) {
    console.error('Email verification error:', err);
    return sendVerifyResponse(req, res, 500, {
      verified: false,
      reason: 'verification_error',
    });
  }
});

router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      const { email } = req.body;
      const hmacKey = process.env.EMAIL_HMAC_KEY;
      const emailHash = hmacEmail(email, hmacKey);
      const user = await db.getUserByEmailHmac(emailHash);

      if (!user) {
        return res.json({ message: 'If an account exists, a verification email has been sent.' });
      }

      if (user.email_verified !== false) {
        return res.json({ message: 'Account is already verified.' });
      }

      if (!isBrevoConfigured()) {
        return res.status(503).json({
          error: 'Email verification service is not configured.',
        });
      }

      const verificationState = createEmailVerificationToken();
      await db.setUserEmailVerificationToken(
        user.id,
        verificationState.tokenHash,
        verificationState.expiresAt
      );

      const verificationUrl = `${VERIFY_API_BASE_URL}/api/auth/verify-email?token=${verificationState.token}`;
      const emailResult = await sendVerificationEmail({
        toEmail: email,
        firstName: user.first_name,
        verificationUrl,
      });

      if (!emailResult.sent) {
        return res.status(503).json({
          error: 'Verification email provider is not configured.',
        });
      }

      return res.json({ message: 'Verification email sent.' });
    } catch (err) {
      console.error('Resend verification error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ---- LOGIN ----
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1, max: 128 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const { email, password } = req.body;
      const hmacKey = process.env.EMAIL_HMAC_KEY;
      const currentPepper = process.env.PASSWORD_PEPPER;
      const previousPepper = process.env.PASSWORD_PEPPER_PREVIOUS || null;

      // Find user by email HMAC (no decryption needed for lookup)
      const emailHash = hmacEmail(email, hmacKey);
      const user = await db.getUserByEmailHmac(emailHash);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check account lockout (Availability — prevent brute force)
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
        return res.status(423).json({
          error: `Account locked. Try again in ${minutesLeft} minutes.`,
        });
      }

      // Verify password with pepper rotation support
      const result = await verifyWithPepperRotation(
        password,
        user.password_hash,
        currentPepper,
        previousPepper
      );

      if (!result.verified) {
        // Increment login attempts
        const attempts = (user.login_attempts || 0) + 1;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
          await db.updateUserFailedLogin(user.id, attempts, lockUntil);
          await db.addAuditLog({
            user_id: user.id,
            action: 'ACCOUNT_LOCKED',
            ip_address: req.ip,
            details: JSON.stringify({ attempts }),
          });
          const lockPayload = { userId: user.id, attempts, lockUntil };
          await sendMakeEvent('auth_account_locked', lockPayload);
          logToNotionAsync('auth_account_locked', lockPayload);
        } else {
          await db.updateUserLoginAttempts(user.id, attempts);
        }

        await db.addAuditLog({ user_id: user.id, action: 'LOGIN_FAILED', ip_address: req.ip });
        const failPayload = { message: `Login failed (attempt ${attempts})`, path: '/api/auth/login', ip: req.ip };
        logToNotionAsync('auth_login_failed', failPayload);
        sendMakeEvent('auth_login_failed', failPayload).catch(() => {});

        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Require verification only for accounts created with this feature.
      if (REQUIRE_EMAIL_VERIFICATION && user.email_verified === false) {
        await db.resetUserLockout(user.id);
        await db.addAuditLog({
          user_id: user.id,
          action: 'LOGIN_BLOCKED_UNVERIFIED',
          ip_address: req.ip,
        });

        return res.status(403).json({
          error: 'Please verify your email before logging in.',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }

      // If pepper was rotated, update the password hash with new pepper
      if (result.needsRehash) {
        const pepperRow = await db.getCurrentPepperVersion();
        await db.updateUserPasswordHashAndPepperVersion(
          user.id,
          result.newHash,
          pepperRow.version
        );

        await db.addAuditLog({
          user_id: user.id,
          action: 'PEPPER_REHASH',
          ip_address: req.ip,
          details: JSON.stringify({ newPepperVersion: pepperRow.version }),
        });
      }

      // Reset login attempts on success
      await db.resetUserLockout(user.id);

      // Audit log
      await db.addAuditLog({ user_id: user.id, action: 'LOGIN_SUCCESS', ip_address: req.ip });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      const loginErrPayload = { message: err.message, path: '/api/auth/login', ip: req.ip };
      await sendMakeEvent('auth_login_error', loginErrPayload);
      logToNotionAsync('auth_login_error', loginErrPayload);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ---- PEPPER ROTATION (Admin only) ----
router.post('/rotate-pepper', async (req, res) => {
  try {
    // In production, protect this endpoint with admin auth middleware
    // Create new pepper version
    const currentVersion = await db.getMaxPepperVersion();
    const newVersion = (currentVersion.version || 0) + 1;
    await db.rotatePepperVersion(newVersion);

    // Count users that will need rehash on next login
    const usersToRehashCount = await db.countUsersWithPepperVersionLessThan(newVersion);

    await db.addAuditLog({
      action: 'PEPPER_ROTATED',
      details: JSON.stringify({ newVersion, usersAffected: usersToRehashCount }),
    });

    res.json({
      message: 'Pepper rotated successfully',
      newVersion,
      note: `${usersToRehashCount} users will be re-hashed on their next login. Update PASSWORD_PEPPER in .env with the new pepper value and move the old pepper to PASSWORD_PEPPER_PREVIOUS.`,
    });
  } catch (err) {
    console.error('Pepper rotation error:', err);
    const pepperErrPayload = { message: err.message, path: '/api/auth/rotate-pepper', ip: req.ip };
    await sendMakeEvent('auth_pepper_rotation_error', pepperErrPayload);
    logToNotionAsync('auth_pepper_rotation_error', pepperErrPayload);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
