const router = require('express').Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireUser } = require('../middleware/auth');

// Vehicle info from API key prefix
const VEHICLE_MAP = {
  TYT: ['Toyota', 'Innova Crysta', 2022, 'diesel'],
  HON: ['Honda', 'City', 2023, 'petrol'],
  MAR: ['Maruti', 'Swift', 2021, 'petrol'],
  HYN: ['Hyundai', 'Creta', 2023, 'petrol'],
  KIA: ['Kia', 'Seltos', 2023, 'petrol'],
  TAT: ['Tata', 'Nexon', 2023, 'petrol'],
  MHN: ['Mahindra', 'XUV700', 2022, 'diesel'],
  BMW: ['BMW', '3 Series', 2022, 'petrol'],
  MRC: ['Mercedes-Benz', 'C-Class', 2023, 'petrol'],
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, vehicle_api_key } = req.body;
    if (!name || !email || !password || !vehicle_api_key)
      return res.status(400).json({ error: 'All fields are required' });

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR vehicle_api_key = ?',
      [email, vehicle_api_key]
    );
    if (existing.length)
      return res.status(409).json({ error: 'Email or vehicle API key already registered' });

    const prefix = vehicle_api_key.substring(0, 3).toUpperCase();
    const [make, model, year] = VEHICLE_MAP[prefix] || ['Generic', 'Sedan', 2020, 'petrol'];

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash, vehicle_api_key,
        vehicle_company, vehicle_model, vehicle_year)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hash, vehicle_api_key, make, model, year]
    );

    res.json({
      success: true,
      user: {
        id: result.insertId, name, email,
        vehicle_company: make, vehicle_model: model, vehicle_year: year,
        vehicle_api_key
      }
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    if (!user.is_active)
      return res.status(403).json({ error: 'Account is deactivated' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;

    res.json({
      success: true,
      is_admin: user.is_admin,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        vehicle_company: user.vehicle_company,
        vehicle_model: user.vehicle_model,
        vehicle_year: user.vehicle_year,
        vehicle_api_key: user.vehicle_api_key,
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', requireUser, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    is_admin: u.is_admin,
    vehicle_company: u.vehicle_company,
    vehicle_model: u.vehicle_model,
    vehicle_year: u.vehicle_year,
    vehicle_api_key: u.vehicle_api_key,
  });
});

module.exports = router;
