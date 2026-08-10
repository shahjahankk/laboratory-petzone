const express = require('express');
const { pool, executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

async function nextReportNumber(conn) {
  const year = new Date().getFullYear();
  const prefix = `PZ-${year}-`;
  const [rows] = await conn.execute(
    `SELECT report_no FROM lab_reports
     WHERE report_no LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows.length) {
    const parts = String(rows[0].report_no).split('-');
    const last = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(last)) seq = last + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function normalizeSpecies(species) {
  const s = String(species || '').trim().toLowerCase();
  if (s === 'cat' || s === 'feline') return 'Cat';
  if (s === 'dog' || s === 'canine') return 'Dog';
  return species || '';
}

function speciesReference(param, species) {
  const key = normalizeSpecies(species);
  if (key === 'Cat') {
    return param.reference_range_cat || param.reference_range || '';
  }
  return param.reference_range_dog || param.reference_range || '';
}

async function loadReportBundle(reportId) {
  const reports = await executeQuery(
    `SELECT r.*, u.name AS created_by_name
     FROM lab_reports r
     LEFT JOIN lab_users u ON u.id = r.created_by
     WHERE r.id = ?
     LIMIT 1`,
    [reportId]
  );
  if (!reports.length) return null;

  const report = reports[0];
  report.species = normalizeSpecies(report.species) || report.species;

  const panels = await executeQuery(
    `SELECT p.id, p.code, p.name, p.description, p.display_order
     FROM lab_report_panels rp
     INNER JOIN lab_test_panels p ON p.id = rp.panel_id
     WHERE rp.report_id = ?
     ORDER BY p.display_order ASC, p.id ASC`,
    [reportId]
  );

  const results = await executeQuery(
    `SELECT rr.id, rr.parameter_id, rr.value, rr.flag, rr.remarks,
            tp.panel_id, tp.code, tp.name, tp.unit,
            tp.reference_range, tp.reference_range_dog, tp.reference_range_cat,
            tp.display_order
     FROM lab_report_results rr
     INNER JOIN lab_test_parameters tp ON tp.id = rr.parameter_id
     WHERE rr.report_id = ?
     ORDER BY tp.display_order ASC, tp.id ASC`,
    [reportId]
  );

  const mappedResults = results.map((r) => ({
    ...r,
    reference_range: speciesReference(r, report.species),
    reference_range_dog: r.reference_range_dog || r.reference_range || '',
    reference_range_cat: r.reference_range_cat || r.reference_range || '',
  }));

  const panelsWithResults = panels.map((panel) => ({
    ...panel,
    results: mappedResults.filter((r) => r.panel_id === panel.id),
  }));

  let images = [];
  try {
    images = await executeQuery(
      `SELECT id, report_id, stored_name, original_name, display_order
       FROM lab_report_images
       WHERE report_id = ?
       ORDER BY display_order ASC, id ASC`,
      [reportId]
    );
    images = images.map((img) => ({
      ...img,
      url: `/api/uploads/file/${encodeURIComponent(img.stored_name)}`,
    }));
  } catch (_) {
    images = [];
  }

  let forms = {};
  try {
    const formRows = await executeQuery(
      `SELECT form_code, form_json FROM lab_report_forms WHERE report_id = ?`,
      [reportId]
    );
    for (const row of formRows) {
      try {
        forms[row.form_code] = JSON.parse(row.form_json);
      } catch (_) {
        forms[row.form_code] = {};
      }
    }
  } catch (_) {
    forms = {};
  }

  return { ...report, panels: panelsWithResults, images, forms };
}

async function saveReportForms(conn, reportId, forms) {
  if (!forms || typeof forms !== 'object') return;
  for (const [form_code, payload] of Object.entries(forms)) {
    if (!form_code) continue;
    const json = JSON.stringify(payload == null ? {} : payload);
    await conn.execute(
      `INSERT INTO lab_report_forms (report_id, form_code, form_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE form_json = VALUES(form_json)`,
      [reportId, String(form_code).slice(0, 40), json]
    );
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    let sql = `
      SELECT id, report_no, patient_name, pet_name, species, sample_date, report_date, status, created_at
      FROM lab_reports
    `;
    const params = [];
    if (q) {
      sql += ` WHERE report_no LIKE ? OR patient_name LIKE ? OR pet_name LIKE ? OR owner_phone LIKE ?`;
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ` ORDER BY id DESC LIMIT ${limit}`;
    const rows = await executeQuery(sql, params);
    res.json({ success: true, reports: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/no/:reportNo', async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT id FROM lab_reports WHERE report_no = ? LIMIT 1',
      [req.params.reportNo]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    const report = await loadReportBundle(rows[0].id);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const report = await loadReportBundle(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      patient_name,
      owner_phone,
      pet_name,
      species,
      breed,
      age,
      sex,
      referring_vet,
      sample_date,
      report_date,
      clinical_notes,
      remarks,
      status,
      panel_ids,
      results,
      image_ids,
      forms,
    } = req.body;

    if (!patient_name || !pet_name) {
      return res.status(400).json({ success: false, message: 'Patient and pet name are required' });
    }

    const speciesNorm = normalizeSpecies(species);
    if (speciesNorm !== 'Dog' && speciesNorm !== 'Cat') {
      return res.status(400).json({ success: false, message: 'Select species: Dog or Cat' });
    }

    const selectedPanels = Array.isArray(panel_ids) ? panel_ids.map(Number).filter(Boolean) : [];
    if (!selectedPanels.length) {
      return res.status(400).json({ success: false, message: 'Select at least one test panel' });
    }

    await conn.beginTransaction();
    const reportNo = await nextReportNumber(conn);

    const [insertResult] = await conn.execute(
      `INSERT INTO lab_reports (
        report_no, patient_name, owner_phone, pet_name, species, breed, age, sex,
        referring_vet, sample_date, report_date, clinical_notes, remarks, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportNo,
        patient_name.trim(),
        owner_phone || null,
        pet_name.trim(),
        speciesNorm,
        breed || null,
        age || null,
        sex || null,
        referring_vet || null,
        sample_date || null,
        report_date || new Date().toISOString().slice(0, 10),
        clinical_notes || null,
        remarks || null,
        status === 'draft' ? 'draft' : 'final',
        req.user.id,
      ]
    );

    const reportId = insertResult.insertId;

    for (const panelId of selectedPanels) {
      await conn.execute(
        'INSERT INTO lab_report_panels (report_id, panel_id) VALUES (?, ?)',
        [reportId, panelId]
      );
    }

    const resultRows = Array.isArray(results) ? results : [];
    for (const row of resultRows) {
      if (!row.parameter_id) continue;
      await conn.execute(
        `INSERT INTO lab_report_results (report_id, parameter_id, value, flag, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [
          reportId,
          Number(row.parameter_id),
          row.value != null ? String(row.value) : null,
          row.flag || null,
          row.remarks || null,
        ]
      );
    }

    if (Array.isArray(image_ids)) {
      const ids = image_ids.map(Number).filter(Boolean);
      for (let i = 0; i < ids.length; i++) {
        await conn.execute(
          'UPDATE lab_report_images SET report_id = ?, display_order = ? WHERE id = ? AND (report_id IS NULL OR report_id = ?)',
          [reportId, i, ids[i], reportId]
        );
      }
    }

    await saveReportForms(conn, reportId, forms);

    await conn.commit();
    const report = await loadReportBundle(reportId);
    res.status(201).json({ success: true, report });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const reportId = Number(req.params.id);
    const existing = await executeQuery('SELECT id FROM lab_reports WHERE id = ? LIMIT 1', [reportId]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const {
      patient_name,
      owner_phone,
      pet_name,
      species,
      breed,
      age,
      sex,
      referring_vet,
      sample_date,
      report_date,
      clinical_notes,
      remarks,
      status,
      panel_ids,
      results,
      image_ids,
      forms,
    } = req.body;

    const speciesNorm = normalizeSpecies(species);
    if (speciesNorm !== 'Dog' && speciesNorm !== 'Cat') {
      return res.status(400).json({ success: false, message: 'Select species: Dog or Cat' });
    }

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE lab_reports SET
        patient_name = ?, owner_phone = ?, pet_name = ?, species = ?, breed = ?,
        age = ?, sex = ?, referring_vet = ?, sample_date = ?, report_date = ?,
        clinical_notes = ?, remarks = ?, status = ?
       WHERE id = ?`,
      [
        patient_name,
        owner_phone || null,
        pet_name,
        speciesNorm,
        breed || null,
        age || null,
        sex || null,
        referring_vet || null,
        sample_date || null,
        report_date || null,
        clinical_notes || null,
        remarks || null,
        status === 'draft' ? 'draft' : 'final',
        reportId,
      ]
    );

    if (Array.isArray(panel_ids)) {
      await conn.execute('DELETE FROM lab_report_panels WHERE report_id = ?', [reportId]);
      for (const panelId of panel_ids.map(Number).filter(Boolean)) {
        await conn.execute(
          'INSERT INTO lab_report_panels (report_id, panel_id) VALUES (?, ?)',
          [reportId, panelId]
        );
      }
    }

    if (Array.isArray(results)) {
      await conn.execute('DELETE FROM lab_report_results WHERE report_id = ?', [reportId]);
      for (const row of results) {
        if (!row.parameter_id) continue;
        await conn.execute(
          `INSERT INTO lab_report_results (report_id, parameter_id, value, flag, remarks)
           VALUES (?, ?, ?, ?, ?)`,
          [
            reportId,
            Number(row.parameter_id),
            row.value != null ? String(row.value) : null,
            row.flag || null,
            row.remarks || null,
          ]
        );
      }
    }

    if (Array.isArray(image_ids)) {
      const ids = image_ids.map(Number).filter(Boolean);
      await conn.execute(
        'UPDATE lab_report_images SET report_id = NULL WHERE report_id = ?',
        [reportId]
      );
      for (let i = 0; i < ids.length; i++) {
        await conn.execute(
          'UPDATE lab_report_images SET report_id = ?, display_order = ? WHERE id = ?',
          [reportId, i, ids[i]]
        );
      }
    }

    if (forms && typeof forms === 'object') {
      await conn.execute('DELETE FROM lab_report_forms WHERE report_id = ?', [reportId]);
      await saveReportForms(conn, reportId, forms);
    }

    await conn.commit();
    const report = await loadReportBundle(reportId);
    res.json({ success: true, report });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await executeQuery('DELETE FROM lab_reports WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
