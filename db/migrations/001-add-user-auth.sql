-- Migration: Add user authentication support
-- Apply to existing databases that already have the base schema

CREATE TABLE IF NOT EXISTS `user` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kakao_id BIGINT NOT NULL COMMENT 'Kakao account unique ID',
  nickname VARCHAR(100) NULL,
  profile_image_url VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_kakao_id (kakao_id)
) ENGINE=InnoDB;

-- Add user_id column to watch_item (skip if already exists)
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'watch_item'
    AND COLUMN_NAME = 'user_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE watch_item ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id, ADD KEY idx_item_user (user_id), ADD CONSTRAINT fk_item_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
