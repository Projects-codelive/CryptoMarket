const connect = require('../config/Mysqlcon');

async function ensureStakingSchema() {
    let conn;
    try {
        const pool = await connect();
        conn = await pool.getConnection();
        console.log('[autoMigrate] Running schema checks...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dbt_user_verify_doc (
                id int(11) NOT NULL AUTO_INCREMENT,
                user_id varchar(100) NOT NULL,
                full_name varchar(255) NOT NULL,
                document_type varchar(50) NOT NULL,
                document_number varchar(100) NOT NULL,
                dob date DEFAULT NULL,
                address text DEFAULT NULL,
                city varchar(100) DEFAULT NULL,
                state varchar(100) DEFAULT NULL,
                country varchar(100) DEFAULT NULL,
                postal_code varchar(20) DEFAULT NULL,
                status varchar(20) DEFAULT 'pending',
                created_at timestamp NOT NULL DEFAULT current_timestamp(),
                updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                PRIMARY KEY (id),
                UNIQUE KEY user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        console.log('[autoMigrate] Ensured dbt_user_verify_doc table exists');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS dbt_user_bank_details (
                id int(11) NOT NULL AUTO_INCREMENT,
                user_id varchar(100) NOT NULL,
                account_holder_name varchar(255) NOT NULL,
                bank_name varchar(255) NOT NULL,
                account_number varchar(100) NOT NULL,
                ifsc_code varchar(50) NOT NULL,
                branch_name varchar(255) DEFAULT NULL,
                account_type varchar(50) DEFAULT NULL,
                upi_id varchar(100) DEFAULT NULL,
                created_at timestamp NOT NULL DEFAULT current_timestamp(),
                updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                PRIMARY KEY (id),
                UNIQUE KEY user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        console.log('[autoMigrate] Ensured dbt_user_bank_details table exists');

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

        try {
            await conn.query('DROP TABLE IF EXISTS dbt_coin_network');
        } catch (_) {}
        await conn.query(`
            CREATE TABLE dbt_coin_network (
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
        console.log('[autoMigrate] Recreated dbt_coin_network table');

        try {
            await conn.query("ALTER TABLE dbt_cryptocoin ADD COLUMN coin_position INT DEFAULT 0");
            console.log('[autoMigrate] Added coin_position column');
        } catch (_) {}
        try {
            await conn.query("UPDATE dbt_cryptocoin SET coin_position = id WHERE coin_position IS NULL OR coin_position = 0");
        } catch (_) {}

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
        const [netCount] = await conn.query('SELECT COUNT(*) AS cnt FROM dbt_coin_network');
        console.log(`[autoMigrate] dbt_coin_network has ${netCount[0].cnt} rows`);

        // Drop legacy staking tables — we now use the `staking` and `staking_log` tables exclusively
        try {
            await conn.query('DROP TABLE IF EXISTS dbt_user_staking');
            await conn.query('DROP TABLE IF EXISTS dbt_staking_plans');
            console.log('[autoMigrate] Removed legacy dbt_staking_plans and dbt_user_staking tables');
        } catch (_) {}


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
        try {
            await conn.query("ALTER TABLE tbl_withdraw MODIFY COLUMN user_id VARCHAR(100) NOT NULL COLLATE utf8mb4_general_ci");
            console.log('[autoMigrate] Fixed tbl_withdraw.user_id collation');
        } catch (_) {}

        // ----- Seed initial order book and trade history -----
        const [existingOrders] = await conn.query('SELECT COUNT(*) AS cnt FROM dbt_biding WHERE status = 2');
        const [existingTradeLogs] = await conn.query('SELECT COUNT(*) AS cnt FROM dbt_biding_log');
        if (existingOrders[0].cnt === 0 || existingTradeLogs[0].cnt === 0) {
            const [users] = await conn.query('SELECT user_id FROM dbt_user LIMIT 1');
            const seedUserId = users.length > 0 ? users[0].user_id : 'SEED_USER';

            // Ensure seed user has sufficient balances for seeded orders
            await conn.query(
                'INSERT INTO dbt_balance (user_id, currency_symbol, balance, sharewallet, fundwallet) VALUES (?, ?, 500000, 0, 0) ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 500000)',
                [seedUserId, 'INR']
            );
            await conn.query(
                'INSERT INTO dbt_balance (user_id, currency_symbol, balance, sharewallet, fundwallet) VALUES (?, ?, 500, 0, 0) ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 500)',
                [seedUserId, 'SOL']
            );
            await conn.query(
                'INSERT INTO dbt_balance (user_id, currency_symbol, balance, sharewallet, fundwallet) VALUES (?, ?, 50, 0, 0) ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 50)',
                [seedUserId, 'BTC']
            );
            await conn.query(
                'INSERT INTO dbt_balance (user_id, currency_symbol, balance, sharewallet, fundwallet) VALUES (?, ?, 500, 0, 0) ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 500)',
                [seedUserId, 'ETH']
            );
            await conn.query(
                'INSERT INTO dbt_balance (user_id, currency_symbol, balance, sharewallet, fundwallet) VALUES (?, ?, 50000, 0, 0) ON DUPLICATE KEY UPDATE balance = GREATEST(balance, 50000)',
                [seedUserId, 'USDT']
            );

            const orderIdMap = {};
            if (existingOrders[0].cnt === 0) {
                const now = new Date();
                const seedOrders = [
                    // SOL_INR
                    { key: 'sol_b1',  market: 'SOL_INR', coin: 'SOL', type: 'BUY',  price: 5000,  qty: 10 },
                    { key: 'sol_b2',  market: 'SOL_INR', coin: 'SOL', type: 'BUY',  price: 4900,  qty: 15 },
                    { key: 'sol_s1',  market: 'SOL_INR', coin: 'SOL', type: 'SELL', price: 5200,  qty:  8 },
                    { key: 'sol_s2',  market: 'SOL_INR', coin: 'SOL', type: 'SELL', price: 5300,  qty: 12 },
                    // BTC_INR
                    { key: 'btc_b1',  market: 'BTC_INR', coin: 'BTC', type: 'BUY',  price: 5000000, qty: 0.5 },
                    { key: 'btc_b2',  market: 'BTC_INR', coin: 'BTC', type: 'BUY',  price: 4900000, qty: 1   },
                    { key: 'btc_s1',  market: 'BTC_INR', coin: 'BTC', type: 'SELL', price: 5200000, qty: 0.3 },
                    { key: 'btc_s2',  market: 'BTC_INR', coin: 'BTC', type: 'SELL', price: 5300000, qty: 0.7 },
                    // ETH_INR
                    { key: 'eth_b1',  market: 'ETH_INR', coin: 'ETH', type: 'BUY',  price: 150000, qty: 2 },
                    { key: 'eth_b2',  market: 'ETH_INR', coin: 'ETH', type: 'BUY',  price: 145000, qty: 3 },
                    { key: 'eth_s1',  market: 'ETH_INR', coin: 'ETH', type: 'SELL', price: 160000, qty: 1 },
                    { key: 'eth_s2',  market: 'ETH_INR', coin: 'ETH', type: 'SELL', price: 165000, qty: 2 },
                ];
                for (const o of seedOrders) {
                    const totalAmount = o.price * o.qty;
                    const [r] = await conn.query(
                        "INSERT INTO dbt_biding (bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, open_order, fees_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2)",
                        [o.type, o.price, o.qty, o.qty, totalAmount, totalAmount, o.coin, o.market, seedUserId, now]
                    );
                    orderIdMap[o.key] = r.insertId;
                }
                console.log(`[autoMigrate] Seeded ${seedOrders.length} counter orders in dbt_biding`);
            }

            if (existingTradeLogs[0].cnt === 0) {
                const now = new Date();
                // Use captured IDs if we just seeded; fall back to 1-based offset otherwise
                const id = (key) => orderIdMap[key] || (() => { const m = { sol_b1:1,sol_b2:2,sol_s1:3,sol_s2:4,btc_b1:5,btc_b2:6,btc_s1:7,btc_s2:8,eth_b1:9,eth_b2:10,eth_s1:11,eth_s2:12 }; return m[key] || 0; })();
                const logEntries = [
                    // SOL_INR
                    { bid: 'sol_b1', ask: 'sol_s1', market: 'SOL_INR', coin: 'SOL', price: 5100, qty: 2, amt: 10200 },
                    { bid: 'sol_b1', ask: 'sol_s2', market: 'SOL_INR', coin: 'SOL', price: 5050, qty: 3, amt: 15150 },
                    { bid: 'sol_b2', ask: 'sol_s1', market: 'SOL_INR', coin: 'SOL', price: 5080, qty: 1, amt: 5080  },
                    { bid: 'sol_b1', ask: 'sol_s2', market: 'SOL_INR', coin: 'SOL', price: 5120, qty: 2, amt: 10240 },
                    { bid: 'sol_b2', ask: 'sol_s1', market: 'SOL_INR', coin: 'SOL', price: 5060, qty: 4, amt: 20240 },
                    // BTC_INR
                    { bid: 'btc_b1', ask: 'btc_s1', market: 'BTC_INR', coin: 'BTC', price: 5100000, qty: 0.1,  amt: 510000  },
                    { bid: 'btc_b2', ask: 'btc_s1', market: 'BTC_INR', coin: 'BTC', price: 5050000, qty: 0.2,  amt: 1010000 },
                    { bid: 'btc_b1', ask: 'btc_s2', market: 'BTC_INR', coin: 'BTC', price: 5150000, qty: 0.15, amt: 772500  },
                    // ETH_INR
                    { bid: 'eth_b1', ask: 'eth_s1', market: 'ETH_INR', coin: 'ETH', price: 155000, qty: 1,   amt: 155000 },
                    { bid: 'eth_b2', ask: 'eth_s2', market: 'ETH_INR', coin: 'ETH', price: 158000, qty: 0.5, amt: 79000  },
                ];
                for (const l of logEntries) {
                    const t = new Date(now.getTime() - Math.random() * 86400000);
                    const utcStr = t.toISOString().replace('T', ' ').substring(0, 19);
                    const unixTs = Math.floor(t.getTime() / 1000);
                    await conn.query(
                        "INSERT INTO dbt_biding_log (bid_id, bid_type, bid_price, complete_qty, complete_amount, user_id, currency_symbol, market_symbol, success_time, success_time_utc, success_time_unix, fees_amount, available_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)",
                        [id(l.bid), 'BUY',  l.price, l.qty, l.amt, seedUserId, l.coin, l.market, t, utcStr, unixTs]
                    );
                    await conn.query(
                        "INSERT INTO dbt_biding_log (bid_id, bid_type, bid_price, complete_qty, complete_amount, user_id, currency_symbol, market_symbol, success_time, success_time_utc, success_time_unix, fees_amount, available_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)",
                        [id(l.ask), 'SELL', l.price, l.qty, l.amt, seedUserId, l.coin, l.market, t, utcStr, unixTs]
                    );
                }
                console.log(`[autoMigrate] Seeded ${logEntries.length * 2} trade logs in dbt_biding_log`);
            }
        }

        conn.release();
        console.log('[autoMigrate] Schema checks complete.');
    } catch (err) {
        if (conn) conn.release();
        console.error('[autoMigrate] error:', err.message);
    }
}

module.exports = { ensureStakingSchema };
