/**
 * ECU Analytics — One-Click Start Script
 * =========================================
 * Run:  node start.js
 *
 * Does everything automatically:
 *  1. Checks Node.js version
 *  2. Installs npm packages
 *  3. Creates MySQL database + tables
 *  4. Creates admin user
 *  5. Starts the server
 *  6. Opens browser
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');

const G = '\x1b[92m', Y = '\x1b[93m', R = '\x1b[91m', C = '\x1b[96m', B = '\x1b[1m', X = '\x1b[0m';
const ok = m => console.log(`  ${G}✓${X}  ${m}`);
const warn = m => console.log(`  ${Y}⚠${X}  ${m}`);
const err = m => console.log(`  ${R}✗${X}  ${m}`);
const info = m => console.log(`  ${C}→${X}  ${m}`);
const sep = () => console.log(`\n${B}${C}  ${'─'.repeat(50)}${X}`);

// ── Step 1: Node version ──────────────────────────────────────────────────────
sep(); console.log(`${B}${C}  Step 1 — Node.js Check${X}`);
const [maj] = process.versions.node.split('.').map(Number);
if (maj < 16) { err('Node.js 16+ required. Download: https://nodejs.org'); process.exit(1); }
ok(`Node.js v${process.versions.node}`);

// ── Step 2: Install packages ──────────────────────────────────────────────────
sep(); console.log(`${B}${C}  Step 2 — Installing npm packages${X}`);
if (!fs.existsSync(path.join(BACKEND, 'node_modules'))) {
  info('Running npm install (first time ~30 seconds)...');
  execSync('npm install', { cwd: BACKEND, stdio: 'inherit' });
  ok('Packages installed');
} else {
  ok('node_modules already exists');
}

// ── Step 3: Create .env if missing ───────────────────────────────────────────
const envPath = path.join(BACKEND, '.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath,
    `PORT=3000\nSECRET_KEY=ecu-analytics-secret-2025\nDB_HOST=localhost\nDB_PORT=3306\nDB_USER=root\nDB_PASSWORD=Jeeva4U\nDB_NAME=ecu_analytics\n`);
  warn('.env created. Edit it if your MySQL has a password.');
}
ok('.env file ready');

// ── Step 4: Create DB and tables ──────────────────────────────────────────────
sep(); console.log(`${B}${C}  Step 3 — Setting up MySQL Database${X}`);
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: envPath });

async function setupDB() {
  const mysql = require(path.join(BACKEND, 'node_modules', 'mysql2', 'promise'));
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`ecu_analytics\` CHARACTER SET utf8mb4`);
    await conn.query(`USE \`ecu_analytics\``);
    ok('Database ecu_analytics ready');

    // Create tables
    await conn.execute(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL, vehicle_api_key VARCHAR(100) NOT NULL UNIQUE,
      vehicle_company VARCHAR(100), vehicle_model VARCHAR(100), vehicle_year SMALLINT,
      is_active TINYINT(1) DEFAULT 1, is_admin TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME
    ) ENGINE=InnoDB`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS telemetry_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, session_id VARCHAR(60) NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      engine_rpm FLOAT, vehicle_speed FLOAT, throttle_position FLOAT,
      acceleration FLOAT, engine_load FLOAT, fuel_injection_rate FLOAT,
      coolant_temperature FLOAT, mass_air_flow FLOAT,
      fuel_predicted_xgb FLOAT, fuel_predicted_ridge FLOAT, fuel_predicted_svr FLOAT,
      fuel_avg FLOAT, driving_label VARCHAR(12), driving_code TINYINT, speed_alert TINYINT(1) DEFAULT 0,
      INDEX (user_id), INDEX (session_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS alerts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, session_id VARCHAR(60),
      alert_type VARCHAR(30) NOT NULL, rpm_value FLOAT, speed_value FLOAT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    ok('All tables created');

    // Admin user
    const bcrypt = require(path.join(BACKEND, 'node_modules', 'bcrypt'));
    const hash = await bcrypt.hash('admin123', 10);
    try {
      await conn.execute(
        `INSERT IGNORE INTO users (name,email,password_hash,vehicle_api_key,is_admin,is_active) VALUES (?,?,?,?,1,1)`,
        ['Administrator', 'admin@ecu.com', hash, 'ADMIN-KEY-001']
      );
      ok('Admin user ready  →  admin@ecu.com / admin123');
    } catch (_) { ok('Admin user already exists'); }

    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) { }
    err('MySQL error: ' + e.message);
    warn('Fix: Make sure MySQL is running and .env has the correct DB_PASSWORD');
    warn('Then re-run: node start.js');
    return false;
  }
}

setupDB().then(dbOk => {
  if (!dbOk) process.exit(1);

  // ── Step 5: Start server ───────────────────────────────────────────────────
  sep(); console.log(`${B}${C}  Step 4 — Starting Server${X}`);
  info('Starting Express server...');
  const server = spawn('node', ['server.js'], { cwd: BACKEND, stdio: 'inherit' });

  // ── Step 6: Open browser ───────────────────────────────────────────────────
  function waitAndOpen(ms) {
    setTimeout(() => {
      http.get('http://localhost:3000/api/health', res => {
        if (res.statusCode === 200) {
          info('Opening browser → http://localhost:3000');
          const url = 'http://localhost:3000';
          const cmd = process.platform === 'win32' ? `start ${url}`
            : process.platform === 'darwin' ? `open ${url}`
              : `xdg-open ${url}`;
          try { execSync(cmd); } catch (_) { }
        } else { waitAndOpen(1500); }
      }).on('error', () => waitAndOpen(1500));
    }, ms);
  }
  waitAndOpen(2500);

  process.on('SIGINT', () => { server.kill(); process.exit(0); });
});
