const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database');
const { requireAuth } = require('./auth');
const { decryptEmail } = require('./crypto');
const { sendAccountSuspendedEmail, sendAccountDeletedEmail, sendAccountPromotedEmail } = require('./brevoMailer');

const adminRouter = express.Router();

function tryDecryptUserEmail(user) {
  try {
    const key = process.env.EMAIL_ENCRYPTION_KEY;
    if (!key || !user.email_encrypted || !user.email_iv || !user.email_auth_tag) return null;
    return decryptEmail(user.email_encrypted, user.email_iv, user.email_auth_tag, key);
  } catch (_) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /api/admin/users — all registered users (no emails, privacy-safe)
adminRouter.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ users });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// POST /api/admin/users/:id/ban
adminRouter.post('/users/:id/ban', requireAuth, requireAdmin, async (req, res) => {
  try {
    const target = await db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Cannot ban an admin.' });
    await db.setBannedStatus(req.params.id, true);
    const email = tryDecryptUserEmail(target);
    if (email) {
      sendAccountSuspendedEmail({ toEmail: email, firstName: target.first_name }).catch(() => {});
    }
    res.json({ message: 'User banned.' });
  } catch (err) {
    console.error('Ban error:', err);
    res.status(500).json({ error: 'Failed to ban user.' });
  }
});

// POST /api/admin/users/:id/unban
adminRouter.post('/users/:id/unban', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.setBannedStatus(req.params.id, false);
    res.json({ message: 'User unbanned.' });
  } catch (err) {
    console.error('Unban error:', err);
    res.status(500).json({ error: 'Failed to unban user.' });
  }
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.authUser.id) {
      return res.status(403).json({ error: 'Cannot delete your own account.' });
    }
    const target = await db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Cannot delete an admin.' });
    const email = tryDecryptUserEmail(target);
    if (email) {
      sendAccountDeletedEmail({ toEmail: email, firstName: target.first_name }).catch(() => {});
    }
    await db.deleteUser(req.params.id);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// POST /api/admin/users/:id/make-researcher
