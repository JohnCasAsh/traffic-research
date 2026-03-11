// ============================================
// AUTH ROUTES - Signup, Login, Pepper Rotation
// ============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
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
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { firstName, lastName, email, password, role } = req.body;
      const pepper = process.env.PASSWORD_PEPPER;
      const encKey = process.env.EMAIL_ENCRYPTION_KEY;
      const hmacKey = process.env.EMAIL_HMAC_KEY;

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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        login_attempts: 0,
        locked_until: null,
      });

      // Audit log (Integrity — tracking all security events)
      await db.addAuditLog({
        user_id: userId,
        action: 'SIGNUP',
        ip_address: req.ip,
        details: JSON.stringify({ role }),
      });

      res.status(201).json({
        message: 'Account created successfully',
        user: { id: userId, firstName, lastName, role },
      });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Internal server error' });
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
        } else {
          await db.updateUserLoginAttempts(user.id, attempts);
        }

        await db.addAuditLog({ user_id: user.id, action: 'LOGIN_FAILED', ip_address: req.ip });

        return res.status(401).json({ error: 'Invalid credentials' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
