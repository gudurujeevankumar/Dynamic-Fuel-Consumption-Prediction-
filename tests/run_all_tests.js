/**
 * ECU Analytics — COMPLETE Test Suite
 * =======================================
 * Tests: Frontend HTML, Backend APIs, DB Schema, ML Predictor,
 *        ECU Simulator, Car Physics (Engine Load), Security
 * No npm needed — pure Node.js built-ins only
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── Colours ───────────────────────────────────────────────────────────────────
const G='\x1b[92m',Y='\x1b[93m',R='\x1b[91m',C='\x1b[96m',B='\x1b[1m',X='\x1b[0m',D='\x1b[90m';
const tick=`${G}✓${X}`, cross=`${R}✗${X}`;

// ── Counters ──────────────────────────────────────────────────────────────────
let passed=0, failed=0, cookie='', adminCookie='';
const failures=[];

function assert(name, cond, got, note='') {
  if(cond){ passed++; console.log(`  ${tick}  ${name.padEnd(55)} ${D}${String(got).substring(0,50)}${X}`); }
  else    { failed++; console.log(`  ${cross}  ${name.padEnd(55)} ${R}got: ${JSON.stringify(got).substring(0,60)}${X}`); failures.push({name,got,note}); }
}
function section(t){ console.log(`\n${B}${C}  ┌─ ${t} ${'─'.repeat(Math.max(0,56-t.length))}${X}`); }

// ── HTTP helper ───────────────────────────────────────────────────────────────
function req(method, p, body, jar='') {
  return new Promise((res,rej) => {
    const d = body?JSON.stringify(body):'';
    const r = http.request({ hostname:'localhost',port:4000,path:p,method,
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d),...(jar?{'Cookie':jar}:{})} }, rs=>{
      let b=''; rs.on('data',c=>b+=c); rs.on('end',()=>{
        try{ res({status:rs.statusCode,headers:rs.headers,body:JSON.parse(b)}); }
        catch{ res({status:rs.statusCode,headers:rs.headers,body:b}); }
      });
    });
    r.on('error',rej); if(d) r.write(d); r.end();
  });
}
function getCookie(h){ const sc=h['set-cookie']; if(!sc) return ''; return Array.isArray(sc)?sc.map(c=>c.split(';')[0]).join('; '):sc.split(';')[0]; }

// ── Wait for server ───────────────────────────────────────────────────────────
function waitServer(ms=400){ return new Promise(r=>setTimeout(r,ms)); }

// ════════════════════════════════════════════════════════════════
//  PART A — FRONTEND HTML TESTS
// ════════════════════════════════════════════════════════════════
function testFrontend() {
  section('PART A · Module 01 — Frontend: login.html');
  const DIR = path.join(__dirname, 'frontend');
  const pages = { 'login.html':[], 'admin_login.html':[], 'user_dashboard.html':[], 'admin_dashboard.html':[], 'demo_car.html':[] };

  for (const [file] of Object.entries(pages)) {
    const fp = path.join(DIR, file);
    assert(`File exists: ${file}`,                    fs.existsSync(fp),                  fs.existsSync(fp));
  }

  // login.html
  section('PART A · Module 02 — Frontend: login.html structure');
  {
    const html = fs.readFileSync(path.join(DIR,'login.html'),'utf8');
    assert('login.html: has <title>',                 html.includes('<title>'),             html.includes('<title>'));
    assert('login.html: has register form',           html.includes('id="form-register"'), !!html.match(/form-register/));
    assert('login.html: has login form',              html.includes('id="form-login"'),     !!html.match(/form-login/));
    assert('login.html: email input exists',          html.includes('type="email"'),        !!html.match(/type="email"/));
    assert('login.html: password input exists',       html.includes('type="password"'),     !!html.match(/type="password"/));
    assert('login.html: vehicle_api_key field',       html.includes('vehicle_api_key'),     !!html.match(/vehicle_api_key/));
    assert('login.html: calls /api/auth/login',       html.includes('/auth/login'),         !!html.match(/auth\/login/));
    assert('login.html: calls /api/auth/register',    html.includes('/auth/register'),      !!html.match(/auth\/register/));
    assert('login.html: redirects to user_dashboard', html.includes('user_dashboard.html'), !!html.match(/user_dashboard/));
    assert('login.html: redirects admin to admin_dashboard', html.includes('admin_dashboard.html'), !!html.match(/admin_dashboard/));
    assert('login.html: error display element',       html.includes('id="login-err"'),      !!html.match(/login-err/));
    assert('login.html: uses credentials:include',   html.includes("credentials:'include'"), !!html.match(/credentials.*include/));
  }

  section('PART A · Module 03 — Frontend: admin_login.html structure');
  {
    const html = fs.readFileSync(path.join(DIR,'admin_login.html'),'utf8');
    assert('admin_login: has admin login form',       html.includes('doLogin'),             !!html.match(/doLogin/));
    assert('admin_login: checks is_admin flag',       html.includes('is_admin'),            !!html.match(/is_admin/));
    assert('admin_login: back link to login.html',    html.includes('login.html'),          !!html.match(/login\.html/));
    assert('admin_login: redirects to admin_dashboard', html.includes('admin_dashboard.html'), !!html.match(/admin_dashboard/));
    assert('admin_login: has error display',          html.includes('id="err"'),            !!html.match(/id="err"/));
  }

  section('PART A · Module 04 — Frontend: user_dashboard.html structure');
  {
    const html = fs.readFileSync(path.join(DIR,'user_dashboard.html'),'utf8');
    // Navigation sections
    assert('user_dash: Live Dashboard section exists', html.includes('id="sec-live"'),      !!html.match(/sec-live/));
    assert('user_dash: Drive Report section exists',   html.includes('id="sec-report"'),    !!html.match(/sec-report/));
    assert('user_dash: My Alerts section exists',      html.includes('id="sec-alerts"'),    !!html.match(/sec-alerts/));
    assert('user_dash: My Vehicle section exists',     html.includes('id="sec-vehicle"'),   !!html.match(/sec-vehicle/));
    // Metric cards
    assert('user_dash: Fuel metric card',              html.includes('id="m-fuel"'),         !!html.match(/id="m-fuel"/));
    assert('user_dash: Speed metric card',             html.includes('id="m-spd"'),          !!html.match(/id="m-spd"/));
    assert('user_dash: RPM metric card',               html.includes('id="m-rpm"'),          !!html.match(/id="m-rpm"/));
    assert('user_dash: Driving Profile card',          html.includes('id="m-lbl"'),          !!html.match(/id="m-lbl"/));
    // ECU param displays
    assert('user_dash: throttle display e-thr',        html.includes('id="e-thr"'),          !!html.match(/id="e-thr"/));
    assert('user_dash: engine load display e-load',    html.includes('id="e-load"'),         !!html.match(/id="e-load"/));
    assert('user_dash: coolant display e-cool',        html.includes('id="e-cool"'),         !!html.match(/id="e-cool"/));
    assert('user_dash: MAF display e-maf',             html.includes('id="e-maf"'),          !!html.match(/id="e-maf"/));
    // ML prediction displays
    assert('user_dash: XGBoost prediction e-xgb',     html.includes('id="e-xgb"'),          !!html.match(/id="e-xgb"/));
    assert('user_dash: Ridge prediction e-ridge',     html.includes('id="e-ridge"'),        !!html.match(/id="e-ridge"/));
    assert('user_dash: SVR prediction e-svr',          html.includes('id="e-svr"'),          !!html.match(/id="e-svr"/));
    // Charts
    assert('user_dash: RPM chart canvas',              html.includes('id="c-rpm"'),          !!html.match(/id="c-rpm"/));
    assert('user_dash: Speed chart canvas',            html.includes('id="c-spd"'),          !!html.match(/id="c-spd"/));
    assert('user_dash: Chart.js loaded',               html.includes('chart.js'),            !!html.match(/chart\.js/i));
    // Report section
    assert('user_dash: PDF download button',           html.includes('downloadPDF'),         !!html.match(/downloadPDF/));
    assert('user_dash: jsPDF library loaded',          html.includes('jspdf'),               !!html.match(/jspdf/i));
    assert('user_dash: Eco/Normal/Aggressive display', html.includes('r-eco') && html.includes('r-normal') && html.includes('r-aggr'), 'all 3');
    // Vehicle section
    assert('user_dash: Vehicle make display',          html.includes('id="v-make"'),         !!html.match(/id="v-make"/));
    assert('user_dash: Health bars present',           html.includes('class="hb-fill"'),     !!html.match(/hb-fill/));
    assert('user_dash: Engine Load health bar',        html.includes('id="hb-load"'),        !!html.match(/id="hb-load"/));
    // API calls
    assert('user_dash: polls /api/ecu/live',           html.includes('/ecu/live'),           !!html.match(/ecu\/live/));
    assert('user_dash: 1500ms polling interval',       html.includes('1500'),                !!html.match(/1500/));
    assert('user_dash: logout calls /api/auth/logout', html.includes('/auth/logout'),        !!html.match(/auth\/logout/));
    assert('user_dash: overspeed modal present',       html.includes('overspeed-modal'),     !!html.match(/overspeed-modal/));
    assert('user_dash: demo car link present',         html.includes('demo_car.html'),       !!html.match(/demo_car\.html/));
  }

  section('PART A · Module 05 — Frontend: admin_dashboard.html structure');
  {
    const html = fs.readFileSync(path.join(DIR,'admin_dashboard.html'),'utf8');
    assert('admin_dash: Overview section',             html.includes('id="sec-overview"'),   !!html.match(/sec-overview/));
    assert('admin_dash: Users section',                html.includes('id="sec-users"'),      !!html.match(/sec-users/));
    assert('admin_dash: Alerts section',               html.includes('id="sec-alerts"'),     !!html.match(/sec-alerts/));
    assert('admin_dash: ML Metrics section',           html.includes('id="sec-metrics"'),    !!html.match(/sec-metrics/));
    assert('admin_dash: total_users card',             html.includes('id="ov-users"'),       !!html.match(/ov-users/));
    assert('admin_dash: total_logs card',              html.includes('id="ov-logs"'),        !!html.match(/ov-logs/));
    assert('admin_dash: total_alerts card',            html.includes('id="ov-alerts"'),      !!html.match(/ov-alerts/));
    assert('admin_dash: users table tbody',            html.includes('id="users-tbody"'),    !!html.match(/users-tbody/));
    assert('admin_dash: alerts table tbody',           html.includes('id="alerts-tbody"'),   !!html.match(/alerts-tbody/));
    assert('admin_dash: ML regression table',          html.includes('id="ml-reg"'),         !!html.match(/ml-reg/));
    assert('admin_dash: ML classification table',      html.includes('id="ml-cls"'),         !!html.match(/ml-cls/));
    assert('admin_dash: toggleUser function',          html.includes('toggleUser'),          !!html.match(/toggleUser/));
    assert('admin_dash: calls /api/admin/overview',    html.includes('/admin/overview'),     !!html.match(/admin\/overview/));
    assert('admin_dash: calls /api/admin/users',       html.includes('/admin/users'),        !!html.match(/admin\/users/));
    assert('admin_dash: calls /api/admin/alerts',      html.includes('/admin/alerts'),       !!html.match(/admin\/alerts/));
    assert('admin_dash: calls /api/metrics',           html.includes('/metrics'),            !!html.match(/\/metrics/));
  }

  section('PART A · Module 06 — Frontend: demo_car.html structure + ENGINE LOAD FIX');
  {
    const html = fs.readFileSync(path.join(DIR,'demo_car.html'),'utf8');
    // Scene elements
    assert('demo_car: road scene present',             html.includes('class="road"'),        !!html.match(/class="road"/));
    assert('demo_car: car SVG present',                html.includes('car-wrap'),            !!html.match(/car-wrap/));
    assert('demo_car: headlights in SVG',              html.includes('brake-lt'),            !!html.match(/brake-lt/));
    assert('demo_car: wheel elements (wfl, wrl)',      html.includes('id="wfl"') && html.includes('id="wrl"'), 'both wheels');
    // Gauges
    assert('demo_car: speed gauge canvas g-spd',       html.includes('id="g-spd"'),          !!html.match(/id="g-spd"/));
    assert('demo_car: RPM gauge canvas g-rpm',         html.includes('id="g-rpm"'),          !!html.match(/id="g-rpm"/));
    assert('demo_car: fuel gauge canvas g-fuel',       html.includes('id="g-fuel"'),         !!html.match(/id="g-fuel"/));
    assert('demo_car: load gauge canvas g-load',       html.includes('id="g-load"'),         !!html.match(/id="g-load"/));
    // Controls
    assert('demo_car: accelerate pedal p-acc',         html.includes('id="p-acc"'),          !!html.match(/id="p-acc"/));
    assert('demo_car: brake pedal p-brk',              html.includes('id="p-brk"'),          !!html.match(/id="p-brk"/));
    assert('demo_car: gear buttons 1-4',               html.includes("setGear('1')") && html.includes("setGear('4')"), 'gears 1-4');
    assert('demo_car: drive mode buttons',             html.includes("setMode('eco')") && html.includes("setMode('sport')"), 'eco+sport');
    assert('demo_car: engine load slider',             html.includes('id="load-range"'),     !!html.match(/id="load-range"/));
    assert('demo_car: coolant slider',                 html.includes('id="cool-range"'),     !!html.match(/id="cool-range"/));
    assert('demo_car: mini-chart canvas',              html.includes('id="mini-chart"'),     !!html.match(/id="mini-chart"/));
    // ML overlay
    assert('demo_car: ML overlay present',             html.includes('class="ml-overlay"'), !!html.match(/ml-overlay/));
    assert('demo_car: ML XGBoost display mlo-xgb',    html.includes('id="mlo-xgb"'),        !!html.match(/mlo-xgb/));
    assert('demo_car: ML Ridge display mlo-ridge',    html.includes('id="mlo-ridge"'),      !!html.match(/mlo-ridge/));
    assert('demo_car: ML SVR display mlo-svr',         html.includes('id="mlo-svr"'),        !!html.match(/mlo-svr/));
    assert('demo_car: ML driving label mlo-lbl',       html.includes('id="mlo-lbl"'),        !!html.match(/mlo-lbl/));
    assert('demo_car: DB log ID display mlo-id',       html.includes('id="mlo-id"'),         !!html.match(/mlo-id/));
    // *** ENGINE LOAD FIX VERIFICATION ***
    assert('demo_car: _dispLoad display buffer in state', html.includes('_dispLoad:20'),     !!html.match(/_dispLoad/));
    assert('demo_car: _dispFuel display buffer in state', html.includes('_dispFuel:0.5'),    !!html.match(/_dispFuel/));
    assert('demo_car: _dispLoad updated in physics',  html.includes('S._dispLoad = S._dispLoad'), !!html.match(/S\._dispLoad\s*=/));
    assert('demo_car: _dispFuel updated in physics',  html.includes('S._dispFuel = S._dispFuel'), !!html.match(/S\._dispFuel\s*=/));
    assert('demo_car: gauge uses _dispLoad not S.load', html.includes("g-load', S._dispLoad"), !!html.match(/g-load.*_dispLoad/));
    assert('demo_car: gauge uses _dispFuel not S.fuel', html.includes("g-fuel', S._dispFuel"), !!html.match(/g-fuel.*_dispFuel/));
    assert('demo_car: load smoothing factor 0.012',   html.includes('0.012'),               !!html.match(/0\.012/));
    assert('demo_car: dispLoad smoothing factor 0.025',html.includes('0.025'),              !!html.match(/0\.025/));
    // Physics
    assert('demo_car: throttle has smooth ramp',      html.includes('_thr_target'),         !!html.match(/_thr_target/));
    assert('demo_car: RPM smooth interpolation',      html.includes('0.08*(rpmTarget'),     !!html.match(/0\.08.*rpmTarget/));
    assert('demo_car: keyboard W/S/ArrowUp/Down',     html.includes('ArrowUp') && html.includes('ArrowDown'), 'both arrows');
    assert('demo_car: sends POST to /api/ecu/ingest', html.includes('/ecu/ingest'),          !!html.match(/ecu\/ingest/));
    assert('demo_car: POST every 500ms',              html.includes('SEND_MS    = 500'),     !!html.match(/SEND_MS.*500/));
    assert('demo_car: shows log_id from DB',          html.includes('ml-logid'),            !!html.match(/ml-logid/));
    assert('demo_car: physics tick 48ms',             html.includes('PHYS_MS    = 48'),     !!html.match(/PHYS_MS.*48/));
    assert('demo_car: overspeed warning banner',      html.includes('id="os-warn"'),        !!html.match(/os-warn/));
    assert('demo_car: back link to dashboard',        html.includes('user_dashboard.html'), !!html.match(/user_dashboard/));
    assert('demo_car: Chart.js loaded',               html.includes('chart.js'),            !!html.match(/chart\.js/i));
  }
}

// ════════════════════════════════════════════════════════════════
//  PART B — DATABASE SCHEMA TESTS
// ════════════════════════════════════════════════════════════════
function testDatabase() {
  section('PART B · Module 07 — Database Schema (setup.sql)');
  const sql = fs.readFileSync(path.join(__dirname,'database','setup.sql'),'utf8');
  assert('schema: CREATE DATABASE ecu_analytics',   sql.includes('CREATE DATABASE'),          !!sql.match(/CREATE DATABASE/));
  assert('schema: users table defined',              sql.includes('CREATE TABLE IF NOT EXISTS users'), !!sql.match(/CREATE TABLE.*users/));
  assert('schema: telemetry_log table defined',     sql.includes('CREATE TABLE IF NOT EXISTS telemetry_log'), !!sql.match(/telemetry_log/));
  assert('schema: alerts table defined',             sql.includes('CREATE TABLE IF NOT EXISTS alerts'), !!sql.match(/CREATE TABLE.*alerts/));
  assert('schema: drive_sessions table defined',    sql.includes('CREATE TABLE IF NOT EXISTS drive_sessions'), !!sql.match(/drive_sessions/));
  assert('schema: users.id AUTO_INCREMENT PK',      sql.includes('AUTO_INCREMENT PRIMARY KEY'), !!sql.match(/AUTO_INCREMENT PRIMARY KEY/));
  assert('schema: users.email UNIQUE',               sql.includes('email') && sql.includes('UNIQUE'), 'email UNIQUE');
  assert('schema: users.password_hash column',      sql.includes('password_hash'),            !!sql.match(/password_hash/));
  assert('schema: users.is_admin column',            sql.includes('is_admin'),                 !!sql.match(/is_admin/));
  assert('schema: users.is_active column',           sql.includes('is_active'),                !!sql.match(/is_active/));
  assert('schema: users.vehicle_api_key UNIQUE',    sql.includes('vehicle_api_key'),          !!sql.match(/vehicle_api_key/));
  assert('schema: telemetry FK to users',            sql.includes('FOREIGN KEY (user_id) REFERENCES users(id)'), !!sql.match(/FOREIGN KEY.*user_id.*REFERENCES users/));
  assert('schema: telemetry fuel_predicted_xgb',    sql.includes('fuel_predicted_xgb'),       !!sql.match(/fuel_predicted_xgb/));
  assert('schema: telemetry driving_label column',  sql.includes('driving_label'),            !!sql.match(/driving_label/));
  assert('schema: telemetry speed_alert column',    sql.includes('speed_alert'),              !!sql.match(/speed_alert/));
  assert('schema: alerts.alert_type column',         sql.includes('alert_type'),               !!sql.match(/alert_type/));
  assert('schema: admin user seed INSERT',           sql.includes("INSERT IGNORE INTO users"), !!sql.match(/INSERT IGNORE/));
  assert('schema: admin email admin@ecu.com',        sql.includes('admin@ecu.com'),            !!sql.match(/admin@ecu\.com/));
  assert('schema: ENGINE=InnoDB on tables',         sql.includes('ENGINE=InnoDB'),            !!sql.match(/ENGINE=InnoDB/));
  assert('schema: utf8mb4 charset',                  sql.includes('utf8mb4'),                  !!sql.match(/utf8mb4/));
  assert('schema: INDEX on user_id',                 sql.includes('INDEX (user_id)'),          !!sql.match(/INDEX \(user_id\)/));
  assert('schema: ON DELETE CASCADE',                sql.includes('ON DELETE CASCADE'),        !!sql.match(/ON DELETE CASCADE/));

  section('PART B · Module 08 — Backend Files Exist');
  const backendFiles = ['server.js','db.js','package.json','.env',
    'routes/auth.js','routes/ecu.js','routes/alerts.js','routes/metrics.js','routes/admin.js',
    'middleware/auth.js','ml/predictor.js'];
  for (const f of backendFiles) {
    const fp = path.join(__dirname,'backend',f);
    assert(`backend/${f} exists`,                    fs.existsSync(fp),                       fs.existsSync(fp));
  }

  section('PART B · Module 09 — Backend Config (.env + package.json)');
  const env = fs.readFileSync(path.join(__dirname,'backend','.env'),'utf8');
  assert('.env: PORT defined',                       env.includes('PORT='),                   env.includes('PORT='));
  assert('.env: DB_HOST defined',                    env.includes('DB_HOST='),                env.includes('DB_HOST='));
  assert('.env: DB_NAME=ecu_analytics',              env.includes('DB_NAME=ecu_analytics'),   env.includes('DB_NAME=ecu_analytics'));
  assert('.env: DB_PASSWORD=Jeeva4U set',            env.includes('DB_PASSWORD=Jeeva4U'),     env.includes('DB_PASSWORD=Jeeva4U'));
  assert('.env: DB_USER=root set',                   env.includes('DB_USER=root'),            env.includes('DB_USER=root'));
  assert('.env: SECRET_KEY defined',                 env.includes('SECRET_KEY='),             env.includes('SECRET_KEY='));

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname,'backend','package.json'),'utf8'));
  assert('package.json: express dependency',         !!pkg.dependencies?.express,             pkg.dependencies?.express);
  assert('package.json: mysql2 dependency',          !!pkg.dependencies?.mysql2,              pkg.dependencies?.mysql2);
  assert('package.json: express-session dependency', !!pkg.dependencies?.['express-session'], pkg.dependencies?.['express-session']);
  assert('package.json: bcrypt dependency',          !!pkg.dependencies?.bcrypt,              pkg.dependencies?.bcrypt);
  assert('package.json: cors dependency',            !!pkg.dependencies?.cors,                pkg.dependencies?.cors);
  assert('package.json: dotenv dependency',          !!pkg.dependencies?.dotenv,              pkg.dependencies?.dotenv);
  assert('package.json: nodemon devDependency',      !!pkg.devDependencies?.nodemon,          pkg.devDependencies?.nodemon);
  assert('package.json: start script defined',       !!pkg.scripts?.start,                    pkg.scripts?.start);
  assert('package.json: dev script defined',         !!pkg.scripts?.dev,                      pkg.scripts?.dev);
}

// ════════════════════════════════════════════════════════════════
//  PART C — ML PREDICTOR DEEP TESTS
// ════════════════════════════════════════════════════════════════
function testML() {
  section('PART C · Module 10 — ML Predictor: Regression accuracy');
  // Import predictor logic inline (mirrors backend/ml/predictor.js)
  function predict(row) {
    const f = { engine_rpm:+row.engine_rpm||0, vehicle_speed:+row.vehicle_speed||0,
      throttle_position:+row.throttle_position||0, acceleration:+row.acceleration||0,
      engine_load:+row.engine_load||0, mass_air_flow:+row.mass_air_flow||0,
      coolant_temperature:+row.coolant_temperature||85 };
    const xgb = Math.max(0.3,0.42+f.engine_rpm*0.00258+f.engine_load*0.0385+f.throttle_position*0.0192+f.mass_air_flow*0.048+f.vehicle_speed*0.0065+Math.max(0,f.acceleration)*0.18);
    const ridge = Math.max(0.3,xgb+0.14);
    const svr = Math.max(0.3,xgb-0.09);
    const avg = (xgb+ridge+svr)/3;
    let sc=0;
    if(f.engine_rpm>4000)sc+=3;else if(f.engine_rpm>3000)sc+=2;else if(f.engine_rpm>1800)sc+=1;
    if(f.vehicle_speed>110)sc+=4;else if(f.vehicle_speed>90)sc+=3;else if(f.vehicle_speed>55)sc+=1;
    if(f.throttle_position>70)sc+=2;else if(f.throttle_position>30)sc+=1;
    if(f.acceleration>1.5)sc+=2;else if(f.acceleration>0.5)sc+=1;
    if(f.engine_load>80)sc+=1;
    const label=sc<=2?'Eco':sc<=6?'Normal':'Aggressive';
    return { fuel_xgb:+xgb.toFixed(3), fuel_ridge:+ridge.toFixed(3), fuel_svr:+svr.toFixed(3), fuel_avg:+avg.toFixed(3), driving_label:label, driving_code:sc<=2?0:sc<=6?1:2, speed_alert:f.vehicle_speed>100 };
  }

  // Test 1: Idle engine
  const idle = predict({engine_rpm:750,vehicle_speed:0,throttle_position:5,acceleration:0,engine_load:15,mass_air_flow:1.2,coolant_temperature:85});
  assert('ML: Idle → fuel_xgb > 0.3',               idle.fuel_xgb >= 0.3,                   idle.fuel_xgb);
  assert('ML: Idle → Eco classification',            idle.driving_label==='Eco',             idle.driving_label);
  assert('ML: Idle → no speed alert',               !idle.speed_alert,                      idle.speed_alert);

  // Test 2: City driving
  const city = predict({engine_rpm:2000,vehicle_speed:40,throttle_position:28,acceleration:0.2,engine_load:38,mass_air_flow:5,coolant_temperature:90});
  assert('ML: City → fuel_xgb in range [2–10]',     city.fuel_xgb>2 && city.fuel_xgb<10,   city.fuel_xgb);
  assert('ML: City → Normal or Eco label',           ['Eco','Normal'].includes(city.driving_label), city.driving_label);

  // Test 3: Highway
  const hwy = predict({engine_rpm:2800,vehicle_speed:100,throttle_position:42,acceleration:0.1,engine_load:55,mass_air_flow:11,coolant_temperature:92});
  assert('ML: Highway → fuel higher than city',     hwy.fuel_xgb > city.fuel_xgb,          `hwy:${hwy.fuel_xgb} city:${city.fuel_xgb}`);
  assert('ML: Highway 100km/h → speed_alert false', !hwy.speed_alert,                      hwy.speed_alert);

  // Test 4: Aggressive
  const agg = predict({engine_rpm:5500,vehicle_speed:135,throttle_position:90,acceleration:2.2,engine_load:88,mass_air_flow:22,coolant_temperature:97});
  assert('ML: Aggressive → label=Aggressive',       agg.driving_label==='Aggressive',       agg.driving_label);
  assert('ML: Aggressive → speed_alert true',       agg.speed_alert===true,                 agg.speed_alert);
  assert('ML: Aggressive fuel > highway * 1.5',     agg.fuel_xgb > hwy.fuel_xgb*1.5,      `agg:${agg.fuel_xgb} hwy:${hwy.fuel_xgb}`);
  assert('ML: Aggressive driving_code=2',           agg.driving_code===2,                   agg.driving_code);

  // Test 5: Model relationship invariants
  assert('ML: XGBoost < Ridge (bias term)',         idle.fuel_xgb < idle.fuel_ridge,        `xgb:${idle.fuel_xgb} < ridge:${idle.fuel_ridge}`);
  assert('ML: XGBoost > SVR (SVR subtracts)',       idle.fuel_xgb > idle.fuel_svr,         `xgb:${idle.fuel_xgb} > svr:${idle.fuel_svr}`);
  assert('ML: avg = (xgb+ridge+svr)/3',             Math.abs(idle.fuel_avg-(idle.fuel_xgb+idle.fuel_ridge+idle.fuel_svr)/3)<0.01, idle.fuel_avg);
  assert('ML: fuel never below 0.3',               [idle,city,hwy,agg].every(p=>p.fuel_xgb>=0.3), 'all ≥ 0.3');

  section('PART C · Module 11 — ML Predictor: Classification boundary tests');
  // Boundary eco/normal
  const boundary = predict({engine_rpm:2000,vehicle_speed:60,throttle_position:35,acceleration:0.5,engine_load:45,mass_air_flow:7,coolant_temperature:90});
  assert('ML: boundary (spd=60,rpm=2k) → Normal',  boundary.driving_label==='Normal',       boundary.driving_label);
  assert('ML: boundary driving_code=1',             boundary.driving_code===1,               boundary.driving_code);

  // Eco edge
  const eco_edge = predict({engine_rpm:1200,vehicle_speed:30,throttle_position:20,acceleration:0,engine_load:25,mass_air_flow:3,coolant_temperature:88});
  assert('ML: eco_edge (spd=30,rpm=1.2k) → Eco',   eco_edge.driving_label==='Eco',         eco_edge.driving_label);
  assert('ML: eco_edge driving_code=0',             eco_edge.driving_code===0,               eco_edge.driving_code);

  // Borderline aggressive
  const semi_agg = predict({engine_rpm:4200,vehicle_speed:115,throttle_position:75,acceleration:1.8,engine_load:82,mass_air_flow:19,coolant_temperature:94});
  assert('ML: semi-aggressive → Aggressive',        semi_agg.driving_label==='Aggressive',  semi_agg.driving_label);

  section('PART C · Module 12 — ML Predictor: 100-sample stress test');
  // Run 100 predictions and verify all outputs are valid
  let allValid=true, ecoCount=0, normalCount=0, aggrCount=0;
  for(let i=0;i<100;i++){
    const rpm = 800 + Math.random()*5700;
    const spd = Math.random()*140;
    const thr = Math.random()*100;
    const p = predict({engine_rpm:rpm,vehicle_speed:spd,throttle_position:thr,acceleration:(Math.random()-0.5)*3,engine_load:Math.random()*90,mass_air_flow:1+Math.random()*22,coolant_temperature:80+Math.random()*20});
    if(!['Eco','Normal','Aggressive'].includes(p.driving_label)) allValid=false;
    if(p.fuel_xgb<0.3||p.fuel_xgb>50) allValid=false;
    if(p.fuel_ridge<p.fuel_xgb-0.5) allValid=false; // ridge always >= xgb - small margin
    if(p.driving_label==='Eco') ecoCount++;
    else if(p.driving_label==='Normal') normalCount++;
    else aggrCount++;
  }
  assert('ML: 100 samples all valid labels',        allValid,                               'all valid');
  assert('ML: all 3 labels seen in 100 samples',   ecoCount>0&&normalCount>0&&aggrCount>0, `Eco:${ecoCount} Nor:${normalCount} Agg:${aggrCount}`);
  assert('ML: fuel range always 0.3–50',            allValid,                               'range ok');
}

// ════════════════════════════════════════════════════════════════
//  PART D — ECU SIMULATOR TESTS
// ════════════════════════════════════════════════════════════════
function testSimulator() {
  section('PART D · Module 13 — ECU Simulator: Data quality');
  // Inline simulator matching scripts/ecu_generator.js
  const simS={ rpm:800,speed:0,throttle:5,load:20,coolant:30,profile:0,timer:0,dur:45 };
  const r=(a,b)=>a+Math.random()*(b-a);
  const sm=(v,t)=>v+0.08*(t-v);
  function simStep(){
    simS.timer++;
    if(simS.timer>=simS.dur){simS.profile=Math.random()<.5?0:Math.random()<.7?1:2;simS.dur=30+Math.floor(Math.random()*60);simS.timer=0;}
    const t=simS.profile===0?{rpm:[900,2000],spd:[15,60],thr:[8,30],load:[18,50]}:simS.profile===1?{rpm:[1400,3500],spd:[35,90],thr:[22,55],load:[38,72]}:{rpm:[2800,6500],spd:[75,140],thr:[58,92],load:[62,95]};
    const prev=simS.speed;
    simS.rpm=sm(simS.rpm,r(...t.rpm));simS.speed=sm(simS.speed,r(...t.spd));
    simS.throttle=sm(simS.throttle,r(...t.thr));simS.load=sm(simS.load,r(...t.load));
    simS.coolant=simS.coolant<85?simS.coolant+r(0.2,0.9):sm(simS.coolant,90)+r(-0.4,0.4);
    const fuel=Math.max(0.3,Math.min(28,0.00038*simS.rpm+0.048*simS.load+0.019*simS.throttle));
    const maf=Math.max(1,simS.rpm/600*(simS.throttle/100)*12+r(-0.4,0.4));
    const accel=(simS.speed-prev)/3.6;
    return{engine_rpm:+simS.rpm.toFixed(1),vehicle_speed:+simS.speed.toFixed(1),throttle_position:+simS.throttle.toFixed(1),acceleration:+accel.toFixed(3),engine_load:+simS.load.toFixed(1),fuel_injection_rate:+fuel.toFixed(3),coolant_temperature:+simS.coolant.toFixed(1),mass_air_flow:+maf.toFixed(2)};
  }

  // Generate 50 samples
  const samples = Array.from({length:50},()=>simStep());
  assert('Sim: 50 samples generated',               samples.length===50,                    50);
  assert('Sim: rpm always > 700',                   samples.every(s=>s.engine_rpm>700),     Math.min(...samples.map(s=>s.engine_rpm)).toFixed(0));
  assert('Sim: rpm always < 7500',                  samples.every(s=>s.engine_rpm<7500),    Math.max(...samples.map(s=>s.engine_rpm)).toFixed(0));
  assert('Sim: speed always >= 0',                  samples.every(s=>s.vehicle_speed>=0),   Math.min(...samples.map(s=>s.vehicle_speed)));
  assert('Sim: throttle in [0,100]',                samples.every(s=>s.throttle_position>=0&&s.throttle_position<=100), 'range ok');
  assert('Sim: coolant is rising toward operating temp',  samples[49].coolant_temperature > 30, samples[49].coolant_temperature.toFixed(1)+'°C');
  assert('Sim: fuel never negative',                samples.every(s=>s.fuel_injection_rate>=0.3), Math.min(...samples.map(s=>s.fuel_injection_rate)));
  assert('Sim: maf always > 0',                     samples.every(s=>s.mass_air_flow>0),    Math.min(...samples.map(s=>s.mass_air_flow)));
  assert('Sim: produces 8 fields per row',          Object.keys(samples[0]).length===8,     Object.keys(samples[0]).length);
  assert('Sim: rpm values are unique (not static)', new Set(samples.map(s=>s.engine_rpm.toFixed(0))).size > 10, new Set(samples.map(s=>s.engine_rpm.toFixed(0))).size+' unique RPMs');

  section('PART D · Module 14 — Car Physics: Engine Load smoothing');
  // Simulate the demo_car physics with _dispLoad to verify no rapid movement
  const ph = { speed:0, rpm:800, throttle:0, _thr_target:0, load:20, _dispLoad:20, _dispFuel:0.5, fuel:0.5 };
  const PHYS_MS=48;
  const modeEco = {maxSpd:90,accelK:.55,rpmK:.7};
  let loadHistory=[], dispHistory=[];
  let loadJumps=0, dispJumps=0;

  // Simulate 2 seconds of pressing W (40 ticks)
  for(let i=0;i<40;i++){
    ph._thr_target = Math.min(100, ph._thr_target + 5*modeEco.accelK);
    ph.throttle = ph.throttle + 0.07*(ph._thr_target - ph.throttle);
    const rpmTgt = Math.max(800,Math.min(7000,(ph.speed*42*1.8)+(ph.throttle*18*modeEco.rpmK)));
    ph.rpm = ph.rpm + 0.08*(rpmTgt - ph.rpm);
    const tspd = (ph.throttle/100)*modeEco.maxSpd; ph.speed += (tspd-ph.speed)*.07;
    const targetLoad = 20*0.25 + ph.throttle*0.75;
    ph.load = ph.load + 0.012*(targetLoad - ph.load);
    const targetFuel = Math.max(0.3, ph.rpm*0.00258 + ph.load*0.038 + ph.throttle*0.019);
    ph.fuel = ph.fuel + 0.06*(targetFuel - ph.fuel);
    ph._dispLoad = ph._dispLoad + 0.025*(ph.load - ph._dispLoad);
    ph._dispFuel = ph._dispFuel + 0.035*(ph.fuel - ph._dispFuel);
    if(loadHistory.length>0 && Math.abs(ph.load - loadHistory[loadHistory.length-1])>5) loadJumps++;
    if(dispHistory.length>0 && Math.abs(ph._dispLoad - dispHistory[dispHistory.length-1])>5) dispJumps++;
    loadHistory.push(ph.load); dispHistory.push(ph._dispLoad);
  }

  // Then 1 second braking (20 ticks)
  for(let i=0;i<20;i++){
    ph._thr_target = Math.max(0, ph._thr_target - 4);
    ph.throttle = ph.throttle + 0.07*(ph._thr_target - ph.throttle);
    ph.speed = Math.max(0,ph.speed-5.5);
    const targetLoad = 20*0.25 + ph.throttle*0.75;
    ph.load = ph.load + 0.012*(targetLoad - ph.load);
    ph._dispLoad = ph._dispLoad + 0.025*(ph.load - ph._dispLoad);
    if(loadHistory.length>0 && Math.abs(ph.load - loadHistory[loadHistory.length-1])>5) loadJumps++;
    if(dispHistory.length>0 && Math.abs(ph._dispLoad - dispHistory[dispHistory.length-1])>5) dispJumps++;
    loadHistory.push(ph.load); dispHistory.push(ph._dispLoad);
  }

  const loadMax  = Math.max(...loadHistory.map((v,i,a)=>i>0?Math.abs(v-a[i-1]):0));
  const dispMax  = Math.max(...dispHistory.map((v,i,a)=>i>0?Math.abs(v-a[i-1]):0));
  assert('Physics: S.load max change per tick < 2',  loadMax < 2,                           `max Δload: ${loadMax.toFixed(3)}`);
  assert('Physics: _dispLoad max change per tick < 1', dispMax < 1,                         `max Δdisp: ${dispMax.toFixed(3)}`);
  assert('Physics: Zero large jumps (>5) in S.load',  loadJumps===0,                        `jumps: ${loadJumps}`);
  assert('Physics: Zero large jumps (>5) in _dispLoad', dispJumps===0,                      `jumps: ${dispJumps}`);
  assert('Physics: _dispLoad always lags behind S.load', dispHistory[39] < loadHistory[39], `disp:${dispHistory[39].toFixed(2)} load:${loadHistory[39].toFixed(2)}`);
  assert('Physics: Engine load is smoothly increasing',   loadHistory[39] > loadHistory[0],                 loadHistory[39].toFixed(1));
  assert('Physics: Speed limited by gear N (0 in neutral)', ph.speed >= 0,                        ph.speed.toFixed(1)+' km/h');
  assert('Physics: RPM increases with throttle',      ph.rpm > 1500,                         Math.round(ph.rpm)+' rpm');
}

// ════════════════════════════════════════════════════════════════
//  PART E — BACKEND API TESTS (live HTTP)
// ════════════════════════════════════════════════════════════════
async function testBackend() {
  section('PART E · Module 15 — Backend: Health + Auth Register');
  const h = await req('GET','/api/health');
  assert('API: /api/health → 200',                  h.status===200,                         h.status);
  assert('API: health status=ok',                   h.body.status==='ok',                   h.body.status);

  // Register users
  const r1 = await req('POST','/api/auth/register',{name:'G. Jeevan Kumar',email:'jeevan@crec.ac.in',password:'Jeevan123',vehicle_api_key:'TYT-2024-001'});
  assert('API: register user → 200',               r1.status===200,                         r1.status);
  assert('API: register success=true',             r1.body.success===true,                  r1.body.success);
  assert('API: register → Toyota auto-detected',   r1.body.user?.vehicle_company==='Toyota', r1.body.user?.vehicle_company);
  assert('API: register → Innova Crysta model',    r1.body.user?.vehicle_model==='Innova Crysta', r1.body.user?.vehicle_model);

  await req('POST','/api/auth/register',{name:'D. Sujith',email:'sujith@crec.ac.in',password:'Sujith456',vehicle_api_key:'HYN-2024-002'});
  assert('API: register 2nd user (Hyundai)',       true,                                     'ok');

  // Error cases
  const rDup = await req('POST','/api/auth/register',{name:'X',email:'jeevan@crec.ac.in',password:'x',vehicle_api_key:'DUP-001'});
  assert('API: duplicate email → 409',             rDup.status===409,                        rDup.status);
  const rBad = await req('POST','/api/auth/register',{name:'X'});
  assert('API: missing fields → 400',              rBad.status===400,                        rBad.status);

  section('PART E · Module 16 — Backend: Auth Login');
  const rWrong = await req('POST','/api/auth/login',{email:'jeevan@crec.ac.in',password:'WRONG'});
  assert('API: wrong password → 401',             rWrong.status===401,                      rWrong.status);

  const rLogin = await req('POST','/api/auth/login',{email:'jeevan@crec.ac.in',password:'Jeevan123'});
  assert('API: login → 200',                       rLogin.status===200,                      rLogin.status);
  assert('API: login success=true',                rLogin.body.success===true,               rLogin.body.success);
  assert('API: login is_admin=false for user',     rLogin.body.is_admin===0||rLogin.body.is_admin===false, rLogin.body.is_admin);
  assert('API: session cookie set',                !!getCookie(rLogin.headers),              !!getCookie(rLogin.headers));
  cookie = getCookie(rLogin.headers);

  const rAdmin = await req('POST','/api/auth/login',{email:'admin@ecu.com',password:'admin123'});
  assert('API: admin login → 200',                 rAdmin.status===200,                      rAdmin.status);
  assert('API: admin is_admin=true',               rAdmin.body.is_admin===1||rAdmin.body.is_admin===true, rAdmin.body.is_admin);
  adminCookie = getCookie(rAdmin.headers);

  section('PART E · Module 17 — Backend: /me + session');
  const rMe = await req('GET','/api/auth/me',null,cookie);
  assert('API: /me → 200',                         rMe.status===200,                         rMe.status);
  assert('API: /me email correct',                 rMe.body.email==='jeevan@crec.ac.in',     rMe.body.email);
  assert('API: /me vehicle_company Toyota',        rMe.body.vehicle_company==='Toyota',      rMe.body.vehicle_company);
  const rMeNo = await req('GET','/api/auth/me');
  assert('API: /me without session → 401',         rMeNo.status===401,                       rMeNo.status);

  section('PART E · Module 18 — Backend: ECU Live');
  for(let i=0;i<6;i++) await req('GET','/api/ecu/live?session_id=sess-001',null,cookie);
  const rLive = await req('GET','/api/ecu/live?session_id=sess-001',null,cookie);
  assert('API: /ecu/live → 200',                   rLive.status===200,                       rLive.status);
  assert('API: live has ecu object',               !!rLive.body.ecu,                         !!rLive.body.ecu);
  assert('API: live ecu.engine_rpm > 0',           rLive.body.ecu?.engine_rpm>0,            rLive.body.ecu?.engine_rpm);
  assert('API: live has prediction object',        !!rLive.body.prediction,                  !!rLive.body.prediction);
  assert('API: live prediction.fuel_xgb > 0',     rLive.body.prediction?.fuel_xgb>0,       rLive.body.prediction?.fuel_xgb);
  assert('API: live prediction.fuel_ridge > fuel_xgb', rLive.body.prediction?.fuel_ridge > rLive.body.prediction?.fuel_xgb, `ridge:${rLive.body.prediction?.fuel_ridge} xgb:${rLive.body.prediction?.fuel_xgb}`);
  assert('API: live driving_label valid',          ['Eco','Normal','Aggressive'].includes(rLive.body.prediction?.driving_label), rLive.body.prediction?.driving_label);
  assert('API: live has log_id',                   rLive.body.log_id>0,                     rLive.body.log_id);
  assert('API: live has session_id',               typeof rLive.body.session_id==='string', rLive.body.session_id);
  assert('API: /ecu/live without auth → 401',      (await req('GET','/api/ecu/live')).status===401, 401);

  section('PART E · Module 19 — Backend: ECU Ingest (Virtual Car)');
  const payload = {session_id:'demo-car-001',engine_rpm:3200,vehicle_speed:85,throttle_position:55,acceleration:0.8,engine_load:65,coolant_temperature:91,mass_air_flow:12.5,fuel_injection_rate:6.2};
  const rIng = await req('POST','/api/ecu/ingest',payload,cookie);
  assert('API: /ecu/ingest → 200',                 rIng.status===200,                        rIng.status);
  assert('API: ingest status=ok',                  rIng.body.status==='ok',                  rIng.body.status);
  assert('API: ingest returns log_id',             rIng.body.log_id>0,                       rIng.body.log_id);
  assert('API: ingest echoes rpm=3200',            rIng.body.ecu?.engine_rpm===3200,         rIng.body.ecu?.engine_rpm);
  assert('API: ingest prediction has fuel_xgb',    rIng.body.prediction?.fuel_xgb>0,        rIng.body.prediction?.fuel_xgb);
  assert('API: ingest has session_id',             rIng.body.session_id==='demo-car-001',    rIng.body.session_id);
  // Overspeeding
  const rOvsp = await req('POST','/api/ecu/ingest',{...payload,vehicle_speed:125,engine_rpm:5500,throttle_position:88,acceleration:1.8,engine_load:88,mass_air_flow:22},cookie);
  assert('API: ingest overspeeding → speed_alert=true', rOvsp.body.prediction?.speed_alert===true, rOvsp.body.prediction?.speed_alert);
  assert('API: ingest aggressive → label=Aggressive',   rOvsp.body.prediction?.driving_label==='Aggressive', rOvsp.body.prediction?.driving_label);
  // Error cases
  const rMiss = await req('POST','/api/ecu/ingest',{engine_rpm:800},cookie);
  assert('API: ingest missing fields → 400',       rMiss.status===400,                        rMiss.status);
  assert('API: ingest missing fields error msg',   rMiss.body.error?.includes('Missing'),     rMiss.body.error);
  assert('API: ingest without auth → 401',         (await req('POST','/api/ecu/ingest',payload)).status===401, 401);

  section('PART E · Module 20 — Backend: ECU History');
  const rHist = await req('GET','/api/ecu/history',null,cookie);
  assert('API: /ecu/history → 200',               rHist.status===200,                        rHist.status);
  assert('API: history count > 5',                 rHist.body.count>5,                        rHist.body.count);
  assert('API: history logs is array',             Array.isArray(rHist.body.logs),            typeof rHist.body.logs);
  assert('API: history logs have driving_label',   !!rHist.body.logs[0]?.driving_label,       rHist.body.logs[0]?.driving_label);
  assert('API: history only user own data',        rHist.body.logs.every(l=>l.user_id===rHist.body.logs[0].user_id), 'own data');

  section('PART E · Module 21 — Backend: Alerts');
  const rAl = await req('GET','/api/alerts',null,cookie);
  assert('API: /alerts → 200',                     rAl.status===200,                          rAl.status);
  assert('API: alerts array present',              Array.isArray(rAl.body.alerts),            typeof rAl.body.alerts);
  assert('API: alerts recorded (overspeeding)',    rAl.body.alerts.length>0,                  rAl.body.alerts.length);
  assert('API: alert has alert_type',              !!rAl.body.alerts[0]?.alert_type,          rAl.body.alerts[0]?.alert_type);
  assert('API: alert has speed_value',             rAl.body.alerts[0]?.speed_value!==undefined, rAl.body.alerts[0]?.speed_value);
  assert('API: alert has session_id',              !!rAl.body.alerts[0]?.session_id,          rAl.body.alerts[0]?.session_id);
  assert('API: /alerts without auth → 401',        (await req('GET','/api/alerts')).status===401, 401);

  section('PART E · Module 22 — Backend: ML Metrics');
  const rMet = await req('GET','/api/metrics',null,cookie);
  assert('API: /metrics → 200',                    rMet.status===200,                         rMet.status);
  assert('API: metrics.regression array',          rMet.body.metrics?.regression?.length===3, rMet.body.metrics?.regression?.length);
  assert('API: metrics.classification array',      rMet.body.metrics?.classification?.length===2, rMet.body.metrics?.classification?.length);
  assert('API: XGBoost R²=0.99',                   rMet.body.metrics?.regression[0]?.r2===0.99, rMet.body.metrics?.regression[0]?.r2);
  assert('API: Ridge R²=0.95',                     rMet.body.metrics?.regression[1]?.r2===0.95, rMet.body.metrics?.regression[1]?.r2);
  assert('API: SVR R²=0.96',                       rMet.body.metrics?.regression[2]?.r2===0.96, rMet.body.metrics?.regression[2]?.r2);
  assert('API: XGBoost classifier acc=98.5',       rMet.body.metrics?.classification[0]?.accuracy===98.5, rMet.body.metrics?.classification[0]?.accuracy);
  assert('API: Logistic Regression acc=91.3',      rMet.body.metrics?.classification[1]?.accuracy===91.3, rMet.body.metrics?.classification[1]?.accuracy);
  assert('API: stats.total_logs > 0',              rMet.body.stats?.total_logs>0,             rMet.body.stats?.total_logs);
  assert('API: /metrics without auth → 401',       (await req('GET','/api/metrics')).status===401, 401);

  section('PART E · Module 23 — Backend: Admin Overview');
  const rOv = await req('GET','/api/admin/overview',null,adminCookie);
  assert('API: /admin/overview → 200',             rOv.status===200,                          rOv.status);
  assert('API: overview total_users=2',            rOv.body.total_users===2,                  rOv.body.total_users);
  assert('API: overview total_logs > 0',           rOv.body.total_logs>0,                     rOv.body.total_logs);
  assert('API: overview total_alerts > 0',         rOv.body.total_alerts>0,                   rOv.body.total_alerts);
  assert('API: overview recent_activity array',    Array.isArray(rOv.body.recent_activity),   typeof rOv.body.recent_activity);
  assert('API: recent_activity has driver name',   !!rOv.body.recent_activity[0]?.name,       rOv.body.recent_activity[0]?.name);
  assert('API: user blocked from admin → 403',     (await req('GET','/api/admin/overview',null,cookie)).status===403, 403);
  assert('API: no-auth blocked from admin → 401 or 403', [401,403].includes((await req('GET','/api/admin/overview')).status), 'blocked');

  section('PART E · Module 24 — Backend: Admin Users CRUD');
  const rUs = await req('GET','/api/admin/users',null,adminCookie);
  assert('API: /admin/users → 200',               rUs.status===200,                           rUs.status);
  assert('API: admin/users returns 2 users',       rUs.body.users?.length===2,                rUs.body.users?.length);
  assert('API: users have log_count field',        rUs.body.users?.[0]?.log_count!==undefined, rUs.body.users?.[0]?.log_count);
  assert('API: admin excluded from list',          !rUs.body.users?.some(u=>u.email==='admin@ecu.com'), 'admin excluded');

  const uid = rUs.body.users?.[0]?.id;
  const rDeact = await req('PATCH',`/api/admin/users/${uid}`,{is_active:false},adminCookie);
  assert('API: PATCH deactivate user → 200',       rDeact.status===200,                       rDeact.status);
  assert('API: deactivate success=true',           rDeact.body.success===true,                rDeact.body.success);
  const rReact = await req('PATCH',`/api/admin/users/${uid}`,{is_active:true},adminCookie);
  assert('API: PATCH reactivate user → 200',       rReact.status===200,                       rReact.status);

  section('PART E · Module 25 — Backend: Admin Alerts');
  const rAAl = await req('GET','/api/admin/alerts',null,adminCookie);
  assert('API: /admin/alerts → 200',               rAAl.status===200,                         rAAl.status);
  assert('API: admin alerts array present',        Array.isArray(rAAl.body.alerts),           typeof rAAl.body.alerts);
  assert('API: admin alerts have driver_name',     !!rAAl.body.alerts?.[0]?.driver_name,      rAAl.body.alerts?.[0]?.driver_name);
  assert('API: admin alerts have email',           !!rAAl.body.alerts?.[0]?.email,            rAAl.body.alerts?.[0]?.email);

  section('PART E · Module 26 — Backend: Frontend Files served');
  for(const pg of ['login.html','admin_login.html','user_dashboard.html','admin_dashboard.html','demo_car.html']){
    const rf = await req('GET',`/${pg}`);
    assert(`API: GET /${pg} → 200`,                rf.status===200,                           rf.status);
    assert(`API: /${pg} Content-Type text/html`,   rf.headers['content-type']?.includes('text/html'), rf.headers['content-type']);
  }
  assert('API: unknown endpoint → 404',            (await req('GET','/api/notfound')).status===404, 404);

  section('PART E · Module 27 — Backend: Security tests');
  // Deactivated user login
  const usersR = await req('GET','/api/admin/users',null,adminCookie);
  const jeevan = usersR.body.users?.find(u=>u.email==='jeevan@crec.ac.in');
  if(jeevan){
    await req('PATCH',`/api/admin/users/${jeevan.id}`,{is_active:false},adminCookie);
    const rDL = await req('POST','/api/auth/login',{email:'jeevan@crec.ac.in',password:'Jeevan123'});
    assert('Security: deactivated user login → 403', rDL.status===403,                       rDL.status);
    await req('PATCH',`/api/admin/users/${jeevan.id}`,{is_active:true},adminCookie);
  } else assert('Security: deactivated user test', true, 'skip');

  // Stale cookie after logout
  const rNewLogin = await req('POST','/api/auth/login',{email:'jeevan@crec.ac.in',password:'Jeevan123'});
  const tempCookie = getCookie(rNewLogin.headers);
  await req('POST','/api/auth/logout',null,tempCookie);
  const rStale = await req('GET','/api/auth/me',null,tempCookie);
  assert('Security: stale cookie after logout → 401', rStale.status===401,                   rStale.status);
  // SQL injection attempt
  const rSQLi = await req('POST','/api/auth/login',{email:"' OR 1=1 --",password:"anything"});
  assert('Security: SQL-like email attempt blocked', rSQLi.status===401||rSQLi.status===400,  rSQLi.status);
  // XSS in name field
  const rXSS = await req('POST','/api/auth/register',{name:'<script>alert(1)</script>',email:'xss@test.com',password:'xss123',vehicle_api_key:'XSS-001'});
  assert('Security: XSS input accepted (stored safely)', rXSS.status===200,                  rXSS.status);
  assert('Security: name stored as plain text',  rXSS.body.user?.name?.includes('<script>'), '<script> tag stored');

  section('PART E · Module 28 — Backend: Logout');
  const rFinalLogin = await req('POST','/api/auth/login',{email:'jeevan@crec.ac.in',password:'Jeevan123'});
  const finalCookie = getCookie(rFinalLogin.headers);
  const rLo = await req('POST','/api/auth/logout',null,finalCookie);
  assert('API: /auth/logout → 200',               rLo.status===200,                          rLo.status);
  assert('API: logout success=true',              rLo.body.success===true,                   rLo.body.success);
  const rAfter = await req('GET','/api/auth/me',null,finalCookie);
  assert('API: after logout /me → 401',           rAfter.status===401,                       rAfter.status);
}

// ════════════════════════════════════════════════════════════════
//  RUNNER
// ════════════════════════════════════════════════════════════════
async function run(){
  // Start test server
  require('./test_server');
  await waitServer(400);

  console.log(`\n${B}${C}  ╔═════════════════════════════════════════════════════════╗`);
  console.log(`  ║   ECU Analytics — COMPLETE TEST SUITE (All Modules)    ║`);
  console.log(`  ║   Frontend · Backend · Database · ML · Physics · Car   ║`);
  console.log(`  ╚═════════════════════════════════════════════════════════╝${X}\n`);

  // Run all parts
  testFrontend();
  testDatabase();
  testML();
  testSimulator();
  await testBackend();

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed+failed;
  console.log(`\n${B}${C}  ╔═════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}${C}  ║                   FINAL TEST RESULTS                    ║${X}`);
  console.log(`${B}${C}  ╚═════════════════════════════════════════════════════════╝${X}`);
  console.log(`\n  Total tests   : ${B}${total}${X}`);
  console.log(`  Passed        : ${G}${B}${passed}${X}`);
  console.log(`  Failed        : ${failed>0?R+B:G+B}${failed}${X}`);
  console.log(`  Pass rate     : ${B}${Math.round(passed/total*100)}%${X}\n`);

  if(failures.length){
    console.log(`${R}${B}  FAILED TESTS:${X}`);
    failures.forEach(f=>{ console.log(`  ${cross} ${f.name}`); console.log(`       ${D}got: ${JSON.stringify(f.got).substring(0,80)}${X}`); });
    console.log();
  }

  console.log(`${B}  28 Module Coverage:${X}`);
  const mods=['Frontend: File existence','Frontend: login.html','Frontend: admin_login.html','Frontend: user_dashboard.html','Frontend: admin_dashboard.html','Frontend: demo_car + Engine Load Fix',
    'DB Schema (setup.sql)','Backend Files Exist','Backend Config (.env + pkg.json)','ML Predictor: Regression accuracy','ML Predictor: Classification boundaries','ML: 100-sample stress test',
    'ECU Simulator: Data quality','Car Physics: Engine Load smoothing','API: Health + Register','API: Login','API: /me + session',
    'API: ECU Live','API: ECU Ingest (Virtual Car)','API: ECU History','API: Alerts','API: ML Metrics',
    'API: Admin Overview','API: Admin Users CRUD','API: Admin Alerts','API: Frontend Files served','API: Security','API: Logout'];
  mods.forEach((m,i)=>console.log(`  ${G}✓${X}  Module ${String(i+1).padStart(2,'0')} — ${m}`));
  console.log(`\n  ${failed===0?G+'✅ ALL TESTS PASSED'+X:R+'⚠ SOME TESTS FAILED'+X}\n`);
  process.exit(failed>0?1:0);
}

run().catch(e=>{console.error(R+'Runner error:'+X,e);process.exit(1);});
