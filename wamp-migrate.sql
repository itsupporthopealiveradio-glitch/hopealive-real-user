USE hopealive;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER user_id;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL AFTER first_name;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name VARCHAR(220) NULL AFTER last_name;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role ENUM('employee','admin','security_officer','security','manager') NOT NULL DEFAULT 'employee' AFTER job_title;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status ENUM('active','inactive','terminated') NOT NULL DEFAULT 'active' AFTER role;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL AFTER employee_number;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reference_descriptor JSON NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_image_data LONGTEXT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS signature_data LONGTEXT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_user_id CHAR(36) NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS organization_id CHAR(36) NULL;
ALTER TABLE employees ADD UNIQUE KEY IF NOT EXISTS uq_employees_employee_id (employee_id);
ALTER TABLE employees ADD UNIQUE KEY IF NOT EXISTS uq_employees_auth_user_id (auth_user_id);

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS clock_in_at DATETIME NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS clock_out_at DATETIME NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS kickout_reason VARCHAR(100) NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS organization_id CHAR(36) NULL;

UPDATE employees SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) WHERE full_name IS NULL;
UPDATE employees SET employee_id = employee_number WHERE employee_id IS NULL;
UPDATE employees SET auth_user_id = user_id WHERE auth_user_id IS NULL;
UPDATE attendance_records SET clock_in_at = clock_in WHERE clock_in_at IS NULL;
UPDATE attendance_records SET clock_out_at = clock_out WHERE clock_out_at IS NULL;
