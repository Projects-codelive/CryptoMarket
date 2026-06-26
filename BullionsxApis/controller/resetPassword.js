const connect = require('../config/Mysqlcon');
const bcrypt = require('bcrypt');

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email, newPassword, and confirmPassword are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one number.' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one special character.' });
    }

    const conn = await connect();
    const normalizedEmail = email.toLowerCase().trim();

    // Check if OTP was verified for reset-password
    const [otps] = await conn.query(
      'SELECT id FROM dbt_otp WHERE email = ? AND purpose = "reset-password" AND verified = 1 LIMIT 1',
      [normalizedEmail]
    );

    if (otps.length === 0) {
      return res.status(400).json({ error: 'OTP not verified. Please complete OTP verification first.' });
    }

    // Verify user exists
    const [users] = await conn.query('SELECT id FROM dbt_user WHERE email = ?', [normalizedEmail]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    await conn.query('UPDATE dbt_user SET password = ? WHERE email = ?', [hashedPassword, normalizedEmail]);

    // Clean verified OTP record
    await conn.query('DELETE FROM dbt_otp WHERE email = ? AND purpose = "reset-password"', [normalizedEmail]);

    return res.status(200).json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
