const mysql = require('mysql2/promise');

const dbPort = parseInt(process.env.DB_PORT || '3306', 10);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number.isFinite(dbPort) ? dbPort : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petzonep_laboratory',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '20', 10),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '50', 10),
  charset: 'utf8mb4',
  timezone: 'Z',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

const pool = mysql.createPool(dbConfig);

const executeQuery = async (query, params = []) => {
  const [rows] = await pool.execute(query, params);
  return rows;
};

const connectDB = async () => {
  const conn = await pool.getConnection();
  conn.release();
  console.log(`MySQL connected: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
};

module.exports = { pool, executeQuery, connectDB };
