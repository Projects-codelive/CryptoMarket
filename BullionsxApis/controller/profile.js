// controller/profile.js
// Existing getProfile + updateProfile are UNCHANGED.
// New exports: getKyc, saveKyc, getBankDetails, saveBankDetails

const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');

const EDITABLE_FIELDS = [
    'first_name', 'last_name', 'username', 'language',
    'country', 'city', 'address', 'bio', 'image'
];

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING — DO NOT MODIFY
// ─────────────────────────────────────────────────────────────────────────────

exports.getProfile = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query(
        `SELECT id, user_id, first_name, last_name, username, email, phone,
                googleauth, referral_id, referral_status, language, country,
                city, address, bio, image, status, verified, created,
                ip, remarks, withdraw_status, deposit_status, trade_status, mobile_pin
         FROM dbt_user WHERE user_id = ?`,
        [req.user.user_id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(rows[0]);
});

exports.updateProfile = asyncMiddleware(async (req, res) => {
    const { email, phone, password, user_id, password_reset_token, id, ...body } = req.body;

    if (email !== undefined)
        return res.status(400).json({ message: 'Email cannot be changed through this endpoint.' });
    if (phone !== undefined)
        return res.status(400).json({ message: 'Phone number cannot be changed through this endpoint.' });
    if (password !== undefined)
        return res.status(400).json({ message: 'Password cannot be changed through this endpoint.' });
    if (user_id !== undefined)
        return res.status(400).json({ message: 'user_id cannot be changed.' });
    if (password_reset_token !== undefined)
        return res.status(400).json({ message: 'password_reset_token cannot be changed through this endpoint.' });
    if (id !== undefined)
        return res.status(400).json({ message: 'id cannot be changed.' });

    const updates = {};
    for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) updates[field] = body[field];
    }

    const extraKeys = Object.keys(body).filter(k => !EDITABLE_FIELDS.includes(k));
    if (extraKeys.length > 0)
        return res.status(400).json({ message: `Unexpected fields: ${extraKeys.join(', ')}` });

    if (Object.keys(updates).length === 0)
        return res.status(400).json({ message: 'No editable fields provided.' });

    const conn = await connect();
    await conn.query('UPDATE dbt_user SET ? WHERE user_id = ?', [updates, req.user.user_id]);

    const [rows] = await conn.query(
        `SELECT id, user_id, first_name, last_name, username, email, phone,
                googleauth, referral_id, referral_status, language, country,
                city, address, bio, image, status, verified, created,
                ip, remarks, withdraw_status, deposit_status, trade_status, mobile_pin
         FROM dbt_user WHERE user_id = ?`,
        [req.user.user_id]
    );
    res.status(200).json(rows[0]);
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — KYC
// ─────────────────────────────────────────────────────────────────────────────

exports.getKyc = asyncMiddleware(async (req, res) => {
    const pool = await connect();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            'SELECT * FROM dbt_user_verify_doc WHERE user_id = ? LIMIT 1',
            [req.user.user_id]
        );
        res.status(200).json({ status: 1, kyc: rows[0] || null });
    } finally {
        conn.release();
    }
});

