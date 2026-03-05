const router = require('express').Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/overview
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const [[users]]    = await db.query('SELECT COUNT(*) as total FROM users WHERE is_admin = 0');
    const [[active]]   = await db.query('SELECT COUNT(*) as total FROM users WHERE is_admin = 0 AND is_active = 1');
    const [[logs]]     = await db.query('SELECT COUNT(*) as total FROM telemetry_log');
    const [[alerts]]   = await db.query('SELECT COUNT(*) as total FROM alerts');
    const [[sessions]] = await db.query('SELECT COUNT(DISTINCT session_id) as total FROM telemetry_log');
    const [recent]     = await db.query(
      `SELECT u.name, u.email, u.vehicle_company, u.vehicle_model, t.driving_label, t.vehicle_speed, t.timestamp
       FROM telemetry_log t JOIN users u ON t.user_id = u.id
       ORDER BY t.timestamp DESC LIMIT 10`
    );
    res.json({
      total_users:    users.total,
      active_users:   active.total,
      total_logs:     logs.total,
      total_alerts:   alerts.total,
      total_sessions: sessions.total,
      recent_activity: recent,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.vehicle_api_key, u.vehicle_company,
        u.vehicle_model, u.vehicle_year, u.is_active, u.created_at, u.last_login,
        COUNT(t.id) as log_count,
        MAX(t.driving_label) as last_label
       FROM users u
       LEFT JOIN telemetry_log t ON t.user_id = u.id
       WHERE u.is_admin = 0
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ users });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE users SET is_active = ? WHERE id = ? AND is_admin = 0',
      [is_active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/alerts
router.get('/alerts', requireAdmin, async (req, res) => {
  try {
    const [alerts] = await db.query(
      `SELECT a.*, u.name as driver_name, u.email
       FROM alerts a JOIN users u ON a.user_id = u.id
       ORDER BY a.timestamp DESC LIMIT 200`
    );
    res.json({ alerts });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