adminRouter.post('/users/:id/make-researcher', requireAuth, requireAdmin, async (req, res) => {
  try {
    const target = await db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Cannot change role of an admin.' });
    if (target.role === 'researcher') return res.status(400).json({ error: 'User is already a researcher.' });
    await db.updateUserProfile(req.params.id, { role: 'researcher' });
    const email = tryDecryptUserEmail(target);
    if (email) {
      sendAccountPromotedEmail({
        toEmail: email,
        firstName: target.first_name,
        role: 'researcher',
      }).catch(() => {});
    }
    res.json({ message: 'User promoted to researcher.' });
  } catch (err) {
    console.error('Make researcher error:', err);
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// POST /api/admin/users/:id/make-admin
adminRouter.post('/users/:id/make-admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const target = await db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(400).json({ error: 'User is already an admin.' });
    await db.updateUserProfile(req.params.id, { role: 'admin' });
    const email = tryDecryptUserEmail(target);
    if (email) {
      sendAccountPromotedEmail({ toEmail: email, firstName: target.first_name }).catch(() => {});
    }
    res.json({ message: 'User promoted to admin.' });
  } catch (err) {
    console.error('Make admin error:', err);
    res.status(500).json({ error: 'Failed to promote user.' });
  }
});

// POST /api/admin/users/:id/make-commuter
adminRouter.post('/users/:id/make-commuter', requireAuth, requireAdmin, async (req, res) => {
  try {
    const target = await db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Cannot change role of an admin.' });
    if (target.role === 'commuter') return res.status(400).json({ error: 'User is already a commuter.' });
    await db.updateUserProfile(req.params.id, { role: 'commuter' });
    res.json({ message: 'User set to commuter.' });
  } catch (err) {
    console.error('Make commuter error:', err);
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// POST /api/admin/users/:id/make-driver
adminRouter.post('/users/:id/make-driver', requireAuth, requireAdmin, async (req, res) => {
  try {
    const target = await db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Cannot change role of an admin.' });
    if (target.role === 'driver') return res.status(400).json({ error: 'User is already a driver.' });
    await db.updateUserProfile(req.params.id, { role: 'driver' });
    res.json({ message: 'User set to driver.' });
  } catch (err) {
    console.error('Make driver error:', err);
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// GET /api/admin/logins — recent login events
adminRouter.get('/logins', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100'), 200);
    const logs = await db.getRecentLoginLogs(limit);

    // Join with user names for display
    const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))];
    const userMap = {};
    await Promise.all(
      userIds.map(async (id) => {
        const u = await db.getUserById(id);
        if (u) {
          userMap[id] = {
            firstName: u.first_name || '',
            lastName: u.last_name || '',
            role: u.role || 'driver',
          };
        }
      })
    );

    const enriched = logs.map((log) => ({
      ...log,
      user: userMap[log.user_id] || null,
    }));

    res.json({ logins: enriched });
  } catch (err) {
    console.error('Admin logins error:', err);
    res.status(500).json({ error: 'Failed to fetch login logs.' });
  }
});

// ── Parking Location Management ──────────────────────────────────────────────

// GET /api/admin/parking — list all
adminRouter.get('/parking', requireAuth, requireAdmin, async (req, res) => {
  try {
    const locations = await db.getAllParkingLocations();
    res.json({ locations });
  } catch (err) {
    console.error('Parking list error:', err);
    res.status(500).json({ error: 'Failed to fetch parking locations.' });
  }
});

// POST /api/admin/parking — add new
adminRouter.post(
  '/parking',
  requireAuth,
  requireAdmin,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('type').isIn(['mall', 'street', 'jeepney_terminal', 'tricycle_terminal', 'public', 'church', 'school', 'gas_station', 'gasoline_station', 'diesel_station', 'ev_charging', 'other']),
    body('lat').isFloat({ min: 15, max: 20 }),
    body('lng').isFloat({ min: 119, max: 127 }),
    body('notes').optional().trim().isLength({ max: 300 }),
    body('fare_normal').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
    body('fare_discounted').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
    body('photo').optional({ nullable: true }).isString().isLength({ max: 500000 }),
    body('fuel_prices').optional({ nullable: true }).isArray(),
    body('fuel_prices.*.name').optional().isString().isLength({ max: 50 }),
    body('fuel_prices.*.price').optional().isString().isLength({ max: 20 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { name, type, lat, lng, notes, fare_normal, fare_discounted, photo, fuel_prices } = req.body;
      const id = await db.addParkingLocation({
        name, type, lat, lng, notes,
        fare_normal: fare_normal ?? null,
        fare_discounted: fare_discounted ?? null,
        photo: photo || null,
        fuel_prices: fuel_prices ?? null,
        addedBy: req.authUser.id,
      });
      res.json({ id, message: 'Parking location added.' });
    } catch (err) {
      console.error('Add parking error:', err);
      res.status(500).json({ error: 'Failed to add parking location.' });
    }
  }
);

// PATCH /api/admin/parking/:id — update name/type/notes
adminRouter.patch(
  '/parking/:id',
  requireAuth,
  requireAdmin,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('type').optional().isIn(['mall', 'street', 'jeepney_terminal', 'tricycle_terminal', 'public', 'church', 'school', 'gas_station', 'other']),
    body('notes').optional().trim().isLength({ max: 300 }),
    body('fare_normal').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
    body('fare_discounted').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
    body('photo').optional({ nullable: true }).isString().isLength({ max: 500000 }),
    body('fuel_prices').optional({ nullable: true }).isArray(),
    body('fuel_prices.*.name').optional().isString().isLength({ max: 50 }),
    body('fuel_prices.*.price').optional().isString().isLength({ max: 20 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { name, type, notes, fare_normal, fare_discounted, photo, fuel_prices } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (notes !== undefined) updates.notes = notes;
      if (fare_normal !== undefined) updates.fare_normal = fare_normal;
      if (fare_discounted !== undefined) updates.fare_discounted = fare_discounted;
      if (photo !== undefined) updates.photo = photo;
      if (fuel_prices !== undefined) updates.fuel_prices = fuel_prices;
      await db.updateParkingLocation(req.params.id, updates);
      res.json({ message: 'Parking location updated.' });
    } catch (err) {
      console.error('Update parking error:', err);
      res.status(500).json({ error: 'Failed to update parking location.' });
    }
  }
);

// DELETE /api/admin/parking/:id
adminRouter.delete('/parking/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.deleteParkingLocation(req.params.id);
    res.json({ message: 'Parking location deleted.' });
  } catch (err) {
    console.error('Delete parking error:', err);
    res.status(500).json({ error: 'Failed to delete parking location.' });
  }
});

// GET /api/admin/feedback — all feedback reports
adminRouter.get('/feedback', requireAuth, requireAdmin, async (req, res) => {
  try {
    const reports = await db.getAllFeedback();
    res.json({ reports });
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback.' });
  }
});

// PATCH /api/admin/feedback/:id/respond — admin responds to a report
adminRouter.patch('/feedback/:id/respond', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, admin_response } = req.body;
    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    await db.updateFeedbackResponse(req.params.id, { status, admin_response });
    res.json({ message: 'Response saved.' });
  } catch (err) {
    console.error('Feedback respond error:', err);
    res.status(500).json({ error: 'Failed to save response.' });
  }
});

module.exports = { adminRouter };
