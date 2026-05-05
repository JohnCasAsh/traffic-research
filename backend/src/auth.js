// ============================================
// AUTH ROUTES - Signup, Login, Pepper Rotation
// ============================================

const crypto = require('crypto');
const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { sendMakeEvent } = require('./makeNotifier');
const { logToNotionAsync } = require('./notionLogger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./brevoMailer');
const { createOriginPolicy } = require('./originPolicy');
const {
  decryptEmail,
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
const PASSWORD_RESET_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || '60');
const PASSWORD_RESET_MAX_PER_DAY = parseInt(process.env.PASSWORD_RESET_MAX_PER_DAY || '3');
const OAUTH_STATE_TTL_MS = parseInt(process.env.OAUTH_STATE_TTL_MS || '600000');
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
const originPolicy = createOriginPolicy(process.env.ALLOWED_ORIGINS);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PROFILE_PICTURE_MAX_LENGTH = 400000;
const oauthStates = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of oauthStates.entries()) {
    if (!entry || entry.expiresAt <= now) {
      oauthStates.delete(state);
    }
  }
}, Math.max(30000, Math.floor(OAUTH_STATE_TTL_MS / 2))).unref();

function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60000).toISOString();

  return { token, tokenHash, expiresAt };
}

function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60000).toISOString();

  return { token, tokenHash, expiresAt };
}

function createOauthState(provider, frontendBaseUrl = FRONTEND_URL) {
  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.set(state, {
    provider,
    frontendBaseUrl,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  });

  return state;
}

function consumeOauthState(provider, state) {
  if (!state || typeof state !== 'string') {
    return null;
  }

  const entry = oauthStates.get(state);
  oauthStates.delete(state);

  if (!entry) {
    return null;
  }

  if (entry.provider !== provider) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    return null;
  }

  return entry;
}

function providerLabel(provider) {
  if (provider === 'google') {
    return 'Google';
  }

  if (provider === 'github') {
    return 'GitHub';
  }

  return 'OAuth';
}

function createEmptyAddress() {
  return {
    country: '',
    province: '',
    city: '',
    barangay: '',
    street: '',
    houseNumber: '',
    postalCode: '',
  };
}

function normalizeTextField(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeAddress(address) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    return createEmptyAddress();
  }

  return {
    country: normalizeTextField(address.country, 100),
    province: normalizeTextField(address.province, 100),
    city: normalizeTextField(address.city, 100),
    barangay: normalizeTextField(address.barangay, 120),
    street: normalizeTextField(address.street, 120),
    houseNumber: normalizeTextField(address.houseNumber, 40),
    postalCode: normalizeTextField(address.postalCode, 20),
  };
}

function isProfilePictureValueValid(value) {
  if (value == null || value === '') {
    return true;
  }

  if (typeof value !== 'string' || value.length > PROFILE_PICTURE_MAX_LENGTH) {
    return false;
  }

  return (
    /^https?:\/\//i.test(value) ||
    /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(value)
  );
}

function getAuthProviderList(user) {
  if (Array.isArray(user.auth_providers) && user.auth_providers.length > 0) {
    return user.auth_providers;
  }

  if (user.auth_provider) {
    return [user.auth_provider];
  }

  return [];
}

function formatProviderList(providers) {
  const labels = providers
    .map((provider) => providerLabel(provider))
    .filter(Boolean);

  if (labels.length === 0) {
    return 'social sign-in';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

function normalizeEmailAddress(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= trimmed.length - 1) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  let domainPart = trimmed.slice(atIndex + 1);

  if (domainPart === 'googlemail.com') {
    domainPart = 'gmail.com';
  }

  if (domainPart === 'gmail.com') {
    const canonicalLocal = localPart.split('+')[0].replace(/\./g, '');
    return `${canonicalLocal}@${domainPart}`;
  }

  return `${localPart}@${domainPart}`;
}

function buildEmailLookupCandidates(email) {
  const trimmed = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!trimmed) {
    return [];
  }

  const candidates = new Set([trimmed, normalizeEmailAddress(trimmed)]);
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= trimmed.length - 1) {
    return Array.from(candidates).filter(Boolean);
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  const isGmailLike = domainPart === 'gmail.com' || domainPart === 'googlemail.com';

  if (isGmailLike) {
    const localWithoutSubAddress = localPart.split('+')[0];
    const localWithoutDots = localWithoutSubAddress.replace(/\./g, '');

    for (const gmailDomain of ['gmail.com', 'googlemail.com']) {
      candidates.add(`${localPart}@${gmailDomain}`);
      candidates.add(`${localWithoutSubAddress}@${gmailDomain}`);
      candidates.add(`${localWithoutDots}@${gmailDomain}`);
    }
  }

  return Array.from(candidates).filter(Boolean);
}

