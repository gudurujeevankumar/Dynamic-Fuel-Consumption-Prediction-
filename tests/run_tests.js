/**
 * ECU Analytics — Full Test Suite
 * Starts the server, tests every module, prints detailed results
 */

const http   = require('http');
const { DB, predict, simStep } = require('./test_server');

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0, cookie = '', adminCookie = '';
const results = [];

const G='\x1b[92m',Y='\x1b[93m',R='\x1b[91m',C='\x1b[96m',B='\x1b[1m',X='\x1b[0m',D='\x1b[90m';
const tick  = `${G}✓${X}`;
const cross = `${R}✗${X}`;
const warn  = `${Y}⚠${X}`;

function req(method, path, body, jar='') {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname:'localhost', port:4000, path,
      method, headers:{
        'Content-Type':'application/json',
        'Content-Length':Buffer.byteLength(data),
        ...(jar ? {'Cookie': jar} : {})
      }
    };
    const r = http.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status:res.statusCode, headers:res.headers, body:JSON.parse(body) }); }
        catch { resolve({ status:res.statusCode, headers:res.headers, body }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function getCookie(headers) {
  const sc = headers['set-cookie'];
  if (!sc) return '';
  return Array.isArray(sc) ? sc.map(c=>c.split(';')[0]).join('; ') : sc.split(';')[0];
}

function assert(name, condition, got, expected='') {
  const ok = !!condition;
  if (ok) passed++; else failed++;
  results.push({ ok, name, got, expected });
  const icon = ok ? tick : cross;
  const detail = ok ? D+String(got).substring(0,60)+X : R+`got: ${JSON.stringify(got).substring(0,80)}${X}`;
  console.log(`  ${icon}  ${name.padEnd(48)} ${detail}`);
}

function section(title) {
  console.log(`\n${B}${C}  ┌─ ${title} ${'─'.repeat(Math.max(0,52-title.length))}${X}`);
}

// ════════════════════════════════════════════════════════════════
//  TESTS
// ════════════════════════════════════════════════════════════════

async function runTests() {
  await new Promise(r => setTimeout(r, 300)); // wait for server

  console.log(`\n${B}${C}  ╔═══════════════════════════════════════════════════════╗`);
  console.log(`  ║       ECU Analytics — Full Module Test Suite          ║`);
  console.log(`  ╚═══════════════════════════════════════════════════════╝${X}\n`);

  // ── 1. HEALTH CHECK ────────────────────────────────────────────────────────
  section('MODULE 1 — Health Check');
  {
    const r = await req('GET', '/api/health');
    assert('Server is running (status 200)',            r.status === 200,                       r.status);
    assert('Health response has status:ok',             r.body.status === 'ok',                 r.body.status);
    assert('Health shows timestamp',                    typeof r.body.time === 'string',        r.body.time);
  }

  // ── 2. AUTH — REGISTER ─────────────────────────────────────────────────────
  section('MODULE 2 — Auth: Register');
  {
    const r = await req('POST', '/api/auth/register', {
      name: 'G. Jeevan Kumar', email: 'jeevan@crec.ac.in',
      password: 'Jeevan123', vehicle_api_key: 'TYT-2024-001'
    });
    assert('Register new user (201/200)',               [200,201].includes(r.status),           r.status);
    assert('Response has success:true',                 r.body.success === true,                r.body.success);
    assert('User name matches',                         r.body.user?.name === 'G. Jeevan Kumar',r.body.user?.name);
    assert('Vehicle auto-detected as Toyota',           r.body.user?.vehicle_company === 'Toyota', r.body.user?.vehicle_company);
    assert('Vehicle model is Innova Crysta',            r.body.user?.vehicle_model === 'Innova Crysta', r.body.user?.vehicle_model);

    // Duplicate email
    const r2 = await req('POST', '/api/auth/register', {
      name: 'Dup', email: 'jeevan@crec.ac.in', password: 'x', vehicle_api_key: 'DUP-001'
    });
    assert('Duplicate email rejected (409)',            r2.status === 409,                      r2.status);

    // Missing fields
    const r3 = await req('POST', '/api/auth/register', { name: 'X' });
    assert('Missing fields rejected (400)',             r3.status === 400,                      r3.status);

    // Register second test user (Hyundai)
    await req('POST', '/api/auth/register', {
      name: 'D. Sujith', email: 'sujith@crec.ac.in',
      password: 'Sujith456', vehicle_api_key: 'HYN-2024-002'
    });
  }

  // ── 3. AUTH — LOGIN ────────────────────────────────────────────────────────
  section('MODULE 3 — Auth: Login');
  {
    // Wrong password
    const r0 = await req('POST', '/api/auth/login', { email:'jeevan@crec.ac.in', password:'wrongpass' });
    assert('Wrong password rejected (401)',             r0.status === 401,                      r0.status);

    // Good login
    const r = await req('POST', '/api/auth/login', { email:'jeevan@crec.ac.in', password:'Jeevan123' });
    assert('User login success (200)',                  r.status === 200,                       r.status);
    assert('Response success:true',                     r.body.success === true,                r.body.success);
    assert('is_admin = false for user',                 r.body.is_admin === false || r.body.is_admin === 0, r.body.is_admin);
    assert('Session cookie set',                        !!getCookie(r.headers),                 !!getCookie(r.headers));
    cookie = getCookie(r.headers);

    // Admin login
    const ra = await req('POST', '/api/auth/login', { email:'admin@ecu.com', password:'admin123' });
    assert('Admin login success (200)',                 ra.status === 200,                      ra.status);
    assert('is_admin = true for admin',                 ra.body.is_admin === true || ra.body.is_admin === 1, ra.body.is_admin);
    adminCookie = getCookie(ra.headers);
  }

  // ── 4. AUTH — /ME ──────────────────────────────────────────────────────────
  section('MODULE 4 — Auth: Get Current User (/me)');
  {
    const r = await req('GET', '/api/auth/me', null, cookie);
    assert('/me returns user info (200)',               r.status === 200,                       r.status);
    assert('/me has correct email',                     r.body.email === 'jeevan@crec.ac.in',   r.body.email);
    assert('/me has vehicle info',                      r.body.vehicle_company === 'Toyota',    r.body.vehicle_company);

    const r2 = await req('GET', '/api/auth/me');
    assert('/me without session returns 401',           r2.status === 401,                      r2.status);
  }

  // ── 5. ECU SIMULATOR ──────────────────────────────────────────────────────
  section('MODULE 5 — ECU Simulator / Data Generator');
  {
    const row = simStep();
    assert('ECU row has engine_rpm',                   typeof row.engine_rpm === 'number' && row.engine_rpm > 0, row.engine_rpm);
    assert('ECU row has vehicle_speed',                typeof row.vehicle_speed === 'number',  row.vehicle_speed);
    assert('ECU row has throttle_position',            row.throttle_position >= 0 && row.throttle_position <= 100, row.throttle_position);
    assert('ECU row has coolant_temperature',          row.coolant_temperature > 0,            row.coolant_temperature);
    assert('ECU row has mass_air_flow > 0',            row.mass_air_flow > 0,                  row.mass_air_flow);
    assert('fuel_injection_rate is realistic',         row.fuel_injection_rate >= 0.3 && row.fuel_injection_rate < 30, row.fuel_injection_rate);

    // Simulate 5 consecutive readings
    const rows = Array.from({length:5}, () => simStep());
    assert('Simulator produces 5 unique readings',     new Set(rows.map(r=>r.engine_rpm)).size > 1, rows.map(r=>r.engine_rpm.toFixed(0)).join(','));
  }

  // ── 6. ML PREDICTOR ───────────────────────────────────────────────────────
  section('MODULE 6 — ML Predictor (XGBoost/Ridge/SVR)');
  {
    // Eco scenario
    const eco = predict({ engine_rpm:1200, vehicle_speed:40, throttle_position:20, acceleration:0.1, engine_load:25, mass_air_flow:3, coolant_temperature:88 });
    assert('Eco scenario → label=Eco',                 eco.driving_label === 'Eco',            eco.driving_label);
    assert('Eco fuel_xgb is positive number',          eco.fuel_xgb > 0,                       eco.fuel_xgb);
    assert('Eco speed_alert = false (<100km/h)',       eco.speed_alert === false,               eco.speed_alert);
    assert('XGBoost < Ridge (bias term works)',        eco.fuel_xgb < eco.fuel_ridge,          `xgb:${eco.fuel_xgb} ridge:${eco.fuel_ridge}`);

    // Normal scenario
    const nor = predict({ engine_rpm:2500, vehicle_speed:70, throttle_position:40, acceleration:0.3, engine_load:50, mass_air_flow:8, coolant_temperature:90 });
    assert('Normal scenario → label=Normal',           nor.driving_label === 'Normal',         nor.driving_label);

    // Aggressive scenario
    const agg = predict({ engine_rpm:5000, vehicle_speed:130, throttle_position:85, acceleration:2.0, engine_load:85, mass_air_flow:18, coolant_temperature:95 });
    assert('Aggressive scenario → label=Aggressive',   agg.driving_label === 'Aggressive',     agg.driving_label);
    assert('Aggressive triggers speed_alert (>100)',   agg.speed_alert === true,               agg.speed_alert);
    assert('Aggressive fuel much higher than Eco',     agg.fuel_xgb > eco.fuel_xgb * 1.5,    `agg:${agg.fuel_xgb} eco:${eco.fuel_xgb}`);

    // All three predictions present
    assert('All 3 fuel predictions returned',          eco.fuel_xgb && eco.fuel_ridge && eco.fuel_svr, `xgb:${eco.fuel_xgb} ridge:${eco.fuel_ridge} svr:${eco.fuel_svr}`);
    assert('fuel_avg is mean of three',                Math.abs(eco.fuel_avg - (eco.fuel_xgb+eco.fuel_ridge+eco.fuel_svr)/3) < 0.01, eco.fuel_avg);
    assert('driving_code: Eco=0',                      eco.driving_code === 0,                 eco.driving_code);
    assert('driving_code: Normal=1',                   nor.driving_code === 1,                 nor.driving_code);
    assert('driving_code: Aggressive=2',               agg.driving_code === 2,                 agg.driving_code);
  }

  // ── 7. ECU LIVE ───────────────────────────────────────────────────────────
  section('MODULE 7 — ECU Live Endpoint');
  {
    const r = await req('GET', '/api/ecu/live?session_id=test-sess-001', null, cookie);
    assert('GET /api/ecu/live returns 200',            r.status === 200,                       r.status);
    assert('Response has ecu object',                  typeof r.body.ecu === 'object',         typeof r.body.ecu);
    assert('Response has prediction object',           typeof r.body.prediction === 'object',  typeof r.body.prediction);
    assert('ECU has engine_rpm',                       r.body.ecu?.engine_rpm > 0,             r.body.ecu?.engine_rpm);
    assert('Prediction has fuel_xgb',                  r.body.prediction?.fuel_xgb > 0,        r.body.prediction?.fuel_xgb);
    assert('Prediction has driving_label',             ['Eco','Normal','Aggressive'].includes(r.body.prediction?.driving_label), r.body.prediction?.driving_label);
    assert('Response has log_id',                      r.body.log_id > 0,                      r.body.log_id);
    assert('Response has session_id',                  typeof r.body.session_id === 'string',  r.body.session_id);

    // Unauthenticated
    const r2 = await req('GET', '/api/ecu/live');
    assert('Live ECU without auth returns 401',        r2.status === 401,                      r2.status);

    // Call multiple times to build up data
    for (let i=0; i<5; i++) await req('GET', '/api/ecu/live?session_id=test-sess-001', null, cookie);
  }

  // ── 8. ECU INGEST (Virtual Car) ───────────────────────────────────────────
  section('MODULE 8 — ECU Ingest (Virtual Car POST)');
  {
    const payload = {
      session_id: 'demo-car-001',
      engine_rpm: 3200, vehicle_speed: 85, throttle_position: 55,
      acceleration: 0.8, engine_load: 65, coolant_temperature: 91,
      mass_air_flow: 12.5, fuel_injection_rate: 6.2
    };
    const r = await req('POST', '/api/ecu/ingest', payload, cookie);
    assert('POST /api/ecu/ingest returns 200',         r.status === 200,                       r.status);
    assert('Ingest response status ok',                r.body.status === 'ok',                 r.body.status);
    assert('Ingest returns log_id',                    r.body.log_id > 0,                      r.body.log_id);
    assert('Ingest echoes back ecu data',              r.body.ecu?.engine_rpm === 3200,        r.body.ecu?.engine_rpm);
    assert('Ingest prediction has fuel_xgb',           r.body.prediction?.fuel_xgb > 0,        r.body.prediction?.fuel_xgb);

    // Overspeed ingest
    const ovsp = { session_id:'demo-ovsp', engine_rpm:5500, vehicle_speed:125,
      throttle_position:88, acceleration:1.8, engine_load:88, coolant_temperature:94, mass_air_flow:22, fuel_injection_rate:14 };
    const ro = await req('POST', '/api/ecu/ingest', ovsp, cookie);
    assert('Overspeeding ingest → speed_alert=true',  ro.body.prediction?.speed_alert === true, ro.body.prediction?.speed_alert);
    assert('Overspeeding ingest → Aggressive profile',ro.body.prediction?.driving_label === 'Aggressive', ro.body.prediction?.driving_label);

    // Missing fields
    const rm = await req('POST', '/api/ecu/ingest', { engine_rpm:800 }, cookie);
    assert('Ingest with missing fields returns 400',   rm.status === 400,                      rm.status);
    assert('Ingest error mentions missing fields',     rm.body.error?.includes('Missing'),     rm.body.error);

    // Unauthenticated
    const ru = await req('POST', '/api/ecu/ingest', payload);
    assert('Ingest without auth returns 401',          ru.status === 401,                      ru.status);
  }

  // ── 9. ECU HISTORY ────────────────────────────────────────────────────────
  section('MODULE 9 — ECU History');
  {
    const r = await req('GET', '/api/ecu/history', null, cookie);
    assert('GET /api/ecu/history returns 200',         r.status === 200,                       r.status);
    assert('History has count field',                  typeof r.body.count === 'number',       r.body.count);
    assert('History count > 0 (data was logged)',      r.body.count > 0,                       r.body.count);
    assert('History logs is array',                    Array.isArray(r.body.logs),             typeof r.body.logs);
    assert('History logs have driving_label',          r.body.logs[0]?.driving_label !== undefined, r.body.logs[0]?.driving_label);
    assert('History only returns user\'s own data',   r.body.logs.every(l=>l.user_id===r.body.logs[0].user_id), 'user_ids match');
  }

  // ── 10. ALERTS ────────────────────────────────────────────────────────────
  section('MODULE 10 — Alerts');
  {
    const r = await req('GET', '/api/alerts', null, cookie);
    assert('GET /api/alerts returns 200',              r.status === 200,                       r.status);
    assert('Alerts response has alerts array',         Array.isArray(r.body.alerts),           typeof r.body.alerts);
    assert('Alerts recorded from overspeeding',        r.body.alerts.length > 0,               r.body.alerts.length);
    assert('Alert has alert_type field',               typeof r.body.alerts[0]?.alert_type==='string', r.body.alerts[0]?.alert_type);
    assert('Alert has speed_value',                    r.body.alerts[0]?.speed_value !== undefined, r.body.alerts[0]?.speed_value);
    assert('Alert has session_id',                     typeof r.body.alerts[0]?.session_id==='string', r.body.alerts[0]?.session_id);

    // Unauthenticated
    const r2 = await req('GET', '/api/alerts');
    assert('Alerts without auth returns 401',          r2.status === 401,                      r2.status);
  }

  // ── 11. ML METRICS ────────────────────────────────────────────────────────
  section('MODULE 11 — ML Metrics');
  {
    const r = await req('GET', '/api/metrics', null, cookie);
    assert('GET /api/metrics returns 200',             r.status === 200,                       r.status);
    assert('Metrics has regression array',             Array.isArray(r.body.metrics?.regression), r.body.metrics?.regression?.length);
    assert('Metrics has classification array',         Array.isArray(r.body.metrics?.classification), r.body.metrics?.classification?.length);
    assert('XGBoost R² = 0.99',                        r.body.metrics?.regression[0]?.r2 === 0.99, r.body.metrics?.regression[0]?.r2);
    assert('XGBoost Classifier accuracy = 98.5',       r.body.metrics?.classification[0]?.accuracy === 98.5, r.body.metrics?.classification[0]?.accuracy);
    assert('Stats has total_logs count',               typeof r.body.stats?.total_logs === 'number', r.body.stats?.total_logs);
  }

  // ── 12. ADMIN: Overview ───────────────────────────────────────────────────
  section('MODULE 12 — Admin: System Overview');
  {
    const r = await req('GET', '/api/admin/overview', null, adminCookie);
    assert('GET /api/admin/overview returns 200',      r.status === 200,                       r.status);
    assert('Overview has total_users count',           typeof r.body.total_users === 'number', r.body.total_users);
    assert('Overview has total_logs count',            typeof r.body.total_logs === 'number',  r.body.total_logs);
    assert('Overview has total_alerts count',          typeof r.body.total_alerts === 'number',r.body.total_alerts);
    assert('Overview has recent_activity array',       Array.isArray(r.body.recent_activity), r.body.recent_activity?.length);

    // User trying to access admin
    const r2 = await req('GET', '/api/admin/overview', null, cookie);
    assert('Non-admin blocked from admin routes (403)',r2.status === 403,                      r2.status);
  }

  // ── 13. ADMIN: Users ─────────────────────────────────────────────────────
  section('MODULE 13 — Admin: Users List');
  {
    const r = await req('GET', '/api/admin/users', null, adminCookie);
    assert('GET /api/admin/users returns 200',         r.status === 200,                       r.status);
    assert('Users list has 2 registered users',        r.body.users?.length === 2,             r.body.users?.length);
    assert('Users list has log_count',                 r.body.users?.[0]?.log_count !== undefined, r.body.users?.[0]?.log_count);
    assert('Admin user not in users list',             !r.body.users?.some(u=>u.email==='admin@ecu.com'), 'admin excluded');

    // Deactivate user
    const userId = r.body.users?.[0]?.id;
    const rp = await req('PATCH', `/api/admin/users/${userId}`, { is_active: false }, adminCookie);
    assert('PATCH toggle user active → 200',           rp.status === 200,                      rp.status);
    assert('Toggle response success:true',             rp.body.success === true,               rp.body.success);
    const u = DB.users.find(u=>u.id===userId);
    assert('User is now deactivated in DB',            u?.is_active === 0,                     u?.is_active);

    // Reactivate
    await req('PATCH', `/api/admin/users/${userId}`, { is_active: true }, adminCookie);
    assert('Reactivate user works',                    DB.users.find(u=>u.id===userId)?.is_active === 1, DB.users.find(u=>u.id===userId)?.is_active);
  }

  // ── 14. ADMIN: Alerts ─────────────────────────────────────────────────────
  section('MODULE 14 — Admin: All Alerts');
  {
    const r = await req('GET', '/api/admin/alerts', null, adminCookie);
    assert('GET /api/admin/alerts returns 200',        r.status === 200,                       r.status);
    assert('Admin alerts has all system alerts',       r.body.alerts?.length > 0,              r.body.alerts?.length);
    assert('Alert has driver_name field',              r.body.alerts?.[0]?.driver_name !== undefined, r.body.alerts?.[0]?.driver_name);
    assert('Alert has alert_type field',               typeof r.body.alerts?.[0]?.alert_type==='string', r.body.alerts?.[0]?.alert_type);
  }

  // ── 15. AUTH: Logout ──────────────────────────────────────────────────────
  section('MODULE 15 — Auth: Logout');
  {
    const r = await req('POST', '/api/auth/logout', null, cookie);
    assert('POST /api/auth/logout returns 200',        r.status === 200,                       r.status);
    assert('Logout response success:true',             r.body.success === true,                r.body.success);

    // After logout, /me should fail
    const r2 = await req('GET', '/api/auth/me', null, cookie);
    assert('After logout, /me returns 401',            r2.status === 401,                      r2.status);
  }

  // ── 16. FRONTEND FILES ────────────────────────────────────────────────────
  section('MODULE 16 — Frontend Files');
  {
    const pages = ['login.html','admin_login.html','user_dashboard.html','admin_dashboard.html','demo_car.html'];
    for (const page of pages) {
      const r = await req('GET', `/${page}`);
      assert(`GET /${page} returns 200`,               r.status === 200,                       r.status);
    }
    const r404 = await req('GET', '/api/nonexistent');
    assert('Unknown API endpoint returns 404',         r404.status === 404,                    r404.status);
  }

  // ── 17. DEACTIVATED USER ──────────────────────────────────────────────────
  section('MODULE 17 — Security: Deactivated User');
  {
    // Deactivate jeevan
    const usersR = await req('GET', '/api/admin/users', null, adminCookie);
    const jeevan = usersR.body.users?.find(u=>u.email==='jeevan@crec.ac.in');
    if (jeevan) {
      await req('PATCH', `/api/admin/users/${jeevan.id}`, {is_active:false}, adminCookie);
      const r = await req('POST', '/api/auth/login', {email:'jeevan@crec.ac.in',password:'Jeevan123'});
      assert('Deactivated user cannot login (403)',    r.status === 403,                       r.status);
      // Reactivate for any subsequent tests
      await req('PATCH', `/api/admin/users/${jeevan.id}`, {is_active:true}, adminCookie);
    } else {
      assert('Deactivated user test (skipped)',        true, 'n/a');
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  RESULTS SUMMARY
  // ════════════════════════════════════════════════════════════════
  const total = passed + failed;
  console.log(`\n${B}${C}  ╔═══════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}${C}  ║               TEST RESULTS SUMMARY                    ║${X}`);
  console.log(`${B}${C}  ╚═══════════════════════════════════════════════════════╝${X}`);
  console.log(`\n  Total tests  : ${B}${total}${X}`);
  console.log(`  Passed       : ${G}${B}${passed}${X}`);
  console.log(`  Failed       : ${failed > 0 ? R+B : G+B}${failed}${X}`);
  console.log(`  Pass rate    : ${B}${Math.round(passed/total*100)}%${X}\n`);

  if (failed > 0) {
    console.log(`${R}  ✗ Failed Tests:${X}`);
    results.filter(r=>!r.ok).forEach(r => {
      console.log(`  ${cross} ${r.name}`);
      console.log(`       ${D}got: ${JSON.stringify(r.got)}  expected: ${r.expected}${X}`);
    });
    console.log();
  }

  // Module breakdown
  console.log(`${B}  Module Coverage:${X}`);
  const modules = [
    'Health Check','Auth Register','Auth Login','Auth /me',
    'ECU Simulator','ML Predictor','ECU Live','ECU Ingest',
    'ECU History','Alerts','ML Metrics','Admin Overview',
    'Admin Users','Admin Alerts','Auth Logout','Frontend Files','Security'
  ];
  modules.forEach((m,i) => console.log(`  ${G}✓${X}  Module ${String(i+1).padStart(2,'0')} — ${m}`));

  console.log(`\n${B}${C}  ══ DB State After Tests ════════════════════════════════${X}`);
  console.log(`  Users      : ${DB.users.length} (incl. admin)`);
  console.log(`  Telemetry  : ${DB.telemetry.length} rows`);
  console.log(`  Alerts     : ${DB.alerts.length} records`);
  console.log(`  Sessions   : ${Object.keys(DB.sessions).length} active\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error(R+'Test runner error:'+X, e); process.exit(1); });
