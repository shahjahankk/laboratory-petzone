const express = require('express');
const { executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/** Distinct patients/pets from past reports for autofill */
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '30', 10) || 30, 100);

    let sql = `
      SELECT
        r.patient_name,
        r.owner_phone,
        r.pet_name,
        r.species,
        r.breed,
        r.age,
        r.sex,
        r.referring_vet,
        MAX(r.id) AS last_report_id,
        MAX(r.report_date) AS last_report_date,
        COUNT(*) AS visit_count
      FROM lab_reports r
    `;
    const params = [];

    if (q) {
      sql += ` WHERE r.patient_name LIKE ? OR r.pet_name LIKE ? OR r.owner_phone LIKE ?`;
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    sql += `
      GROUP BY
        r.patient_name,
        IFNULL(r.owner_phone, ''),
        r.pet_name,
        IFNULL(r.species, ''),
        IFNULL(r.breed, ''),
        IFNULL(r.age, ''),
        IFNULL(r.sex, ''),
        IFNULL(r.referring_vet, '')
      ORDER BY last_report_id DESC
      LIMIT ${limit}
    `;

    const patients = await executeQuery(sql, params);
    res.json({ success: true, patients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
