// ============================================
// AUTH ROUTES - Signup, Login, Pepper Rotation
// ============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const {
  encryptEmail,
  decryptEmail,
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
      const existingUser = db.prepare('SELECT id FROM users WHERE email_hmac = ?').get(emailHash);
      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Encrypt email (Confidentiality)
      const { encrypted, iv, authTag } = encryptEmail(email, encKey);

      // Hash password with Argon2id + salt + pepper (Confidentiality + Integrity)
      const passwordHash = await hashPassword(password, pepper);

      // Get current pepper version
      const pepperRow = db.prepare('SELECT version FROM pepper_versions WHERE is_current = 1').get();

      // Insert user
      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, email_encrypted, email_hmac, email_iv, email_auth_tag, password_hash, pepper_version, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, encrypted, emailHash, iv, authTag, passwordHash, pepperRow.version, firstName, lastName, role);

      // Audit log (Integrity — tracking all security events)
      db.prepare('INSERT INTO audit_log (user_id, action, ip_address, details) VALUES (?, ?, ?, ?)').run(
        userId,
        'SIGNUP',
        req.ip,
        JSON.stringify({ role })
      );

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
      const user = db.prepare('SELECT * FROM users WHERE email_hmac = ?').get(emailHash);

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
        const attempts = user.login_attempts + 1;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
          db.prepare('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?').run(
            attempts,
            lockUntil,
            user.id
          );
          db.prepare('INSERT INTO audit_log (user_id, action, ip_address, details) VALUES (?, ?, ?, ?)').run(
            user.id,
            'ACCOUNT_LOCKED',
            req.ip,
            JSON.stringify({ attempts })
          );
        } else {
          db.prepare('UPDATE users SET login_attempts = ? WHERE id = ?').run(attempts, user.id);
        }

        db.prepare('INSERT INTO audit_log (user_id, action, ip_address) VALUES (?, ?, ?)').run(
          user.id,
          'LOGIN_FAILED',
          req.ip
        );

        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // If pepper was rotated, update the password hash with new pepper
      if (result.needsRehash) {
        const pepperRow = db.prepare('SELECT version FROM pepper_versions WHERE is_current = 1').get();
        db.prepare('UPDATE users SET password_hash = ?, pepper_version = ?, updated_at = datetime(?) WHERE id = ?').run(
          result.newHash,
          pepperRow.version,
          new Date().toISOString(),
          user.id
        );

        db.prepare('INSERT INTO audit_log (user_id, action, ip_address, details) VALUES (?, ?, ?, ?)').run(
          user.id,
          'PEPPER_REHASH',
          req.ip,
          JSON.stringify({ newPepperVersion: pepperRow.version })
        );
      }

      // Reset login attempts on success
      db.prepare('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

      // Audit log
      db.prepare('INSERT INTO audit_log (user_id, action, ip_address) VALUES (?, ?, ?)').run(
        user.id,
        'LOGIN_SUCCESS',
        req.ip
      );

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
    const currentPepper = process.env.PASSWORD_PEPPER;

    // Create new pepper version
    const currentVersion = db.prepare('SELECT MAX(version) as v FROM pepper_versions').get();
    const newVersion = (currentVersion.v || 0) + 1;

    db.prepare('UPDATE pepper_versions SET is_current = 0').run();
    db.prepare('INSERT INTO pepper_versions (version, is_current) VALUES (?, 1)').run(newVersion);

    // Count users that will need rehash on next login
    const usersToRehash = db.prepare('SELECT COUNT(*) as count FROM users WHERE pepper_version < ?').get(newVersion);

    db.prepare('INSERT INTO audit_log (action, details) VALUES (?, ?)').run(
      'PEPPER_ROTATED',
      JSON.stringify({ newVersion, usersAffected: usersToRehash.count })
    );

    res.json({
      message: 'Pepper rotated successfully',
      newVersion,
      note: `${usersToRehash.count} users will be re-hashed on their next login. Update PASSWORD_PEPPER in .env with the new pepper value and move the old pepper to PASSWORD_PEPPER_PREVIOUS.`,
    });
  } catch (err) {
    console.error('Pepper rotation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
