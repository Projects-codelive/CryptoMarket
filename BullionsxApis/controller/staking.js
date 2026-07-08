const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');
const Joi = require('joi');
const { ensureBalanceRow, InsufficientBalanceError } = require('../services/balanceService');

// ---------- PUBLIC ----------

exports.getPlans = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query('SELECT * FROM dbt_staking_plans WHERE status = 1 ORDER BY min_amount ASC');
    res.status(200).json(rows);
});

// ---------- USER ----------

exports.getMyStaking = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query(
        `SELECT us.*, sp.name AS plan_name
         FROM dbt_user_staking us
         JOIN dbt_staking_plans sp ON us.plan_id = sp.id
         WHERE us.user_id = ?
         ORDER BY us.created_at DESC`,
        [req.user.user_id]
    );
    res.status(200).json(rows);
});

exports.subscribe = async (req, res) => {
    let conn;
    try {
        const { error } = Joi.object({
            plan_id: Joi.number().integer().positive().required(),
            stake_amount: Joi.number().positive().required()
        }).validate(req.body);
        if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

        const { plan_id, stake_amount } = req.body;
        const amount = parseFloat(stake_amount);
        const userId = req.user.user_id;

        const pool = await connect();
        conn = await pool.getConnection();

        // Ensure staking table columns exist (safety net if autoMigrate didn't run)
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
            try { await conn.query(`ALTER TABLE dbt_user_staking ADD COLUMN ${col} ${def}`); }
            catch (_) {
                if (col === 'status') {
                    try { await conn.query(`ALTER TABLE dbt_user_staking MODIFY COLUMN ${col} ${def}`); } catch (_2) {}
                }
            }
        }

        await conn.beginTransaction();

        const [plans] = await conn.query('SELECT * FROM dbt_staking_plans WHERE id = ? AND status = 1', [plan_id]);
        if (!plans.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Staking plan not found or inactive.' });
        }
        const plan = plans[0];

        const [existingStakes] = await conn.query(
            "SELECT id FROM dbt_user_staking WHERE user_id = ? AND plan_id = ? AND status IN ('ACTIVE','MATURED')",
            [userId, plan_id]
        );
        if (existingStakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({
                status: 0,
                message: 'You already have an active or matured subscription to this plan.'
            });
        }

        if (amount < parseFloat(plan.min_amount) || amount > parseFloat(plan.max_amount)) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({
                status: 0,
                message: `Stake amount must be between ${plan.min_amount} and ${plan.max_amount}.`
            });
        }

        const stakingRow = await ensureBalanceRow(conn, userId, 'INR');
        const spotBal = parseFloat(stakingRow.balance || 0);
        if (spotBal < amount) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 0, message: `Insufficient spot balance: ${spotBal} INR.` });
        }
        await conn.query(
            'UPDATE dbt_balance SET balance = balance - ?, sharewallet = sharewallet + ? WHERE id = ?',
            [amount, amount, stakingRow.id]
        );
        await conn.query(
            'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [stakingRow.id, userId, 'INR', 'STAKING_SUBSCRIBE', amount, 0, req.ip || '0.0.0.0']
        );

        const [insertResult] = await conn.query(
            `INSERT INTO dbt_user_staking
             (user_id, plan_id, stake_amount, currency_symbol, apr_percent, duration_days, start_date, maturity_date, status)
             VALUES (?, ?, ?, 'INR', ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 'ACTIVE')`,
            [userId, plan_id, amount, plan.apr_percent, plan.duration_days, plan.duration_days]
        );

        await conn.commit();
        conn.release();

        const io = req.app.get('io');
        if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

        res.status(201).json({
            status: 1,
            message: 'Successfully subscribed to staking plan.',
            stake_id: insertResult.insertId
        });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        if (err instanceof InsufficientBalanceError) {
            return res.status(400).json({ status: 2, message: err.message });
        }
        console.error('staking subscribe error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

exports.unsubscribe = async (req, res) => {
    let conn;
    try {
        const { error } = Joi.object({
            stake_id: Joi.number().integer().positive().required()
        }).validate(req.body);
        if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

        const { stake_id } = req.body;
        const userId = req.user.user_id;

        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [stakes] = await conn.query(
            "SELECT * FROM dbt_user_staking WHERE id = ? AND user_id = ? AND status = 'ACTIVE'",
            [stake_id, userId]
        );
        if (!stakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Active stake not found.' });
        }
        const stake = stakes[0];

        const refundAmount = parseFloat(stake.stake_amount);

        const unstakeRow = await ensureBalanceRow(conn, userId, 'INR');
        await conn.query(
            'UPDATE dbt_balance SET sharewallet = sharewallet - ?, balance = balance + ? WHERE id = ?',
            [refundAmount, refundAmount, unstakeRow.id]
        );
        await conn.query(
            'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [unstakeRow.id, userId, 'INR', 'STAKING_UNSTAKE', refundAmount, 0, req.ip || '0.0.0.0']
        );

        await conn.query(
            "UPDATE dbt_user_staking SET status = 'UNSTAKED', claimed_at = NOW() WHERE id = ?",
            [stake_id]
        );

        await conn.commit();
        conn.release();

        const io = req.app.get('io');
        if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

        res.json({ status: 1, message: 'Stake has been unstaked early. Principal refunded.' });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        if (err instanceof InsufficientBalanceError) {
            return res.status(400).json({ status: 0, message: err.message });
        }
        console.error('staking unsubscribe error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

exports.claim = async (req, res) => {
    let conn;
    try {
        const { error } = Joi.object({
            stake_id: Joi.number().integer().positive().required()
        }).validate(req.body);
        if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

        const { stake_id } = req.body;
        const userId = req.user.user_id;

        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [stakes] = await conn.query(
            "SELECT * FROM dbt_user_staking WHERE id = ? AND user_id = ? AND status = 'MATURED'",
            [stake_id, userId]
        );
        if (!stakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Matured stake not found or already claimed.' });
        }
        const stake = stakes[0];

        const principal = parseFloat(stake.stake_amount);
        const reward = parseFloat(stake.reward_amount || 0);
        const totalCredit = principal + reward;

        const claimRow = await ensureBalanceRow(conn, userId, 'INR');
        await conn.query(
            'UPDATE dbt_balance SET sharewallet = sharewallet - ?, balance = balance + ? WHERE id = ?',
            [totalCredit, totalCredit, claimRow.id]
        );
        await conn.query(
            'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [claimRow.id, userId, 'INR', 'STAKING_PAYOUT', totalCredit, 0, req.ip || '0.0.0.0']
        );

        await conn.query(
            "UPDATE dbt_user_staking SET status = 'CLAIMED', claimed_at = NOW() WHERE id = ?",
            [stake_id]
        );

        await conn.commit();
        conn.release();

        const io = req.app.get('io');
        if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

        res.json({ status: 1, message: 'Staking rewards claimed successfully.', principal, reward, total: totalCredit });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        if (err instanceof InsufficientBalanceError) {
            return res.status(400).json({ status: 0, message: err.message });
        }
        console.error('staking claim error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

// ---------- ADMIN ----------

exports.adminGetPlans = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query('SELECT * FROM dbt_staking_plans ORDER BY min_amount ASC');
    res.status(200).json(rows);
});

exports.adminCreatePlan = async (req, res) => {
    let conn;
    try {
        const { error } = Joi.object({
            name: Joi.string().min(2).max(100).required(),
            min_amount: Joi.number().positive().required(),
            max_amount: Joi.number().positive().greater(Joi.ref('min_amount')).required(),
            duration_days: Joi.number().integer().positive().required(),
            apr_percent: Joi.number().positive().max(100).required()
        }).validate(req.body);
        if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            'INSERT INTO dbt_staking_plans (name, min_amount, max_amount, duration_days, apr_percent) VALUES (?, ?, ?, ?, ?)',
            [req.body.name, req.body.min_amount, req.body.max_amount, req.body.duration_days, req.body.apr_percent]
        );

        await conn.commit();
        conn.release();
        res.status(201).json({ status: 1, message: 'Staking plan created.', plan_id: result.insertId });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        console.error('admin create plan error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

exports.adminUpdatePlan = async (req, res) => {
    let conn;
    try {
        const { error } = Joi.object({
            name: Joi.string().min(2).max(100),
            min_amount: Joi.number().positive(),
            max_amount: Joi.number().positive(),
            duration_days: Joi.number().integer().positive(),
            apr_percent: Joi.number().positive().max(100),
            status: Joi.number().integer().valid(0, 1)
        }).min(1).validate(req.body);
        if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

        const { id } = req.params;
        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [plans] = await conn.query('SELECT id FROM dbt_staking_plans WHERE id = ?', [id]);
        if (!plans.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Plan not found.' });
        }

        const updates = {};
        const fields = ['name', 'min_amount', 'max_amount', 'duration_days', 'apr_percent', 'status'];
        for (const field of fields) {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        }

        await conn.query('UPDATE dbt_staking_plans SET ? WHERE id = ?', [updates, id]);
        await conn.commit();
        conn.release();
        res.json({ status: 1, message: 'Plan updated.' });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        console.error('admin update plan error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

exports.adminDeletePlan = async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [activeStakes] = await conn.query(
            "SELECT id FROM dbt_user_staking WHERE plan_id = ? AND status = 'ACTIVE' LIMIT 1",
            [id]
        );
        if (activeStakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 0, message: 'Cannot delete plan with active stakes. Ask users to unstake first.' });
        }

        await conn.query('DELETE FROM dbt_user_staking WHERE plan_id = ?', [id]);
        await conn.query('DELETE FROM dbt_staking_plans WHERE id = ?', [id]);
        await conn.commit();
        conn.release();
        res.json({ status: 1, message: 'Plan deleted along with its staking history.' });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        console.error('admin delete plan error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

exports.adminGetAllStaking = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query(
        `SELECT us.*, sp.name AS plan_name,
                u.first_name, u.last_name, u.email
         FROM dbt_user_staking us
         JOIN dbt_staking_plans sp ON us.plan_id = sp.id
         LEFT JOIN dbt_user u ON us.user_id = u.user_id
         ORDER BY us.created_at DESC`
    );
    res.status(200).json(rows);
});
