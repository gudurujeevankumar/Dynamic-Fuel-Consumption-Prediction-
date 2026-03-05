// ── alerts.js ─────────────────────────────────────────────────────────────────
const alertRouter = require('express').Router();
const db = require('../db');
const { requireUser } = require('../middleware/auth');

alertRouter.get('/', requireUser, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM alerts WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ alerts: rows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = alertRouter;
