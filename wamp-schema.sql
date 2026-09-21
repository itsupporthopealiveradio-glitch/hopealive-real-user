CREATE DATABASE IF NOT EXISTS hopealive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hopealive;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  pin_hash VARCHAR(255) NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  profile_image_path VARCHAR(500) NULL,
  role ENUM('user','security','manager','admin') NOT NULL DEFAULT 'user',
  status ENUM('pending','active','suspended','blocked','deactivated') NOT NULL DEFAULT 'pending',
  first_login_at DATETIME NULL,
  email_verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  remember_email TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_status_role (status, role)
);

CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL UNIQUE,
  email VARCHAR(255) NULL UNIQUE,
  employee_number VARCHAR(50) NOT NULL UNIQUE,
  id_number VARCHAR(100) NULL UNIQUE,
  department VARCHAR(150) NULL,
  job_title VARCHAR(150) NULL,
  employment_type VARCHAR(50) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  onboarding_status ENUM('invited','pending','active','inactive') NOT NULL DEFAULT 'pending',
  biometric_consent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user_expiry (user_id, expires_at)
);

CREATE TABLE IF NOT EXISTS access_cards (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  card_number VARCHAR(100) NOT NULL UNIQUE,
  card_type ENUM('qr','rfid','manual') NOT NULL DEFAULT 'qr',
  status ENUM('active','revoked','lost','expired') NOT NULL DEFAULT 'active',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_by CHAR(36) NULL,
  CONSTRAINT fk_cards_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_cards_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_cards_employee_status (employee_id, status)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  clock_in DATETIME NOT NULL,
  clock_out DATETIME NULL,
  clock_in_method ENUM('app','qr','card','manual') NOT NULL DEFAULT 'app',
  clock_out_method ENUM('app','qr','card','manual') NULL,
  status ENUM('in_progress','complete','voided') NOT NULL DEFAULT 'in_progress',
  clocked_in_by CHAR(36) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attendance_actor FOREIGN KEY (clocked_in_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_attendance_employee_time (employee_id, clock_in),
  INDEX idx_attendance_open (status, clock_in)
);

CREATE TABLE IF NOT EXISTS biometric_enrollments (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL UNIQUE,
  face_image_path VARCHAR(500) NOT NULL,
  face_template_hash CHAR(64) NULL,
  consent_at DATETIME NOT NULL,
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_biometrics_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_biometrics_status (status)
);

CREATE TABLE IF NOT EXISTS guest_invites (
  id CHAR(36) PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by_employee_id CHAR(36) NOT NULL,
  guest_name VARCHAR(200) NOT NULL,
  guest_count INT NOT NULL DEFAULT 1,
  guest_email VARCHAR(255) NULL,
  guest_phone VARCHAR(40) NULL,
  purpose VARCHAR(255) NULL,
  valid_from DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  status ENUM('pending','approved','checked_in','checked_out','cancelled','expired','denied') NOT NULL DEFAULT 'pending',
  approved_by CHAR(36) NULL,
  approved_at DATETIME NULL,
  checked_in_at DATETIME NULL,
  checked_in_by CHAR(36) NULL,
  checked_out_at DATETIME NULL,
  checked_out_by CHAR(36) NULL,
  id_photo_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invites_employee FOREIGN KEY (invited_by_employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_invites_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_invites_status_expiry (status, expires_at)
);

CREATE TABLE IF NOT EXISTS guest_verifications (
  id CHAR(36) PRIMARY KEY,
  invite_id CHAR(36) NOT NULL,
  verification_type ENUM('face','government_id') NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  captured_by CHAR(36) NULL,
  verified_at DATETIME NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_verifications_invite FOREIGN KEY (invite_id) REFERENCES guest_invites(id) ON DELETE CASCADE,
  CONSTRAINT fk_verifications_actor FOREIGN KEY (captured_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_invite_verification_type (invite_id, verification_type)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id CHAR(36) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS security_events (
  id CHAR(36) PRIMARY KEY,
  event_type ENUM('failed_login','invalid_qr','access_denied','suspicious_activity','data_access','other') NOT NULL,
  severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  actor_user_id CHAR(36) NULL,
  target_user_id CHAR(36) NULL,
  details JSON NULL,
  status ENUM('open','investigating','resolved','dismissed') NOT NULL DEFAULT 'open',
  resolved_by CHAR(36) NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_security_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_security_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_security_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_security_open (status, severity, created_at)
);

CREATE TABLE IF NOT EXISTS account_blocks (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  blocked_by CHAR(36) NULL,
  blocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unblocked_by CHAR(36) NULL,
  unblocked_at DATETIME NULL,
  CONSTRAINT fk_blocks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_blocks_actor FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_blocks_unblocker FOREIGN KEY (unblocked_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_blocks_active (user_id, unblocked_at)
);

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('demo_mode', 'false'),
  ('guest_verification_required', 'true'),
  ('emergency_blocking_enabled', 'true')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

ALTER TABLE access_cards ENGINE = InnoDB;
ALTER TABLE account_blocks ENGINE = InnoDB;
ALTER TABLE app_settings ENGINE = InnoDB;
ALTER TABLE attendance_records ENGINE = InnoDB;
ALTER TABLE biometric_enrollments ENGINE = InnoDB;
ALTER TABLE audit_logs ENGINE = InnoDB;
ALTER TABLE employees ENGINE = InnoDB;
ALTER TABLE guest_invites ENGINE = InnoDB;
ALTER TABLE guest_verifications ENGINE = InnoDB;
ALTER TABLE security_events ENGINE = InnoDB;
ALTER TABLE users ENGINE = InnoDB;
ALTER TABLE user_sessions ENGINE = InnoDB;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL UNIQUE;