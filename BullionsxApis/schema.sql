-- BullionsX Trading Platform - Complete Database Schema
-- Database: trade
-- Run this in phpMyAdmin or MySQL CLI to create all tables

CREATE DATABASE IF NOT EXISTS `trade` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `trade`;

-- --------------------------------------------------------
-- Table: dbt_user (user accounts)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `googleauth` varchar(255) DEFAULT NULL,
  `referral_id` varchar(100) DEFAULT NULL,
  `referral_status` tinyint(1) DEFAULT 0,
  `language` varchar(50) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 1,
  `verified` tinyint(1) DEFAULT 0,
  `created` timestamp NOT NULL DEFAULT current_timestamp(),
  `ip` varchar(100) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `withdraw_status` tinyint(1) DEFAULT 1,
  `deposit_status` tinyint(1) DEFAULT 1,
  `trade_status` tinyint(1) DEFAULT 1,
  `mobile_pin` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_otp (OTP verification codes)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_otp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `otp` varchar(255) NOT NULL,
  `purpose` varchar(50) NOT NULL COMMENT 'register, login, reset-password',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `verified` tinyint(1) DEFAULT 0,
  `attempts` int(11) DEFAULT 0,
  `blocked_until` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `email_purpose` (`email`, `purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_balance (user wallet balances)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_balance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `currency_id` int(11) DEFAULT NULL,
  `currency_symbol` varchar(100) NOT NULL,
  `balance` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `sharewallet` decimal(20,8) DEFAULT NULL,
  `fundwallet` decimal(20,8) DEFAULT NULL,
  `last_update` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_currency` (`user_id`, `currency_symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_balance_log (balance transaction history)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_balance_log` (
  `log_id` bigint(22) NOT NULL AUTO_INCREMENT,
  `balance_id` int(11) NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `currency_id` int(11) DEFAULT NULL,
  `currency_symbol` varchar(100) NOT NULL,
  `transaction_type` varchar(100) NOT NULL COMMENT 'SIGNUP_BONUS, ORDER_PLACE_BUY, ORDER_PLACE_SELL, TRADE_BUY, TRADE_SELL, ORDER_CANCEL_REFUND, PRICE_IMPROVEMENT_REFUND, ADJUSTMENT, SHARE_HOLDING_SHARE',
  `transaction_amount` decimal(20,8) NOT NULL,
  `transaction_fees` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `ip` varchar(100) NOT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `user_id` (`user_id`),
  KEY `user_currency` (`user_id`, `currency_symbol`),
  KEY `transaction_type` (`transaction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_biding (open order book)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_biding` (
  `id` bigint(22) NOT NULL AUTO_INCREMENT,
  `bid_type` varchar(50) NOT NULL COMMENT 'BUY or SELL',
  `bid_price` decimal(20,8) NOT NULL,
  `bid_qty` decimal(20,8) NOT NULL,
  `bid_qty_available` decimal(20,8) NOT NULL,
  `total_amount` decimal(20,8) NOT NULL,
  `amount_available` decimal(20,8) NOT NULL,
  `coin_id` varchar(50) DEFAULT NULL,
  `currency_symbol` varchar(100) NOT NULL,
  `market_id` int(100) DEFAULT NULL,
  `market_symbol` varchar(100) NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `open_order` timestamp NOT NULL DEFAULT current_timestamp(),
  `fees_amount` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `status` tinyint(1) NOT NULL COMMENT '1=Complete, 2=Running/Open, 3=Cancelled',
  `cancelbutton` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `market_symbol` (`market_symbol`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  KEY `market_status_type` (`market_symbol`, `status`, `bid_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_biding_log (completed trade log)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_biding_log` (
  `log_id` bigint(22) NOT NULL AUTO_INCREMENT,
  `bid_id` bigint(22) NOT NULL,
  `bid_type` varchar(10) NOT NULL COMMENT 'BUY or SELL',
  `bid_price` decimal(20,8) NOT NULL,
  `complete_qty` decimal(20,8) NOT NULL,
  `complete_amount` decimal(20,8) NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `coin_id` varchar(100) DEFAULT NULL,
  `currency_symbol` varchar(100) NOT NULL,
  `market_id` int(11) DEFAULT NULL,
  `market_symbol` varchar(100) NOT NULL,
  `success_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `success_time_utc` timestamp NOT NULL DEFAULT current_timestamp(),
  `success_time_unix` bigint(20) DEFAULT NULL,
  `fees_amount` decimal(20,8) NOT NULL,
  `available_amount` decimal(20,8) NOT NULL,
  `status` tinyint(1) NOT NULL COMMENT '1=Complete, 2=Partial',
  PRIMARY KEY (`log_id`),
  KEY `market_symbol` (`market_symbol`),
  KEY `user_id` (`user_id`),
  KEY `success_time` (`success_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_coinhistory (price history / candlesticks)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_coinhistory` (
  `id` bigint(22) NOT NULL AUTO_INCREMENT,
  `coin_symbol` varchar(50) NOT NULL,
  `market_symbol` varchar(100) NOT NULL,
  `last_price` decimal(20,8) NOT NULL,
  `total_coin_supply` decimal(20,8) DEFAULT NULL,
  `price_high_1h` decimal(20,8) DEFAULT NULL,
  `price_low_1h` decimal(20,8) DEFAULT NULL,
  `price_change_1h` decimal(20,8) DEFAULT NULL,
  `volume_1h` decimal(20,8) DEFAULT NULL,
  `price_high_24h` decimal(20,8) DEFAULT NULL,
  `price_low_24h` decimal(20,8) DEFAULT NULL,
  `price_change_24h` decimal(20,8) DEFAULT NULL,
  `volume_24h` decimal(20,8) DEFAULT NULL,
  `open` decimal(20,8) DEFAULT NULL,
  `close` decimal(20,8) DEFAULT NULL,
  `volumefrom` decimal(20,8) DEFAULT NULL,
  `volumeto` decimal(20,8) DEFAULT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `market_symbol` (`market_symbol`),
  KEY `coin_symbol` (`coin_symbol`),
  KEY `market_date` (`market_symbol`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_coinpair (trading pairs configuration)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_coinpair` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `market_symbol` varchar(100) NOT NULL COMMENT 'e.g. BTC_INR, ETH_INR',
  `coin_symbol` varchar(50) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `base_price` decimal(20,8) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `market_symbol` (`market_symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_cryptocoin (supported crypto coins)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_cryptocoin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `coin_symbol` varchar(50) NOT NULL,
  `coin_name` varchar(100) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `coin_symbol` (`coin_symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_address (blockchain wallet addresses)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_address` (
  `id` int(5) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(225) NOT NULL,
  `coin_id` varchar(225) NOT NULL,
  `address` varchar(225) NOT NULL,
  `epkey` varchar(225) NOT NULL,
  `publickey` varchar(225) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: dbt_fees (trading fee configuration)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbt_fees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `level` varchar(50) NOT NULL COMMENT 'BUY or SELL',
  `currency_symbol` varchar(100) NOT NULL,
  `fees` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `level_currency` (`level`, `currency_symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Seed data: default trading pairs (USDT markets)
-- --------------------------------------------------------
INSERT INTO `dbt_coinpair` (`market_symbol`, `coin_symbol`, `status`) VALUES
('BTC_USDT', 'BTC', 1),
('ETH_USDT', 'ETH', 1),
('SOL_USDT', 'SOL', 1),
('BNB_USDT', 'BNB', 1),
('XRP_USDT', 'XRP', 1),
('DOGE_USDT', 'DOGE', 1),
('ADA_USDT', 'ADA', 1)
ON DUPLICATE KEY UPDATE `status` = 1;

-- --------------------------------------------------------
-- Seed data: crypto coins
-- --------------------------------------------------------
INSERT INTO `dbt_cryptocoin` (`coin_symbol`, `coin_name`, `status`) VALUES
('BTC', 'Bitcoin', 1),
('ETH', 'Ethereum', 1),
('SOL', 'Solana', 1),
('BNB', 'Binance Coin', 1),
('XRP', 'Ripple', 1),
('DOGE', 'Dogecoin', 1),
('ADA', 'Cardano', 1),
('TRX', 'Tron', 1),
('SHIB', 'Shiba Inu', 1),
('CAKE', 'PancakeSwap', 1),
('MDR', 'Mudra', 1),
('BLN', 'Billion', 1),
('BLNS', 'Bullions', 1),
('BUSD', 'Binance USD', 1)
ON DUPLICATE KEY UPDATE `status` = 1;

-- --------------------------------------------------------
-- Seed data: trading fees (0.10% for both buy and sell in USDT)
-- --------------------------------------------------------
INSERT INTO `dbt_fees` (`level`, `currency_symbol`, `fees`) VALUES
('BUY', 'USDT', 0.10),
('SELL', 'USDT', 0.10)
ON DUPLICATE KEY UPDATE `fees` = VALUES(`fees`);
