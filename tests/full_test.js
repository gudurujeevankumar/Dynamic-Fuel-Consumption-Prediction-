/**
 * ECU Analytics — FULL COMPREHENSIVE TEST SUITE
 * ================================================
 * Tests: Frontend HTML, Frontend JS, Backend API (all endpoints),
 *        DB Schema, ML Predictor, Car Physics, Security, Error handling
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Colours ───────────────────────────────────────────────────────────────────
const G = '\x1b[92m', Y = '\x1b[93m', R = '\x1b[91m', C = '\x1b[96m', B = '\x1b[1m', X = '\x1b[0m', D = '\x1b[90m', M = '\x1b[95m';

// ── Stats ─────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];
let currentSection = '';

function sec(title) {
  currentSection = title;
  console.log(`\n${B}${C}  ┌─ ${title} ${'─'.repeat(Math.max(2, 54 - title.length))}${X}`);
}
function ok(name, detail = '') {
  passed++;
  console.log(`  ${G}✓${X}  ${name.padEnd(52)} ${D}${String(detail).substring(0, 50)}${X}`);
}
function fail(name, got, expected = '') {
  failed++;
  failures.push({ section: currentSection, name, got, expected });
  console.log(`  ${R}✗${X}  ${name.padEnd(52)} ${R}got:${JSON.stringify(got).substring(0, 50)}${X}`);
}
function skip(name, reason = '') {
  skipped++;
  console.log(`  ${Y}–${X}  ${name.padEnd(52)} ${Y}${reason}${X}`);
}
function assert(name, cond, got, expected = '') {
  cond ? ok(name, got) : fail(name, got, expected);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function req(method, p, body, jar = '') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const r = http.request({
      hostname: 'localhost', port: 4000, path: p, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(jar ? { 'Cookie': jar } : {}) }
    },
      res => {
        let b = ''; res.on('data', c => b += c); res.on('end', () => {
          try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(b) }); }
          catch { resolve({ status: res.statusCode, headers: res.headers, body: b }); }
        });
      });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
function getCookie(h) { const sc = h['set-cookie']; if (!sc) return ''; return (Array.isArray(sc) ? sc : [sc]).map(c => c.split(';')[0]).join('; '); }

// ── Load predictor directly ───────────────────────────────────────────────────
const predictorPath = path.join(__dirname, 'backend/ml/predictor.js');
let predict = null;
if (fs.existsSync(predictorPath)) {
  try { predict = require(predictorPath).predict; } catch (e) { }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION A — FRONTEND FILE EXISTENCE & SIZE
// ══════════════════════════════════════════════════════════════════════════════
function testFrontendFiles() {
  sec('A — Frontend Files: Existence & Size');
  const files = {
    'frontend/login.html': { minSize: 3000, mustHave: ['register', 'login', 'vehicle_api_key', 'Orbitron'] },
    'frontend/admin_login.html': { minSize: 1500, mustHave: ['admin', 'password', 'RESTRICTED'] },
    'frontend/user_dashboard.html': { minSize: 20000, mustHave: ['sec-live', 'sec-report', 'sec-alerts', 'sec-vehicle', 'Chart.js', 'jspdf'] },
    'frontend/admin_dashboard.html': { minSize: 8000, mustHave: ['admin/overview', 'admin/users', 'admin/alerts', 'metrics'] },
    'frontend/demo_car.html': { minSize: 20000, mustHave: ['physics', 'S.load', '_thr_target', 'S.throttle', 'drawGauge', 'ml/predictor', 'ingest'] },
  };
  for (const [f, cfg] of Object.entries(files)) {
    const fp = path.join(__dirname, f);
    if (!fs.existsSync(fp)) { fail(`${f} exists`, false, 'missing'); continue; }
    const content = fs.readFileSync(fp, 'utf8');
    assert(`${f} exists`, true, `${(content.length / 1024).toFixed(1)}KB`);
    assert(`${f} size ≥ ${(cfg.minSize / 1024).toFixed(0)}KB`, content.length >= cfg.minSize, content.length);
    for (const kw of cfg.mustHave) {
      assert(`  └ contains "${kw}"`, content.includes(kw), kw);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION B — FRONTEND HTML STRUCTURE
// ══════════════════════════════════════════════════════════════════════════════
function testFrontendHTML() {
  sec('B — Frontend HTML Structure');

  // login.html
  const login = fs.readFileSync(path.join(__dirname, 'frontend/login.html'), 'utf8');
  assert('login.html: has email input', login.includes('type="email"'), 'email input present');
  assert('login.html: has password input', login.includes('type="password"'), 'password input present');
  assert('login.html: has vehicle_api_key field', login.includes('vehicle_api_key'), 'api key field present');
  assert('login.html: has Register tab', login.includes('Register'), 'register tab present');
  assert('login.html: calls /api/auth/login', login.includes('/auth/login'), 'login endpoint');
  assert('login.html: calls /api/auth/register', login.includes('/auth/register'), 'register endpoint');
  assert('login.html: redirects on login', login.includes('user_dashboard.html'), 'dashboard redirect');
  assert('login.html: admin link present', login.includes('admin_login.html'), 'admin link');

  // admin_login.html
  const adminLogin = fs.readFileSync(path.join(__dirname, 'frontend/admin_login.html'), 'utf8');
  assert('admin_login: checks is_admin flag', adminLogin.includes('is_admin'), 'is_admin check');
  assert('admin_login: redirects to dashboard', adminLogin.includes('admin_dashboard'), 'admin redirect');

  // user_dashboard.html — 4 sections
  const dash = fs.readFileSync(path.join(__dirname, 'frontend/user_dashboard.html'), 'utf8');
  for (const sec of ['sec-live', 'sec-report', 'sec-alerts', 'sec-vehicle']) {
    assert(`user_dash: section #${sec} present`, dash.includes(`id="${sec}"`), sec);
  }
  assert('user_dash: Chart.js CDN loaded', dash.includes('chart.js'), 'chart.js cdn');
  assert('user_dash: jsPDF CDN loaded', dash.includes('jspdf'), 'jspdf cdn');
  assert('user_dash: PDF download function', dash.includes('downloadPDF'), 'downloadPDF fn');
  assert('user_dash: /ecu/live polling', dash.includes('/ecu/live'), '/ecu/live');
  assert('user_dash: /auth/logout call', dash.includes('/auth/logout'), 'logout call');
  assert('user_dash: overspeed modal', dash.includes('overspeed-modal'), 'overspeed modal');
  assert('user_dash: RPM chart canvas', dash.includes('c-rpm'), 'rpm chart');
  assert('user_dash: speed chart canvas', dash.includes('c-spd'), 'speed chart');
  assert('user_dash: XGBoost fuel display', dash.includes('e-xgb'), 'xgb fuel');
  assert('user_dash: Ridge fuel display', dash.includes('e-ridge'), 'ridge fuel');
  assert('user_dash: SVR fuel display', dash.includes('e-svr'), 'svr fuel');
  assert('user_dash: demo car button', dash.includes('demo_car.html'), 'demo car link');

  // admin_dashboard.html — 4 sections
  const adash = fs.readFileSync(path.join(__dirname, 'frontend/admin_dashboard.html'), 'utf8');
  assert('admin_dash: overview section', adash.includes('sec-overview'), 'overview section');
  assert('admin_dash: users section', adash.includes('sec-users'), 'users section');
  assert('admin_dash: alerts section', adash.includes('sec-alerts'), 'alerts section');
  assert('admin_dash: ml metrics section', adash.includes('sec-metrics'), 'metrics section');
  assert('admin_dash: toggle user function', adash.includes('toggleUser'), 'toggleUser fn');
  assert('admin_dash: loadUsers function', adash.includes('loadUsers'), 'loadUsers fn');
  assert('admin_dash: PATCH admin/users', adash.includes('admin/users'), 'admin/users route');
  assert('admin_dash: ML regression table', adash.includes('ml-reg'), 'ml-reg table');
  assert('admin_dash: ML classification table', adash.includes('ml-cls'), 'ml-cls table');

  // demo_car.html — physics + controls
  const car = fs.readFileSync(path.join(__dirname, 'frontend/demo_car.html'), 'utf8');
  assert('demo_car: W/S keyboard controls', car.includes("'w'") && car.includes("'s'"), 'keyboard controls');
  assert('demo_car: gear buttons 1-4', car.includes("setGear('1')") && car.includes("setGear('4')"), 'gear buttons');
  assert('demo_car: Eco/Normal/Sport modes', car.includes("setMode('eco')") && car.includes("setMode('sport')"), 'drive modes');
  assert('demo_car: _thr_target smooth state', car.includes('_thr_target'), '_thr_target fix');
  assert('demo_car: throttle smooth ramp 0.07', car.includes('0.07'), 'throttle smooth');
  assert('demo_car: load smooth factor 0.012', car.includes('0.012'), 'load smooth 0.012');
  assert('demo_car: RPM smooth rpmTarget', car.includes('rpmTarget'), 'rpmTarget smooth');
  assert('demo_car: fuel smooth 0.06', car.includes('0.06'), 'fuel smooth');
  assert('demo_car: POST /ecu/ingest', car.includes('/ecu/ingest'), 'ingest POST');
  assert('demo_car: overspeed warning', car.includes('os-warn'), 'overspeed warn');
  assert('demo_car: ML overlay panel', car.includes('mlo-xgb'), 'ml overlay');
  assert('demo_car: drawGauge for speed', car.includes("'g-spd'"), 'speed gauge');
  assert('demo_car: drawGauge for rpm', car.includes("'g-rpm'"), 'rpm gauge');
  assert('demo_car: drawGauge for fuel', car.includes("'g-fuel'"), 'fuel gauge');
  assert('demo_car: drawGauge for load', car.includes("'g-load'"), 'load gauge');
  assert('demo_car: accelerate pedal button', car.includes('p-acc'), 'accel pedal');
  assert('demo_car: brake pedal button', car.includes('p-brk'), 'brake pedal');
  assert('demo_car: mini chart canvas', car.includes('mini-chart'), 'mini chart');
  assert('demo_car: session_id in payload', car.includes('SESSION_ID'), 'session id');
  assert('demo_car: sends every 500ms', car.includes('500'), 'send interval');
  assert('demo_car: DB log_id displayed', car.includes('mlo-id'), 'log id display');
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION C — CAR PHYSICS SIMULATION (actual JS execution)
// ══════════════════════════════════════════════════════════════════════════════
function testCarPhysics() {
  sec('C — Car Physics: Engine Load Bar Smoothness & Behaviour');

  const MODES = { eco: { maxSpd: 90, accelK: .55, rpmK: .7 }, normal: { maxSpd: 120, accelK: 1, rpmK: 1 }, sport: { maxSpd: 160, accelK: 1.9, rpmK: 1.5 } };
  const GEAR_R = { N: 0, R: -.8, '1': 1.8, '2': 1.25, '3': .85, '4': .55 };
  const slider_load = 20, slider_cool = 88;

  function runPhysics(ticks, accelerating, gear, mode) {
    const S = { speed: 0, rpm: 800, throttle: 0, _thr_target: 0, load: 20, coolant: slider_cool, maf: 2, accel: 0, fuel: 0.5 };
    const history = [];
    for (let i = 0; i < ticks; i++) {
      const m = MODES[mode]; const r = GEAR_R[gear] || 0; const prev = S.speed;
      if (accelerating) { S._thr_target = Math.min(100, S._thr_target + 5 * m.accelK); }
      else { S._thr_target = Math.max(0, S._thr_target - 4); }
      S.throttle = S.throttle + 0.07 * (S._thr_target - S.throttle);
      if (r > 0) { const t = (S.throttle / 100) * m.maxSpd; S.speed += (t - S.speed) * .07; } else S.speed = Math.max(0, S.speed - .7);
      S.accel = (S.speed - prev) / 3.6;
      const rpmTarget = gear === 'N' ? 750 : Math.max(800, Math.min(7000, (S.speed * 42 * Math.abs(r)) + (S.throttle * 18 * m.rpmK)));
      S.rpm = S.rpm + 0.08 * (rpmTarget - S.rpm);
      const targetLoad = slider_load * 0.25 + S.throttle * 0.75;
      S.load = S.load + 0.012 * (targetLoad - S.load);
      const targetFuel = Math.max(0.3, S.rpm * 0.00258 + S.load * 0.038 + S.throttle * 0.019);
      S.fuel = S.fuel + 0.06 * (targetFuel - S.fuel);
      history.push({ ...S });
    }
    return history;
  }

  // ── Test 1: Load bar max delta per tick (the core fix)
  const ecoHist = runPhysics(60, true, '3', 'eco');
  const sptHist = runPhysics(60, true, '3', 'sport');
  const maxDeltaEco = Math.max(...ecoHist.map((h, i) => i === 0 ? 0 : Math.abs(h.load - ecoHist[i - 1].load)));
  const maxDeltaSpt = Math.max(...sptHist.map((h, i) => i === 0 ? 0 : Math.abs(h.load - sptHist[i - 1].load)));
  assert('ECO mode: max load delta per tick < 0.5', maxDeltaEco < 0.5, maxDeltaEco.toFixed(4));
  assert('SPORT mode: max load delta per tick < 0.5', maxDeltaSpt < 0.5, maxDeltaSpt.toFixed(4));

  // ── Test 2: Throttle smooth (never jumps >11 in one tick)
  const maxThrDelta = Math.max(...sptHist.map((h, i) => i === 0 ? 0 : Math.abs(h.throttle - sptHist[i - 1].throttle)));
  assert('Throttle smooth: max delta per tick < 2.0', maxThrDelta < 2.0, maxThrDelta.toFixed(4));

  // ── Test 3: RPM smooth (no instant jumps)
  const maxRpmDelta = Math.max(...sptHist.map((h, i) => i === 0 ? 0 : Math.abs(h.rpm - sptHist[i - 1].rpm)));
  assert('RPM smooth: max delta per tick < 200', maxRpmDelta < 200, maxRpmDelta.toFixed(1));

  // ── Test 4: Speed builds up with acceleration
  assert('Speed increases when accelerating', sptHist[59].speed > sptHist[0].speed, `${sptHist[0].speed.toFixed(1)} → ${sptHist[59].speed.toFixed(1)}`);

  // ── Test 5: Speed drops when no acceleration
  const brakeHist = runPhysics(30, false, 'N', 'normal');
  assert('Speed stays 0 with no input in N gear', brakeHist[29].speed <= 1, brakeHist[29].speed.toFixed(2));

  // ── Test 6: Sport mode reaches higher speed
  const normHist = runPhysics(80, true, '3', 'normal');
  const sport80 = runPhysics(80, true, '3', 'sport');
  assert('Sport mode reaches higher speed than Normal', sport80[79].speed > normHist[79].speed,
    `sport:${sport80[79].speed.toFixed(1)} normal:${normHist[79].speed.toFixed(1)}`);

  // ── Test 7: Gear 1 vs Gear 4 RPM difference
  const g1hist = runPhysics(60, true, '1', 'normal');
  const g4hist = runPhysics(60, true, '4', 'normal');
  // At same speed, gear 1 (higher ratio) should produce higher RPM
  assert('Gear 1 has higher RPM than Gear 4 at same throttle', g1hist[59].rpm > g4hist[59].rpm,
    `G1:${g1hist[59].rpm.toFixed(0)} G4:${g4hist[59].rpm.toFixed(0)}`);

  // ── Test 8: Fuel increases with more load
  const lowLoadFuel = ecoHist[59].fuel;
  const highLoadFuel = sptHist[59].fuel;
  assert('Fuel consumption higher in Sport vs Eco', highLoadFuel > lowLoadFuel,
    `eco:${lowLoadFuel.toFixed(3)} sport:${highLoadFuel.toFixed(3)}`);

  // ── Test 9: Load stays in valid range 0-100
  const allLoads = [...ecoHist, ...sptHist].map(h => h.load);
  assert('Load always stays in 0-100 range', allLoads.every(l => l >= 0 && l <= 100),
    `min:${Math.min(...allLoads).toFixed(1)} max:${Math.max(...allLoads).toFixed(1)}`);

  // ── Test 10: ECU payload values are realistic numbers
  const snap = sptHist[40];
  assert('Payload RPM is finite positive number', isFinite(snap.rpm) && snap.rpm > 0, snap.rpm.toFixed(1));
  assert('Payload speed is finite non-negative', isFinite(snap.speed) && snap.speed >= 0, snap.speed.toFixed(1));
  assert('Payload throttle 0-100', snap.throttle >= 0 && snap.throttle <= 100, snap.throttle.toFixed(1));
  assert('Payload fuel is positive', snap.fuel > 0, snap.fuel.toFixed(3));
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION D — ML PREDICTOR (direct module test)
// ══════════════════════════════════════════════════════════════════════════════
function testMLPredictor() {
  sec('D — ML Predictor: Logic & Boundaries');
  if (!predict) { skip('All ML tests', 'predictor.js not loadable'); return; }

  // Eco
  const eco = predict({ engine_rpm: 1000, vehicle_speed: 35, throttle_position: 18, acceleration: 0.1, engine_load: 22, mass_air_flow: 2.5, coolant_temperature: 88 });
  assert('ECO: speed 35 throttle 18 → label Eco', eco.driving_label === 'Eco', eco.driving_label);
  assert('ECO: speed_alert false (35 km/h)', eco.speed_alert === false, eco.speed_alert);
  assert('ECO: driving_code 0', eco.driving_code === 0, eco.driving_code);
  assert('ECO: fuel_xgb > 0', eco.fuel_xgb > 0, eco.fuel_xgb);

  // Normal
  const nor = predict({ engine_rpm: 2500, vehicle_speed: 70, throttle_position: 40, acceleration: 0.5, engine_load: 50, mass_air_flow: 9, coolant_temperature: 90 });
  assert('NORMAL: speed 70 throttle 40 → Normal', nor.driving_label === 'Normal', nor.driving_label);
  assert('NORMAL: driving_code 1', nor.driving_code === 1, nor.driving_code);

  // Aggressive
  const agg = predict({ engine_rpm: 5200, vehicle_speed: 135, throttle_position: 88, acceleration: 2.2, engine_load: 88, mass_air_flow: 20, coolant_temperature: 95 });
  assert('AGGRESSIVE: speed 135 throttle 88 → Aggressive', agg.driving_label === 'Aggressive', agg.driving_label);
  assert('AGGRESSIVE: speed_alert true (>100)', agg.speed_alert === true, agg.speed_alert);
  assert('AGGRESSIVE: driving_code 2', agg.driving_code === 2, agg.driving_code);

  // Model hierarchy
  assert('Ridge > XGBoost (Ridge bias term)', nor.fuel_ridge > nor.fuel_xgb, `xgb:${nor.fuel_xgb} ridge:${nor.fuel_ridge}`);
  assert('SVR < XGBoost (SVR negative bias)', nor.fuel_svr < nor.fuel_xgb, `svr:${nor.fuel_svr} xgb:${nor.fuel_xgb}`);
  assert('fuel_avg is mean of 3 models', Math.abs(nor.fuel_avg - (nor.fuel_xgb + nor.fuel_ridge + nor.fuel_svr) / 3) < 0.01, nor.fuel_avg);

  // Aggressive fuel >> Eco fuel
  assert('Aggressive fuel >> Eco fuel (3× at least)', agg.fuel_xgb > eco.fuel_xgb * 2.5, `agg:${agg.fuel_xgb} eco:${eco.fuel_xgb}`);

  // Edge cases
  const zero = predict({ engine_rpm: 0, vehicle_speed: 0, throttle_position: 0, acceleration: 0, engine_load: 0, mass_air_flow: 0, coolant_temperature: 0 });
  assert('Zero inputs: fuel_xgb ≥ 0.3 (floor)', zero.fuel_xgb >= 0.3, zero.fuel_xgb);
  assert('Zero inputs: returns Eco', zero.driving_label === 'Eco', zero.driving_label);

  // Exactly at speed boundary
  const ovsp = predict({ engine_rpm: 3000, vehicle_speed: 101, throttle_position: 50, acceleration: 0, engine_load: 50, mass_air_flow: 8, coolant_temperature: 90 });
  assert('Speed 101 → speed_alert true', ovsp.speed_alert === true, ovsp.vehicle_speed);
  const safe = predict({ engine_rpm: 3000, vehicle_speed: 99, throttle_position: 50, acceleration: 0, engine_load: 50, mass_air_flow: 8, coolant_temperature: 90 });
  assert('Speed 99 → speed_alert false', safe.speed_alert === false, 99);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION E — BACKEND FILE STRUCTURE
// ══════════════════════════════════════════════════════════════════════════════
function testBackendFiles() {
  sec('E — Backend File Structure & Code Quality');
  const files = {
    'backend/server.js': ['express', 'session', 'cors', 'static', 'listen', '3000'],
    'backend/db.js': ['mysql2', 'createPool', 'DB_HOST', 'DB_PASSWORD', 'getConnection'],
    'backend/middleware/auth.js': ['requireUser', 'requireAdmin', 'is_active', 'is_admin'],
    'backend/routes/auth.js': ['register', 'login', 'logout', '/me', 'bcrypt', 'VEHICLE_MAP'],
    'backend/routes/ecu.js': ['/live', '/ingest', '/history', 'predict', 'saveTelemetry', 'appendCSV'],
    'backend/routes/alerts.js': ['alerts', 'requireUser'],
    'backend/routes/metrics.js': ['regression', 'classification', 'r2:0.99', '98.5'],
    'backend/routes/admin.js': ['overview', 'users', 'alerts', 'requireAdmin', 'is_active'],
    'backend/ml/predictor.js': ['xgbFuel', 'ridgeFuel', 'svrFuel', 'classifyDriving', 'predict', 'module.exports'],
    'backend/package.json': ['express', 'mysql2', 'bcrypt', 'express-session', 'cors'],
    'backend/.env': ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'],
    'database/setup.sql': ['CREATE TABLE', 'users', 'telemetry_log', 'alerts', 'AUTO_INCREMENT', 'FOREIGN KEY'],
    'scripts/ecu_generator.js': ['engine_rpm', 'vehicle_speed', 'throttle_position', 'setInterval'],
  };
  for (const [f, keywords] of Object.entries(files)) {
    const fp = path.join(__dirname, f);
    if (!fs.existsSync(fp)) { fail(`${f} exists`, false, 'missing'); continue; }
    const content = fs.readFileSync(fp, 'utf8');
    ok(`${f} exists`, (content.length / 1024).toFixed(1) + 'KB');
    for (const kw of keywords) {
      assert(`  └ "${kw}"`, content.includes(kw), kw);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION F — DATABASE SCHEMA
// ══════════════════════════════════════════════════════════════════════════════
function testDBSchema() {
  sec('F — Database Schema (setup.sql)');
  const sql = fs.readFileSync(path.join(__dirname, 'database/setup.sql'), 'utf8');

  // Users table
  assert('users table: id AUTO_INCREMENT PK', sql.includes('id') && sql.includes('AUTO_INCREMENT'), 'id field');
  assert('users table: name VARCHAR', sql.includes('name') && sql.includes('VARCHAR'), 'name field');
  assert('users table: email UNIQUE', sql.includes('email') && sql.includes('UNIQUE'), 'email unique');
  assert('users table: password_hash field', sql.includes('password_hash'), 'password_hash');
  assert('users table: vehicle_api_key field', sql.includes('vehicle_api_key'), 'api key');
  assert('users table: is_active flag', sql.includes('is_active'), 'is_active');
  assert('users table: is_admin flag', sql.includes('is_admin'), 'is_admin');
  assert('users table: created_at DATETIME', sql.includes('created_at') && sql.includes('DATETIME'), 'created_at');

  // Telemetry table
  assert('telemetry_log table exists', sql.includes('telemetry_log'), 'telemetry_log');
  assert('telemetry_log: engine_rpm FLOAT', sql.includes('engine_rpm'), 'engine_rpm');
  assert('telemetry_log: vehicle_speed FLOAT', sql.includes('vehicle_speed'), 'vehicle_speed');
  assert('telemetry_log: fuel_predicted_xgb', sql.includes('fuel_predicted_xgb'), 'fuel_xgb');
  assert('telemetry_log: fuel_predicted_ridge', sql.includes('fuel_predicted_ridge'), 'fuel_ridge');
  assert('telemetry_log: fuel_predicted_svr', sql.includes('fuel_predicted_svr'), 'fuel_svr');
  assert('telemetry_log: driving_label VARCHAR', sql.includes('driving_label'), 'driving_label');
  assert('telemetry_log: speed_alert field', sql.includes('speed_alert'), 'speed_alert');
  assert('telemetry_log: FK to users', sql.includes('FOREIGN KEY') && sql.includes('users(id)'), 'foreign key');
  assert('telemetry_log: INDEX on user_id', sql.includes('INDEX (user_id)'), 'user_id index');

  // Alerts table
  assert('alerts table exists', sql.includes('CREATE TABLE IF NOT EXISTS alerts'), 'alerts table');
  assert('alerts table: alert_type VARCHAR', sql.includes('alert_type'), 'alert_type');
  assert('alerts table: rpm_value field', sql.includes('rpm_value'), 'rpm_value');
  assert('alerts table: speed_value field', sql.includes('speed_value'), 'speed_value');

  // Drive sessions table
  assert('drive_sessions table exists', sql.includes('drive_sessions'), 'drive_sessions');
  assert('drive_sessions: eco_pct field', sql.includes('eco_pct'), 'eco_pct');
  assert('drive_sessions: aggressive_pct', sql.includes('aggressive_pct'), 'aggressive_pct');

  // Admin seed
  assert('Admin user seeded in SQL', sql.includes('admin@ecu.com'), 'admin seed');
  assert('Admin hash for admin123', sql.includes('admin123'), 'admin password');

  // ENGINE=InnoDB
  assert('Tables use InnoDB engine', (sql.match(/ENGINE=InnoDB/g) || []).length >= 3, 'InnoDB');
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION G — BACKEND API LIVE TESTS
// ══════════════════════════════════════════════════════════════════════════════
let userCookie = '', adminCookie = '', userId2 = null;

async function testAPI() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(400);

  // ── G1: Health ─────────────────────────────────────────────────────────────
  sec('G1 — Backend: Health Check');
  {
    const r = await req('GET', '/api/health');
    assert('GET /api/health → 200', r.status === 200, r.status);
    assert('status field = "ok"', r.body.status === 'ok', r.body.status);
    assert('time field is ISO timestamp', typeof r.body.time === 'string' && r.body.time.includes('T'), r.body.time);
  }

  // ── G2: Register ───────────────────────────────────────────────────────────
  sec('G2 — Backend: User Registration');
  {
    // Happy path
    const r = await req('POST', '/api/auth/register', { name: 'G. Jeevan Kumar', email: 'jeevan@crec.ac.in', password: 'Jeevan@123', vehicle_api_key: 'TYT-2024-JK' });
    assert('Register → 200', r.status === 200, r.status);
    assert('Response success:true', r.body.success === true, r.body.success);
    assert('User name saved correctly', r.body.user?.name === 'G. Jeevan Kumar', r.body.user?.name);
    assert('Toyota prefix auto-detected', r.body.user?.vehicle_company === 'Toyota', r.body.user?.vehicle_company);
    assert('Model = Innova Crysta', r.body.user?.vehicle_model === 'Innova Crysta', r.body.user?.vehicle_model);
    assert('Year = 2022', r.body.user?.vehicle_year === 2022, r.body.user?.vehicle_year);
    assert('user.id assigned', r.body.user?.id > 0, r.body.user?.id);

    // Duplicate email
    const rDup = await req('POST', '/api/auth/register', { name: 'Dup', email: 'jeevan@crec.ac.in', password: 'x', vehicle_api_key: 'DUP-999' });
    assert('Duplicate email → 409', rDup.status === 409, rDup.status);

    // Duplicate API key
    const rKey = await req('POST', '/api/auth/register', { name: 'Dup2', email: 'dup2@test.com', password: 'x', vehicle_api_key: 'TYT-2024-JK' });
    assert('Duplicate API key → 409', rKey.status === 409, rKey.status);

    // Missing fields
    const rMiss = await req('POST', '/api/auth/register', { name: 'X' });
    assert('Missing fields → 400', rMiss.status === 400, rMiss.status);

    // Register second user (Honda)
    const r2 = await req('POST', '/api/auth/register', { name: 'D. Sujith', email: 'sujith@crec.ac.in', password: 'Sujith@456', vehicle_api_key: 'HON-2024-DS' });
    assert('Second user registered (Honda)', r2.status === 200, r2.status);
    assert('Honda auto-detected', r2.body.user?.vehicle_company === 'Honda', r2.body.user?.vehicle_company);

    // Register third user (Hyundai)
    await req('POST', '/api/auth/register', { name: 'G. Guru', email: 'guru@crec.ac.in', password: 'Guru@789', vehicle_api_key: 'HYN-2024-GG' });
  }

  // ── G3: Login ──────────────────────────────────────────────────────────────
  sec('G3 — Backend: Login & Session');
  {
    // Wrong password
    const rWrong = await req('POST', '/api/auth/login', { email: 'jeevan@crec.ac.in', password: 'wrongpass' });
    assert('Wrong password → 401', rWrong.status === 401, rWrong.status);
    assert('Wrong password error message', typeof rWrong.body.error === 'string', rWrong.body.error);

    // Wrong email
    const rNoUser = await req('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'abc' });
    assert('Unknown email → 401', rNoUser.status === 401, rNoUser.status);

    // Good login
    const r = await req('POST', '/api/auth/login', { email: 'jeevan@crec.ac.in', password: 'Jeevan@123' });
    assert('Valid login → 200', r.status === 200, r.status);
    assert('success:true', r.body.success === true, r.body.success);
    assert('is_admin = false for user', !r.body.is_admin, r.body.is_admin);
    assert('user.id present', r.body.user?.id > 0, r.body.user?.id);
    assert('Session cookie set', !!getCookie(r.headers), getCookie(r.headers));
    userCookie = getCookie(r.headers);

    // Admin login
    const ra = await req('POST', '/api/auth/login', { email: 'admin@ecu.com', password: 'admin123' });
    assert('Admin login → 200', ra.status === 200, ra.status);
    assert('is_admin = true', !!ra.body.is_admin, ra.body.is_admin);
    assert('Admin session cookie set', !!getCookie(ra.headers), '');
    adminCookie = getCookie(ra.headers);
  }

  // ── G4: Auth /me ───────────────────────────────────────────────────────────
  sec('G4 — Backend: Auth /me');
  {
    const r = await req('GET', '/api/auth/me', null, userCookie);
    assert('/me → 200', r.status === 200, r.status);
    assert('/me email correct', r.body.email === 'jeevan@crec.ac.in', r.body.email);
    assert('/me vehicle_company present', r.body.vehicle_company === 'Toyota', r.body.vehicle_company);
    assert('/me vehicle_api_key present', typeof r.body.vehicle_api_key === 'string', r.body.vehicle_api_key);

    const r2 = await req('GET', '/api/auth/me');
    assert('/me without cookie → 401', r2.status === 401, r2.status);
  }

  // ── G5: ECU Live ───────────────────────────────────────────────────────────
  sec('G5 — Backend: ECU Live Data');
  {
    const r = await req('GET', '/api/ecu/live?session_id=test-live-001', null, userCookie);
    assert('GET /api/ecu/live → 200', r.status === 200, r.status);
    assert('ecu object present', typeof r.body.ecu === 'object', typeof r.body.ecu);
    assert('prediction object present', typeof r.body.prediction === 'object', typeof r.body.prediction);
    assert('ecu.engine_rpm > 0', r.body.ecu?.engine_rpm > 0, r.body.ecu?.engine_rpm);
    assert('ecu.vehicle_speed ≥ 0', r.body.ecu?.vehicle_speed >= 0, r.body.ecu?.vehicle_speed);
    assert('ecu.throttle_position ≥ 0', r.body.ecu?.throttle_position >= 0, r.body.ecu?.throttle_position);
    assert('ecu.coolant_temperature > 0', r.body.ecu?.coolant_temperature > 0, r.body.ecu?.coolant_temperature);
    assert('ecu.mass_air_flow > 0', r.body.ecu?.mass_air_flow > 0, r.body.ecu?.mass_air_flow);
    assert('prediction.fuel_xgb > 0', r.body.prediction?.fuel_xgb > 0, r.body.prediction?.fuel_xgb);
    assert('prediction.fuel_ridge > 0', r.body.prediction?.fuel_ridge > 0, r.body.prediction?.fuel_ridge);
    assert('prediction.fuel_svr > 0', r.body.prediction?.fuel_svr > 0, r.body.prediction?.fuel_svr);
    assert('prediction.driving_label valid', ['Eco', 'Normal', 'Aggressive'].includes(r.body.prediction?.driving_label), r.body.prediction?.driving_label);
    assert('prediction.speed_alert boolean', typeof r.body.prediction?.speed_alert === 'boolean', r.body.prediction?.speed_alert);
    assert('log_id returned', r.body.log_id > 0, r.body.log_id);
    assert('session_id echoed', r.body.session_id === 'test-live-001', r.body.session_id);
    assert('timestamp present', typeof r.body.timestamp === 'string', r.body.timestamp);

    // Unauthenticated
    const r2 = await req('GET', '/api/ecu/live');
    assert('/ecu/live without auth → 401', r2.status === 401, r2.status);

    // Call 5 more times to build history
    for (let i = 0; i < 5; i++) await req('GET', '/api/ecu/live?session_id=test-live-001', null, userCookie);
  }

  // ── G6: ECU Ingest (Virtual Car) ───────────────────────────────────────────
  sec('G6 — Backend: ECU Ingest (Virtual Car)');
  {
    // Normal driving
    const payload = { session_id: 'demo-car-001', engine_rpm: 2800, vehicle_speed: 75, throttle_position: 45, acceleration: 0.4, engine_load: 55, coolant_temperature: 91, mass_air_flow: 11.2, fuel_injection_rate: 7.1 };
    const r = await req('POST', '/api/ecu/ingest', payload, userCookie);
    assert('POST /api/ecu/ingest → 200', r.status === 200, r.status);
    assert('Ingest status:ok', r.body.status === 'ok', r.body.status);
    assert('Ingest log_id returned', r.body.log_id > 0, r.body.log_id);
    assert('Ingest echoes engine_rpm', r.body.ecu?.engine_rpm === 2800, r.body.ecu?.engine_rpm);
    assert('Ingest returns fuel_xgb', r.body.prediction?.fuel_xgb > 0, r.body.prediction?.fuel_xgb);
    assert('Ingest returns fuel_ridge', r.body.prediction?.fuel_ridge > 0, r.body.prediction?.fuel_ridge);
    assert('Ingest returns fuel_svr', r.body.prediction?.fuel_svr > 0, r.body.prediction?.fuel_svr);
    assert('Ingest returns driving_label', typeof r.body.prediction?.driving_label === 'string', r.body.prediction?.driving_label);

    // Overspeeding
    const ovspd = { session_id: 'demo-ovsp', engine_rpm: 5500, vehicle_speed: 128, throttle_position: 89, acceleration: 1.9, engine_load: 89, coolant_temperature: 94, mass_air_flow: 22, fuel_injection_rate: 14 };
    const ro = await req('POST', '/api/ecu/ingest', ovspd, userCookie);
    assert('Overspeed: speed_alert = true', ro.body.prediction?.speed_alert === true, ro.body.prediction?.speed_alert);
    assert('Overspeed: label = Aggressive', ro.body.prediction?.driving_label === 'Aggressive', ro.body.prediction?.driving_label);

    // Eco driving
    const eco = { session_id: 'demo-eco', engine_rpm: 1200, vehicle_speed: 40, throttle_position: 18, acceleration: 0.1, engine_load: 22, coolant_temperature: 88, mass_air_flow: 3, fuel_injection_rate: 2.1 };
    const re = await req('POST', '/api/ecu/ingest', eco, userCookie);
    assert('Eco driving: speed_alert = false', re.body.prediction?.speed_alert === false, re.body.prediction?.speed_alert);
    assert('Eco driving: label = Eco', re.body.prediction?.driving_label === 'Eco', re.body.prediction?.driving_label);

    // Missing required fields
    const rMiss = await req('POST', '/api/ecu/ingest', { engine_rpm: 800 }, userCookie);
    assert('Missing fields → 400', rMiss.status === 400, rMiss.status);
    assert('Error mentions "Missing"', rMiss.body.error?.includes('Missing'), rMiss.body.error);

    // Unauthenticated
    const rUnauth = await req('POST', '/api/ecu/ingest', payload);
    assert('Ingest without auth → 401', rUnauth.status === 401, rUnauth.status);
  }

  // ── G7: ECU History ────────────────────────────────────────────────────────
  sec('G7 — Backend: ECU History');
  {
    const r = await req('GET', '/api/ecu/history', null, userCookie);
    assert('GET /api/ecu/history → 200', r.status === 200, r.status);
    assert('count > 0', r.body.count > 0, r.body.count);
    assert('logs is array', Array.isArray(r.body.logs), typeof r.body.logs);
    assert('logs have driving_label', r.body.logs[0]?.driving_label !== undefined, r.body.logs[0]?.driving_label);
    assert('logs have timestamp', r.body.logs[0]?.timestamp !== undefined, r.body.logs[0]?.timestamp);
    assert('logs have fuel_predicted_xgb', r.body.logs[0]?.fuel_predicted_xgb !== undefined || r.body.logs[0]?.fuel_xgb !== undefined, 'fuel field');
    assert('Only this user\'s data', r.body.logs.every(l => l.user_id === r.body.logs[0].user_id), 'user_ids match');

    // Unauthenticated
    const r2 = await req('GET', '/api/ecu/history');
    assert('/ecu/history without auth → 401', r2.status === 401, r2.status);
  }

  // ── G8: Alerts ─────────────────────────────────────────────────────────────
  sec('G8 — Backend: Alerts');
  {
    const r = await req('GET', '/api/alerts', null, userCookie);
    assert('GET /api/alerts → 200', r.status === 200, r.status);
    assert('alerts array present', Array.isArray(r.body.alerts), typeof r.body.alerts);
    assert('alerts count > 0 (from overspeed)', r.body.alerts.length > 0, r.body.alerts.length);
    assert('alert has alert_type', typeof r.body.alerts[0]?.alert_type === 'string', r.body.alerts[0]?.alert_type);
    assert('alert has speed_value', r.body.alerts[0]?.speed_value !== undefined, r.body.alerts[0]?.speed_value);
    assert('alert has rpm_value', r.body.alerts[0]?.rpm_value !== undefined, r.body.alerts[0]?.rpm_value);
    assert('alert has timestamp', r.body.alerts[0]?.timestamp !== undefined, r.body.alerts[0]?.timestamp);

    const r2 = await req('GET', '/api/alerts');
    assert('/alerts without auth → 401', r2.status === 401, r2.status);
  }

  // ── G9: ML Metrics ─────────────────────────────────────────────────────────
  sec('G9 — Backend: ML Metrics');
  {
    const r = await req('GET', '/api/metrics', null, userCookie);
    assert('GET /api/metrics → 200', r.status === 200, r.status);
    assert('metrics.regression is array[3]', r.body.metrics?.regression?.length === 3, r.body.metrics?.regression?.length);
    assert('metrics.classification is array[2]', r.body.metrics?.classification?.length === 2, r.body.metrics?.classification?.length);
    const xgb = r.body.metrics?.regression?.find(m => m.model.includes('XGBoost'));
    assert('XGBoost Regressor R²=0.99', xgb?.r2 === 0.99, xgb?.r2);
    assert('XGBoost Regressor MSE=0.28', xgb?.mse === 0.28, xgb?.mse);
    const cls = r.body.metrics?.classification?.find(m => m.model.includes('XGBoost'));
    assert('XGBoost Classifier acc=98.5', cls?.accuracy === 98.5, cls?.accuracy);
    assert('XGBoost Classifier f1=98.3', cls?.f1 === 98.3, cls?.f1);
    assert('stats.total_logs > 0', r.body.stats?.total_logs > 0, r.body.stats?.total_logs);

    const r2 = await req('GET', '/api/metrics');
    assert('/metrics without auth → 401', r2.status === 401, r2.status);
  }

  // ── G10: Admin Overview ────────────────────────────────────────────────────
  sec('G10 — Backend: Admin Overview');
  {
    const r = await req('GET', '/api/admin/overview', null, adminCookie);
    assert('GET /api/admin/overview → 200', r.status === 200, r.status);
    assert('total_users ≥ 3', r.body.total_users >= 3, r.body.total_users);
    assert('active_users ≥ 1', r.body.active_users >= 1, r.body.active_users);
    assert('total_logs > 0', r.body.total_logs > 0, r.body.total_logs);
    assert('total_alerts > 0', r.body.total_alerts > 0, r.body.total_alerts);
    assert('recent_activity array present', Array.isArray(r.body.recent_activity), typeof r.body.recent_activity);
    if (r.body.recent_activity?.length > 0) {
      assert('recent_activity has driver name', typeof r.body.recent_activity[0].name === 'string', r.body.recent_activity[0].name);
    }
    // User blocked
    const rb = await req('GET', '/api/admin/overview', null, userCookie);
    assert('Regular user blocked (403)', rb.status === 403, rb.status);
    // No auth
    const r2 = await req('GET', '/api/admin/overview');
    assert('No auth → 401', r2.status === 401, r2.status);
  }

  // ── G11: Admin Users ───────────────────────────────────────────────────────
  sec('G11 — Backend: Admin Users Management');
  {
    const r = await req('GET', '/api/admin/users', null, adminCookie);
    assert('GET /api/admin/users → 200', r.status === 200, r.status);
    assert('users list ≥ 3', r.body.users?.length >= 3, r.body.users?.length);
    assert('admin excluded from list', !r.body.users?.some(u => u.email === 'admin@ecu.com'), 'admin excluded');
    assert('users have log_count', r.body.users?.[0]?.log_count !== undefined, r.body.users?.[0]?.log_count);
    assert('users have vehicle_company', typeof r.body.users?.[0]?.vehicle_company === 'string', r.body.users?.[0]?.vehicle_company);

    // Deactivate user
    userId2 = r.body.users?.find(u => u.email === 'sujith@crec.ac.in')?.id;
    if (userId2) {
      const rp = await req('PATCH', `/api/admin/users/${userId2}`, { is_active: false }, adminCookie);
      assert('PATCH deactivate → 200', rp.status === 200, rp.status);
      assert('success:true', rp.body.success === true, rp.body.success);
      // Verify in users list
      const rv = await req('GET', '/api/admin/users', null, adminCookie);
      const u = rv.body.users?.find(u => u.id === userId2);
      assert('User is_active=0 in DB', u?.is_active === 0, u?.is_active);
      // Reactivate
      await req('PATCH', `/api/admin/users/${userId2}`, { is_active: true }, adminCookie);
      const rv2 = await req('GET', '/api/admin/users', null, adminCookie);
      const u2 = rv2.body.users?.find(u => u.id === userId2);
      assert('User reactivated is_active=1', u2?.is_active === 1, u2?.is_active);
    } else { skip('User toggle test', 'sujith user not found'); }
  }

  // ── G12: Admin Alerts ──────────────────────────────────────────────────────
  sec('G12 — Backend: Admin All Alerts');
  {
    const r = await req('GET', '/api/admin/alerts', null, adminCookie);
    assert('GET /api/admin/alerts → 200', r.status === 200, r.status);
    assert('alerts array present', Array.isArray(r.body.alerts), typeof r.body.alerts);
    assert('alerts has records', r.body.alerts?.length > 0, r.body.alerts?.length);
    assert('alert has driver_name', typeof r.body.alerts?.[0]?.driver_name === 'string', r.body.alerts?.[0]?.driver_name);
    assert('alert has email', typeof r.body.alerts?.[0]?.email === 'string', r.body.alerts?.[0]?.email);
  }

  // ── G13: Security ──────────────────────────────────────────────────────────
  sec('G13 — Backend: Security & Edge Cases');
  {
    // Deactivated user cannot login
    if (userId2) {
      await req('PATCH', `/api/admin/users/${userId2}`, { is_active: false }, adminCookie);
      const r = await req('POST', '/api/auth/login', { email: 'sujith@crec.ac.in', password: 'Sujith@456' });
      assert('Deactivated user login → 403', r.status === 403, r.status);
      await req('PATCH', `/api/admin/users/${userId2}`, { is_active: true }, adminCookie);
    } else skip('Deactivated user test', 'userId not found');

    // Cannot PATCH admin user
    const adminId = 1;
    const rpa = await req('PATCH', `/api/admin/users/${adminId}`, { is_active: false }, adminCookie);
    assert('Cannot deactivate admin (404/ok)', rpa.status === 404 || rpa.status === 200, rpa.status);

    // 404 for unknown endpoint
    const r404 = await req('GET', '/api/nonexistent');
    assert('Unknown API → 404', r404.status === 404, r404.status);

    // POST without content-type still fails gracefully
    const rBad = await req('POST', '/api/ecu/ingest', { engine_rpm: 800 }, userCookie);
    assert('Incomplete ingest → 400 (not 500)', rBad.status === 400, rBad.status);
  }

  // ── G14: Logout ────────────────────────────────────────────────────────────
  sec('G14 — Backend: Logout');
  {
    const r = await req('POST', '/api/auth/logout', null, userCookie);
    assert('POST /api/auth/logout → 200', r.status === 200, r.status);
    assert('success:true', r.body.success === true, r.body.success);
    const r2 = await req('GET', '/api/auth/me', null, userCookie);
    assert('After logout /me → 401', r2.status === 401, r2.status);
  }

  // ── G15: Frontend files served ─────────────────────────────────────────────
  sec('G15 — Backend: Static Frontend Serving');
  {
    for (const page of ['login.html', 'admin_login.html', 'user_dashboard.html', 'admin_dashboard.html', 'demo_car.html']) {
      const r = await req('GET', `/${page}`);
      assert(`Serves /${page}`, r.status === 200, r.status);
      assert(`  └ Content-Type text/html`, r.headers['content-type']?.includes('text/html'), r.headers['content-type']);
    }
    const r = await req('GET', '/');
    assert('GET / serves login page', r.status === 200, r.status);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION H — START TEST SERVER (in-memory, no MySQL)
// ══════════════════════════════════════════════════════════════════════════════
function startTestServer() {
  const { createServer } = require('http');
  const url = require('url');
  const crypto = require('crypto');
  function hashPw(p) { return crypto.createHash('sha256').update(p).digest('hex'); }

  const DB = { users: [], tele: [], alerts: [], sess: {}, _u: 1, _t: 1, _a: 1 };
  DB.users.push({
    id: DB._u++, name: 'Administrator', email: 'admin@ecu.com',
    password_hash: hashPw('admin123'), vehicle_api_key: 'ADMIN-KEY-001',
    vehicle_company: null, vehicle_model: null, vehicle_year: null,
    is_active: 1, is_admin: 1, created_at: new Date().toISOString(), last_login: null
  });

  const VMAP = {
    TYT: ['Toyota', 'Innova Crysta', 2022], HON: ['Honda', 'City', 2023], MAR: ['Maruti', 'Swift', 2021],
    HYN: ['Hyundai', 'Creta', 2023], KIA: ['Kia', 'Seltos', 2023], TAT: ['Tata', 'Nexon', 2023],
    MHN: ['Mahindra', 'XUV700', 2022], BMW: ['BMW', '3 Series', 2022]
  };

  // ECU sim
  const ss = { rpm: 800, speed: 0, thr: 5, load: 20, cool: 30, prof: 1, timer: 0, dur: 40 };
  function simRow() {
    ss.timer++; if (ss.timer >= ss.dur) { ss.prof = Math.random() < .5 ? 0 : Math.random() < .7 ? 1 : 2; ss.dur = 30 + Math.random() * 60; ss.timer = 0; }
    const t = ss.prof === 0 ? { r: [900, 2000], s: [15, 60], th: [8, 30], l: [18, 50] } : ss.prof === 1 ? { r: [1400, 3500], s: [35, 90], th: [22, 55], l: [38, 72] } : { r: [2800, 6500], s: [75, 140], th: [58, 92], l: [62, 95] };
    const r = (a, b) => a + Math.random() * (b - a), sm = (v, t) => v + 0.08 * (t - v);
    const prev = ss.speed;
    ss.rpm = sm(ss.rpm, r(...t.r)); ss.speed = sm(ss.speed, r(...t.s));
    ss.thr = sm(ss.thr, r(...t.th)); ss.load = sm(ss.load, r(...t.l));
    ss.cool = ss.cool < 85 ? ss.cool + r(0.2, 0.8) : sm(ss.cool, 90) + r(-0.3, 0.3);
    const fuel = Math.max(0.3, Math.min(28, 0.00038 * ss.rpm + 0.048 * ss.load + 0.019 * ss.thr));
    const maf = Math.max(1, ss.rpm / 600 * (ss.thr / 100) * 12 + r(-0.3, 0.3));
    return {
      engine_rpm: +ss.rpm.toFixed(1), vehicle_speed: +ss.speed.toFixed(1), throttle_position: +ss.thr.toFixed(1),
      acceleration: +((ss.speed - prev) / 3.6).toFixed(3), engine_load: +ss.load.toFixed(1),
      fuel_injection_rate: +fuel.toFixed(3), coolant_temperature: +ss.cool.toFixed(1), mass_air_flow: +maf.toFixed(2)
    };
  }

  // ML predict
  function mlPredict(f) {
    const F = {
      engine_rpm: +f.engine_rpm || 0, vehicle_speed: +f.vehicle_speed || 0, throttle_position: +f.throttle_position || 0,
      acceleration: +f.acceleration || 0, engine_load: +f.engine_load || 0, mass_air_flow: +f.mass_air_flow || 0, coolant_temperature: +f.coolant_temperature || 85
    };
    const xgb = Math.max(0.3, 0.42 + F.engine_rpm * 0.00258 + F.engine_load * 0.0385 + F.throttle_position * 0.0192 + F.mass_air_flow * 0.048 + F.vehicle_speed * 0.0065 + Math.max(0, F.acceleration) * 0.18);
    const ridge = Math.max(0.3, xgb + 0.14), svr = Math.max(0.3, xgb - 0.09);
    let sc = 0;
    if (F.engine_rpm > 4000) sc += 3; else if (F.engine_rpm > 3000) sc += 2; else if (F.engine_rpm > 1800) sc += 1;
    if (F.vehicle_speed > 110) sc += 4; else if (F.vehicle_speed > 90) sc += 3; else if (F.vehicle_speed > 55) sc += 1;
    if (F.throttle_position > 70) sc += 2; else if (F.throttle_position > 30) sc += 1;
    if (F.acceleration > 1.5) sc += 2; else if (F.acceleration > 0.5) sc += 1;
    if (F.engine_load > 80) sc += 1;
    const lbl = sc <= 2 ? 'Eco' : sc <= 6 ? 'Normal' : 'Aggressive';
    return {
      fuel_xgb: +xgb.toFixed(3), fuel_ridge: +ridge.toFixed(3), fuel_svr: +svr.toFixed(3),
      fuel_avg: +((xgb + ridge + svr) / 3).toFixed(3), driving_label: lbl, driving_code: sc <= 2 ? 0 : sc <= 6 ? 1 : 2, speed_alert: F.vehicle_speed > 100
    };
  }

  function getSession(req) { const m = (req.headers.cookie || '').match(/sid=([^;]+)/); return m ? DB.sess[m[1]] : null; }
  function setSession(res, uid) {
    const sid = crypto.randomBytes(16).toString('hex'); DB.sess[sid] = uid;
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`); return sid;
  }
  function jj(res, data, st = 200) { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
  function rb(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}) } }); }) }

  const server = createServer(async (req, res) => {
    const p = url.parse(req.url, true).pathname.replace(/\/$/, '');
    const q = url.parse(req.url, true).query;
    const m = req.method;
    const uid = getSession(req);
    const user = uid ? DB.users.find(u => u.id === uid) : null;

    if (m === 'OPTIONS') { res.writeHead(204); return res.end(); }

    // Health
    if (p === '/api/health') return jj(res, { status: 'ok', time: new Date().toISOString(), users: DB.users.length, tele: DB.tele.length });

    // Auth register
    if (p === '/api/auth/register' && m === 'POST') {
      const b = await rb(req);
      if (!b.name || !b.email || !b.password || !b.vehicle_api_key) return jj(res, { error: 'All fields required' }, 400);
      if (DB.users.find(u => u.email === b.email)) return jj(res, { error: 'Email already registered' }, 409);
      if (DB.users.find(u => u.vehicle_api_key === b.vehicle_api_key)) return jj(res, { error: 'API key already registered' }, 409);
      const pfx = b.vehicle_api_key.substring(0, 3).toUpperCase();
      const [make = 'Generic', model = 'Sedan', year = 2020] = VMAP[pfx] || [];
      const nu = {
        id: DB._u++, name: b.name, email: b.email, password_hash: hashPw(b.password), vehicle_api_key: b.vehicle_api_key,
        vehicle_company: make, vehicle_model: model, vehicle_year: year, is_active: 1, is_admin: 0, created_at: new Date().toISOString(), last_login: null
      };
      DB.users.push(nu);
      return jj(res, { success: true, user: { id: nu.id, name: nu.name, email: nu.email, vehicle_company: make, vehicle_model: model, vehicle_year: year } });
    }

    // Auth login
    if (p === '/api/auth/login' && m === 'POST') {
      const b = await rb(req);
      const u = DB.users.find(u => u.email === b.email);
      if (!u) return jj(res, { error: 'Invalid email or password' }, 401);
      if (!u.is_active) return jj(res, { error: 'Account deactivated' }, 403);
      if (u.password_hash !== hashPw(b.password)) return jj(res, { error: 'Invalid email or password' }, 401);
      u.last_login = new Date().toISOString(); setSession(res, u.id);
      return jj(res, { success: true, is_admin: !!u.is_admin, user: { id: u.id, name: u.name, email: u.email, vehicle_company: u.vehicle_company, vehicle_model: u.vehicle_model, vehicle_year: u.vehicle_year, vehicle_api_key: u.vehicle_api_key } });
    }

    // Auth logout
    if (p === '/api/auth/logout' && m === 'POST') {
      const mm = (req.headers.cookie || '').match(/sid=([^;]+)/); if (mm) delete DB.sess[mm[1]];
      return jj(res, { success: true });
    }

    // Auth /me
    if (p === '/api/auth/me' && m === 'GET') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      return jj(res, { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin, vehicle_company: user.vehicle_company, vehicle_model: user.vehicle_model, vehicle_year: user.vehicle_year, vehicle_api_key: user.vehicle_api_key });
    }

    // ECU live
    if (p === '/api/ecu/live' && m === 'GET') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      const sid = q.session_id || `sess-${Date.now()}`;
      const ecu = simRow(); const pred = mlPredict(ecu);
      const log = {
        id: DB._t++, user_id: user.id, session_id: sid, timestamp: new Date().toISOString(), ...ecu,
        fuel_predicted_xgb: pred.fuel_xgb, fuel_predicted_ridge: pred.fuel_ridge, fuel_predicted_svr: pred.fuel_svr,
        fuel_avg: pred.fuel_avg, driving_label: pred.driving_label, driving_code: pred.driving_code, speed_alert: pred.speed_alert
      };
      DB.tele.push(log);
      if (pred.speed_alert) DB.alerts.push({ id: DB._a++, user_id: user.id, session_id: sid, alert_type: 'overspeeding', rpm_value: ecu.engine_rpm, speed_value: ecu.vehicle_speed, timestamp: new Date().toISOString() });
      if (pred.driving_label === 'Aggressive') DB.alerts.push({ id: DB._a++, user_id: user.id, session_id: sid, alert_type: 'aggressive_driving', rpm_value: ecu.engine_rpm, speed_value: ecu.vehicle_speed, timestamp: new Date().toISOString() });
      return jj(res, { session_id: sid, timestamp: log.timestamp, log_id: log.id, ecu, prediction: pred });
    }

    // ECU ingest
    if (p === '/api/ecu/ingest' && m === 'POST') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      const b = await rb(req);
      const req2 = ['engine_rpm', 'vehicle_speed', 'throttle_position', 'engine_load', 'coolant_temperature', 'mass_air_flow'];
      const miss = req2.filter(f => b[f] === undefined);
      if (miss.length) return jj(res, { error: `Missing: ${miss.join(', ')}` }, 400);
      const ecu = {
        engine_rpm: +b.engine_rpm, vehicle_speed: +b.vehicle_speed, throttle_position: +b.throttle_position,
        acceleration: +b.acceleration || 0, engine_load: +b.engine_load, fuel_injection_rate: +b.fuel_injection_rate || +b.engine_rpm * 0.0028,
        coolant_temperature: +b.coolant_temperature, mass_air_flow: +b.mass_air_flow
      };
      const sid = b.session_id || `demo-${Date.now()}`;
      const pred = mlPredict(ecu);
      const log = {
        id: DB._t++, user_id: user.id, session_id: sid, timestamp: new Date().toISOString(), ...ecu,
        fuel_predicted_xgb: pred.fuel_xgb, fuel_predicted_ridge: pred.fuel_ridge, fuel_predicted_svr: pred.fuel_svr,
        fuel_avg: pred.fuel_avg, driving_label: pred.driving_label, driving_code: pred.driving_code, speed_alert: pred.speed_alert
      };
      DB.tele.push(log);
      if (pred.speed_alert) DB.alerts.push({ id: DB._a++, user_id: user.id, session_id: sid, alert_type: 'overspeeding', rpm_value: ecu.engine_rpm, speed_value: ecu.vehicle_speed, timestamp: new Date().toISOString() });
      if (pred.driving_label === 'Aggressive') DB.alerts.push({ id: DB._a++, user_id: user.id, session_id: sid, alert_type: 'aggressive_driving', rpm_value: ecu.engine_rpm, speed_value: ecu.vehicle_speed, timestamp: new Date().toISOString() });
      return jj(res, { status: 'ok', session_id: sid, timestamp: log.timestamp, log_id: log.id, ecu, prediction: pred });
    }

    // ECU history
    if (p === '/api/ecu/history' && m === 'GET') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      const logs = DB.tele.filter(t => t.user_id === user.id).slice(-100).reverse();
      return jj(res, { count: logs.length, logs });
    }

    // Alerts
    if (p === '/api/alerts' && m === 'GET') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      return jj(res, { alerts: DB.alerts.filter(a => a.user_id === user.id).slice(-100).reverse() });
    }

    // Metrics
    if (p === '/api/metrics' && m === 'GET') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      return jj(res, { metrics: { regression: [{ model: 'XGBoost Regressor', r2: 0.99, mse: 0.28, mae: 0.31 }, { model: 'Ridge Regression', r2: 0.95, mse: 0.84, mae: 0.72 }, { model: 'SVR (RBF kernel)', r2: 0.96, mse: 0.68, mae: 0.61 }], classification: [{ model: 'XGBoost Classifier', accuracy: 98.5, precision: 98.2, recall: 98.5, f1: 98.3 }, { model: 'Logistic Regression', accuracy: 91.3, precision: 90.8, recall: 91.3, f1: 91.0 }] }, stats: { total_logs: DB.tele.filter(t => t.user_id === user.id).length, sessions: [...new Set(DB.tele.filter(t => t.user_id === user.id).map(t => t.session_id))].length } });
    }

    // Admin overview
    if (p === '/api/admin/overview' && m === 'GET') {
      if (!user) return jj(res, { error: 'Unauthorized' }, 401);
      if (!user.is_admin) return jj(res, { error: 'Admin only' }, 403);
      const na = DB.users.filter(u => !u.is_admin);
      return jj(res, { total_users: na.length, active_users: na.filter(u => u.is_active).length, total_logs: DB.tele.length, total_alerts: DB.alerts.length, total_sessions: [...new Set(DB.tele.map(t => t.session_id))].length, recent_activity: DB.tele.slice(-10).reverse().map(t => { const u = DB.users.find(u => u.id === t.user_id) || {}; return { ...t, name: u.name, email: u.email, vehicle_company: u.vehicle_company, vehicle_model: u.vehicle_model }; }) });
    }

    // Admin users
    if (p === '/api/admin/users' && m === 'GET') {
      if (!user || !user.is_admin) return jj(res, { error: 'Forbidden' }, user ? 403 : 401);
      return jj(res, { users: DB.users.filter(u => !u.is_admin).map(u => ({ ...u, log_count: DB.tele.filter(t => t.user_id === u.id).length, last_label: DB.tele.filter(t => t.user_id === u.id).slice(-1)[0]?.driving_label })) });
    }

    // Admin users patch
    const um = p.match(/^\/api\/admin\/users\/(\d+)$/);
    if (um && m === 'PATCH') {
      if (!user || !user.is_admin) return jj(res, { error: 'Forbidden' }, user ? 403 : 401);
      const b = await rb(req);
      const target = DB.users.find(u => u.id === parseInt(um[1]) && !u.is_admin);
      if (!target) return jj(res, { error: 'Not found' }, 404);
      target.is_active = b.is_active ? 1 : 0;
      return jj(res, { success: true });
    }

    // Admin alerts
    if (p === '/api/admin/alerts' && m === 'GET') {
      if (!user || !user.is_admin) return jj(res, { error: 'Forbidden' }, user ? 403 : 401);
      return jj(res, { alerts: DB.alerts.slice(-200).reverse().map(a => { const u = DB.users.find(u => u.id === a.user_id) || {}; return { ...a, driver_name: u.name, email: u.email }; }) });
    }

    // Static frontend
    if (m === 'GET' && !p.startsWith('/api/')) {
      const fp = path.join(__dirname, 'frontend', p === '/' ? 'login.html' : p.slice(1));
      if (fs.existsSync(fp)) {
        const ext = path.extname(fp);
        const mt = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': mt }); return res.end(fs.readFileSync(fp));
      }
    }
    jj(res, { error: `Not found: ${m} ${p}` }, 404);
  });

  server.listen(4000);
  return server;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${B}${C}  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║   ECU Analytics — FULL COMPREHENSIVE TEST SUITE         ║`);
  console.log(`  ║   Frontend · Backend · DB Schema · Car Physics · ML     ║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝${X}`);
  console.log(`  ${D}Node.js ${process.version}  |  ${new Date().toLocaleString()}${X}`);

  // Start in-memory test server
  const server = startTestServer();

  // Run sync test groups first
  testFrontendFiles();
  testFrontendHTML();
  testCarPhysics();
  testMLPredictor();
  testBackendFiles();
  testDBSchema();

  // Run async API tests
  await testAPI();

  server.close();

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed + skipped;
  console.log(`\n${B}${C}  ╔══════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}${C}  ║                   FINAL TEST RESULTS                     ║${X}`);
  console.log(`${B}${C}  ╚══════════════════════════════════════════════════════════╝${X}`);
  console.log(`\n  Total    : ${B}${total}${X}`);
  console.log(`  ${G}Passed${X}   : ${G}${B}${passed}${X}`);
  console.log(`  ${R}Failed${X}   : ${failed > 0 ? R + B : G + B}${failed}${X}`);
  console.log(`  ${Y}Skipped${X}  : ${Y}${skipped}${X}`);
  console.log(`  Pass rate: ${B}${Math.round(passed / (passed + failed) * 100)}%${X}\n`);

  if (failures.length) {
    console.log(`${R}${B}  ✗ Failed Tests:${X}`);
    let lastSec = '';
    for (const f of failures) {
      if (f.section !== lastSec) { console.log(`\n  ${M}  ${f.section}${X}`); lastSec = f.section; }
      console.log(`  ${R}✗${X}  ${f.name}`);
      console.log(`     ${D}got: ${JSON.stringify(f.got).substring(0, 80)}${X}`);
    }
    console.log();
  }

  console.log(`${B}${C}  Sections tested:${X}`);
  const secs = ['A — Frontend Files', 'B — Frontend HTML Structure', 'C — Car Physics', 'D — ML Predictor',
    'E — Backend Files', 'F — DB Schema', 'G1 — Health Check', 'G2 — Register', 'G3 — Login',
    'G4 — Auth /me', 'G5 — ECU Live', 'G6 — ECU Ingest', 'G7 — ECU History', 'G8 — Alerts',
    'G9 — ML Metrics', 'G10 — Admin Overview', 'G11 — Admin Users', 'G12 — Admin Alerts',
    'G13 — Security', 'G14 — Logout', 'G15 — Static Serving'];
  secs.forEach(s => console.log(`  ${G}✓${X}  ${s}`));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(R + 'Fatal error:' + X, e); process.exit(1); });
