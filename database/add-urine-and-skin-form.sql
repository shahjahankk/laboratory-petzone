-- Urine Analysis panel + structured forms table for Skin Scraping checklist
-- Safe to re-run

CREATE TABLE IF NOT EXISTS lab_report_forms (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id   INT UNSIGNED NOT NULL,
  form_code   VARCHAR(40) NOT NULL,
  form_json   MEDIUMTEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report_form (report_id, form_code),
  CONSTRAINT fk_form_report FOREIGN KEY (report_id) REFERENCES lab_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Skin Scraping now uses tickable form UI (hide old value-row parameters)
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id
SET tp.is_active = 0
WHERE p.code = 'SKIN_SCRAPING';

UPDATE lab_test_panels
SET name = 'Skin Scraping',
    description = 'Tickable dermatology scraping report',
    display_order = 7,
    is_active = 1
WHERE code = 'SKIN_SCRAPING';

INSERT INTO lab_test_panels (code, name, description, display_order, is_active)
VALUES ('URINE_ANALYSIS', 'Urine Analysis', 'Complete urinalysis — physical, chemical & sediment', 9, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  display_order = VALUES(display_order),
  is_active = 1;

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'COLOR' AS code, 'Color' AS name, '' AS unit, 'Yellow' AS dog_ref, 'Yellow' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'APPEARANCE', 'Appearance / Clarity', '', 'Clear', 'Clear', 2 UNION ALL
  SELECT 'SG', 'Specific Gravity', '', '1.015 - 1.045', '1.020 - 1.060', 3 UNION ALL
  SELECT 'PH', 'pH', '', '5.5 - 7.0', '5.5 - 7.5', 4 UNION ALL
  SELECT 'PROTEIN', 'Protein', '', 'Negative / Trace', 'Negative / Trace', 5 UNION ALL
  SELECT 'GLUCOSE', 'Glucose', '', 'Negative', 'Negative', 6 UNION ALL
  SELECT 'KETONES', 'Ketones', '', 'Negative', 'Negative', 7 UNION ALL
  SELECT 'BILIRUBIN', 'Bilirubin', '', 'Negative', 'Negative / Trace', 8 UNION ALL
  SELECT 'BLOOD', 'Blood / Occult blood', '', 'Negative', 'Negative', 9 UNION ALL
  SELECT 'LEUKOCYTES', 'Leukocytes', '', 'Negative', 'Negative', 10 UNION ALL
  SELECT 'NITRITE', 'Nitrite', '', 'Negative', 'Negative', 11 UNION ALL
  SELECT 'UROBILINOGEN', 'Urobilinogen', '', 'Normal', 'Normal', 12 UNION ALL
  SELECT 'RBC_SED', 'RBC (sediment)', '/HPF', '0 - 5', '0 - 5', 13 UNION ALL
  SELECT 'WBC_SED', 'WBC (sediment)', '/HPF', '0 - 5', '0 - 5', 14 UNION ALL
  SELECT 'EPITHELIAL', 'Epithelial cells', '/HPF', 'Occasional', 'Occasional', 15 UNION ALL
  SELECT 'CASTS', 'Casts', '/LPF', 'None / Rare', 'None / Rare', 16 UNION ALL
  SELECT 'CRYSTALS', 'Crystals', '', 'None / Few', 'None / Few', 17 UNION ALL
  SELECT 'BACTERIA_UA', 'Bacteria (sediment)', '', 'None', 'None', 18 UNION ALL
  SELECT 'OTHER_UA', 'Other findings', '', '—', '—', 19
) x ON p.code = 'URINE_ANALYSIS'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);
