const router    = require('express').Router();
const fs        = require('fs');
const path      = require('path');
const db        = require('../db');
const predictor = require('../ml/predictor');
const { requireUser } = require('../middleware/auth');

const CSV_PATH = path.join(__dirname, '../../../ecu_data.csv');

// ── Helper: read last row from CSV ────────────────────────────────────────────
function readLatestCSV() {
  try {
    if (!fs.existsSync(CSV_PATH)) return null;
    const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n');
    if (lines.length < 2) return null;
    const headers = lines[0].split(',');
    const values  = lines[lines.length - 1].split(',');
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = parseFloat(values[i]) || 0; });
    return row;
  } catch { return null; }
}

// ── Helper: generate synthetic ECU row ───────────────────────────────────────
let _simState = { rpm: 1800, speed: 45, throttle: 25, load: 40, coolant: 88 };
function syntheticRow() {
  const sm = (v, t) => v + 0.08 * (t - v) + (Math.random() - 0.5) * 8;
  _simState.rpm      = Math.max(800,  Math.min(6500, sm(_simState.rpm, 1500 + Math.random() * 2500)));
  _simState.speed    = Math.max(0,    Math.min(130,  sm(_simState.speed, 20 + Math.random() * 80)));
  _simState.throttle = Math.max(5,    Math.min(90,   sm(_simState.throttle, 15 + Math.random() * 60)));
  _simState.load     = Math.max(15,   Math.min(90,   sm(_simState.load, 25 + Math.random() * 55)));
  _simState.coolant  = Math.max(82,   Math.min(98,   sm(_simState.coolant, 90)));
  const maf = Math.max(1, _simState.rpm / 600 + Math.random());
  const accel = (Math.random() - 0.5) * 1.5;
  const fuel = Math.max(0.3, _simState.rpm * 0.00028 + _simState.load * 0.04 + _simState.throttle * 0.018);
  return {
    engine_rpm:          parseFloat(_simState.rpm.toFixed(1)),
    vehicle_speed:       parseFloat(_simState.speed.toFixed(1)),
    throttle_position:   parseFloat(_simState.throttle.toFixed(1)),
    acceleration:        parseFloat(accel.toFixed(3)),
    engine_load:         parseFloat(_simState.load.toFixed(1)),
    fuel_injection_rate: parseFloat(fuel.toFixed(3)),
    coolant_temperature: parseFloat(_simState.coolant.toFixed(1)),
    mass_air_flow:       parseFloat(maf.toFixed(2)),
  };
}

// ── Persist to DB + create alerts ─────────────────────────────────────────────
async function saveTelemetry(userId, sessionId, ecu, prediction) {
  const [result] = await db.query(
    `INSERT INTO telemetry_log
      (user_id, session_id, engine_rpm, vehicle_speed, throttle_position,
       acceleration, engine_load, fuel_injection_rate, coolant_temperature,
       mass_air_flow, fuel_predicted_xgb, fuel_predicted_ridge, fuel_predicted_svr,
       fuel_avg, driving_label, driving_code, speed_alert)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      userId, sessionId,
      ecu.engine_rpm, ecu.vehicle_speed, ecu.throttle_position,
      ecu.acceleration || 0, ecu.engine_load, ecu.fuel_injection_rate || prediction.fuel_xgb,
      ecu.coolant_temperature, ecu.mass_air_flow,
      prediction.fuel_xgb, prediction.fuel_ridge, prediction.fuel_svr,
      prediction.fuel_avg, prediction.driving_label, prediction.driving_code,
      prediction.speed_alert ? 1 : 0,
    ]
  );

  if (prediction.speed_alert) {
    await db.query(
      'INSERT INTO alerts (user_id, session_id, alert_type, rpm_value, speed_value) VALUES (?,?,?,?,?)',
      [userId, sessionId, 'overspeeding', ecu.engine_rpm, ecu.vehicle_speed]
    );
  }
  if (prediction.driving_label === 'Aggressive') {
    await db.query(
      'INSERT INTO alerts (user_id, session_id, alert_type, rpm_value, speed_value) VALUES (?,?,?,?,?)',
      [userId, sessionId, 'aggressive_driving', ecu.engine_rpm, ecu.vehicle_speed]
    );
  }

  return result.insertId;
}

// GET /api/ecu/live?session_id=...
router.get('/live', requireUser, async (req, res) => {
  try {
    const sessionId = req.query.session_id || `sess-${Date.now()}`;
    const ecu       = readLatestCSV() || syntheticRow();
    const prediction = predictor.predict(ecu);
    const logId = await saveTelemetry(req.user.id, sessionId, ecu, prediction);
    res.json({ session_id: sessionId, timestamp: new Date().toISOString(),
               ecu, prediction, log_id: logId });
  } catch (err) {
    console.error('Live ECU error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ecu/ingest  ← Virtual car sends data here
router.post('/ingest', requireUser, async (req, res) => {
  try {
    const body = req.body;
    const required = ['engine_rpm','vehicle_speed','throttle_position','engine_load','coolant_temperature','mass_air_flow'];
    const missing  = required.filter(f => body[f] === undefined);
    if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });

    const ecu = {
      engine_rpm:          parseFloat(body.engine_rpm),
      vehicle_speed:       parseFloat(body.vehicle_speed),
      throttle_position:   parseFloat(body.throttle_position),
      acceleration:        parseFloat(body.acceleration)  || 0,
      engine_load:         parseFloat(body.engine_load),
      fuel_injection_rate: parseFloat(body.fuel_injection_rate) || parseFloat(body.engine_rpm) * 0.0028,
      coolant_temperature: parseFloat(body.coolant_temperature),
      mass_air_flow:       parseFloat(body.mass_air_flow),
    };

    const sessionId  = body.session_id || `demo-${Date.now()}`;
    const prediction = predictor.predict(ecu);
    const logId      = await saveTelemetry(req.user.id, sessionId, ecu, prediction);

    // Append to CSV so live dashboard sees virtual car data
    appendCSV(ecu);

    res.json({ status: 'ok', session_id: sessionId,
               timestamp: new Date().toISOString(),
               log_id: logId, ecu, prediction });
  } catch (err) {
    console.error('Ingest error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/ecu/history
router.get('/history', requireUser, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const [rows] = await db.query(
      `SELECT * FROM telemetry_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`,
      [req.user.id, limit]
    );
    res.json({ count: rows.length, logs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── CSV helper ────────────────────────────────────────────────────────────────
function appendCSV(ecu) {
  try {
    const cols = ['engine_rpm','vehicle_speed','throttle_position','acceleration',
                  'engine_load','fuel_injection_rate','coolant_temperature','mass_air_flow'];
    const header = !fs.existsSync(CSV_PATH);
    const line   = cols.map(c => ecu[c] ?? 0).join(',');
    const row    = new Date().toISOString() + ',' + line + '\n';
    if (header) fs.writeFileSync(CSV_PATH, 'timestamp,' + cols.join(',') + '\n');
    fs.appendFileSync(CSV_PATH, row);
  } catch { /* non-critical */ }
}

module.exports = router;