async function findUserByEmailVariants(email, hmacKey) {
  const candidates = buildEmailLookupCandidates(email);
  for (const candidate of candidates) {
    const candidateHash = hmacEmail(candidate, hmacKey);
    const user = await db.getUserByEmailHmac(candidateHash);
    if (user) {
      return { user, matchedEmail: candidate };
    }
  }

  return {
    user: null,
    matchedEmail: normalizeEmailAddress(email),
  };
}

function createCodeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function issueAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

function decodeUserEmail(user) {
  if (!user?.email_encrypted || !user?.email_iv || !user?.email_auth_tag) {
    return '';
  }

  try {
    return decryptEmail(
      user.email_encrypted,
      user.email_iv,
      user.email_auth_tag,
      process.env.EMAIL_ENCRYPTION_KEY
    );
  } catch {
    return '';
  }
}

function buildUserResponse(user) {
  return {
    id: user.id,
    email: decodeUserEmail(user),
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    role: user.role || 'driver',
    profilePictureUrl: typeof user.profile_picture_url === 'string' ? user.profile_picture_url : '',
    address: normalizeAddress(user.address),
    authProviders: getAuthProviderList(user),
    hasPassword: Boolean(user.password_hash),
    emailVerified: user.email_verified !== false,
  };
}

async function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    const user = await db.getUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.authUser = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function relaxOAuthRedirectHeaders(res) {
  // OAuth endpoints only return redirects. Relaxing frame/security headers here
  // avoids browser ERR_BLOCKED_BY_RESPONSE in embedded/webview contexts.
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  res.removeHeader('Cross-Origin-Opener-Policy');
}

function resolveFrontendBaseUrl(req) {
  return originPolicy.resolveFrontendBaseUrl(
    [
      typeof req.query.frontendOrigin === 'string' ? req.query.frontendOrigin : '',
      req.get('origin'),
      req.get('referer'),
    ],
    FRONTEND_URL
  );
}

function buildVerificationUrl(token, frontendBaseUrl = FRONTEND_URL) {
  const verificationUrl = new URL(`${VERIFY_API_BASE_URL}/api/auth/verify-email`);
  verificationUrl.searchParams.set('token', token);
  verificationUrl.searchParams.set('frontendOrigin', frontendBaseUrl);
  return verificationUrl.toString();
}

function buildPasswordResetUrl(token, frontendBaseUrl = FRONTEND_URL) {
  const resetUrl = new URL(`${frontendBaseUrl}/password-recovery`);
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
}

function buildLoginRedirectUrl(frontendBaseUrl = FRONTEND_URL, params = {}) {
  const search = new URLSearchParams(params).toString();
  return `${frontendBaseUrl}/login${search ? `?${search}` : ''}`;
}

function buildOauthErrorRedirectUrl(provider, reason, frontendBaseUrl = FRONTEND_URL) {
  return buildLoginRedirectUrl(frontendBaseUrl, {
    oauth: 'error',
    provider,
    reason,
  });
}

function buildOauthSuccessRedirectUrl(provider, user, frontendBaseUrl = FRONTEND_URL) {
  return buildLoginRedirectUrl(frontendBaseUrl, {
    oauth: 'success',
    provider,
    token: issueAuthToken(user),
    userId: user.id,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    role: user.role || 'driver',
  });
}

