require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { connectDB, pool } = require('./config/database');

const authRoutes = require('./routes/auth');
const templatesRoutes = require('./routes/templates');
const reportsRoutes = require('./routes/reports');
const patientsRoutes = require('./routes/patients');

const app = express();
const PORT = process.env.PORT || 4060;
const publicDir = path.join(__dirname, 'public');

connectDB().catch((err) => {
  console.error('DB connection failed:', err.message);
});

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

async function healthHandler(req, res) {
  let db = 'down';
  let dbError = null;
  try {
    await pool.query('SELECT 1 AS ok');
    db = 'up';
  } catch (err) {
    dbError = err.message;
  }

  const ok = db === 'up';
  res.status(ok ? 200 : 503).json({
    success: ok,
    service: 'PetZone Laboratory',
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    node: process.version,
    database: db,
    ...(dbError ? { dbError } : {}),
    assets: {
      css: fs.existsSync(path.join(publicDir, 'css', 'styles.css')),
      js: fs.existsSync(path.join(publicDir, 'js', 'app.js')),
      logoPng: fs.existsSync(path.join(publicDir, 'img', 'petzonelogo.png')),
      logoSvg: fs.existsSync(path.join(publicDir, 'img', 'petzonelogo.svg')),
    },
  });
}

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

app.use('/api/auth/login', rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please wait' },
}));

app.use('/api/auth', authRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/patients', patientsRoutes);

app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/js', express.static(path.join(publicDir, 'js')));
app.use('/img', express.static(path.join(publicDir, 'img')));
app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});

app.get('/report/new', (req, res) => {
  res.sendFile(path.join(publicDir, 'report-new.html'));
});

app.get('/report/:id', (req, res) => {
  res.sendFile(path.join(publicDir, 'report-print.html'));
});

app.get('/report/:id/edit', (req, res) => {
  res.sendFile(path.join(publicDir, 'report-new.html'));
});

app.listen(PORT, () => {
  console.log(`PetZone Laboratory running on port ${PORT}`);
});
