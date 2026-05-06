const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('./database');
const { requireAuth } = require('./auth');

const savedRoutesRouter = express.Router();

// GET /api/saved-routes
savedRoutesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const routes = await db.getSavedRoutes(req.authUser.id);
    res.json({ routes });
  } catch (err) {
    console.error('Get saved routes error:', err);
    res.status(500).json({ error: 'Failed to fetch saved routes.' });
  }
});

// POST /api/saved-routes
savedRoutesRouter.post(
  '/',
  requireAuth,
  [
    body('label').isString().trim().isLength({ min: 1, max: 100 }),
    body('origin').isString().trim().isLength({ min: 1, max: 300 }),
    body('destination').isString().trim().isLength({ min: 1, max: 300 }),
    body('vehicle_type').isString().trim().isLength({ min: 1, max: 50 }),
    body('fuel_type').isIn(['gasoline', 'diesel', 'electric']),
    body('fuel_price').isString().trim().isLength({ min: 1, max: 20 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid route data.', details: errors.array() });
    }

    try {
      const { label, origin, destination, vehicle_type, fuel_type, fuel_price } = req.body;
      const id = await db.saveRoute(req.authUser.id, {
        label, origin, destination, vehicle_type, fuel_type, fuel_price,
      });
      res.status(201).json({ id, message: 'Route saved.' });
    } catch (err) {
      if (err.code === 'LIMIT_REACHED') {
        return res.status(409).json({ error: 'You can save up to 10 routes. Remove one to save another.' });
      }
      console.error('Save route error:', err);
      res.status(500).json({ error: 'Failed to save route.' });
    }
  }
);

// DELETE /api/saved-routes/:id
savedRoutesRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.deleteSavedRoute(req.authUser.id, req.params.id);
    res.json({ message: 'Route removed.' });
  } catch (err) {
    console.error('Delete saved route error:', err);
    res.status(500).json({ error: 'Failed to remove route.' });
  }
});

module.exports = { savedRoutesRouter };
