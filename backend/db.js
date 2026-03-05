const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'ecu_analytics',
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4',
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('  ✓  MySQL connected — database:', process.env.DB_NAME || 'ecu_analytics');
    conn.release();
  })
  .catch(err => {
    console.error('  ✗  MySQL connection failed:', err.message);
    console.error('     → Make sure MySQL is running and .env is configured correctly');
  });

module.exports = pool;
