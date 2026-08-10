const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'petzone-lab-change-me-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const PASSWORD_SALT = 'petzone-lab-salt';

function hashPassword(password) {
  return crypto.scryptSync(String(password), PASSWORD_SALT, 64).toString('hex');
}

function verifyPassword(password, hash) {
  const incoming = hashPassword(password);
  const a = Buffer.from(incoming, 'hex');
  const b = Buffer.from(String(hash || ''), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const cookieToken = req.cookies?.lab_token;
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookieToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    const users = await executeQuery(
      'SELECT id, name, email, role, is_active FROM lab_users WHERE id = ? LIMIT 1',
      [decoded.userId]
    );

    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }

    req.user = users[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  authMiddleware,
  JWT_SECRET,
};
