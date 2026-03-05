const db = require('../db');

// Require a logged-in user session
async function requireUser(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.session.userId]);
    if (!rows.length) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Require admin session
async function requireAdmin(req, res, next) {
  await requireUser(req, res, async () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

module.exports = { requireUser, requireAdmin };
