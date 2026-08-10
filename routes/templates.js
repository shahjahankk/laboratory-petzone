const express = require('express');
const { executeQuery } = require('../config/database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

function cleanCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function toOrder(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toActive(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  return Number(value) ? 1 : 0;
}

function mapParam(param) {
  return {
    ...param,
    reference_range_dog: param.reference_range_dog || param.reference_range || '',
    reference_range_cat: param.reference_range_cat || param.reference_range || '',
  };
}

async function loadPanelsBundle({ activeOnly }) {
  const panels = await executeQuery(
    `SELECT id, code, name, description, display_order, is_active
     FROM lab_test_panels
     ${activeOnly ? 'WHERE is_active = 1' : ''}
     ORDER BY display_order ASC, id ASC`
  );

  const parameters = await executeQuery(
    `SELECT id, panel_id, code, name, unit,
            reference_range_dog, reference_range_cat, reference_range,
            display_order, is_active
     FROM lab_test_parameters
     ${activeOnly ? 'WHERE is_active = 1' : ''}
     ORDER BY display_order ASC, id ASC`
  );

  const byPanel = {};
  for (const p of panels) {
    byPanel[p.id] = { ...p, parameters: [] };
  }
  for (const param of parameters) {
    if (byPanel[param.panel_id]) {
      byPanel[param.panel_id].parameters.push(mapParam(param));
    }
  }
  return Object.values(byPanel);
}

router.get('/', async (req, res) => {
  try {
    const panels = await loadPanelsBundle({ activeOnly: true });
    res.json({ success: true, panels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const panels = await loadPanelsBundle({ activeOnly: false });
    res.json({ success: true, panels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/panels', requireAdmin, async (req, res) => {
  try {
    const code = cleanCode(req.body.code);
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim() || null;
    const display_order = toOrder(req.body.display_order, 0);

    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Code and name are required' });
    }

    const existing = await executeQuery(
      'SELECT id FROM lab_test_panels WHERE code = ? LIMIT 1',
      [code]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: `Panel code "${code}" already exists` });
    }

    const result = await executeQuery(
      `INSERT INTO lab_test_panels (code, name, description, display_order, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [code, name, description, display_order]
    );

    const rows = await executeQuery(
      'SELECT id, code, name, description, display_order, is_active FROM lab_test_panels WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, panel: { ...rows[0], parameters: [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/panels/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'Invalid panel id' });
    }

    const rows = await executeQuery('SELECT * FROM lab_test_panels WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Panel not found' });
    }

    const current = rows[0];
    const name = req.body.name !== undefined ? String(req.body.name || '').trim() : current.name;
    const description = req.body.description !== undefined
      ? (String(req.body.description || '').trim() || null)
      : current.description;
    const display_order = req.body.display_order !== undefined
      ? toOrder(req.body.display_order, current.display_order)
      : current.display_order;
    const is_active = req.body.is_active !== undefined
      ? toActive(req.body.is_active, current.is_active)
      : current.is_active;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    await executeQuery(
      `UPDATE lab_test_panels
       SET name = ?, description = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [name, description, display_order, is_active, id]
    );

    const updated = await executeQuery(
      'SELECT id, code, name, description, display_order, is_active FROM lab_test_panels WHERE id = ?',
      [id]
    );
    res.json({ success: true, panel: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/panels/:id/parameters', requireAdmin, async (req, res) => {
  try {
    const panelId = Number(req.params.id);
    if (!Number.isFinite(panelId)) {
      return res.status(400).json({ success: false, message: 'Invalid panel id' });
    }

    const panels = await executeQuery('SELECT id FROM lab_test_panels WHERE id = ? LIMIT 1', [panelId]);
    if (!panels.length) {
      return res.status(404).json({ success: false, message: 'Panel not found' });
    }

    const code = cleanCode(req.body.code);
    const name = String(req.body.name || '').trim();
    const unit = String(req.body.unit || '').trim() || null;
    const dog = String(req.body.reference_range_dog || '').trim() || null;
    const cat = String(req.body.reference_range_cat || '').trim() || null;
    const display_order = toOrder(req.body.display_order, 0);

    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Parameter code and name are required' });
    }

    const existing = await executeQuery(
      'SELECT id FROM lab_test_parameters WHERE panel_id = ? AND code = ? LIMIT 1',
      [panelId, code]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: `Parameter code "${code}" already exists on this panel` });
    }

    const result = await executeQuery(
      `INSERT INTO lab_test_parameters
        (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [panelId, code, name, unit, dog, cat, dog, display_order]
    );

    const rows = await executeQuery('SELECT * FROM lab_test_parameters WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, parameter: mapParam(rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/parameters/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'Invalid parameter id' });
    }

    const rows = await executeQuery('SELECT * FROM lab_test_parameters WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Parameter not found' });
    }

    const current = rows[0];
    const name = req.body.name !== undefined ? String(req.body.name || '').trim() : current.name;
    const unit = req.body.unit !== undefined
      ? (String(req.body.unit || '').trim() || null)
      : current.unit;
    const dog = req.body.reference_range_dog !== undefined
      ? (String(req.body.reference_range_dog || '').trim() || null)
      : current.reference_range_dog;
    const cat = req.body.reference_range_cat !== undefined
      ? (String(req.body.reference_range_cat || '').trim() || null)
      : current.reference_range_cat;
    const display_order = req.body.display_order !== undefined
      ? toOrder(req.body.display_order, current.display_order)
      : current.display_order;
    const is_active = req.body.is_active !== undefined
      ? toActive(req.body.is_active, current.is_active)
      : current.is_active;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    await executeQuery(
      `UPDATE lab_test_parameters
       SET name = ?, unit = ?, reference_range_dog = ?, reference_range_cat = ?,
           reference_range = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [name, unit, dog, cat, dog, display_order, is_active, id]
    );

    const updated = await executeQuery('SELECT * FROM lab_test_parameters WHERE id = ?', [id]);
    res.json({ success: true, parameter: mapParam(updated[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