function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${VERIFY_API_BASE_URL}/api/auth/oauth/google/callback`,
  };
}

function getGitHubOAuthConfig() {
  return {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: process.env.GITHUB_REDIRECT_URI || `${VERIFY_API_BASE_URL}/api/auth/oauth/github/callback`,
  };
}

function isGoogleOAuthConfigured() {
  const config = getGoogleOAuthConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function isGoogleOAuthStartConfigured() {
  const config = getGoogleOAuthConfig();
  return Boolean(config.clientId && config.redirectUri);
}

function isGitHubOAuthConfigured() {
  const config = getGitHubOAuthConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function isGitHubOAuthStartConfigured() {
  const config = getGitHubOAuthConfig();
  return Boolean(config.clientId && config.redirectUri);
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

async function fetchGoogleProfile(code) {
  const config = getGoogleOAuthConfig();
  if (!isGoogleOAuthConfigured()) {
    throw createCodeError('OAUTH_NOT_CONFIGURED', 'Google OAuth is not configured.');
  }

  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  });

  const tokenData = await parseJsonSafely(tokenResponse);
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw createCodeError('OAUTH_TOKEN_FAILED', 'Failed to exchange Google OAuth code.');
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const profile = await parseJsonSafely(profileResponse);
  if (!profileResponse.ok || !profile?.email) {
    throw createCodeError('OAUTH_PROFILE_FAILED', 'Failed to fetch Google profile.');
  }

  if (profile.email_verified !== true) {
    throw createCodeError('NO_VERIFIED_EMAIL', 'Google account email is not verified.');
  }

  return {
    email: profile.email,
    firstName: profile.given_name || '',
    lastName: profile.family_name || '',
  };
}

async function fetchGitHubProfile(code) {
  const config = getGitHubOAuthConfig();
  if (!isGitHubOAuthConfigured()) {
    throw createCodeError('OAUTH_NOT_CONFIGURED', 'GitHub OAuth is not configured.');
  }

  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody,
  });

  const tokenData = await parseJsonSafely(tokenResponse);
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw createCodeError('OAUTH_TOKEN_FAILED', 'Failed to exchange GitHub OAuth code.');
  }

  const githubHeaders = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'smartroute-auth',
  };

  const profileResponse = await fetch('https://api.github.com/user', {
    headers: githubHeaders,
  });
  const profile = await parseJsonSafely(profileResponse);

  if (!profileResponse.ok) {
    throw createCodeError('OAUTH_PROFILE_FAILED', 'Failed to fetch GitHub profile.');
  }

  let email = profile?.email || '';
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: githubHeaders,
    });
    const emails = await parseJsonSafely(emailsResponse);

    if (!emailsResponse.ok || !Array.isArray(emails)) {
      throw createCodeError('OAUTH_PROFILE_FAILED', 'Failed to fetch GitHub email list.');
    }

    const verifiedPrimary = emails.find((entry) => entry && entry.verified && entry.primary);
    const verifiedFallback = emails.find((entry) => entry && entry.verified);
    email = (verifiedPrimary || verifiedFallback || {}).email || '';
  }

  if (!email) {
    throw createCodeError('NO_VERIFIED_EMAIL', 'GitHub account has no verified public email.');
  }

  const fullName = (profile?.name || '').trim();
  let firstName = '';
  let lastName = '';
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }

  if (!firstName) {
    firstName = profile?.login || 'GitHubUser';
  }

  return {
    email,
    firstName,
    lastName,
  };
}

async function findOrCreateOAuthUser({ provider, email, firstName, lastName, ipAddress }) {
  const hmacKey = process.env.EMAIL_HMAC_KEY;
  const encKey = process.env.EMAIL_ENCRYPTION_KEY;
  const canonicalEmail = normalizeEmailAddress(email);
  const emailHash = hmacEmail(canonicalEmail, hmacKey);
  const { user: existingUser } = await findUserByEmailVariants(canonicalEmail, hmacKey);

  if (existingUser) {
    // Block OAuth login for accounts registered with email/password
    if (existingUser.password_hash) {
      throw createCodeError(
        'PASSWORD_ACCOUNT_EXISTS',
        'This account was created using email and password. Please return to login and sign in with your password.'
      );
    }

    await db.addOAuthProviderToUser(existingUser.id, provider);

    if (existingUser.email_verified === false) {
      await db.markUserEmailVerified(existingUser.id);
      existingUser.email_verified = true;
      existingUser.email_verified_at = new Date().toISOString();
    }

    existingUser.auth_provider = provider;
    existingUser.auth_providers = Array.from(new Set([
      ...(Array.isArray(existingUser.auth_providers) ? existingUser.auth_providers : []),
      provider,
    ]));

    await db.addAuditLog({
      user_id: existingUser.id,
      action: 'OAUTH_LOGIN_SUCCESS',
      ip_address: ipAddress,
      details: JSON.stringify({ provider }),
    });

    return existingUser;
  }

  const { encrypted, iv, authTag } = encryptEmail(email, encKey);
  const nowIso = new Date().toISOString();
  const pepperRow = await db.getCurrentPepperVersion();
  const userId = uuidv4();

  await db.createUser({
    id: userId,
    email_encrypted: encrypted,
    email_hmac: emailHash,
    email_iv: iv,
    email_auth_tag: authTag,
    password_hash: null,
    pepper_version: pepperRow.version,
    first_name: firstName || 'User',
    last_name: lastName || '',
    role: 'driver',
    created_at: nowIso,
    updated_at: nowIso,
    login_attempts: 0,
    locked_until: null,
    email_verified: true,
    email_verified_at: nowIso,
    email_verification_token_hash: null,
    email_verification_expires_at: null,
    password_reset_token_hash: null,
    password_reset_expires_at: null,
    password_reset_requested_at: null,
    password_reset_request_date: null,
    password_reset_request_count: 0,
    profile_picture_url: '',
    address: createEmptyAddress(),
    auth_provider: provider,
    auth_providers: [provider],
  });

  await db.addAuditLog({
    user_id: userId,
    action: 'OAUTH_SIGNUP',
    ip_address: ipAddress,
    details: JSON.stringify({ provider }),
  });

  return {
    id: userId,
    first_name: firstName || 'User',
    last_name: lastName || '',
    role: 'driver',
    email_verified: true,
  };
}

function redirectOAuthError(res, provider, reason, frontendBaseUrl = FRONTEND_URL) {
  relaxOAuthRedirectHeaders(res);
  return res.redirect(302, buildOauthErrorRedirectUrl(provider, reason, frontendBaseUrl));
}

function redirectOAuthSuccess(res, provider, user, frontendBaseUrl = FRONTEND_URL) {
  relaxOAuthRedirectHeaders(res);
  return res.redirect(302, buildOauthSuccessRedirectUrl(provider, user, frontendBaseUrl));
}

function sendVerifyResponse(req, res, statusCode, payload) {
  const wantsJson = String(req.query.format || '').toLowerCase() === 'json';
  if (wantsJson) {
    return res.status(statusCode).json(payload);
  }

  const frontendBaseUrl = resolveFrontendBaseUrl(req);

  if (payload.verified) {
    return res.redirect(302, buildLoginRedirectUrl(frontendBaseUrl, { verified: '1' }));
  }

  return res.redirect(302, buildLoginRedirectUrl(frontendBaseUrl, {
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
      const frontendBaseUrl = resolveFrontendBaseUrl(req);
      const nowIso = new Date().toISOString();
      const canonicalEmail = normalizeEmailAddress(email);

      // Check if email already exists (using HMAC lookup — no decryption needed)
      const emailHash = hmacEmail(canonicalEmail, hmacKey);
      const { user: existingUser } = await findUserByEmailVariants(canonicalEmail, hmacKey);
      if (existingUser) {
        if (!existingUser.password_hash) {
          const providers = formatProviderList(getAuthProviderList(existingUser));
          return res.status(409).json({
            error: `This account has been created using ${providers}. Please return to login and use the ${providers} sign-in button.`,
            code: 'OAUTH_ACCOUNT_EXISTS',
          });
        }

        return res.status(409).json({
          error: 'An account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }

      // Encrypt email (Confidentiality)
      const { encrypted, iv, authTag } = encryptEmail(canonicalEmail, encKey);

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
        password_reset_token_hash: null,
        password_reset_expires_at: null,
        password_reset_requested_at: null,
        password_reset_request_date: null,
        password_reset_request_count: 0,
        profile_picture_url: '',
        address: createEmptyAddress(),
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
        const verificationUrl = buildVerificationUrl(verificationState.token, frontendBaseUrl);
        const emailResult = await sendVerificationEmail({
          toEmail: canonicalEmail,
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
      const canonicalEmail = normalizeEmailAddress(email);
      const { user } = await findUserByEmailVariants(canonicalEmail, hmacKey);

      if (!user) {
        return res.json({ message: 'If an account exists, a verification email has been sent.' });
      }

      if (user.email_verified !== false) {
        return res.json({ message: 'Account is already verified.' });
      }

      const verificationState = createEmailVerificationToken();
      const frontendBaseUrl = resolveFrontendBaseUrl(req);
      await db.setUserEmailVerificationToken(
        user.id,
        verificationState.tokenHash,
        verificationState.expiresAt
      );

      const verificationUrl = buildVerificationUrl(verificationState.token, frontendBaseUrl);
      const emailResult = await sendVerificationEmail({
        toEmail: canonicalEmail,
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

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      const { email } = req.body;
      const hmacKey = process.env.EMAIL_HMAC_KEY;
      const canonicalEmail = normalizeEmailAddress(email);
      const { user } = await findUserByEmailVariants(canonicalEmail, hmacKey);

      if (!user) {
        return res.json({ message: 'If an account exists, a password reset email has been sent.' });
      }

      if (!user.password_hash) {
        const providers = formatProviderList(getAuthProviderList(user));
        await db.addAuditLog({
          user_id: user.id,
          action: 'PASSWORD_RESET_BLOCKED_OAUTH_ACCOUNT',
          ip_address: req.ip,
          details: JSON.stringify({ providers }),
        });
        return res.status(400).json({
          error: `This account was signed in using ${providers}. Please return to login and use ${providers} to sign in.`,
          code: 'OAUTH_ACCOUNT_NO_PASSWORD',
        });
      }

      const todayUtc = new Date().toISOString().slice(0, 10);
      const currentCount = user.password_reset_request_date === todayUtc
        ? Number(user.password_reset_request_count || 0)
        : 0;

      if (currentCount >= PASSWORD_RESET_MAX_PER_DAY) {
        await db.addAuditLog({
          user_id: user.id,
          action: 'PASSWORD_RESET_DAILY_LIMIT_REACHED',
          ip_address: req.ip,
          details: JSON.stringify({
            date: todayUtc,
            count: currentCount,
            limit: PASSWORD_RESET_MAX_PER_DAY,
          }),
        });

        return res.status(429).json({
          error: `Password reset limit reached. You can request up to ${PASSWORD_RESET_MAX_PER_DAY} reset emails per day.`,
          code: 'PASSWORD_RESET_DAILY_LIMIT',
        });
      }

      const resetState = createPasswordResetToken();
      const nextCount = currentCount + 1;
      const frontendBaseUrl = resolveFrontendBaseUrl(req);
      await db.setUserPasswordResetToken(
        user.id,
        resetState.tokenHash,
        resetState.expiresAt,
        todayUtc,
        nextCount
      );

      const resetUrl = buildPasswordResetUrl(resetState.token, frontendBaseUrl);
      const emailResult = await sendPasswordResetEmail({
        toEmail: canonicalEmail,
        firstName: user.first_name,
        resetUrl,
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
      });

      if (!emailResult.sent) {
        return res.status(503).json({
          error: 'Password reset email provider is not configured.',
        });
      }

      await db.addAuditLog({
        user_id: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        ip_address: req.ip,
        details: JSON.stringify({
          date: todayUtc,
          count: nextCount,
          limit: PASSWORD_RESET_MAX_PER_DAY,
        }),
      });

      const resetPayload = {
        userId: user.id,
        count: nextCount,
        limit: PASSWORD_RESET_MAX_PER_DAY,
      };
      sendMakeEvent('auth_password_reset_requested', resetPayload).catch(() => {});
      logToNotionAsync('auth_password_reset_requested', resetPayload);

      return res.json({ message: 'Password reset email sent. Please check your inbox.' });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/reset-password',
  [
    body('token').isString().trim().isLength({ min: 20, max: 256 }),
    body('password')
      .isLength({ min: 8, max: 128 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must have uppercase, lowercase, and number'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { token, password } = req.body;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await db.getUserByPasswordResetTokenHash(tokenHash);

      if (!user) {
        return res.status(400).json({
          error: 'Reset link is invalid or already used.',
          code: 'INVALID_RESET_TOKEN',
        });
      }

      const expiresAt = user.password_reset_expires_at
        ? new Date(user.password_reset_expires_at).getTime()
        : 0;

      if (!expiresAt || Number.isNaN(expiresAt) || expiresAt < Date.now()) {
        await db.clearUserPasswordResetToken(user.id).catch(() => {});
        return res.status(410).json({
          error: 'Reset link expired. Please request a new one.',
          code: 'RESET_TOKEN_EXPIRED',
        });
      }

      if (!user.password_hash) {
        const providers = formatProviderList(getAuthProviderList(user));
        return res.status(400).json({
          error: `This account was signed in using ${providers}. Please return to login and use ${providers} to sign in.`,
          code: 'OAUTH_ACCOUNT_NO_PASSWORD',
        });
      }

      const currentPepper = process.env.PASSWORD_PEPPER;
      const pepperRow = await db.getCurrentPepperVersion();
      const passwordHash = await hashPassword(password, currentPepper);

      await db.updateUserPasswordHashAndPepperVersion(user.id, passwordHash, pepperRow.version);
      await db.clearUserPasswordResetToken(user.id);
      await db.resetUserLockout(user.id);

      await db.addAuditLog({
        user_id: user.id,
        action: 'PASSWORD_RESET_SUCCESS',
        ip_address: req.ip,
      });

      const resetSuccessPayload = { userId: user.id };
      sendMakeEvent('auth_password_reset_success', resetSuccessPayload).catch(() => {});
      logToNotionAsync('auth_password_reset_success', resetSuccessPayload);

      return res.json({
        message: 'Password reset successful. You can sign in with your new password.',
      });
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/me', requireAuth, async (req, res) => {
  return res.json({
    user: buildUserResponse(req.authUser),
  });
});

router.patch(
  '/me',
  requireAuth,
  [
    body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('lastName').optional().isString().trim().isLength({ max: 100 }),
    body('profilePictureUrl')
      .optional({ nullable: true })
      .custom((value) => isProfilePictureValueValid(value)),
    body('address').optional().custom((value) => {
      return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }),
    body('address.country').optional().isString().trim().isLength({ max: 100 }),
    body('address.province').optional().isString().trim().isLength({ max: 100 }),
    body('address.city').optional().isString().trim().isLength({ max: 100 }),
    body('address.barangay').optional().isString().trim().isLength({ max: 120 }),
    body('address.street').optional().isString().trim().isLength({ max: 120 }),
    body('address.houseNumber').optional().isString().trim().isLength({ max: 40 }),
    body('address.postalCode').optional().isString().trim().isLength({ max: 20 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const updates = {};

      if (Object.prototype.hasOwnProperty.call(req.body, 'firstName')) {
        updates.first_name = normalizeTextField(req.body.firstName, 100);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'lastName')) {
        updates.last_name = normalizeTextField(req.body.lastName, 100);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'profilePictureUrl')) {
        updates.profile_picture_url = typeof req.body.profilePictureUrl === 'string'
          ? req.body.profilePictureUrl.trim()
          : '';
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'address')) {
        updates.address = normalizeAddress(req.body.address);
      }

      await db.updateUserProfile(req.authUser.id, updates);
      const updatedUser = await db.getUserById(req.authUser.id);

      await db.addAuditLog({
        user_id: req.authUser.id,
        action: 'PROFILE_UPDATED',
        ip_address: req.ip,
      });

      return res.json({
        message: 'Profile updated successfully',
        user: buildUserResponse(updatedUser),
      });
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').isLength({ min: 1, max: 128 }),
    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must have uppercase, lowercase, and number'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const user = req.authUser;
      if (!user.password_hash) {
        const providers = formatProviderList(getAuthProviderList(user));
        return res.status(400).json({
          error: `This account was created using ${providers}. Password changes are not available. Please use ${providers} to sign in.`,
          code: 'OAUTH_ACCOUNT_NO_PASSWORD',
        });
      }

      const { currentPassword, newPassword } = req.body;
      const currentPepper = process.env.PASSWORD_PEPPER;
      const previousPepper = process.env.PASSWORD_PEPPER_PREVIOUS || null;
      const verificationResult = await verifyWithPepperRotation(
        currentPassword,
        user.password_hash,
        currentPepper,
        previousPepper
      );

      if (!verificationResult.verified) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }

      const pepperRow = await db.getCurrentPepperVersion();
      const nextPasswordHash = await hashPassword(newPassword, currentPepper);
      await db.updateUserPasswordHashAndPepperVersion(user.id, nextPasswordHash, pepperRow.version);
      await db.resetUserLockout(user.id);

      await db.addAuditLog({
        user_id: user.id,
        action: 'PASSWORD_CHANGED',
        ip_address: req.ip,
      });

      return res.json({ message: 'Password updated successfully.' });
    } catch (err) {
      console.error('Change password error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ---- OAUTH (GOOGLE/GITHUB) ----
router.get('/oauth/google/start', (req, res) => {
  const wantsJson = String(req.query.format || '').toLowerCase() === 'json';
  const frontendBaseUrl = resolveFrontendBaseUrl(req);

  if (!isGoogleOAuthStartConfigured()) {
    if (wantsJson) {
      return res.status(503).json({
        error: 'Google OAuth is not configured.',
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }

    return redirectOAuthError(res, 'google', 'oauth_not_configured', frontendBaseUrl);
  }

  const config = getGoogleOAuthConfig();
  const state = createOauthState('google', frontendBaseUrl);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  if (wantsJson) {
    return res.json({ url: googleAuthUrl });
  }

  relaxOAuthRedirectHeaders(res);
  return res.redirect(302, googleAuthUrl);
});

router.get('/oauth/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';
  const oauthState = consumeOauthState('google', state);
  const frontendBaseUrl = oauthState?.frontendBaseUrl || FRONTEND_URL;

  if (providerError) {
    return redirectOAuthError(res, 'google', 'provider_denied', frontendBaseUrl);
  }

  if (!code) {
    return redirectOAuthError(res, 'google', 'missing_code', frontendBaseUrl);
  }

  if (!oauthState) {
    return redirectOAuthError(res, 'google', 'invalid_state', FRONTEND_URL);
  }

  try {
    const profile = await fetchGoogleProfile(code);
    const user = await findOrCreateOAuthUser({
      provider: 'google',
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      ipAddress: req.ip,
    });

    const successPayload = {
      provider: 'google',
      userId: user.id,
    };
    sendMakeEvent('auth_oauth_login_success', successPayload).catch(() => {});
    logToNotionAsync('auth_oauth_login_success', successPayload);

    return redirectOAuthSuccess(res, 'google', user, frontendBaseUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const errorPayload = {
      provider: 'google',
      message: error.message,
      code: error.code || 'OAUTH_FAILED',
    };
    sendMakeEvent('auth_oauth_error', errorPayload).catch(() => {});
    logToNotionAsync('auth_oauth_error', errorPayload);

    const reason = error.code === 'NO_VERIFIED_EMAIL'
      ? 'no_verified_email'
      : error.code === 'OAUTH_NOT_CONFIGURED'
        ? 'oauth_not_configured'
        : error.code === 'PASSWORD_ACCOUNT_EXISTS'
          ? 'password_account_exists'
          : 'oauth_failed';
    return redirectOAuthError(res, 'google', reason, frontendBaseUrl);
  }
});

router.get('/oauth/github/start', (req, res) => {
  const wantsJson = String(req.query.format || '').toLowerCase() === 'json';
  const frontendBaseUrl = resolveFrontendBaseUrl(req);

  if (!isGitHubOAuthStartConfigured()) {
    if (wantsJson) {
      return res.status(503).json({
        error: 'GitHub OAuth is not configured.',
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }

    return redirectOAuthError(res, 'github', 'oauth_not_configured', frontendBaseUrl);
  }

  const config = getGitHubOAuthConfig();
  const state = createOauthState('github', frontendBaseUrl);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'read:user user:email',
    state,
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  if (wantsJson) {
    return res.json({ url: githubAuthUrl });
  }

  relaxOAuthRedirectHeaders(res);
  return res.redirect(302, githubAuthUrl);
});

router.get('/oauth/github/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const providerError = typeof req.query.error === 'string' ? req.query.error : '';
  const oauthState = consumeOauthState('github', state);
  const frontendBaseUrl = oauthState?.frontendBaseUrl || FRONTEND_URL;

  if (providerError) {
    return redirectOAuthError(res, 'github', 'provider_denied', frontendBaseUrl);
  }

  if (!code) {
    return redirectOAuthError(res, 'github', 'missing_code', frontendBaseUrl);
  }

  if (!oauthState) {
    return redirectOAuthError(res, 'github', 'invalid_state', FRONTEND_URL);
  }

  try {
    const profile = await fetchGitHubProfile(code);
    const user = await findOrCreateOAuthUser({
      provider: 'github',
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      ipAddress: req.ip,
    });

    const successPayload = {
      provider: 'github',
      userId: user.id,
    };
    sendMakeEvent('auth_oauth_login_success', successPayload).catch(() => {});
    logToNotionAsync('auth_oauth_login_success', successPayload);

    return redirectOAuthSuccess(res, 'github', user, frontendBaseUrl);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    const errorPayload = {
      provider: 'github',
      message: error.message,
      code: error.code || 'OAUTH_FAILED',
    };
    sendMakeEvent('auth_oauth_error', errorPayload).catch(() => {});
    logToNotionAsync('auth_oauth_error', errorPayload);

    const reason = error.code === 'NO_VERIFIED_EMAIL'
      ? 'no_verified_email'
      : error.code === 'OAUTH_NOT_CONFIGURED'
        ? 'oauth_not_configured'
        : error.code === 'PASSWORD_ACCOUNT_EXISTS'
          ? 'password_account_exists'
          : 'oauth_failed';
    return redirectOAuthError(res, 'github', reason, frontendBaseUrl);
  }
});

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
      const canonicalEmail = normalizeEmailAddress(email);

      // Find user by email HMAC (no decryption needed for lookup)
      const { user } = await findUserByEmailVariants(canonicalEmail, hmacKey);

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

      // Block password login for accounts registered via OAuth only
      if (!user.password_hash) {
        const providers = Array.isArray(user.auth_providers) && user.auth_providers.length > 0
          ? user.auth_providers.map(p => p === 'google' ? 'Google' : p === 'github' ? 'GitHub' : p).join(' or ')
          : 'social sign-in';
        return res.status(401).json({
          error: `This account was created using ${providers}. Please return to login and use the ${providers} sign-in button.`,
          code: 'OAUTH_ACCOUNT_NO_PASSWORD',
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
        token: issueAuthToken(user),
        user: buildUserResponse(user),
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

// ---- CHAT ASSISTANT TOKEN ----
// Returns the Navocs chat URL (with embedded key) only to verified users.
// The key lives in NAVOCS_CHAT_URL env var and is never sent to the browser directly.
router.get('/chat-token', requireAuth, (req, res) => {
  const chatUrl = process.env.NAVOCS_CHAT_URL;
  if (!chatUrl) {
    return res.status(503).json({ error: 'Chat service not configured' });
  }
  return res.json({ url: chatUrl });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
