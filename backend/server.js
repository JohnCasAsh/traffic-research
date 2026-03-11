// ============================================
// MAIN SERVER - Traffic Management Backend
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers (CIA Triad - Confidentiality)
app.use(helmet());

// CORS - only allow frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parse JSON body
app.use(express.json({ limit: '10kb' }));

// Rate limiting (CIA Triad - Availability)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
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
