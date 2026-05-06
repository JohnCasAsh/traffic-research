const express = require('express');
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
