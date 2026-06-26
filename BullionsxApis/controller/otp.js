const connect = require('../config/Mysqlcon');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const { sendOtpEmail } = require('../utils/email');

const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 15 * 60 * 1000;
const EXPIRATION_DURATION_MS = 10 * 60 * 1000;

exports.sendOtp = async (req, res) => {
  try {
    const { email, purpose, phone } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ error: 'Email and purpose are required.' });
    }

    // Validate phone only for registration
    if (purpose === 'register') {
      if (!phone || !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Phone number must be exactly 10 digits.' });
      }
    }

    if (!['register', 'reset-password'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose.' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const conn = await connect();
    const normalizedEmail = email.toLowerCase().trim();

    // Check user existence based on purpose
    const [users] = await conn.query('SELECT id FROM dbt_user WHERE email = ?', [normalizedEmail]);
    if (purpose === 'register' && users.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (purpose === 'reset-password' && users.length === 0) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    // Check if user is currently blocked from sending/verifying
    const [existing] = await conn.query(
      'SELECT blocked_until FROM dbt_otp WHERE email = ? AND purpose = ? AND verified = 0 LIMIT 1',
      [normalizedEmail, purpose]
    );

    if (existing.length > 0 && existing[0].blocked_until) {
      const blockedUntil = new Date(existing[0].blocked_until);
      if (blockedUntil > new Date()) {
        const remaining = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
        return res.status(429).json({
          error: `Too many attempts. Try again in ${remaining} minute(s).`,
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Clean old OTPs for this email/purpose
    await conn.query('DELETE FROM dbt_otp WHERE email = ? AND purpose = ?', [normalizedEmail, purpose]);

    // Insert new OTP
    await conn.query(
      'INSERT INTO dbt_otp (email, otp, purpose, created_at, verified, attempts, blocked_until) VALUES (?, ?, ?, NOW(), 0, 0, NULL)',
      [normalizedEmail, hashedOtp, purpose]
    );

    // Send email
    try {
      await sendOtpEmail(normalizedEmail, otp, purpose);
    } catch (emailErr) {
      await conn.query('DELETE FROM dbt_otp WHERE email = ? AND purpose = ?', [normalizedEmail, purpose]);
      console.error('Email send error:', emailErr);
      return res.status(500).json({ error: 'Failed to send OTP email. Check server configuration.' });
    }

    return res.status(200).json({ success: true, message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({ error: 'Email, OTP, and purpose are required.' });
    }

    const conn = await connect();
    const normalizedEmail = email.toLowerCase().trim();

    // Query OTP record
    const [otps] = await conn.query(
      'SELECT * FROM dbt_otp WHERE email = ? AND purpose = ? AND verified = 0 LIMIT 1',
      [normalizedEmail, purpose]
    );

    if (otps.length === 0) {
      return res.status(400).json({ success: false, message: 'No OTP found. Request a new one.' });
    }

    const otpRecord = otps[0];

    // Check if blocked
    if (otpRecord.blocked_until) {
      const blockedUntil = new Date(otpRecord.blocked_until);
      if (blockedUntil > new Date()) {
        const remaining = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Too many incorrect attempts. Try again in ${remaining} minute(s).`,
        });
      }
    }

    // Check expiration (10 minutes)
    const createdAtTime = new Date(otpRecord.created_at).getTime();
    const isExpired = Date.now() - createdAtTime > EXPIRATION_DURATION_MS;
    if (isExpired) {
      await conn.query('DELETE FROM dbt_otp WHERE id = ?', [otpRecord.id]);
      return res.status(400).json({ success: false, message: 'OTP has expired. Request a new one.' });
    }

    // Compare OTP
    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      const attempts = (otpRecord.attempts || 0) + 1;
      let blockedUntil = null;

      if (attempts >= MAX_ATTEMPTS) {
        blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
      }

      await conn.query(
        'UPDATE dbt_otp SET attempts = ?, blocked_until = ? WHERE id = ?',
        [blockedUntil ? attempts : attempts, blockedUntil, otpRecord.id]
      );

      const remaining = MAX_ATTEMPTS - attempts;
      if (blockedUntil) {
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts. Blocked for 15 minutes.',
        });
      }

      return res.status(400).json({
        success: false,
        message: remaining > 0 ? `Invalid OTP. ${remaining} attempt(s) remaining.` : 'Invalid OTP.',
      });
    }

    // Mark as verified
    await conn.query(
      'UPDATE dbt_otp SET verified = 1, attempts = 0, blocked_until = NULL WHERE id = ?',
      [otpRecord.id]
    );

    // If login OTP, return JWT token with user data
    if (purpose === 'login') {
      const [users] = await conn.query('SELECT user_id, first_name, last_name, email FROM dbt_user WHERE email = ?', [normalizedEmail]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const user = users[0];
      await conn.query('DELETE FROM dbt_otp WHERE email = ? AND purpose = "login"', [normalizedEmail]);
      const token = jwt.sign({ user_id: user.user_id }, process.env.Private_key);
      return res.header('x-auth-token', token).json({
        success: true,
        verified: true,
        token,
        user: {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
        },
        message: 'Successfully logged in.'
      });
    }

    return res.status(200).json({ success: true, verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
