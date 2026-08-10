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

function sendPublic(res, fileName) {
  const full = path.join(publicDir, fileName);
  if (!fs.existsSync(full)) {
    return res.status(500).json({
      success: false,
      message: `Missing file: ${fileName}. Upload the latest public files to cPanel.`,
    });
  }
  return res.sendFile(full);
}

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
    files: {
      patient: fs.existsSync(path.join(publicDir, 'report-patient.html')),
      tests: fs.existsSync(path.join(publicDir, 'report-tests.html')),
      results: fs.existsSync(path.join(publicDir, 'report-results.html')),
      preview: fs.existsSync(path.join(publicDir, 'report-preview.html')),
      css: fs.existsSync(path.join(publicDir, 'css', 'styles.css')),
      js: fs.existsSync(path.join(publicDir, 'js', 'app.js')),
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

// HTML pages BEFORE static — avoids /report/new being treated as report id "new"
app.get('/', (req, res) => sendPublic(res, 'index.html'));
app.get('/login', (req, res) => sendPublic(res, 'login.html'));
app.get('/dashboard', (req, res) => sendPublic(res, 'dashboard.html'));

app.get('/report/new/tests', (req, res) => sendPublic(res, 'report-tests.html'));
app.get('/report/new/results', (req, res) => sendPublic(res, 'report-results.html'));
app.get('/report/new/preview', (req, res) => sendPublic(res, 'report-preview.html'));
app.get('/report/new', (req, res) => sendPublic(res, 'report-patient.html'));

app.get('/report/:id/edit', (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.redirect('/report/new?fresh=1');
  }
  return res.redirect(`/report/new?edit=${encodeURIComponent(req.params.id)}`);
});

app.get('/report/:id', (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.redirect('/report/new?fresh=1');
  }
  return sendPublic(res, 'report-print.html');
});

app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/js', express.static(path.join(publicDir, 'js')));
app.use('/img', express.static(path.join(publicDir, 'img')));
app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`PetZone Laboratory running on port ${PORT}`);
});
