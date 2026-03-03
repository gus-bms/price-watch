CREATE DATABASE IF NOT EXISTS price_watch
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE price_watch;

CREATE TABLE IF NOT EXISTS watch_global_config (
  id TINYINT UNSIGNED NOT NULL,
  default_interval_minutes INT UNSIGNED NOT NULL DEFAULT 5,
  timeout_ms INT UNSIGNED NOT NULL DEFAULT 15000,
  user_agent VARCHAR(255) NOT NULL DEFAULT 'price-watch/0.1 (+local)',
  max_backoff_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  min_notify_interval_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  CONSTRAINT chk_global_singleton CHECK (id = 1),
  CONSTRAINT chk_global_default_interval CHECK (default_interval_minutes > 0),
  CONSTRAINT chk_global_timeout CHECK (timeout_ms > 0),
  CONSTRAINT chk_global_max_backoff CHECK (max_backoff_minutes > 0),
  CONSTRAINT chk_global_min_notify CHECK (min_notify_interval_minutes > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS watch_item (
  id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  target_price DECIMAL(18,4) NOT NULL,
  currency VARCHAR(16) NULL,
  interval_minutes INT UNSIGNED NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  CONSTRAINT chk_item_target_price CHECK (target_price > 0),
  CONSTRAINT chk_item_interval CHECK (interval_minutes > 0),
  CONSTRAINT chk_item_url CHECK (url REGEXP '^https?://'),

  KEY idx_item_enabled_interval (enabled, interval_minutes),
  KEY idx_item_url_prefix (url(255))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS watch_parser (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  watch_id VARCHAR(128) NOT NULL,
  role ENUM('price', 'stock') NOT NULL DEFAULT 'price',
  position INT UNSIGNED NOT NULL,
  tier ENUM('primary', 'secondary', 'fallback') NULL,
  parser_type ENUM('regex', 'jsonPath') NOT NULL,
  pattern TEXT NULL,
  flags VARCHAR(32) NOT NULL DEFAULT '',
  json_path VARCHAR(512) NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  CONSTRAINT fk_parser_watch
    FOREIGN KEY (watch_id) REFERENCES watch_item(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_parser_watch_role_position UNIQUE (watch_id, role, position),
  CONSTRAINT chk_parser_payload CHECK (
    (parser_type = 'regex' AND pattern IS NOT NULL AND json_path IS NULL) OR
    (parser_type = 'jsonPath' AND json_path IS NOT NULL AND pattern IS NULL)
  ),

  KEY idx_parser_watch_enabled_pos (watch_id, role, enabled, position)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS watch_state (
  watch_id VARCHAR(128) NOT NULL,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(1000) NULL,
  last_price DECIMAL(18,4) NULL,
  last_checked_at DATETIME(3) NULL,
  last_notified_at DATETIME(3) NULL,
  last_notified_price DECIMAL(18,4) NULL,
  last_matched_parser_id BIGINT UNSIGNED NULL,
  last_confidence ENUM('high', 'medium', 'low') NULL,
  last_verified_by_recheck BOOLEAN NULL,
  last_in_stock BOOLEAN NULL,
  next_run_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (watch_id),
  CONSTRAINT fk_state_watch
    FOREIGN KEY (watch_id) REFERENCES watch_item(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_state_last_parser
    FOREIGN KEY (last_matched_parser_id) REFERENCES watch_parser(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_state_failures CHECK (failures >= 0),

  KEY idx_state_next_run (next_run_at),
  KEY idx_state_last_checked (last_checked_at),
  KEY idx_state_last_notified (last_notified_at),
  KEY idx_state_last_error_prefix (last_error(191))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS watch_check_run (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  watch_id VARCHAR(128) NOT NULL,
  trigger_source ENUM('scheduled', 'manual', 'api_check') NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  http_status SMALLINT UNSIGNED NULL,
  response_content_type VARCHAR(255) NULL,
  matched_parser_id BIGINT UNSIGNED NULL,
  parsed_price DECIMAL(18,4) NULL,
  confidence ENUM('high', 'medium', 'low') NULL,
  verified_by_recheck BOOLEAN NULL,
  error_message TEXT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INT UNSIGNED NULL,

  PRIMARY KEY (id),
  CONSTRAINT fk_check_watch
    FOREIGN KEY (watch_id) REFERENCES watch_item(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_check_parser
    FOREIGN KEY (matched_parser_id) REFERENCES watch_parser(id)
    ON DELETE SET NULL,

  KEY idx_check_watch_started (watch_id, started_at),
  KEY idx_check_started (started_at),
  KEY idx_check_success_started (success, started_at),
  KEY idx_check_trigger_started (trigger_source, started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS watch_notification (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  watch_id VARCHAR(128) NOT NULL,
  sent_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  price DECIMAL(18,4) NOT NULL,
  target_price_snapshot DECIMAL(18,4) NOT NULL,
  currency VARCHAR(16) NULL,
  notification_type ENUM('price_alert', 'restock') NOT NULL DEFAULT 'price_alert',
  channel ENUM('console', 'slack', 'email', 'webhook') NOT NULL DEFAULT 'console',
  status ENUM('sent', 'failed', 'skipped') NOT NULL DEFAULT 'sent',
  message TEXT NULL,
  error_message VARCHAR(1000) NULL,

  PRIMARY KEY (id),
  CONSTRAINT fk_notification_watch
    FOREIGN KEY (watch_id) REFERENCES watch_item(id)
    ON DELETE CASCADE,

  KEY idx_notification_watch_sent (watch_id, sent_at),
  KEY idx_notification_channel_sent (channel, sent_at),
  KEY idx_notification_status_sent (status, sent_at)
) ENGINE=InnoDB;

INSERT INTO watch_global_config (id)
VALUES (1)
ON DUPLICATE KEY UPDATE id = VALUES(id);
