/**
 * ECU Data Generator — Node.js
 * ==============================
 * Simulates real-time ECU telemetry and writes to ecu_data.csv
 * Run: node scripts/ecu_generator.js
 */

const fs   = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../ecu_data.csv');
const HEADERS  = [
  'timestamp','engine_rpm','vehicle_speed','throttle_position',
  'acceleration','engine_load','fuel_injection_rate','coolant_temperature','mass_air_flow'
];

// ── Physics state ─────────────────────────────────────────────────────────────
const state = {
  rpm:      800,
  speed:    0,
  throttle: 5,
  load:     20,
  coolant:  30,
  profile:  0,       // 0=Eco, 1=Normal, 2=Aggressive
  profTimer: 0,
  profDuration: randomInt(30, 90),
};

function randomInt(min, max) { return Math.floor(Math.random() * (max - min)) + min; }
function rand(min, max)      { return min + Math.random() * (max - min); }
function smooth(v, t, r=0.08){ return v + r * (t - v); }

function profileTargets() {
  if (state.profile === 0) return { rpm: [900, 2000],  speed: [15, 60],   throttle: [8, 30],  load: [18, 50] };
  if (state.profile === 1) return { rpm: [1400, 3500], speed: [35, 90],   throttle: [22, 55], load: [38, 72] };
                           return { rpm: [2800, 6500], speed: [75, 140],  throttle: [58, 92], load: [62, 95] };
}

function step() {
  state.profTimer++;
  if (state.profTimer >= state.profDuration) {
    state.profile     = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2;
    state.profDuration = randomInt(25, 85);
    state.profTimer    = 0;
  }

  const t = profileTargets();
  const prevSpeed = state.speed;

  state.rpm      = smooth(state.rpm,      rand(t.rpm[0],      t.rpm[1]),      0.06);
  state.speed    = smooth(state.speed,    rand(t.speed[0],    t.speed[1]),    0.04);
  state.throttle = smooth(state.throttle, rand(t.throttle[0], t.throttle[1]), 0.08);
  state.load     = smooth(state.load,     rand(t.load[0],     t.load[1]),     0.07);

  if (state.coolant < 85) state.coolant += rand(0.2, 0.9);
  else state.coolant = smooth(state.coolant, 90, 0.01) + rand(-0.4, 0.4);

  const fuel  = Math.max(0.3, Math.min(28, 0.00038 * state.rpm + 0.048 * state.load + 0.019 * state.throttle + rand(-0.08, 0.08)));
  const maf   = Math.max(1, state.rpm / 600 * (state.throttle / 100) * 12 + rand(-0.4, 0.4));
  const accel = (state.speed - prevSpeed) / 3.6;

  return {
    timestamp:          new Date().toISOString(),
    engine_rpm:         +state.rpm.toFixed(1),
    vehicle_speed:      +state.speed.toFixed(1),
    throttle_position:  +state.throttle.toFixed(1),
    acceleration:       +accel.toFixed(3),
    engine_load:        +state.load.toFixed(1),
    fuel_injection_rate:+fuel.toFixed(3),
    coolant_temperature:+state.coolant.toFixed(1),
    mass_air_flow:      +maf.toFixed(2),
  };
}

// ── Write header if new file ──────────────────────────────────────────────────
if (!fs.existsSync(CSV_PATH)) {
  fs.writeFileSync(CSV_PATH, HEADERS.join(',') + '\n');
  console.log('  Created ecu_data.csv');
}

const LABELS = ['ECO', 'NORMAL', 'AGGRESSIVE'];
console.log('\n  ⚡ ECU Data Generator running → ecu_data.csv');
console.log('  Press Ctrl+C to stop\n');

setInterval(() => {
  const row = step();
  const line = HEADERS.map(h => row[h]).join(',') + '\n';
  fs.appendFileSync(CSV_PATH, line);

  const lbl = state.profile === 0 ? '🌿 ECO' : state.profile === 1 ? '🚗 NORMAL' : '🔥 AGGRESSIVE';
  process.stdout.write(
    `\r  RPM: ${row.engine_rpm.toFixed(0).padStart(5)}  ` +
    `Speed: ${row.vehicle_speed.toFixed(1).padStart(5)} km/h  ` +
    `Fuel: ${row.fuel_injection_rate.toFixed(2).padStart(5)} L/h  ` +
    `${lbl}   `
  );
}, 1000);
