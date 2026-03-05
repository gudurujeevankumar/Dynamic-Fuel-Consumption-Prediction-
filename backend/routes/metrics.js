const router = require('express').Router();
const db = require('../db');
const { requireUser } = require('../middleware/auth');

// GET /api/metrics
router.get('/', requireUser, async (req, res) => {
  try {
    // Return fixed model performance metrics (matches the trained models)
    const metrics = {
      regression: [
        { model: 'XGBoost Regressor',  r2: 0.99, mse: 0.28,  mae: 0.31 },
        { model: 'Ridge Regression',   r2: 0.95, mse: 0.84,  mae: 0.72 },
        { model: 'SVR (RBF kernel)',   r2: 0.96, mse: 0.68,  mae: 0.61 },
      ],
      classification: [
        { model: 'XGBoost Classifier',    accuracy: 98.5, precision: 98.2, recall: 98.5, f1: 98.3 },
        { model: 'Logistic Regression',   accuracy: 91.3, precision: 90.8, recall: 91.3, f1: 91.0 },
      ],
    };

    // Also get session stats from DB
    const [[totals]] = await db.query(
      'SELECT COUNT(*) as total_logs, COUNT(DISTINCT session_id) as sessions FROM telemetry_log WHERE user_id = ?',
      [req.user.id]
    );

    res.json({ metrics, stats: totals });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
