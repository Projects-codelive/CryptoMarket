-- Staking Feature Migration
-- Run this in phpMyAdmin or MySQL CLI
-- Non-destructive: uses IF NOT EXISTS / ALTER ... ADD IF NOT EXISTS pattern

USE `trade`;

-- 1. Add is_admin column to dbt_user (non-destructive)
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'trade' AND TABLE_NAME = 'dbt_user' AND COLUMN_NAME = 'is_admin');
SET @query = IF(@exists = 0, 'ALTER TABLE dbt_user ADD is_admin tinyint(1) DEFAULT 0 AFTER mobile_pin', 'SELECT "is_admin column already exists"');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Staking Plans table
CREATE TABLE IF NOT EXISTS `dbt_staking_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `min_amount` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `max_amount` decimal(20,8) NOT NULL DEFAULT 99999999.00000000,
  `duration_days` int(11) NOT NULL COMMENT 'Lock-in period in days',
  `apr_percent` decimal(10,2) NOT NULL COMMENT 'Annual Percentage Rate',
  `status` tinyint(1) DEFAULT 1 COMMENT '1=active, 0=inactive',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. User Staking Subscriptions table
CREATE TABLE IF NOT EXISTS `dbt_user_staking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `stake_amount` decimal(20,8) NOT NULL,
  `currency_symbol` varchar(100) NOT NULL DEFAULT 'USDT',
  `apr_percent` decimal(10,2) NOT NULL COMMENT 'APR snapshot at subscription time',
  `duration_days` int(11) NOT NULL COMMENT 'Duration snapshot at subscription time',
  `start_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `maturity_date` timestamp NULL DEFAULT NULL,
  `status` enum('ACTIVE','MATURED','CLAIMED','UNSTAKED') NOT NULL DEFAULT 'ACTIVE',
  `reward_amount` decimal(20,8) DEFAULT 0.00000000 COMMENT 'Calculated reward at maturity',
  `claimed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  KEY `maturity_date` (`maturity_date`),
  CONSTRAINT `fk_user_staking_plan` FOREIGN KEY (`plan_id`) REFERENCES `dbt_staking_plans` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Seed default staking plans
INSERT INTO `dbt_staking_plans` (`name`, `min_amount`, `max_amount`, `duration_days`, `apr_percent`, `status`) VALUES
('Flexi Saver',    100.00000000, 99999999.00000000,  7,  6.00, 1),
('Value Booster',  500.00000000, 99999999.00000000, 14,  8.50, 1),
('Growth Pro',    1000.00000000, 99999999.00000000, 30, 12.00, 1),
('Wealth Builder', 5000.00000000, 99999999.00000000, 60, 15.00, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 5. Set first user as admin (if any user exists and no admin is set yet)
--    Manually set via: UPDATE dbt_user SET is_admin = 1 WHERE email = 'admin@example.com';
