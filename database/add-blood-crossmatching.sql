-- Blood Crossmatching Form panel (safe to re-run)
-- Tickable form: Major / Minor crossmatch, autocontrol, final interpretation

INSERT INTO lab_test_panels (code, name, description, display_order, is_active)
VALUES ('BLOOD_CROSSMATCH', 'Blood Crossmatching', 'Major / Minor crossmatch — recipient vs donor compatibility', 14, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  display_order = VALUES(display_order),
  is_active = 1;

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'NOTES' AS code, 'Notes' AS name, '' AS unit, '—' AS dog_ref, '—' AS cat_ref, 1 AS ord
) x ON p.code = 'BLOOD_CROSSMATCH'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);