const express = require('express');
const { executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const panels = await executeQuery(
      `SELECT id, code, name, description, display_order, is_active
       FROM lab_test_panels
       WHERE is_active = 1
       ORDER BY display_order ASC, id ASC`
    );

    const parameters = await executeQuery(
      `SELECT id, panel_id, code, name, unit,
              reference_range_dog, reference_range_cat, reference_range,
              display_order, is_active
       FROM lab_test_parameters
       WHERE is_active = 1
       ORDER BY display_order ASC, id ASC`
    );

    const byPanel = {};
    for (const p of panels) {
      byPanel[p.id] = { ...p, parameters: [] };
    }
    for (const param of parameters) {
      if (byPanel[param.panel_id]) {
        byPanel[param.panel_id].parameters.push({
          ...param,
          reference_range_dog: param.reference_range_dog || param.reference_range || '',
          reference_range_cat: param.reference_range_cat || param.reference_range || '',
        });
      }
    }

    res.json({ success: true, panels: Object.values(byPanel) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
