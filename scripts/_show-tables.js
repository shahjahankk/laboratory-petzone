require('dotenv').config({ quiet: true });
const { pool } = require('../config/database');

(async () => {
  const [tables] = await pool.query('SHOW TABLES');
  console.log('Table count:', tables.length);
  console.log(tables);
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
