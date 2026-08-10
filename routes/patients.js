const express = require('express');
const { executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Search by phone (preferred) — one number can have many pets */
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.phone || '').trim();
    const phoneDigits = digitsOnly(q);
    const limit = Math.min(parseInt(req.query.limit || '40', 10) || 40, 100);

    if (!q) {
      return res.json({
        success: true,
        query: '',
        phone: '',
        is_phone_search: false,
        owners: [],
        pets: [],
      });
    }

    const isPhoneQuery = phoneDigits.length >= 7;
    const like = isPhoneQuery ? `%${phoneDigits}%` : `%${q}%`;

    let rows = await executeQuery(
      `
      SELECT
        r.id, r.patient_name, r.owner_phone, r.pet_name, r.species,
        r.breed, r.age, r.sex, r.referring_vet, r.report_date
      FROM lab_reports r
      WHERE r.owner_phone LIKE ?
         OR r.patient_name LIKE ?
         OR r.pet_name LIKE ?
      ORDER BY r.id DESC
      LIMIT 300
      `,
      [like, like, like]
    );

    if (isPhoneQuery) {
      rows = rows.filter((r) => digitsOnly(r.owner_phone).includes(phoneDigits));
    }

    const byPhone = new Map();
    for (const row of rows) {
      const phoneKey = digitsOnly(row.owner_phone) || `name:${String(row.patient_name || '').toLowerCase()}`;
      if (!byPhone.has(phoneKey)) {
        byPhone.set(phoneKey, {
          patient_name: row.patient_name || '',
          owner_phone: row.owner_phone || '',
          referring_vet: row.referring_vet || '',
          petsMap: new Map(),
        });
      }
      const owner = byPhone.get(phoneKey);
      if (!owner.patient_name && row.patient_name) owner.patient_name = row.patient_name;
      if (!owner.referring_vet && row.referring_vet) owner.referring_vet = row.referring_vet;
      if (!owner.owner_phone && row.owner_phone) owner.owner_phone = row.owner_phone;

      const petKey = String(row.pet_name || '').trim().toLowerCase() || `id-${row.id}`;
      if (!owner.petsMap.has(petKey)) {
        owner.petsMap.set(petKey, {
          pet_name: row.pet_name || '',
          species: row.species || '',
          breed: row.breed || '',
          age: row.age || '',
          sex: row.sex || '',
          last_report_id: row.id,
          last_report_date: row.report_date,
        });
      }
    }

    const owners = [...byPhone.values()].slice(0, 20).map((o) => ({
      patient_name: o.patient_name,
      owner_phone: o.owner_phone,
      referring_vet: o.referring_vet,
      pets: [...o.petsMap.values()],
    }));

    const pets = [];
    for (const owner of owners) {
      for (const pet of owner.pets) {
        pets.push({
          ...pet,
          patient_name: owner.patient_name,
          owner_phone: owner.owner_phone,
          referring_vet: owner.referring_vet,
        });
      }
    }

    res.json({
      success: true,
      query: q,
      phone: phoneDigits,
      is_phone_search: isPhoneQuery,
      owners,
      pets: pets.slice(0, limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
