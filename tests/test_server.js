/**
 * ECU Analytics — Self-Contained Test Server
 * Uses ONLY Node.js built-in modules (no npm/MySQL needed)
 * Tests every module: auth, ECU, ML predictor, alerts, metrics, admin
 */

const http    = require('http');
const crypto  = require('crypto');
const url     = require('url');
const fs      = require('fs');
const path    = require('path');

const PORT = 4000;

// ════════════════════════════════════════════════════════════════
//  IN-MEMORY DATABASE  (replaces MySQL for testing)
// ════════════════════════════════════════════════════════════════
const DB = {
  users:        [],
  telemetry:    [],
  alerts:       [],
  sessions:     {},   // sessionId → userId
  _uid: 1, _tid: 1, _aid: 1,
};

// Seed admin user (password: admin123 — sha256 for test simplicity)
function hashPw(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }
DB.users.push({
  id: DB._uid++, name: 'Administrator', email: 'admin@ecu.com',
  password_hash: hashPw('admin123'), vehicle_api_key: 'ADMIN-KEY-001',
  vehicle_company: null, vehicle_model: null, vehicle_year: null,
  is_active: 1, is_admin: 1, created_at: new Date().toISOString(), last_login: null
});

// ════════════════════════════════════════════════════════════════
//  ML PREDICTOR (mirrors ml/predictor.js exactly)
// ════════════════════════════════════════════════════════════════
function predict(row) {
  const f = {
    engine_rpm:          Number(row.engine_rpm)          || 0,
    vehicle_speed:       Number(row.vehicle_speed)       || 0,
    throttle_position:   Number(row.throttle_position)   || 0,
    acceleration:        Number(row.acceleration)        || 0,
    engine_load:         Number(row.engine_load)         || 0,
    mass_air_flow:       Number(row.mass_air_flow)       || 0,
    coolant_temperature: Number(row.coolant_temperature) || 85,
  };
  // XGBoost-equivalent regression
  const xgb   = Math.max(0.3, 0.42 + f.engine_rpm*0.00258 + f.engine_load*0.0385 + f.throttle_position*0.0192 + f.mass_air_flow*0.048 + f.vehicle_speed*0.0065 + Math.max(0,f.acceleration)*0.18);
  const ridge = Math.max(0.3, xgb + 0.14);
  const svr   = Math.max(0.3, xgb - 0.09);
  const avg   = (xgb + ridge + svr) / 3;

  // Classifier
  let sc = 0;
  if (f.engine_rpm > 4000) sc += 3; else if (f.engine_rpm > 3000) sc += 2; else if (f.engine_rpm > 1800) sc += 1;
  if (f.vehicle_speed > 110) sc += 4; else if (f.vehicle_speed > 90) sc += 3; else if (f.vehicle_speed > 55) sc += 1;
  if (f.throttle_position > 70) sc += 2; else if (f.throttle_position > 30) sc += 1;
  if (f.acceleration > 1.5) sc += 2; else if (f.acceleration > 0.5) sc += 1;
  if (f.engine_load > 80) sc += 1;
  const label = sc <= 2 ? 'Eco' : sc <= 6 ? 'Normal' : 'Aggressive';

  return {
    fuel_xgb:      +xgb.toFixed(3),
    fuel_ridge:    +ridge.toFixed(3),
    fuel_svr:      +svr.toFixed(3),
    fuel_avg:      +avg.toFixed(3),
    driving_label: label,
    driving_code:  sc <= 2 ? 0 : sc <= 6 ? 1 : 2,
    speed_alert:   f.vehicle_speed > 100,
  };
}

