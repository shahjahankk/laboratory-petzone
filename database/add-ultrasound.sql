-- Ultrasound panel + image attachments (safe to re-run)

ALTER TABLE lab_report_results
  MODIFY value TEXT NULL;

CREATE TABLE IF NOT EXISTS lab_report_images (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id      INT UNSIGNED DEFAULT NULL,
  stored_name    VARCHAR(190) NOT NULL,
  original_name  VARCHAR(255) DEFAULT NULL,
  created_by     INT UNSIGNED DEFAULT NULL,
  display_order  INT NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_images_report (report_id),
  CONSTRAINT fk_img_report FOREIGN KEY (report_id) REFERENCES lab_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_img_user FOREIGN KEY (created_by) REFERENCES lab_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lab_test_panels (code, name, description, display_order, is_active)
VALUES ('ULTRASOUND', 'Ultrasound', 'Diagnostic ultrasound with images & doctor remarks', 8, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  display_order = VALUES(display_order),
  is_active = 1;

INSERT INTO lab_test_parameters (panel_id, code, name, unit, reference_range_dog, reference_range_cat, reference_range, display_order, is_active)
SELECT p.id, x.code, x.name, x.unit, x.dog_ref, x.cat_ref, x.dog_ref, x.ord, 1
FROM lab_test_panels p
JOIN (
  SELECT 'REGION' AS code, 'Organ / Region examined' AS name, '' AS unit, '—' AS dog_ref, '—' AS cat_ref, 1 AS ord UNION ALL
  SELECT 'FINDINGS', 'Findings', '', '—', '—', 2 UNION ALL
  SELECT 'IMPRESSION', 'Impression', '', '—', '—', 3
) x ON p.code = 'ULTRASOUND'
WHERE NOT EXISTS (
  SELECT 1 FROM lab_test_parameters tp WHERE tp.panel_id = p.id AND tp.code = x.code
);
