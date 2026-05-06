// ============================================
// MAIN SERVER - Traffic Management Backend
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const ipKeyGenerator = rateLimit.ipKeyGenerator || ((ip) => ip);
const fs = require('fs');
const path = require('path');
const { sendMakeEvent, isMakeConfigured } = require('./src/makeNotifier');
const { logToNotionAsync, logToNotion, isNotionConfigured, logProgress, logHealthSummary } = require('./src/notionLogger');
const { createOriginPolicy } = require('./src/originPolicy');

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
const { liveTrackingRouter } = require('./src/liveTracking');
const { routeAnalysisRouter } = require('./src/routeAnalysis');
const { statsRouter } = require('./src/statsAnalysis');
const { adminRouter } = require('./src/adminRouter');
const { savedRoutesRouter } = require('./src/savedRoutesRouter');

const app = express();
const PORT = process.env.PORT || 3001;

function normalizeClientIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') {
    return 'unknown';
  }

  const trimmed = rawIp.trim();
  if (!trimmed) {
    return 'unknown';
  }

  // Some upstream proxies append the source port (e.g. 1.2.3.4:56789).
  // Keep IPv6 intact while stripping IPv4 ports for stable rate-limit keys.
  const ipv4WithPort = /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/;
  if (ipv4WithPort.test(trimmed)) {
    return trimmed.replace(/:\d+$/, '');
  }

  return trimmed;
}

// Azure App Service sits behind a proxy; trust first hop for accurate client IP/rate limits.
app.set('trust proxy', 1);

// Security headers (CIA Triad - Confidentiality)
app.use(helmet());

// CORS - allow frontend origins from env (comma-separated for multiple).
// Supports exact origins and wildcard host patterns like https://*.azurestaticapps.net.
const originPolicy = createOriginPolicy(process.env.ALLOWED_ORIGINS);
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || originPolicy.isAllowed(origin)) {
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
//
// Two tiers:
//   sensitiveAuthLimiter — login, signup, password reset, email verify (brute-force targets)
//   pageAuthLimiter      — /me, /chat-token, and other passive checks called on every page load
//
// Applying a single tight limiter to all /api/auth routes caused legitimate users to hit
// the cap just by navigating between pages (each page calls /me + /chat-token).

const keyGen = (req) => {
  const normalizedIp = normalizeClientIp(req.ip || req.socket?.remoteAddress);
  return ipKeyGenerator(normalizedIp);
};

// Strict: max 10 attempts per 15 min — login / signup / password flows
const sensitiveAuthLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '10'),
  message: { error: 'Too many requests. Try again later.' },
  keyGenerator: keyGen,
  standardHeaders: true,
  legacyHeaders: false,
});

// Relaxed: max 300 per 15 min — passive checks every page load (/me, /chat-token)
const pageAuthLimiter = rateLimit({
  windowMs: 900000,
  max: 300,
  message: { error: 'Too many requests. Try again later.' },
  keyGenerator: keyGen,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply strict limiter only to sensitive write/auth endpoints
app.use('/api/auth/login', sensitiveAuthLimiter);
app.use('/api/auth/signup', sensitiveAuthLimiter);
app.use('/api/auth/forgot-password', sensitiveAuthLimiter);
app.use('/api/auth/reset-password', sensitiveAuthLimiter);
app.use('/api/auth/verify-email', sensitiveAuthLimiter);
app.use('/api/auth/resend-verification', sensitiveAuthLimiter);

// Apply relaxed limiter to passive page-load checks
app.use('/api/auth/me', pageAuthLimiter);
app.use('/api/auth/chat-token', pageAuthLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tracking', liveTrackingRouter);
app.use('/api/routes', routeAnalysisRouter);
app.use('/api/stats', statsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/saved-routes', savedRoutesRouter);

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
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

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