// ════════════════════════════════════════════════════════════════
//  ECU SIMULATOR (mirrors scripts/ecu_generator.js)
// ════════════════════════════════════════════════════════════════
const simState = { rpm:800, speed:0, throttle:5, load:20, coolant:30, profile:0, timer:0, dur:45 };
function simStep() {
  simState.timer++;
  if (simState.timer >= simState.dur) {
    simState.profile = Math.random()<.5?0:Math.random()<.7?1:2;
    simState.dur = 30 + Math.floor(Math.random()*60);
    simState.timer = 0;
  }
  const t = simState.profile===0
    ? {rpm:[900,2000],spd:[15,60],thr:[8,30],load:[18,50]}
    : simState.profile===1
    ? {rpm:[1400,3500],spd:[35,90],thr:[22,55],load:[38,72]}
    : {rpm:[2800,6500],spd:[75,140],thr:[58,92],load:[62,95]};
  const r=(a,b)=>a+Math.random()*(b-a);
  const sm=(v,t)=>v+0.08*(t-v);
  const prev=simState.speed;
  simState.rpm=sm(simState.rpm,r(...t.rpm));
  simState.speed=sm(simState.speed,r(...t.spd));
  simState.throttle=sm(simState.throttle,r(...t.thr));
  simState.load=sm(simState.load,r(...t.load));
  simState.coolant=simState.coolant<85?simState.coolant+r(0.2,0.9):sm(simState.coolant,90)+r(-0.4,0.4);
  const fuel=Math.max(0.3,Math.min(28,0.00038*simState.rpm+0.048*simState.load+0.019*simState.throttle));
  const maf=Math.max(1,simState.rpm/600*(simState.throttle/100)*12+r(-0.4,0.4));
  const accel=(simState.speed-prev)/3.6;
  return {
    engine_rpm:          +simState.rpm.toFixed(1),
    vehicle_speed:       +simState.speed.toFixed(1),
    throttle_position:   +simState.throttle.toFixed(1),
    acceleration:        +accel.toFixed(3),
    engine_load:         +simState.load.toFixed(1),
    fuel_injection_rate: +fuel.toFixed(3),
    coolant_temperature: +simState.coolant.toFixed(1),
    mass_air_flow:       +maf.toFixed(2),
  };
}

