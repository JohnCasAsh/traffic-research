// ============================================
// DATABASE SETUP - Firestore with CIA Triad Schema
// ============================================
// Confidentiality: emails encrypted, passwords hashed
// Integrity: HMAC on emails, hash integrity checks
// Availability: managed cloud datastore + app-level lockout/rate limit
// ============================================

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firestore = null;
let initialized = false;
let initPromise = null;

const COLLECTIONS = {
  users: 'users',
  pepperVersions: 'pepper_versions',
  auditLog: 'audit_log',
};

function loadServiceAccountFromFile(serviceAccountPath) {
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(__dirname, '..', serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${resolvedPath}`);
  }

  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

function buildServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH OR FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
    );
  }

  const normalizedPrivateKey = privateKey
    .replace(/^"|"$/g, '')
    .replace(/\r/g, '')
    .replace(/\\+n/g, '\n');

  return {
    projectId,
    clientEmail,
    privateKey: normalizedPrivateKey,
  };
}

function getFirestore() {
  if (firestore) {
    return firestore;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? loadServiceAccountFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : buildServiceAccountFromEnv();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId:
        process.env.FIREBASE_PROJECT_ID ||
        serviceAccount.projectId ||
        serviceAccount.project_id,
    });
  }

  firestore = admin.firestore();
  return firestore;
}

async function ensureInitialized() {
  if (initialized) {
    return;
  }

  const db = getFirestore();
  const currentPepperSnapshot = await db
    .collection(COLLECTIONS.pepperVersions)
    .where('is_current', '==', true)
    .limit(1)
    .get();

  if (currentPepperSnapshot.empty) {
    await db.collection(COLLECTIONS.pepperVersions).doc('1').set({
      version: 1,
      is_current: true,
      created_at: new Date().toISOString(),
    });
  }

  initialized = true;
}

function ready() {
  if (!initPromise) {
    initPromise = ensureInitialized();
  }
  return initPromise;
}

async function getUserByEmailHmac(emailHmac) {
  await ready();
  const db = getFirestore();

  const snapshot = await db
    .collection(COLLECTIONS.users)
    .where('email_hmac', '==', emailHmac)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    ...data,
    id: data.id || doc.id,
  };
}

async function createUser(user) {
  await ready();
  const db = getFirestore();
  await db.collection(COLLECTIONS.users).doc(user.id).set(user);
}

async function getCurrentPepperVersion() {
  await ready();
  const db = getFirestore();

  const snapshot = await db
    .collection(COLLECTIONS.pepperVersions)
    .where('is_current', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { version: 1 };
  }

  return snapshot.docs[0].data();
}

async function updateUserFailedLogin(userId, attempts, lockUntil) {
  await ready();
  const db = getFirestore();
  await db.collection(COLLECTIONS.users).doc(userId).update({
    login_attempts: attempts,
    locked_until: lockUntil,
    updated_at: new Date().toISOString(),
  });
}

async function updateUserLoginAttempts(userId, attempts) {
  await ready();
  const db = getFirestore();
  await db.collection(COLLECTIONS.users).doc(userId).update({
    login_attempts: attempts,
    updated_at: new Date().toISOString(),
  });
}

async function updateUserPasswordHashAndPepperVersion(userId, passwordHash, pepperVersion) {
  await ready();
  const db = getFirestore();
  await db.collection(COLLECTIONS.users).doc(userId).update({
    password_hash: passwordHash,
    pepper_version: pepperVersion,
    updated_at: new Date().toISOString(),
  });
}

async function resetUserLockout(userId) {
  await ready();
  const db = getFirestore();
  await db.collection(COLLECTIONS.users).doc(userId).update({
    login_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
}

async function addAuditLog({ user_id = null, action, ip_address = null, details = null }) {
  await ready();
  const db = getFirestore();
  await db.collection(COLLECTIONS.auditLog).add({
    user_id,
    action,
    ip_address,
    details,
    created_at: new Date().toISOString(),
  });
}

async function getMaxPepperVersion() {
  await ready();
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.pepperVersions)
    .orderBy('version', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { version: 0 };
  }

  return snapshot.docs[0].data();
}

async function rotatePepperVersion(newVersion) {
  await ready();
  const db = getFirestore();
  const batch = db.batch();

  const currentSnapshot = await db
    .collection(COLLECTIONS.pepperVersions)
    .where('is_current', '==', true)
    .get();

  currentSnapshot.forEach((doc) => {
    batch.update(doc.ref, { is_current: false });
  });

  const newVersionRef = db.collection(COLLECTIONS.pepperVersions).doc(String(newVersion));
  batch.set(newVersionRef, {
    version: newVersion,
    is_current: true,
    created_at: new Date().toISOString(),
  });

  await batch.commit();
}

async function countUsersWithPepperVersionLessThan(version) {
  await ready();
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.users)
    .where('pepper_version', '<', version)
    .get();
  return snapshot.size;
}

module.exports = {
  ready,
  getUserByEmailHmac,
  createUser,
  getCurrentPepperVersion,
  updateUserFailedLogin,
  updateUserLoginAttempts,
  updateUserPasswordHashAndPepperVersion,
  resetUserLockout,
  addAuditLog,
  getMaxPepperVersion,
  rotatePepperVersion,
  countUsersWithPepperVersionLessThan,
};
