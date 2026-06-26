const connect = require('../config/Mysqlcon');
const { validate } = require('../Validate/validate');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

async function generateUniqueUserId(conn) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let user_id;
    let exists = true;
    while (exists) {
        user_id = '';
        for (let i = 0; i < 6; i++) {
            user_id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const [rows] = await conn.query('SELECT id FROM dbt_user WHERE user_id = ?', [user_id]);
        exists = rows.length > 0;
    }
    return user_id;
}

module.exports = async function createUser(req, res, next) {
    let conn;
    try {
        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const { error } = validate(req.body);
        if (error) {
            await conn.rollback();
            conn.release();
            conn = null;
            return res.status(400).json({ error: error.details[0].message });
        }

        const normalizedEmail = req.body.email.toLowerCase().trim();

        const [otps] = await conn.query(
            'SELECT id FROM dbt_otp WHERE email = ? AND purpose = "register" AND verified = 1 LIMIT 1',
            [normalizedEmail]
        );
        if (otps.length === 0) {
            await conn.rollback();
            conn.release();
            conn = null;
            return res.status(400).json({ message: "Email not verified. Please complete OTP verification first." });
        }

        const [existingUsers] = await conn.query('SELECT email FROM dbt_user WHERE email = ?', [normalizedEmail]);
        if (existingUsers.length > 0) {
            await conn.rollback();
            conn.release();
            conn = null;
            return res.status(400).json({ message: "User is already registered" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);

        const nameParts = req.body.name.trim().split(/\s+/);
        const first_name = nameParts[0] || '';
        const last_name = nameParts.slice(1).join(' ') || '';

        const user_id = await generateUniqueUserId(conn);

        let referral_id = null;
        if (req.body.referral_id && req.body.referral_id.trim()) {
            const [refRows] = await conn.query('SELECT id FROM dbt_user WHERE user_id = ?', [req.body.referral_id.trim()]);
            if (refRows.length === 0) {
                await conn.rollback();
                conn.release();
                conn = null;
                return res.status(400).json({ message: "Invalid referral ID. No user found with this ID." });
            }
            referral_id = req.body.referral_id.trim();
        }

        const userdata = [
            first_name,
            last_name,
            normalizedEmail,
            hashedPassword,
            req.body.phone,
            user_id,
            referral_id
        ];

        const [result] = await conn.query(
            'INSERT INTO dbt_user (first_name, last_name, email, password, phone, user_id, referral_id) VALUES (?)',
            [userdata]
        );

        if (result.affectedRows > 0) {
            await conn.query('DELETE FROM dbt_otp WHERE email = ? AND purpose = "register"', [normalizedEmail]);

            const [balanceResult] = await conn.query(
                'INSERT INTO dbt_balance (user_id, currency_symbol, balance) VALUES (?, "INR", 200000.00000000)',
                [user_id]
            );

            const [balanceRows] = await conn.query(
                'SELECT id FROM dbt_balance WHERE user_id = ? AND currency_symbol = "INR"',
                [user_id]
            );
            const balanceId = balanceRows[0]?.id;
            if (balanceId) {
                await conn.query(
                    'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, "INR", "SIGNUP_BONUS", 200000, 0, ?, NOW())',
                    [balanceId, user_id, req.ip || '0.0.0.0']
                );
            }

            await conn.commit();
            conn.release();
            conn = null;

            const token = jwt.sign({ user_id: user_id }, process.env.Private_key);
            return res.header('x-auth-token', token).json({
                message: "successfully registered",
                token: token,
                user: {
                    user_id: user_id,
                    first_name: first_name,
                    last_name: last_name,
                    email: normalizedEmail
                }
            });
        } else {
            await conn.rollback();
            conn.release();
            conn = null;
            return res.status(500).json({ message: "Failed to create user record." });
        }
    }
    catch (err) {
        if (conn) {
            await conn.rollback();
            conn.release();
        }
        console.error('Registration error:', err);
        res.status(400).json({ message: err.message });
    }
}
