const connect = require('../config/Mysqlcon');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', 'config', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'Admin123x@';

async function ensureAdminColumn() {
    try {
        const pool = await connect();
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dbt_user' AND COLUMN_NAME = 'is_admin'`,
            [process.env.DB_NAME || 'trade']
        );
        if (!rows.length) {
            await conn.query('ALTER TABLE dbt_user ADD COLUMN is_admin tinyint(1) DEFAULT 0');
            console.log('[adminLogin] Added is_admin column to dbt_user');
        }
        conn.release();
    } catch (err) {
        console.error('[adminLogin] ensureAdminColumn error:', err.message);
    }
}

async function generateUserId(conn) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 20; attempt++) {
        let id = '';
        for (let i = 0; i < 10; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const [rows] = await conn.query('SELECT id FROM dbt_user WHERE user_id = ?', [id]);
        if (!rows.length) return id;
    }
    return 'ADMIN' + Date.now();
}

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (normalizedEmail !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            return res.status(401).json({ message: 'Invalid admin credentials.' });
        }

        await ensureAdminColumn();

        const conn = await connect();
        let [users] = await conn.query("SELECT * FROM dbt_user WHERE email = ?", [normalizedEmail]);

        let user;
        if (!users.length) {
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
            const user_id = await generateUserId(conn);

            await conn.query(
                'INSERT INTO dbt_user (first_name, last_name, email, password, user_id) VALUES (?)',
                [['Admin', 'User', normalizedEmail, hashedPassword, user_id]]
            );

            await conn.query(
                "INSERT INTO dbt_balance (user_id, currency_symbol, balance) VALUES (?, 'USDT', 200000.00000000)",
                [user_id]
            );

            const [balanceRows] = await conn.query(
                "SELECT id FROM dbt_balance WHERE user_id = ? AND currency_symbol = 'USDT'",
                [user_id]
            );
            if (balanceRows.length) {
                await conn.query(
                    "INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, ip, date) VALUES (?, ?, 'USDT', 'ADMIN_BONUS', 200000, ?, NOW())",
                    [balanceRows[0].id, user_id, req.ip || '0.0.0.0']
                );
            }

            await conn.query(
                'UPDATE dbt_user SET is_admin = 1 WHERE user_id = ?',
                [user_id]
            );

            user = { user_id, first_name: 'Admin', last_name: 'User', email: normalizedEmail, is_admin: 1 };
        } else {
            user = users[0];
            if (!user.is_admin) {
                await conn.query('UPDATE dbt_user SET is_admin = 1 WHERE user_id = ?', [user.user_id]);
                user.is_admin = 1;
            }
        }

        const token = jwt.sign(
            { user_id: user.user_id },
            process.env.Private_key,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                is_admin: user.is_admin,
            }
        });
    } catch (err) {
        console.error('Admin login error:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
};
