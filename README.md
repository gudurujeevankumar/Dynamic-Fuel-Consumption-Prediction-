# ECU Analytics — Node.js + Express + MySQL

**B.Tech Final Year Project**
Machine Learning for Real-Time Fuel Consumption Prediction and Driving Profile Classification Based on ECU Data

**Team:** G. Jeevan Kumar · D. Sujith · G. Guru Devendra · B. Kalyani
**College:** CREC Tirupati · 2025–26

---

## ⚡ Quickstart (3 Steps)

### 1. Install Requirements
- **Node.js 18+** → https://nodejs.org (choose LTS)
- **MySQL 8.0** → https://dev.mysql.com/downloads/installer

### 2. Configure Database Password (if needed)
Edit `backend/.env`:
```
DB_PASSWORD=your_mysql_password_here
```
If MySQL has no password, leave it empty.

### 3. Run
```bash
node start.js
```
That's it! Opens browser automatically at http://localhost:3000

---

## Manual Setup (if start.js fails)

```bash
# Install packages
cd backend
npm install

# Set up MySQL (run in MySQL shell)
mysql -u root -p < ../database/setup.sql

# Start server
node server.js
```

Open http://localhost:3000 in browser.

---

## Login Credentials

| Role  | Email           | Password |
|-------|-----------------|----------|
| Admin | admin@ecu.com   | admin123 |
| User  | Register yourself via /login.html |

Vehicle API Key examples when registering:
- `TYT-2024-001` → Toyota Innova Crysta
- `HON-2024-001` → Honda City
- `HYN-2024-001` → Hyundai Creta
- `TAT-2024-001` → Tata Nexon

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user info |
| GET | /api/ecu/live | Live ECU data + ML prediction |
| POST | /api/ecu/ingest | Virtual car POST (saves to DB) |
| GET | /api/ecu/history | Session history |
| GET | /api/alerts | User alerts |
| GET | /api/metrics | ML model metrics |
| GET | /api/admin/overview | Admin stats |
| GET | /api/admin/users | All users |
| PATCH | /api/admin/users/:id | Toggle user active |
| GET | /api/admin/alerts | All system alerts |
| GET | /api/health | Health check |

---

## Project Structure

```
ecu_project_node/
├── start.js                   ← ONE-CLICK STARTUP
├── backend/
│   ├── server.js              ← Express app + static file serving
│   ├── db.js                  ← MySQL connection pool
│   ├── .env                   ← Database credentials
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js            ← Session authentication
│   ├── ml/
│   │   └── predictor.js       ← Fuel prediction + driving classifier
│   └── routes/
│       ├── auth.js            ← Register, login, logout
│       ├── ecu.js             ← Live data, ingest, history
│       ├── alerts.js          ← User alerts
│       ├── metrics.js         ← ML metrics
│       └── admin.js           ← Admin endpoints
├── frontend/
│   ├── login.html             ← User login + register
│   ├── admin_login.html       ← Admin login
│   ├── user_dashboard.html    ← Live dashboard (4 sections)
│   ├── admin_dashboard.html   ← Admin panel
│   └── demo_car.html          ← Virtual car with live ML
├── database/
│   └── setup.sql              ← MySQL schema
└── scripts/
    └── ecu_generator.js       ← ECU simulator (optional)
```

---

## Run ECU Data Generator (Optional)
In a second terminal:
```bash
node scripts/ecu_generator.js
```
This simulates real-time ECU data every second.

---

## Troubleshooting

**MySQL connection failed:**
- Make sure MySQL service is running
- Check DB_PASSWORD in backend/.env
- Try: `mysql -u root -p -e "CREATE DATABASE ecu_analytics;"`

**Port 3000 already in use:**
Change PORT in backend/.env to 3001 or any free port

**npm install fails:**
- Make sure Node.js 16+ is installed
- Try: `npm install --legacy-peer-deps`



# Dynamic-Fuel-Consumption-Prediction-