// ============================================
// MAIN SERVER - Traffic Management Backend
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ---- STARTUP ENV VALIDATION ----
// Fail fast if required secrets are missing (prevents silent runtime crashes)
const REQUIRED_ENV = [
  'PASSWORD_PEPPER',
  'EMAIL_ENCRYPTION_KEY',
  'EMAIL_HMAC_KEY',
  'JWT_SECRET',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

const authRoutes = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers (CIA Triad - Confidentiality)
app.use(helmet());

// CORS - allow frontend origins from env (comma-separated for multiple)
// Example: ALLOWED_ORIGINS=https://blue.example.com,https://green.example.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`CIA Triad Security Active:`);
  console.log(`  Confidentiality: Argon2id + AES-256-GCM`);
  console.log(`  Integrity: HMAC-SHA256 + Audit Logging`);
  console.log(`  Availability: Rate Limiting + Account Lockout`);
});
