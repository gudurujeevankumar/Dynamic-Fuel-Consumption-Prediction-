/**
 * ECU Analytics — Express Server
 * ================================
 * Serves both the frontend HTML files AND the REST API.
 * Open http://localhost:3000 after starting.
 */

require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const cors     = require('cors');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SECRET_KEY || 'ecu-analytics-secret-2025',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly:   true,
    sameSite:   'lax',
    secure:     false,      // set true if using HTTPS
    maxAge:     86_400_000, // 24 hours
  },
}));

// ── Static frontend ───────────────────────────────────────────────────────────
// This serves all HTML files — no CORS issues since same origin!
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/ecu',     require('./routes/ecu'));
app.use('/api/alerts',  require('./routes/alerts'));
app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/admin',   require('./routes/admin'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Root redirect ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n  ╔═══════════════════════════════════════════╗');
  console.log(`  ║  ⚡ ECU Analytics Server — Port ${PORT}       ║`);
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log(`\n  → App:    http://localhost:${PORT}`);
  console.log(`  → Login:  http://localhost:${PORT}/login.html`);
  console.log(`  → Admin:  http://localhost:${PORT}/admin_login.html`);
  console.log(`  → Health: http://localhost:${PORT}/api/health`);
  console.log('\n  Admin login: admin@ecu.com / admin123');
  console.log('  Press Ctrl+C to stop\n');
});
