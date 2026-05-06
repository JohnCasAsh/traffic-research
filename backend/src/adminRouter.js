const express = require('express');
const db = require('./database');
const { requireAuth } = require('./auth');

const adminRouter = express.Router();

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

module.exports = { adminRouter };
