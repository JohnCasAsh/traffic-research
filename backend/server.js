// ============================================
// MAIN SERVER - Traffic Management Backend
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { sendMakeEvent, isMakeConfigured } = require('./src/makeNotifier');
const { logToNotionAsync, logToNotion, isNotionConfigured, logProgress, logHealthSummary } = require('./src/notionLogger');

// ---- STARTUP ENV VALIDATION ----
// Fail fast if required secrets are missing (prevents silent runtime crashes)
const REQUIRED_ENV = [
  'PASSWORD_PEPPER',
  'EMAIL_ENCRYPTION_KEY',
  'EMAIL_HMAC_KEY',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);

const hasFirebaseFileCredential = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
const hasFirebaseInlineCredential = Boolean(
  process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
);

if (hasFirebaseFileCredential) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(__dirname, serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    missing.push(`Firebase service account file not found at: ${resolvedPath}`);
  }
}

if (!hasFirebaseFileCredential && !hasFirebaseInlineCredential) {
  missing.push(
    'Firebase credentials: set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
  );
}

if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

const authRoutes = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Azure App Service sits behind a proxy; trust first hop for accurate client IP/rate limits.
app.set('trust proxy', 1);

// Security headers (CIA Triad - Confidentiality)
app.use(helmet());

// CORS - allow frontend origins from env (comma-separated for multiple)
// Example: ALLOWED_ORIGINS=https://blue.example.com,https://green.example.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Parse JSON body
app.use(express.json({ limit: '10kb' }));

// Rate limiting (CIA Triad - Availability)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),  // default 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '20'),                  // default 20 attempts
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    makeConfigured: isMakeConfigured(),
    notionConfigured: isNotionConfigured(),
  });
});

// Manual Make test hook (optional x-ops-token protection)
app.post('/api/ops/make-test', async (req, res) => {
  const requiredToken = process.env.OPS_TEST_TOKEN;
  if (requiredToken) {
    const providedToken = req.get('x-ops-token');
    if (providedToken !== requiredToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const eventType = req.body?.eventType || 'manual_make_test';
  const payload = req.body?.payload || {};

  try {
    const result = await sendMakeEvent(eventType, {
      ...payload,
      triggeredFrom: '/api/ops/make-test',
    }, {
      awaitDelivery: true,
    });

    const notionResult = await logToNotion(eventType, {
      ...payload,
      triggeredFrom: '/api/ops/make-test',
    });

    res.json({
      message: 'Make + Notion test event sent',
      makeConfigured: isMakeConfigured(),
      notionConfigured: isNotionConfigured(),
      result,
      notionResult,
    });
  } catch (error) {
    res.status(502).json({
      error: 'Failed to deliver Make event',
      details: error.message,
    });
  }
});

// ---- DAILY PROGRESS LOG ----
app.post('/api/ops/log-progress', async (req, res) => {
  const requiredToken = process.env.OPS_TEST_TOKEN;
  if (requiredToken) {
    const providedToken = req.get('x-ops-token');
    if (providedToken !== requiredToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { title, category, status, notes, impact, date } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await logProgress({ title, category, status, notes, impact, date });

    // Also notify via Make so you get an email about progress
    await sendMakeEvent('daily_progress_logged', {
      message: title,
      category: category || 'Backend',
      status: status || 'Completed',
      notes: notes || '',
      impact: impact || 'Medium',
    }).catch(() => {});

    res.json({ message: 'Progress logged', result });
  } catch (error) {
    res.status(502).json({ error: 'Failed to log progress', details: error.message });
  }
});

// ---- SYSTEM HEALTH SUMMARY ----
app.post('/api/ops/health-summary', async (req, res) => {
  const requiredToken = process.env.OPS_TEST_TOKEN;
  if (requiredToken) {
    const providedToken = req.get('x-ops-token');
    if (providedToken !== requiredToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { totalEvents, errors, warnings, uptimeStatus, keyEvents, notes } = req.body || {};

  try {
    const result = await logHealthSummary({ totalEvents, errors, warnings, uptimeStatus, keyEvents, notes });

    // Also send via Make for email alert
    await sendMakeEvent('daily_health_summary', {
      totalEvents, errors, warnings, uptimeStatus, keyEvents,
      message: `Daily Health: ${uptimeStatus || 'Healthy'} | Errors: ${errors || 0} | Warnings: ${warnings || 0}`,
    }).catch(() => {});

    res.json({ message: 'Health summary logged', result });
  } catch (error) {
    res.status(502).json({ error: 'Failed to log health summary', details: error.message });
  }
});

app.use(async (err, req, res, next) => {
  console.error('Unhandled request error:', err);
  const errorPayload = {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    message: err.message,
  };
  await sendMakeEvent('backend_unhandled_error', errorPayload).catch(() => {});
  logToNotionAsync('backend_unhandled_error', errorPayload);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  const rejPayload = { reason: reason && reason.message ? reason.message : String(reason) };
  sendMakeEvent('backend_unhandled_rejection', rejPayload).catch(() => {});
  logToNotionAsync('backend_unhandled_rejection', rejPayload);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  const excPayload = { message: error.message };
  logToNotionAsync('backend_uncaught_exception', excPayload);
  sendMakeEvent('backend_uncaught_exception', excPayload, {
    awaitDelivery: true,
  }).finally(() => {
    process.exit(1);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`CIA Triad Security Active:`);
  console.log(`  Confidentiality: Argon2id + AES-256-GCM`);
  console.log(`  Integrity: HMAC-SHA256 + Audit Logging`);
  console.log(`  Availability: Rate Limiting + Account Lockout`);
  logToNotionAsync('server_started', {
    message: `Server started on port ${PORT}`,
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
  });
});
