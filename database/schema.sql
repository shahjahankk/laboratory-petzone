-- ============================================================
-- PetZone Laboratory — Database Schema
-- Import in cPanel → phpMyAdmin → Import (run once on fresh DB)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS lab_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_settings (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lab_name      VARCHAR(150) NOT NULL DEFAULT 'PetZone Laboratory',
  address       VARCHAR(255) DEFAULT NULL,
  phone         VARCHAR(50)  DEFAULT NULL,
  email         VARCHAR(150) DEFAULT NULL,
  footer_note   VARCHAR(500) DEFAULT 'This report is for veterinary diagnostic purposes only.',
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_test_panels (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) DEFAULT NULL,
  display_order INT          NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_test_parameters (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  panel_id              INT UNSIGNED NOT NULL,
  code                  VARCHAR(40)  NOT NULL,
  name                  VARCHAR(150) NOT NULL,
  unit                  VARCHAR(40)  DEFAULT NULL,
  reference_range_dog   VARCHAR(120) DEFAULT NULL,
  reference_range_cat   VARCHAR(120) DEFAULT NULL,
  reference_range       VARCHAR(120) DEFAULT NULL,
  display_order         INT          NOT NULL DEFAULT 0,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_panel_param_code (panel_id, code),
  CONSTRAINT fk_param_panel FOREIGN KEY (panel_id) REFERENCES lab_test_panels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_reports (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_no       VARCHAR(30)  NOT NULL UNIQUE,
  patient_name    VARCHAR(150) NOT NULL,
  owner_phone     VARCHAR(40)  DEFAULT NULL,
  pet_name        VARCHAR(120) NOT NULL,
  species         VARCHAR(80)  DEFAULT NULL,
  breed           VARCHAR(100) DEFAULT NULL,
  age             VARCHAR(40)  DEFAULT NULL,
  sex             VARCHAR(20)  DEFAULT NULL,
  referring_vet   VARCHAR(150) DEFAULT NULL,
  sample_date     DATE         DEFAULT NULL,
  report_date     DATE         DEFAULT NULL,
  clinical_notes  TEXT         DEFAULT NULL,
  remarks         TEXT         DEFAULT NULL,
  status          ENUM('draft','final') NOT NULL DEFAULT 'final',
  created_by      INT UNSIGNED DEFAULT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reports_patient (patient_name),
  KEY idx_reports_pet (pet_name),
  KEY idx_reports_date (report_date),
  CONSTRAINT fk_report_user FOREIGN KEY (created_by) REFERENCES lab_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_report_panels (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id  INT UNSIGNED NOT NULL,
  panel_id   INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_report_panel (report_id, panel_id),
  CONSTRAINT fk_rp_report FOREIGN KEY (report_id) REFERENCES lab_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_panel  FOREIGN KEY (panel_id)  REFERENCES lab_test_panels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_report_results (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id     INT UNSIGNED NOT NULL,
  parameter_id  INT UNSIGNED NOT NULL,
  value         VARCHAR(80)  DEFAULT NULL,
  flag          VARCHAR(10)  DEFAULT NULL,
  remarks       VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uq_report_param (report_id, parameter_id),
  CONSTRAINT fk_rr_report FOREIGN KEY (report_id)    REFERENCES lab_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_rr_param  FOREIGN KEY (parameter_id) REFERENCES lab_test_parameters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO lab_settings (lab_name, address, phone, email, footer_note)
SELECT 'PetZone Laboratory', 'PetZone Hospital', '', '', 'This report is for veterinary diagnostic purposes only. Correlate with clinical findings.'
WHERE NOT EXISTS (SELECT 1 FROM lab_settings LIMIT 1);

INSERT INTO lab_test_panels (code, name, description, display_order) VALUES
('CBC', 'Complete Blood Count (CBC)', 'Hematology profile', 1),
('LFT', 'Liver Function Test (LFT)', 'Hepatic biochemistry', 2),
('RFT', 'Renal Function Test (RFT)', 'Kidney biochemistry', 3),
('ELECTROLYTES', 'Electrolytes', 'Serum electrolytes', 4),
('LIPID', 'Lipid Profile', 'Cholesterol & triglycerides', 5),
('GLUCOSE', 'Blood Glucose', 'Glucose estimation', 6),
('SKIN_SCRAPING', 'Skin Scraping', 'Dermatology — mites, yeast, fungal & bacteria', 7)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
FROM lab_test_panels p
JOIN (
  SELECT 'WBC' AS code, 'WBC (White Blood Cells)' AS name, 'x10^9/L' AS unit, '6.0 - 17.0' AS dog_ref, '5.5 - 19.5' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'RBC', 'RBC (Red Blood Cells)', 'x10^12/L', '5.5 - 8.5', '5.0 - 10.0', 2 UNION ALL
  SELECT 'HGB', 'Hemoglobin', 'g/dL', '12.0 - 18.0', '8.0 - 15.0', 3 UNION ALL
  SELECT 'HCT', 'Hematocrit (PCV)', '%', '37 - 55', '30 - 45', 4 UNION ALL
  SELECT 'MCV', 'MCV', 'fL', '60 - 77', '39 - 55', 5 UNION ALL
  SELECT 'MCH', 'MCH', 'pg', '19 - 24', '13 - 17', 6 UNION ALL
  SELECT 'MCHC', 'MCHC', 'g/dL', '32 - 36', '30 - 36', 7 UNION ALL
  SELECT 'PLT', 'Platelets', 'x10^9/L', '200 - 500', '300 - 800', 8 UNION ALL
  SELECT 'NEUT', 'Neutrophils', '%', '60 - 70', '35 - 75', 9 UNION ALL
  SELECT 'LYMPH', 'Lymphocytes', '%', '12 - 30', '20 - 55', 10 UNION ALL
  SELECT 'MONO', 'Monocytes', '%', '3 - 10', '1 - 4', 11 UNION ALL
  SELECT 'EOS', 'Eosinophils', '%', '2 - 10', '2 - 12', 12 UNION ALL
  SELECT 'BASO', 'Basophils', '%', '0 - 1', '0 - 1', 13
) x ON p.code = 'CBC'
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
FROM lab_test_panels p
JOIN (
  SELECT 'ALT' AS code, 'ALT (SGPT)' AS name, 'U/L' AS unit, '10 - 100' AS dog_ref, '12 - 130' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'AST', 'AST (SGOT)', 'U/L', '10 - 80', '10 - 80', 2 UNION ALL
  SELECT 'ALP', 'ALP (Alkaline Phosphatase)', 'U/L', '20 - 150', '10 - 90', 3 UNION ALL
  SELECT 'GGT', 'GGT', 'U/L', '0 - 10', '0 - 5', 4 UNION ALL
  SELECT 'TBIL', 'Total Bilirubin', 'mg/dL', '0.1 - 0.5', '0.1 - 0.4', 5 UNION ALL
  SELECT 'DBIL', 'Direct Bilirubin', 'mg/dL', '0.0 - 0.2', '0.0 - 0.2', 6 UNION ALL
  SELECT 'IBIL', 'Indirect Bilirubin', 'mg/dL', '0.0 - 0.3', '0.0 - 0.3', 7 UNION ALL
  SELECT 'TP', 'Total Protein', 'g/dL', '5.4 - 7.5', '5.7 - 8.0', 8 UNION ALL
  SELECT 'ALB', 'Albumin', 'g/dL', '2.5 - 4.0', '2.3 - 3.9', 9 UNION ALL
  SELECT 'GLOB', 'Globulin', 'g/dL', '2.5 - 4.5', '2.8 - 5.1', 10
) x ON p.code = 'LFT'
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
FROM lab_test_panels p
JOIN (
  SELECT 'UREA' AS code, 'Urea' AS name, 'mg/dL' AS unit, '15 - 40' AS dog_ref, '20 - 50' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'BUN', 'BUN', 'mg/dL', '7 - 27', '14 - 36', 2 UNION ALL
  SELECT 'CREAT', 'Creatinine', 'mg/dL', '0.5 - 1.5', '0.8 - 2.0', 3 UNION ALL
  SELECT 'UA', 'Uric Acid', 'mg/dL', '0 - 1.0', '0 - 1.0', 4
) x ON p.code = 'RFT'
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
FROM lab_test_panels p
JOIN (
  SELECT 'NA' AS code, 'Sodium (Na+)' AS name, 'mmol/L' AS unit, '140 - 155' AS dog_ref, '147 - 156' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'K', 'Potassium (K+)', 'mmol/L', '3.5 - 5.5', '3.5 - 5.2', 2 UNION ALL
  SELECT 'CL', 'Chloride (Cl-)', 'mmol/L', '105 - 120', '112 - 129', 3 UNION ALL
  SELECT 'CA', 'Calcium (Ca)', 'mg/dL', '8.5 - 11.5', '8.0 - 11.0', 4 UNION ALL
  SELECT 'PHOS', 'Phosphorus (P)', 'mg/dL', '2.5 - 6.0', '3.0 - 7.0', 5 UNION ALL
  SELECT 'MG', 'Magnesium (Mg)', 'mg/dL', '1.5 - 2.5', '1.5 - 2.5', 6
) x ON p.code = 'ELECTROLYTES'
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
FROM lab_test_panels p
JOIN (
  SELECT 'CHOL' AS code, 'Total Cholesterol' AS name, 'mg/dL' AS unit, '110 - 320' AS dog_ref, '70 - 200' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'TG', 'Triglycerides', 'mg/dL', '20 - 150', '20 - 100', 2 UNION ALL
  SELECT 'HDL', 'HDL Cholesterol', 'mg/dL', '40 - 80', '30 - 70', 3 UNION ALL
  SELECT 'LDL', 'LDL Cholesterol', 'mg/dL', '50 - 150', '30 - 120', 4
) x ON p.code = 'LIPID'
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
FROM lab_test_panels p
JOIN (
  SELECT 'GLU' AS code, 'Blood Glucose' AS name, 'mg/dL' AS unit, '70 - 120' AS dog_ref, '70 - 150' AS cat_ref, 1 AS ord
) x ON p.code = 'GLUCOSE'
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord
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
WHERE NOT EXISTS (SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code);
