-- SECTION A: Database Migration USDT → INR
-- Run this in your MySQL/MariaDB client (phpMyAdmin, HeidiSQL, etc.)

-- A1. Rename USDT → INR in fee table
UPDATE dbt_fees SET currency_symbol = 'INR' WHERE currency_symbol = 'USDT';

-- A2. Insert INR fee rows if they don't exist
INSERT INTO dbt_fees (level, currency_symbol, fees)
SELECT 'BUY', 'INR', 0.10
WHERE NOT EXISTS (SELECT 1 FROM dbt_fees WHERE level='BUY' AND currency_symbol='INR');

INSERT INTO dbt_fees (level, currency_symbol, fees)
SELECT 'SELL', 'INR', 0.10
WHERE NOT EXISTS (SELECT 1 FROM dbt_fees WHERE level='SELL' AND currency_symbol='INR');

-- A3. Rename existing user balances USDT → INR
UPDATE dbt_balance SET currency_symbol = 'INR' WHERE currency_symbol = 'USDT';

-- A4. Rename existing balance_log entries USDT → INR
UPDATE dbt_balance_log SET currency_symbol = 'INR' WHERE currency_symbol = 'USDT';

-- A5. Fix existing biding records if any used USDT as market quote
UPDATE dbt_biding SET market_symbol = REPLACE(market_symbol, '_USDT', '_INR')
WHERE market_symbol LIKE '%_USDT';

-- A6. Fix coinhistory market symbols
UPDATE dbt_coinhistory SET market_symbol = REPLACE(market_symbol, '_USDT', '_INR')
WHERE market_symbol LIKE '%_USDT';

-- A7. Show results
SELECT 'dbt_fees' AS tbl, COUNT(*) AS rows_updated FROM dbt_fees WHERE currency_symbol = 'INR';
SELECT 'dbt_balance' AS tbl, COUNT(*) AS rows_updated FROM dbt_balance WHERE currency_symbol = 'INR';
SELECT 'dbt_balance_log' AS tbl, COUNT(*) AS rows_updated FROM dbt_balance_log WHERE currency_symbol = 'INR';
SELECT 'dbt_biding' AS tbl, COUNT(*) AS rows_updated FROM dbt_biding WHERE market_symbol LIKE '%_INR';
