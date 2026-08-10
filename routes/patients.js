const express = require('express');
const { executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/** Latest unique patients/pets from past reports for autofill */
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '30', 10) || 30, 100);

    let where = '';
    const params = [];
    if (q) {
      where = `WHERE patient_name LIKE ? OR pet_name LIKE ? OR owner_phone LIKE ?`;
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const sql = `
      SELECT
        r.patient_name,
        r.owner_phone,
        r.pet_name,
        r.species,
        r.breed,
        r.age,
        r.sex,
        r.referring_vet,
        r.id AS last_report_id,
        r.report_date AS last_report_date,
        1 AS visit_count
      FROM lab_reports r
      INNER JOIN (
        SELECT MAX(id) AS id
        FROM lab_reports
        ${where}
        GROUP BY patient_name, pet_name, IFNULL(owner_phone, '')
      ) latest ON latest.id = r.id
      ORDER BY r.id DESC
      LIMIT ${limit}
    `;

    const patients = await executeQuery(sql, params);
    res.json({ success: true, patients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