exports.saveKyc = asyncMiddleware(async (req, res) => {
    const {
        full_name, document_type, document_number,
        dob, address, city, state, country, postal_code,
    } = req.body;

    // ── Required field check ──────────────────────────────────────────────────
    if (!full_name || !full_name.trim())
        return res.status(400).json({ status: 0, message: 'Full name is required.' });
    if (!document_type)
        return res.status(400).json({ status: 0, message: 'Document type is required.' });
    if (!document_number || !document_number.trim())
        return res.status(400).json({ status: 0, message: 'Document number is required.' });

    // ── Format validation (demo-level) ────────────────────────────────────────
    const docNum = document_number.trim().toUpperCase();
    if (document_type === 'aadhaar' && !/^\d{12}$/.test(docNum))
        return res.status(400).json({ status: 0, message: 'Aadhaar must be exactly 12 digits.' });
    if (document_type === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(docNum))
        return res.status(400).json({ status: 0, message: 'PAN must follow format: ABCDE1234F.' });
    if (document_type === 'passport' && !/^[A-Z0-9]{6,9}$/.test(docNum))
        return res.status(400).json({ status: 0, message: 'Passport must be 6–9 alphanumeric characters.' });
    if (document_type === 'driving_licence' && !/^[A-Z0-9-]{5,20}$/.test(docNum))
        return res.status(400).json({ status: 0, message: 'Driving licence format is invalid.' });

    const payload = {
        user_id:         req.user.user_id,
        full_name:       full_name.trim(),
        document_type,
        document_number: docNum,
        dob:             dob || null,
        address:         address || null,
        city:            city || null,
        state:           state || null,
        country:         country || null,
        postal_code:     postal_code || null,
        status:          'pending',
    };

    const pool = await connect();
    const conn = await pool.getConnection();
    try {
        // Upsert — insert or update if record already exists for this user
        await conn.query(
            `INSERT INTO dbt_user_verify_doc
                (user_id, full_name, document_type, document_number,
                 dob, address, city, state, country, postal_code, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE
                full_name       = VALUES(full_name),
                document_type   = VALUES(document_type),
                document_number = VALUES(document_number),
                dob             = VALUES(dob),
                address         = VALUES(address),
                city            = VALUES(city),
                state           = VALUES(state),
                country         = VALUES(country),
                postal_code     = VALUES(postal_code),
                status          = 'pending',
                updated_at      = current_timestamp()`,
            [
                payload.user_id, payload.full_name, payload.document_type,
                payload.document_number, payload.dob, payload.address,
                payload.city, payload.state, payload.country, payload.postal_code,
            ]
        );

        const [rows] = await conn.query(
            'SELECT * FROM dbt_user_verify_doc WHERE user_id = ? LIMIT 1',
            [req.user.user_id]
        );
        res.status(200).json({ status: 1, message: 'KYC details saved successfully.', kyc: rows[0] });
    } finally {
        conn.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Bank Details
// ─────────────────────────────────────────────────────────────────────────────

exports.getBankDetails = asyncMiddleware(async (req, res) => {
    const pool = await connect();
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            'SELECT * FROM dbt_user_bank_details WHERE user_id = ? LIMIT 1',
            [req.user.user_id]
        );
        res.status(200).json({ status: 1, bank: rows[0] || null });
    } finally {
        conn.release();
    }
});

exports.saveBankDetails = asyncMiddleware(async (req, res) => {
    const {
        account_holder_name, bank_name, account_number,
        ifsc_code, branch_name, account_type, upi_id,
    } = req.body;

    // ── Required field check ──────────────────────────────────────────────────
    if (!account_holder_name || !account_holder_name.trim())
        return res.status(400).json({ status: 0, message: 'Account holder name is required.' });
    if (!bank_name || !bank_name.trim())
        return res.status(400).json({ status: 0, message: 'Bank name is required.' });
    if (!account_number || !account_number.trim())
        return res.status(400).json({ status: 0, message: 'Account number is required.' });
    if (!ifsc_code || !ifsc_code.trim())
        return res.status(400).json({ status: 0, message: 'IFSC code is required.' });

    // ── Format validation (demo-level) ────────────────────────────────────────
    if (!/^\d{9,18}$/.test(account_number.trim()))
        return res.status(400).json({ status: 0, message: 'Account number must be 9–18 digits.' });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.trim().toUpperCase()))
        return res.status(400).json({ status: 0, message: 'IFSC code must follow format: ABCD0123456.' });
    if (upi_id && upi_id.trim() && !/^[\w.\-_]+@[\w]+$/.test(upi_id.trim()))
        return res.status(400).json({ status: 0, message: 'UPI ID format is invalid (e.g. name@upi).' });

    const pool = await connect();
    const conn = await pool.getConnection();
    try {
        await conn.query(
            `INSERT INTO dbt_user_bank_details
                (user_id, account_holder_name, bank_name, account_number,
                 ifsc_code, branch_name, account_type, upi_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                account_holder_name = VALUES(account_holder_name),
                bank_name           = VALUES(bank_name),
                account_number      = VALUES(account_number),
                ifsc_code           = VALUES(ifsc_code),
                branch_name         = VALUES(branch_name),
                account_type        = VALUES(account_type),
                upi_id              = VALUES(upi_id),
                updated_at          = current_timestamp()`,
            [
                req.user.user_id,
                account_holder_name.trim(),
                bank_name.trim(),
                account_number.trim(),
                ifsc_code.trim().toUpperCase(),
                branch_name ? branch_name.trim() : null,
                account_type || null,
                upi_id ? upi_id.trim() : null,
            ]
        );

        const [rows] = await conn.query(
            'SELECT * FROM dbt_user_bank_details WHERE user_id = ? LIMIT 1',
            [req.user.user_id]
        );
        res.status(200).json({ status: 1, message: 'Bank details saved successfully.', bank: rows[0] });
    } finally {
        conn.release();
    }
});