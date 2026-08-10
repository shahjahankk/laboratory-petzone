const express = require('express');
const { executeQuery } = require('../config/database');
const { hashPassword, verifyPassword, signToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

function setAuthCookie(res, token) {
  res.cookie('lab_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.get('/status', async (req, res) => {
  try {
    const rows = await executeQuery('SELECT COUNT(*) AS total FROM lab_users');
    res.json({ success: true, needsSetup: Number(rows[0].total) === 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const existing = await executeQuery('SELECT COUNT(*) AS total FROM lab_users');
    if (Number(existing[0].total) > 0) {
      return res.status(400).json({ success: false, message: 'Setup already completed' });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const result = await executeQuery(
      `INSERT INTO lab_users (name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'admin', 1)`,
      [name.trim(), email.toLowerCase().trim(), hashPassword(password)]
    );

    const token = signToken({ userId: result.insertId, role: 'admin' });
    setAuthCookie(res, token);

    res.json({
      success: true,
      token,
      user: {
        id: result.insertId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: 'admin',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const users = await executeQuery(
      'SELECT * FROM lab_users WHERE email = ? AND is_active = 1 LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (!users.length || !verifyPassword(password, users[0].password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, token);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('lab_token');
  res.json({ success: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
