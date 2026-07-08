const connect = require('../config/Mysqlcon');

async function ensureStakingSchema() {
    let conn;
    try {
        const pool = await connect();
        conn = await pool.getConnection();
        console.log('[autoMigrate] Running schema checks...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dbt_user_staking (
                id int(11) NOT NULL AUTO_INCREMENT,
                user_id varchar(100) NOT NULL,
                plan_id int(11) NOT NULL,
                stake_amount decimal(20,8) NOT NULL,
                currency_symbol varchar(100) NOT NULL DEFAULT 'INR',
                apr_percent decimal(10,2) NOT NULL,
                duration_days int(11) NOT NULL,
                start_date timestamp NOT NULL DEFAULT current_timestamp(),
                maturity_date timestamp NULL DEFAULT NULL,
                status enum('ACTIVE','MATURED','CLAIMED','UNSTAKED') NOT NULL DEFAULT 'ACTIVE',
                reward_amount decimal(20,8) DEFAULT 0.00000000,
                claimed_at timestamp NULL DEFAULT NULL,
                created_at timestamp NOT NULL DEFAULT current_timestamp(),
                PRIMARY KEY (id),
                KEY user_id (user_id),
                KEY status (status),
                KEY maturity_date (maturity_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        const stakingCols = [
            ['stake_amount', 'decimal(20,8) NOT NULL'],
            ['currency_symbol', `varchar(100) NOT NULL DEFAULT 'INR'`],
            ['apr_percent', 'decimal(10,2) NOT NULL'],
            ['duration_days', 'int(11) NOT NULL'],
            ['start_date', 'timestamp NOT NULL DEFAULT current_timestamp()'],
            ['maturity_date', 'timestamp NULL DEFAULT NULL'],
            ['status', `enum('ACTIVE','MATURED','CLAIMED','UNSTAKED') NOT NULL DEFAULT 'ACTIVE'`],
            ['reward_amount', 'decimal(20,8) DEFAULT 0.00000000'],
            ['claimed_at', 'timestamp NULL DEFAULT NULL'],
            ['created_at', 'timestamp NOT NULL DEFAULT current_timestamp()'],
        ];
        for (const [col, def] of stakingCols) {
            try {
                await conn.query(`ALTER TABLE dbt_user_staking ADD COLUMN ${col} ${def}`);
                console.log(`[autoMigrate] Added ${col} column`);
            } catch (_) {
                if (col === 'status') {
                    try {
                        await conn.query(`ALTER TABLE dbt_user_staking MODIFY COLUMN ${col} ${def}`);
                        console.log(`[autoMigrate] Repaired ${col} column type`);
                    } catch (_2) {}
                }
            }
        }

        try {
            await conn.query(
                `UPDATE dbt_user_staking SET status = 'ACTIVE' WHERE status NOT IN ('ACTIVE','MATURED','CLAIMED','UNSTAKED')`
            );
        } catch (_) {}

        try {
            await conn.query(`ALTER TABLE dbt_user ADD COLUMN is_admin tinyint(1) DEFAULT 0`);
            console.log('[autoMigrate] Added is_admin column');
        } catch (_) {}

        try {
            await conn.query('ALTER TABLE dbt_balance MODIFY COLUMN sharewallet DECIMAL(20,8) DEFAULT 0.00000000 NOT NULL');
            await conn.query('ALTER TABLE dbt_balance MODIFY COLUMN fundwallet DECIMAL(20,8) DEFAULT 0.00000000 NOT NULL');
            await conn.query('UPDATE dbt_balance SET sharewallet = 0 WHERE sharewallet IS NULL');
            await conn.query('UPDATE dbt_balance SET fundwallet = 0 WHERE fundwallet IS NULL');
            console.log('[autoMigrate] Fixed dbt_balance wallet null defaults');
        } catch (_) {}

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dbt_coin_network (
                id INT AUTO_INCREMENT PRIMARY KEY,
                coin_symbol VARCHAR(50) NOT NULL,
                network_name VARCHAR(50) NOT NULL,
                min_deposit DECIMAL(20,8) DEFAULT 0.00000000,
                min_withdraw DECIMAL(20,8) DEFAULT 0.00000000,
                max_withdraw DECIMAL(20,8) DEFAULT 0.00000000,
                withdraw_fee DECIMAL(20,8) DEFAULT 0.00000000,
                confirmations_required INT DEFAULT 1,
                deposit_status TINYINT(1) DEFAULT 1,
                withdraw_status TINYINT(1) DEFAULT 1,
                status TINYINT(1) DEFAULT 1
            )
        `);
        console.log('[autoMigrate] Ensured dbt_coin_network table');

        const [existingNetworks] = await conn.query('SELECT COUNT(*) AS cnt FROM dbt_coin_network');
        if (existingNetworks[0].cnt === 0) {
            await conn.query(`
                INSERT INTO dbt_coin_network (coin_symbol, network_name, min_withdraw, max_withdraw, withdraw_fee, deposit_status, withdraw_status, status) VALUES
                ('INR', 'IMPS', 100.00000000, 1000000.00000000, 0.00000000, 1, 1, 1),
                ('INR', 'UPI', 100.00000000, 1000000.00000000, 0.00000000, 1, 1, 1),
                ('INR', 'NEFT', 100.00000000, 1000000.00000000, 0.00000000, 1, 1, 1),
                ('BTC', 'BITCOIN', 0.00100000, 1000.00000000, 0.00050000, 1, 1, 1),
                ('ETH', 'ERC20', 0.01000000, 10000.00000000, 0.00500000, 1, 1, 1),
                ('USDT', 'ERC20', 10.00000000, 100000.00000000, 5.00000000, 1, 1, 1),
                ('USDT', 'TRC20', 10.00000000, 100000.00000000, 1.00000000, 1, 1, 1),
                ('USDT', 'BEP20', 10.00000000, 100000.00000000, 0.50000000, 1, 1, 1)
            `);
            console.log('[autoMigrate] Seeded default coin networks');
        }

        try {
            await conn.query(`DROP TABLE IF EXISTS dbt_staking_plan`);
            console.log('[autoMigrate] Dropped duplicate table dbt_staking_plan');
        } catch (_) {}

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dbt_staking_plans (
                id int(11) NOT NULL AUTO_INCREMENT,
                name varchar(100) NOT NULL,
                min_amount decimal(20,8) NOT NULL DEFAULT 0.00000000,
                max_amount decimal(20,8) NOT NULL DEFAULT 99999999.00000000,
                duration_days int(11) NOT NULL,
                apr_percent decimal(10,2) NOT NULL,
                status tinyint(1) DEFAULT 1,
                created_at timestamp NOT NULL DEFAULT current_timestamp(),
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        const [existingPlans] = await conn.query('SELECT COUNT(*) AS cnt FROM dbt_staking_plans');
        if (existingPlans[0].cnt === 0) {
            await conn.query(`
                INSERT INTO dbt_staking_plans (name, min_amount, max_amount, duration_days, apr_percent, status) VALUES
                ('Flexi Saver',    100.00000000, 99999999.00000000,  7,  6.00, 1),
                ('Value Booster',  500.00000000, 99999999.00000000, 14,  8.50, 1),
                ('Growth Pro',    1000.00000000, 99999999.00000000, 30, 12.00, 1),
                ('Wealth Builder', 5000.00000000, 99999999.00000000, 60, 15.00, 1)
            `);
            console.log('[autoMigrate] Seeded default staking plans');
        }

        const withdrawCols = [
            ['charge', 'decimal(20,8) DEFAULT 0.00000000'],
            ['net_amount', 'decimal(20,8) DEFAULT 0.00000000'],
            ['txn_id', 'varchar(255) DEFAULT NULL'],
            ['message', 'text DEFAULT NULL'],
        ];
        for (const [col, def] of withdrawCols) {
            try {
                await conn.query(`ALTER TABLE tbl_withdraw ADD COLUMN ${col} ${def}`);
                console.log(`[autoMigrate] Added tbl_withdraw.${col}`);
            } catch (_) {}
        }
        try {
            await conn.query('ALTER TABLE tbl_withdraw MODIFY COLUMN id int(11) NOT NULL AUTO_INCREMENT');
        } catch (_) {}
        try {
            await conn.query("ALTER TABLE tbl_withdraw MODIFY COLUMN status VARCHAR(20) DEFAULT 'pending'");
            console.log('[autoMigrate] Repaired tbl_withdraw.status type');
        } catch (_) {}

        conn.release();
        console.log('[autoMigrate] Schema checks complete.');
    } catch (err) {
        if (conn) conn.release();
        console.error('[autoMigrate] error:', err.message);
    }
}

module.exports = { ensureStakingSchema };
