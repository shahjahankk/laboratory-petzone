require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { connectDB, pool } = require('./config/database');

const authRoutes = require('./routes/auth');
const templatesRoutes = require('./routes/templates');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 4060;

connectDB().catch((err) => {
  console.error('DB connection failed:', err.message);
});

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      configuredCorsOrigins.length === 0 ||
      configuredCorsOrigins.includes(origin) ||
      /^https:\/\/([a-z0-9-]+\.)*petzone\.pk$/i.test(origin) ||
      /^http:\/\/localhost(?::\d+)?$/i.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/report/new', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report-new.html'));
});

app.get('/report/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report-print.html'));
});

app.get('/report/:id/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report-new.html'));
});

app.listen(PORT, () => {
  console.log(`PetZone Laboratory running on port ${PORT}`);
});