// ════════════════════════════════════════════════════════════════
//  AUTH HELPERS
// ════════════════════════════════════════════════════════════════
const VEHICLE_MAP = {
  TYT:['Toyota','Innova Crysta',2022], HON:['Honda','City',2023],
  MAR:['Maruti','Swift',2021],         HYN:['Hyundai','Creta',2023],
  KIA:['Kia','Seltos',2023],           TAT:['Tata','Nexon EV',2023],
  MHN:['Mahindra','XUV700',2022],      BMW:['BMW','3 Series',2022],
};
function getSession(req) {
  const cookie = req.headers.cookie||'';
  const m = cookie.match(/sid=([^;]+)/);
  return m ? DB.sessions[m[1]] : null;
}
function setSession(res, userId) {
  const sid = crypto.randomBytes(16).toString('hex');
  DB.sessions[sid] = userId;
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Max-Age=86400; Path=/`);
  return sid;
}

// ════════════════════════════════════════════════════════════════
//  ROUTER
// ════════════════════════════════════════════════════════════════
function json(res, data, status=200) {
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Credentials':'true'});
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body||'{}')); } catch { resolve({}); } });
  });
}

async function route(req, res) {
  const parsed  = url.parse(req.url, true);
  const p       = parsed.pathname.replace(/\/$/, '');
  const method  = req.method;
  const query   = parsed.query;
  const userId  = getSession(req);
  const user    = userId ? DB.users.find(u=>u.id===userId) : null;

  // OPTIONS preflight
  if (method === 'OPTIONS') { res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE'}); return res.end(); }

  // ── Health
  if (p === '/api/health') return json(res, { status:'ok', time: new Date().toISOString(), users: DB.users.length, telemetry: DB.telemetry.length });

  // ── Auth: Register
  if (p==='/api/auth/register' && method==='POST') {
    const b = await readBody(req);
    if (!b.name||!b.email||!b.password||!b.vehicle_api_key) return json(res,{error:'All fields required'},400);
    if (DB.users.find(u=>u.email===b.email)) return json(res,{error:'Email already registered'},409);
    if (DB.users.find(u=>u.vehicle_api_key===b.vehicle_api_key)) return json(res,{error:'API key already registered'},409);
    const prefix = b.vehicle_api_key.substring(0,3).toUpperCase();
    const [make='Generic', model='Sedan', year=2020] = VEHICLE_MAP[prefix]||[];
    const newUser = { id:DB._uid++, name:b.name, email:b.email, password_hash:hashPw(b.password),
      vehicle_api_key:b.vehicle_api_key, vehicle_company:make, vehicle_model:model, vehicle_year:year,
      is_active:1, is_admin:0, created_at:new Date().toISOString(), last_login:null };
    DB.users.push(newUser);
    return json(res,{ success:true, user:{ id:newUser.id, name:newUser.name, email:newUser.email,
      vehicle_company:make, vehicle_model:model, vehicle_year:year }});
  }

  // ── Auth: Login
  if (p==='/api/auth/login' && method==='POST') {
    const b = await readBody(req);
    const u = DB.users.find(u=>u.email===b.email);
    if (!u) return json(res,{error:'Invalid email or password'},401);
    if (!u.is_active) return json(res,{error:'Account deactivated'},403);
    if (u.password_hash !== hashPw(b.password)) return json(res,{error:'Invalid email or password'},401);
    u.last_login = new Date().toISOString();
    setSession(res, u.id);
    return json(res,{ success:true, is_admin:u.is_admin, user:{id:u.id,name:u.name,email:u.email,
      vehicle_company:u.vehicle_company, vehicle_model:u.vehicle_model, vehicle_year:u.vehicle_year,
      vehicle_api_key:u.vehicle_api_key }});
  }

  // ── Auth: Logout
  if (p==='/api/auth/logout' && method==='POST') {
    const cookie = req.headers.cookie||'';
    const m = cookie.match(/sid=([^;]+)/);
    if (m) delete DB.sessions[m[1]];
    return json(res,{success:true});
  }

  // ── Auth: Me
  if (p==='/api/auth/me' && method==='GET') {
    if (!user) return json(res,{error:'Unauthorized'},401);
    return json(res,{id:user.id,name:user.name,email:user.email,is_admin:user.is_admin,
      vehicle_company:user.vehicle_company, vehicle_model:user.vehicle_model,
      vehicle_year:user.vehicle_year, vehicle_api_key:user.vehicle_api_key});
  }

  // ── ECU: Live
  if (p==='/api/ecu/live' && method==='GET') {
    if (!user) return json(res,{error:'Unauthorized'},401);
    const sessionId = query.session_id || `sess-${Date.now()}`;
    const ecu = simStep();
    const pred = predict(ecu);
    const log = { id:DB._tid++, user_id:user.id, session_id:sessionId,
      timestamp:new Date().toISOString(), ...ecu, ...{
      fuel_predicted_xgb:pred.fuel_xgb, fuel_predicted_ridge:pred.fuel_ridge,
      fuel_predicted_svr:pred.fuel_svr, fuel_avg:pred.fuel_avg,
      driving_label:pred.driving_label, driving_code:pred.driving_code, speed_alert:pred.speed_alert }};
    DB.telemetry.push(log);
    if (pred.speed_alert) DB.alerts.push({id:DB._aid++,user_id:user.id,session_id:sessionId,alert_type:'overspeeding',rpm_value:ecu.engine_rpm,speed_value:ecu.vehicle_speed,timestamp:new Date().toISOString()});
    if (pred.driving_label==='Aggressive') DB.alerts.push({id:DB._aid++,user_id:user.id,session_id:sessionId,alert_type:'aggressive_driving',rpm_value:ecu.engine_rpm,speed_value:ecu.vehicle_speed,timestamp:new Date().toISOString()});
    return json(res,{ session_id:sessionId, timestamp:log.timestamp, log_id:log.id, ecu, prediction:pred });
  }

  // ── ECU: Ingest (Virtual Car)
  if (p==='/api/ecu/ingest' && method==='POST') {
    if (!user) return json(res,{error:'Unauthorized'},401);
    const b = await readBody(req);
    const required=['engine_rpm','vehicle_speed','throttle_position','engine_load','coolant_temperature','mass_air_flow'];
    const missing = required.filter(f=>b[f]===undefined);
    if (missing.length) return json(res,{error:`Missing: ${missing.join(', ')}`},400);
    const ecu = { engine_rpm:+b.engine_rpm, vehicle_speed:+b.vehicle_speed, throttle_position:+b.throttle_position,
      acceleration:+b.acceleration||0, engine_load:+b.engine_load, fuel_injection_rate:+b.fuel_injection_rate||+b.engine_rpm*0.0028,
      coolant_temperature:+b.coolant_temperature, mass_air_flow:+b.mass_air_flow };
    const sessionId = b.session_id||`demo-${Date.now()}`;
    const pred = predict(ecu);
    const log = { id:DB._tid++, user_id:user.id, session_id:sessionId, timestamp:new Date().toISOString(),
      ...ecu, fuel_predicted_xgb:pred.fuel_xgb, fuel_predicted_ridge:pred.fuel_ridge,
      fuel_predicted_svr:pred.fuel_svr, fuel_avg:pred.fuel_avg,
      driving_label:pred.driving_label, driving_code:pred.driving_code, speed_alert:pred.speed_alert };
    DB.telemetry.push(log);
    if (pred.speed_alert) DB.alerts.push({id:DB._aid++,user_id:user.id,session_id:sessionId,alert_type:'overspeeding',rpm_value:ecu.engine_rpm,speed_value:ecu.vehicle_speed,timestamp:new Date().toISOString()});
    if (pred.driving_label==='Aggressive') DB.alerts.push({id:DB._aid++,user_id:user.id,session_id:sessionId,alert_type:'aggressive_driving',rpm_value:ecu.engine_rpm,speed_value:ecu.vehicle_speed,timestamp:new Date().toISOString()});
    return json(res,{status:'ok',session_id:sessionId,timestamp:log.timestamp,log_id:log.id,ecu,prediction:pred});
  }

  // ── ECU: History
  if (p==='/api/ecu/history' && method==='GET') {
    if (!user) return json(res,{error:'Unauthorized'},401);
    const logs = DB.telemetry.filter(t=>t.user_id===user.id).slice(-100).reverse();
    return json(res,{count:logs.length, logs});
  }

  // ── Alerts
  if (p==='/api/alerts' && method==='GET') {
    if (!user) return json(res,{error:'Unauthorized'},401);
    const alerts = DB.alerts.filter(a=>a.user_id===user.id).slice(-100).reverse();
    return json(res,{alerts});
  }

  // ── Metrics
  if (p==='/api/metrics' && method==='GET') {
    if (!user) return json(res,{error:'Unauthorized'},401);
    return json(res,{
      metrics:{
        regression:[
          {model:'XGBoost Regressor',r2:0.99,mse:0.28,mae:0.31},
          {model:'Ridge Regression', r2:0.95,mse:0.84,mae:0.72},
          {model:'SVR (RBF kernel)', r2:0.96,mse:0.68,mae:0.61},
        ],
        classification:[
          {model:'XGBoost Classifier',  accuracy:98.5,precision:98.2,recall:98.5,f1:98.3},
          {model:'Logistic Regression', accuracy:91.3,precision:90.8,recall:91.3,f1:91.0},
        ],
      },
      stats:{ total_logs: DB.telemetry.filter(t=>t.user_id===user.id).length,
              sessions: [...new Set(DB.telemetry.filter(t=>t.user_id===user.id).map(t=>t.session_id))].length }
    });
  }

  // ── Admin: Overview
  if (p==='/api/admin/overview' && method==='GET') {
    if (!user||!user.is_admin) return json(res,{error:'Admin only'},403);
    const nonAdmins = DB.users.filter(u=>!u.is_admin);
    return json(res,{
      total_users:    nonAdmins.length,
      active_users:   nonAdmins.filter(u=>u.is_active).length,
      total_logs:     DB.telemetry.length,
      total_alerts:   DB.alerts.length,
      total_sessions: [...new Set(DB.telemetry.map(t=>t.session_id))].length,
      recent_activity: DB.telemetry.slice(-10).reverse().map(t=>{
        const u=DB.users.find(u=>u.id===t.user_id)||{};
        return {...t, name:u.name, email:u.email, vehicle_company:u.vehicle_company, vehicle_model:u.vehicle_model};
      })
    });
  }

  // ── Admin: Users
  if (p==='/api/admin/users' && method==='GET') {
    if (!user||!user.is_admin) return json(res,{error:'Admin only'},403);
    const users = DB.users.filter(u=>!u.is_admin).map(u=>({
      ...u, log_count: DB.telemetry.filter(t=>t.user_id===u.id).length,
      last_label: DB.telemetry.filter(t=>t.user_id===u.id).slice(-1)[0]?.driving_label
    }));
    return json(res,{users});
  }

  // ── Admin: Toggle user
  const userMatch = p.match(/^\/api\/admin\/users\/(\d+)$/);
  if (userMatch && method==='PATCH') {
    if (!user||!user.is_admin) return json(res,{error:'Admin only'},403);
    const b = await readBody(req);
    const target = DB.users.find(u=>u.id===parseInt(userMatch[1])&&!u.is_admin);
    if (!target) return json(res,{error:'User not found'},404);
    target.is_active = b.is_active ? 1 : 0;
    return json(res,{success:true});
  }

  // ── Admin: All Alerts
  if (p==='/api/admin/alerts' && method==='GET') {
    if (!user||!user.is_admin) return json(res,{error:'Admin only'},403);
    const alerts = DB.alerts.slice(-200).reverse().map(a=>{
      const u=DB.users.find(u=>u.id===a.user_id)||{};
      return {...a, driver_name:u.name, email:u.email};
    });
    return json(res,{alerts});
  }

  // Serve static frontend
  if (method === 'GET' && !p.startsWith('/api/')) {
    const filePath = path.join(__dirname, 'frontend', p==='/'?'login.html':p.slice(1));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css'}[ext]||'text/plain';
      res.writeHead(200,{'Content-Type':mime});
      return res.end(fs.readFileSync(filePath));
    }
  }

  json(res,{error:`Not found: ${method} ${p}`},404);
}

const server = http.createServer(route);
server.listen(PORT, () => console.log(`\n  ⚡ Test server running → http://localhost:${PORT}\n`));
module.exports = { DB, predict, simStep };
