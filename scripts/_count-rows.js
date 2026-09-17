require('dotenv').config({ quiet: true });
const { pool } = require('../config/database');

(async () => {
  const [tables] = await pool.query('SHOW TABLES');
  const key = Object.keys(tables[0])[0];
  let total = 0;
  for (const t of tables) {
    const name = t[key];
    try {
      const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM `' + name + '`');
      total += cnt;
      console.log(String(name).padEnd(35), cnt);
    } catch (e) {
      console.log(String(name).padEnd(35), 'ERROR:', e.message);
    }
  }
  console.log('-'.repeat(45));
  console.log('TOTAL ROWS'.padEnd(35), total);
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
