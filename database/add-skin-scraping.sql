-- Add Skin Scraping panel + parameters (safe to re-run)
-- Run in phpMyAdmin on petzonep_laboratory-petzone (or your lab DB)

INSERT INTO lab_test_panels (code, name, description, display_order, is_active)
VALUES ('SKIN_SCRAPING', 'Skin Scraping', 'Dermatology — mites, yeast, fungal & bacteria', 7, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  display_order = VALUES(display_order),
  is_active = 1;

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'DEMODEX' AS code, 'Demodex mites' AS name, '' AS unit, 'Not detected' AS dog_ref, 'Not detected' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'SARCOPTES', 'Sarcoptes mites', '', 'Not detected', 'Not detected', 2 UNION ALL
  SELECT 'CHEYLETIELLA', 'Cheyletiella mites', '', 'Not detected', 'Not detected', 3 UNION ALL
  SELECT 'FUNGAL', 'Fungal elements / Dermatophytes', '', 'Not detected', 'Not detected', 4 UNION ALL
  SELECT 'YEAST', 'Malassezia (Yeast)', '', 'Not detected', 'Not detected', 5 UNION ALL
  SELECT 'BACTERIA', 'Bacteria', '', 'Not detected', 'Not detected', 6 UNION ALL
  SELECT 'INFLAM', 'Inflammatory cells', '', 'Occasional / NS', 'Occasional / NS', 7 UNION ALL
  SELECT 'OTHER', 'Other findings', '', '—', '—', 8 UNION ALL
  SELECT 'IMPRESSION', 'Impression', '', '—', '—', 9
) x ON p.code = 'SKIN_SCRAPING'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);
