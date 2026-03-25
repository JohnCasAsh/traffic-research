// ============================================
// CRYPTO MODULE - CIA Triad Security
// ============================================
// Confidentiality: AES-256-GCM email encryption, Argon2 password hashing
// Integrity: HMAC-SHA256 for email verification, Argon2 built-in integrity
// Availability: Graceful error handling, pepper rotation support
// ============================================

const crypto = require('crypto');
const argon2 = require('argon2');

// ---- EMAIL ENCRYPTION (Confidentiality) ----

/**
 * Encrypt email with AES-256-GCM
 * Returns: { encrypted, iv, authTag }
 */
function encryptEmail(email, encryptionKey) {
  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(email.toLowerCase().trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypt email with AES-256-GCM
 */
function decryptEmail(encrypted, iv, authTag, encryptionKey) {
  const key = Buffer.from(encryptionKey, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ---- EMAIL HMAC (Integrity + Lookup) ----

/**
 * Create HMAC of email for secure lookup without decrypting
 */
function hmacEmail(email, hmacKey) {
  return crypto
    .createHmac('sha256', Buffer.from(hmacKey, 'hex'))
    .update(email.toLowerCase().trim())
    .digest('hex');
}

// ---- PASSWORD HASHING (Confidentiality + Integrity) ----

/**
 * Hash password with Argon2id + salt (auto) + pepper (application secret)
 * - Salt: generated automatically by Argon2 (unique per password)
 * - Pepper: application-level secret prepended to password before hashing
 */
async function hashPassword(password, pepper) {
  const pepperedPassword = pepper + password;
  return argon2.hash(pepperedPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,    // 64 MB
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 threads
    saltLength: 32,       // 32 bytes salt
  });
}

/**
 * Verify password against stored hash with pepper
 */
async function verifyPassword(password, storedHash, pepper) {
  const pepperedPassword = pepper + password;
  return argon2.verify(storedHash, pepperedPassword);
}

/**
 * Re-hash password with new pepper (for pepper rotation)
 */
async function rehashWithNewPepper(password, newPepper) {
  return hashPassword(password, newPepper);
}

// ---- PEPPER ROTATION ----

/**
 * Attempt to verify password with current pepper, then fall back to previous pepper.
 * If previous pepper matches, re-hash with current pepper and return the new hash.
 * Returns: { verified: boolean, needsRehash: boolean, newHash: string|null }
 */
async function verifyWithPepperRotation(password, storedHash, currentPepper, previousPepper) {
  // Try current pepper first
  const currentMatch = await verifyPassword(password, storedHash, currentPepper);
  if (currentMatch) {
    return { verified: true, needsRehash: false, newHash: null };
  }

  // Try previous pepper if it exists
  if (previousPepper) {
    const previousMatch = await verifyPassword(password, storedHash, previousPepper);
    if (previousMatch) {
      // Re-hash with current pepper
      const newHash = await hashPassword(password, currentPepper);
      return { verified: true, needsRehash: true, newHash };
    }
  }

  return { verified: false, needsRehash: false, newHash: null };
}

module.exports = {
  encryptEmail,
  decryptEmail,
  hmacEmail,
  hashPassword,
  verifyPassword,
  rehashWithNewPepper,
  verifyWithPepperRotation,
};
