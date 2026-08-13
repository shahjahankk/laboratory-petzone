-- Blood Parasite, FNA Cytology, Surgical Consent, Travel Certificate (safe to re-run)

INSERT INTO lab_test_panels (code, name, description, display_order, is_active)
VALUES
  ('BLOOD_PARASITE', 'Blood Parasite', 'Blood smear — haemoparasites (Babesia, Ehrlichia, etc.)', 10, 1),
  ('FNA_CYTOLOGY', 'FNA Cytology', 'Fine needle aspirate cytology', 11, 1),
  ('SURGICAL_CONSENT', 'Surgical Consent Form', 'Editable surgical consent — type or leave blank to handwrite', 12, 1),
  ('TRAVEL_CERT', 'Travel Health Certificate', 'Animal health certificate for travel — type or handwrite', 13, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  display_order = VALUES(display_order),
  is_active = 1;

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'FINDINGS' AS code, 'Findings' AS name, '' AS unit, '—' AS dog_ref, '—' AS cat_ref, 1 AS ord
) x ON p.code = 'BLOOD_PARASITE'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'FINDINGS' AS code, 'Findings' AS name, '' AS unit, '—' AS dog_ref, '—' AS cat_ref, 1 AS ord
) x ON p.code = 'FNA_CYTOLOGY'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'NOTES' AS code, 'Notes' AS name, '' AS unit, '—' AS dog_ref, '—' AS cat_ref, 1 AS ord
) x ON p.code = 'SURGICAL_CONSENT'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'NOTES' AS code, 'Notes' AS name, '' AS unit, '—' AS dog_ref, '—' AS cat_ref, 1 AS ord
) x ON p.code = 'TRAVEL_CERT'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);
