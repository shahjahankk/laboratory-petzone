-- PetZone Laboratory — add Dog/Cat reference ranges
-- Run once in phpMyAdmin (or via app deploy) on petzonep_laboratory-petzone

ALTER TABLE lab_test_parameters
  ADD COLUMN IF NOT EXISTS reference_range_dog VARCHAR(120) DEFAULT NULL AFTER unit,
  ADD COLUMN IF NOT EXISTS reference_range_cat VARCHAR(120) DEFAULT NULL AFTER reference_range_dog;

-- Some MySQL versions don't support IF NOT EXISTS on ADD COLUMN — fallback handled below if needed.

UPDATE lab_test_parameters SET reference_range_dog = reference_range
WHERE (reference_range_dog IS NULL OR reference_range_dog = '') AND reference_range IS NOT NULL;

-- CBC
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id AND p.code = 'CBC'
SET
  tp.reference_range_dog = CASE tp.code
    WHEN 'WBC' THEN '6.0 - 17.0'
    WHEN 'RBC' THEN '5.5 - 8.5'
    WHEN 'HGB' THEN '12.0 - 18.0'
    WHEN 'HCT' THEN '37 - 55'
    WHEN 'MCV' THEN '60 - 77'
    WHEN 'MCH' THEN '19 - 24'
    WHEN 'MCHC' THEN '32 - 36'
    WHEN 'PLT' THEN '200 - 500'
    WHEN 'NEUT' THEN '60 - 70'
    WHEN 'LYMPH' THEN '12 - 30'
    WHEN 'MONO' THEN '3 - 10'
    WHEN 'EOS' THEN '2 - 10'
    WHEN 'BASO' THEN '0 - 1'
    ELSE tp.reference_range_dog END,
  tp.reference_range_cat = CASE tp.code
    WHEN 'WBC' THEN '5.5 - 19.5'
    WHEN 'RBC' THEN '5.0 - 10.0'
    WHEN 'HGB' THEN '8.0 - 15.0'
    WHEN 'HCT' THEN '30 - 45'
    WHEN 'MCV' THEN '39 - 55'
    WHEN 'MCH' THEN '13 - 17'
    WHEN 'MCHC' THEN '30 - 36'
    WHEN 'PLT' THEN '300 - 800'
    WHEN 'NEUT' THEN '35 - 75'
    WHEN 'LYMPH' THEN '20 - 55'
    WHEN 'MONO' THEN '1 - 4'
    WHEN 'EOS' THEN '2 - 12'
    WHEN 'BASO' THEN '0 - 1'
    ELSE tp.reference_range_cat END;

-- LFT
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id AND p.code = 'LFT'
SET
  tp.reference_range_dog = CASE tp.code
    WHEN 'ALT' THEN '10 - 100'
    WHEN 'AST' THEN '10 - 80'
    WHEN 'ALP' THEN '20 - 150'
    WHEN 'GGT' THEN '0 - 10'
    WHEN 'TBIL' THEN '0.1 - 0.5'
    WHEN 'DBIL' THEN '0.0 - 0.2'
    WHEN 'IBIL' THEN '0.0 - 0.3'
    WHEN 'TP' THEN '5.4 - 7.5'
    WHEN 'ALB' THEN '2.5 - 4.0'
    WHEN 'GLOB' THEN '2.5 - 4.5'
    ELSE tp.reference_range_dog END,
  tp.reference_range_cat = CASE tp.code
    WHEN 'ALT' THEN '12 - 130'
    WHEN 'AST' THEN '10 - 80'
    WHEN 'ALP' THEN '10 - 90'
    WHEN 'GGT' THEN '0 - 5'
    WHEN 'TBIL' THEN '0.1 - 0.4'
    WHEN 'DBIL' THEN '0.0 - 0.2'
    WHEN 'IBIL' THEN '0.0 - 0.3'
    WHEN 'TP' THEN '5.7 - 8.0'
    WHEN 'ALB' THEN '2.3 - 3.9'
    WHEN 'GLOB' THEN '2.8 - 5.1'
    ELSE tp.reference_range_cat END;

-- RFT
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id AND p.code = 'RFT'
SET
  tp.reference_range_dog = CASE tp.code
    WHEN 'UREA' THEN '15 - 40'
    WHEN 'BUN' THEN '7 - 27'
    WHEN 'CREAT' THEN '0.5 - 1.5'
    WHEN 'UA' THEN '0 - 1.0'
    ELSE tp.reference_range_dog END,
  tp.reference_range_cat = CASE tp.code
    WHEN 'UREA' THEN '20 - 50'
    WHEN 'BUN' THEN '14 - 36'
    WHEN 'CREAT' THEN '0.8 - 2.0'
    WHEN 'UA' THEN '0 - 1.0'
    ELSE tp.reference_range_cat END;

-- Electrolytes
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id AND p.code = 'ELECTROLYTES'
SET
  tp.reference_range_dog = CASE tp.code
    WHEN 'NA' THEN '140 - 155'
    WHEN 'K' THEN '3.5 - 5.5'
    WHEN 'CL' THEN '105 - 120'
    WHEN 'CA' THEN '8.5 - 11.5'
    WHEN 'PHOS' THEN '2.5 - 6.0'
    WHEN 'MG' THEN '1.5 - 2.5'
    ELSE tp.reference_range_dog END,
  tp.reference_range_cat = CASE tp.code
    WHEN 'NA' THEN '147 - 156'
    WHEN 'K' THEN '3.5 - 5.2'
    WHEN 'CL' THEN '112 - 129'
    WHEN 'CA' THEN '8.0 - 11.0'
    WHEN 'PHOS' THEN '3.0 - 7.0'
    WHEN 'MG' THEN '1.5 - 2.5'
    ELSE tp.reference_range_cat END;

-- Lipid
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id AND p.code = 'LIPID'
SET
  tp.reference_range_dog = CASE tp.code
    WHEN 'CHOL' THEN '110 - 320'
    WHEN 'TG' THEN '20 - 150'
    WHEN 'HDL' THEN '40 - 80'
    WHEN 'LDL' THEN '50 - 150'
    ELSE tp.reference_range_dog END,
  tp.reference_range_cat = CASE tp.code
    WHEN 'CHOL' THEN '70 - 200'
    WHEN 'TG' THEN '20 - 100'
    WHEN 'HDL' THEN '30 - 70'
    WHEN 'LDL' THEN '30 - 120'
    ELSE tp.reference_range_cat END;

-- Glucose
UPDATE lab_test_parameters tp
INNER JOIN lab_test_panels p ON p.id = tp.panel_id AND p.code = 'GLUCOSE'
SET
  tp.reference_range_dog = CASE tp.code WHEN 'GLU' THEN '70 - 120' ELSE tp.reference_range_dog END,
  tp.reference_range_cat = CASE tp.code WHEN 'GLU' THEN '70 - 150' ELSE tp.reference_range_cat END;

-- Keep legacy column synced to dog range
UPDATE lab_test_parameters
SET reference_range = COALESCE(reference_range_dog, reference_range)
WHERE reference_range_dog IS NOT NULL;
