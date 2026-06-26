const { authValidate } = require('../Validate/validate');
const connect = require('../config/Mysqlcon');
const { sendOtpEmail } = require('../utils/email');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const bcrypt = require('bcrypt');

exports.loginUser = async (req, res, next) => {
    try {
        const conn = await connect();

        const { error } = authValidate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const normalizedEmail = req.body.email.toLowerCase().trim();

        const [users] = await conn.query("SELECT * FROM dbt_user WHERE email=?", [normalizedEmail]);
        if (!users.length) return res.status(400).json({ message: "Invalid email or password" });

        const validatePass = await bcrypt.compare(req.body.password, users[0].password);
        if (!validatePass) return res.status(400).json({ message: "Invalid email or password" });

        // Generate and send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);

        await conn.query('DELETE FROM dbt_otp WHERE email = ? AND purpose = "login"', [normalizedEmail]);
        await conn.query(
            'INSERT INTO dbt_otp (email, otp, purpose, created_at, verified, attempts, blocked_until) VALUES (?, ?, "login", NOW(), 0, 0, NULL)',
            [normalizedEmail, hashedOtp]
        );

        await sendOtpEmail(normalizedEmail, otp, 'login');

        return res.status(200).json({ message: "OTP sent to your email. Please verify to complete login.", email: normalizedEmail });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: err.message });
    }
}