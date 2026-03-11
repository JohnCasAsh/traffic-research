// ============================================
// DATABASE SETUP - SQLite with CIA Triad Schema
// ============================================
// Confidentiality: emails encrypted, passwords hashed
// Integrity: HMAC on emails, hash integrity checks
// Availability: SQLite WAL mode for concurrent reads
// ============================================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'smartroute.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access (Availability)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email_encrypted TEXT NOT NULL,
    email_hmac TEXT NOT NULL UNIQUE,
    email_iv TEXT NOT NULL,
    email_auth_tag TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    pepper_version INTEGER NOT NULL DEFAULT 1,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('driver', 'researcher', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT DEFAULT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email_hmac ON users(email_hmac);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

  CREATE TABLE IF NOT EXISTS pepper_versions (
    version INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_current INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
`);

// Insert initial pepper version if not exists
const pepperExists = db.prepare('SELECT COUNT(*) as count FROM pepper_versions WHERE version = 1').get();
if (pepperExists.count === 0) {
  db.prepare('INSERT INTO pepper_versions (version, is_current) VALUES (1, 1)').run();
}

module.exports = db;
