const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `us-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image files are allowed (JPG, PNG, GIF, WEBP)'), ok);
  },
});

// Public so <img> and print work without Bearer header
router.get('/file/:name', async (req, res) => {
  try {
    const name = path.basename(String(req.params.name || ''));
    if (!name || name !== req.params.name) {
      return res.status(400).json({ success: false, message: 'Invalid file name' });
    }

    const rows = await executeQuery(
      'SELECT id, stored_name FROM lab_report_images WHERE stored_name = ? LIMIT 1',
      [name]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const full = path.join(uploadsDir, name);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ success: false, message: 'Image file missing on server' });
    }
    return res.sendFile(full);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authMiddleware, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file received' });
    }

    try {
      const result = await executeQuery(
        `INSERT INTO lab_report_images (report_id, stored_name, original_name, created_by, display_order)
         VALUES (NULL, ?, ?, ?, 0)`,
        [req.file.filename, req.file.originalname || req.file.filename, req.user.id]
      );

      res.status(201).json({
        success: true,
        image: {
          id: result.insertId,
          stored_name: req.file.filename,
          original_name: req.file.originalname || req.file.filename,
          url: `/api/uploads/file/${encodeURIComponent(req.file.filename)}`,
        },
      });
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      res.status(500).json({ success: false, message: e.message });
    }
  });
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await executeQuery(
      'SELECT id, stored_name, report_id FROM lab_report_images WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    await executeQuery('DELETE FROM lab_report_images WHERE id = ?', [id]);
    const full = path.join(uploadsDir, rows[0].stored_name);
    try { fs.unlinkSync(full); } catch (_) {}

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.uploadsDir = uploadsDir;
