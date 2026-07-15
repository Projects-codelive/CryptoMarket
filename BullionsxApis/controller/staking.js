const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');
const Joi = require('joi');
const { ensureBalanceRow, InsufficientBalanceError } = require('../services/balanceService');

// Helper to get coin price at time of subscription
async function getCoinPrice(conn, symbol) {
    if (symbol === 'INR') return 1.0;
    
    // Check in coinhistory
    try {
        const [rows] = await conn.query(
            'SELECT last_price FROM dbt_coinhistory WHERE coin_symbol = ? ORDER BY id DESC LIMIT 1',
            [symbol]
        );
        if (rows.length && parseFloat(rows[0].last_price) > 0) {
            return parseFloat(rows[0].last_price);
        }
    } catch (_) {}

    // Check in coinpairs
    try {
        const [pairs] = await conn.query(
            'SELECT initial_price FROM dbt_coinpair WHERE symbol = ? OR market_symbol = ?',
            [symbol, symbol]
        );
        if (pairs.length && parseFloat(pairs[0].initial_price) > 0) {
            return parseFloat(pairs[0].initial_price);
        }
    } catch (_) {}

    // Default fallbacks
    const defaults = {
        'BTC': 65000,
        'ETH': 3500,
        'BNB': 580,
        'SOL': 140,
        'XRP': 0.5,
        'MDR': 0.031714
    };
    return defaults[symbol.toUpperCase()] || 1.0;
}

// ---------- PUBLIC ----------

exports.getPlans = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query('SELECT * FROM staking WHERE status = 1 ORDER BY id ASC');
    res.status(200).json(rows);
});

// ---------- USER ----------

exports.getMyStaking = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query(
        `SELECT sl.*, s.name AS plan_name, s.plan AS duration, s.percentage
         FROM staking_log sl
         JOIN staking s ON sl.staking_id = s.id
         WHERE sl.user_id = ?
         ORDER BY sl.id DESC`,
        [req.user.user_id]
    );

    const stakes = rows.map(r => {
        const amount = parseFloat(r.amount || 0);
        const pct = parseFloat(r.percentage || 0);
        const durationMonths = parseInt(r.duration || r.plan) || 12;
        const startDate = new Date(r.date);
        const endDate = new Date(r.enddate);
        const now = new Date();
        const isMatured = now >= endDate;

        const totalDurationMs = endDate - startDate;
        const elapsedMs = Math.max(0, now - startDate);
        const ratio = totalDurationMs > 0 ? Math.min(1.0, elapsedMs / totalDurationMs) : 1.0;
        const reward = amount * (pct / 100) * durationMonths * ratio;

        let statusStr = 'ACTIVE';
        if (r.status === 0) statusStr = 'CLAIMED';
        else if (r.status === 3) statusStr = 'UNSTAKED';
        else if (isMatured) statusStr = 'MATURED';

        return {
            id: r.id,
            staking_id: r.staking_id,
            user_stakingid: r.user_stakingid,
            user_id: r.user_id,
            coin_symbol: r.coin,
            stake_amount: amount,
            apr_percent: pct,
            duration_days: durationMonths * 30,
            start_date: r.date,
            maturity_date: r.enddate,
            status: statusStr,
            reward_amount: parseFloat(reward.toFixed(8)),
            plan_name: r.plan_name,
            price: parseFloat(r.price || 0)
        };
    });

    res.status(200).json(stakes);
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

        await conn.beginTransaction();

        const [plans] = await conn.query('SELECT * FROM staking WHERE id = ? AND status = 1', [plan_id]);
        if (!plans.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Staking plan not found or inactive.' });
        }
        const plan = plans[0];

        const coinSymbol = plan.coin_symbol || 'INR';
        const stakingRow = await ensureBalanceRow(conn, userId, coinSymbol);
        const spotBal = parseFloat(stakingRow.balance || 0);
        if (spotBal < amount) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 0, message: `Insufficient balance: ${spotBal} ${coinSymbol}.` });
        }

        await conn.query(
            'UPDATE dbt_balance SET balance = balance - ?, sharewallet = sharewallet + ? WHERE id = ?',
            [amount, amount, stakingRow.id]
        );

        await conn.query(
            'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [stakingRow.id, userId, coinSymbol, 'STAKING_SUBSCRIBE', amount, 0, req.ip || '0.0.0.0']
        );

        const userStakingId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const price = await getCoinPrice(conn, coinSymbol);

        const months = parseInt(plan.plan) || 12;
        const endDateObj = new Date();
        endDateObj.setMonth(endDateObj.getMonth() + months);
        const formattedEndDate = endDateObj.toISOString().split('T')[0] + ' 00:00:00';

        const [insertResult] = await conn.query(
            `INSERT INTO staking_log (staking_id, user_stakingid, user_id, coin, amount, price, date, enddate, status)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, 1)`,
            [plan.id, userStakingId, userId, coinSymbol, amount, price, formattedEndDate]
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
            "SELECT * FROM staking_log WHERE id = ? AND user_id = ? AND status = 1",
            [stake_id, userId]
        );
        if (!stakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Active stake not found.' });
        }
        const stake = stakes[0];

        const refundAmount = parseFloat(stake.amount);
        const coinSymbol = stake.coin || 'INR';

        const unstakeRow = await ensureBalanceRow(conn, userId, coinSymbol);
        await conn.query(
            'UPDATE dbt_balance SET sharewallet = sharewallet - ?, balance = balance + ? WHERE id = ?',
            [refundAmount, refundAmount, unstakeRow.id]
        );
        await conn.query(
            'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [unstakeRow.id, userId, coinSymbol, 'STAKING_UNSTAKE', refundAmount, 0, req.ip || '0.0.0.0']
        );

        await conn.query(
            "UPDATE staking_log SET status = 3 WHERE id = ?",
            [stake_id]
        );

        await conn.commit();
        conn.release();

        const io = req.app.get('io');
        if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

        res.json({ status: 1, message: 'Stake has been unstaked early. Principal refunded.' });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
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
            "SELECT * FROM staking_log WHERE id = ? AND user_id = ? AND status = 1",
            [stake_id, userId]
        );
        if (!stakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Stake not found or already claimed.' });
        }
        const stake = stakes[0];

        const endDate = new Date(stake.enddate);
        if (new Date() < endDate) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 0, message: 'Staking plan has not matured yet.' });
        }

        const [plans] = await conn.query('SELECT percentage, plan FROM staking WHERE id = ?', [stake.staking_id]);
        if (!plans.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Original plan not found.' });
        }
        const plan = plans[0];

        const principal = parseFloat(stake.amount);
        const durationMonths = parseInt(plan.plan) || 12;
        const reward = principal * (parseFloat(plan.percentage) / 100) * durationMonths;
        const totalCredit = principal + reward;
        const coinSymbol = stake.coin || 'INR';

        const claimRow = await ensureBalanceRow(conn, userId, coinSymbol);
        await conn.query(
            'UPDATE dbt_balance SET sharewallet = sharewallet - ?, balance = balance + ? WHERE id = ?',
            [principal, totalCredit, claimRow.id]
        );
        await conn.query(
            'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [claimRow.id, userId, coinSymbol, 'STAKING_PAYOUT', totalCredit, 0, req.ip || '0.0.0.0']
        );

        await conn.query(
            "UPDATE staking_log SET status = 0 WHERE id = ?",
            [stake_id]
        );

        await conn.commit();
        conn.release();

        const io = req.app.get('io');
        if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

        res.json({ status: 1, message: 'Staking rewards claimed successfully.', principal, reward, total: totalCredit });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        console.error('staking claim error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

// ---------- ADMIN ----------

exports.adminGetPlans = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query('SELECT * FROM staking ORDER BY id DESC');
    res.status(200).json(rows);
});

exports.adminCreatePlan = async (req, res) => {
    let conn;
    try {
        const { error } = Joi.object({
            coin_symbol: Joi.string().required(),
            name: Joi.string().min(2).max(100).required(),
            description: Joi.string().required(),
            start_date: Joi.string().required(),
            end_date: Joi.string().required(),
            plan: Joi.string().required(),
            percentage: Joi.string().required()
        }).validate(req.body);
        if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            'INSERT INTO staking (coin_symbol, name, description, start_date, end_date, plan, percentage, status) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
            [req.body.coin_symbol, req.body.name, req.body.description, req.body.start_date, req.body.end_date, req.body.plan, req.body.percentage]
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
        const { id } = req.params;
        const pool = await connect();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [plans] = await conn.query('SELECT id FROM staking WHERE id = ?', [id]);
        if (!plans.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ status: 0, message: 'Plan not found.' });
        }

        const updates = {};
        const fields = ['coin_symbol', 'name', 'description', 'start_date', 'end_date', 'plan', 'percentage', 'status'];
        for (const field of fields) {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        }

        await conn.query('UPDATE staking SET ? WHERE id = ?', [updates, id]);
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
            "SELECT id FROM staking_log WHERE staking_id = ? AND status = 1 LIMIT 1",
            [id]
        );
        if (activeStakes.length) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ status: 0, message: 'Cannot delete plan with active stakes. Ask users to unstake first.' });
        }

        await conn.query('DELETE FROM staking WHERE id = ?', [id]);
        await conn.commit();
        conn.release();
        res.json({ status: 1, message: 'Plan deleted successfully.' });
    } catch (err) {
        if (conn) { await conn.rollback(); conn.release(); }
        console.error('admin delete plan error:', err);
        res.status(500).json({ status: 0, message: 'Internal server error.' });
    }
};

exports.adminGetAllStaking = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const [rows] = await conn.query(
        `SELECT sl.*, s.name AS plan_name, s.plan AS duration, s.percentage,
                u.first_name, u.last_name, u.email
         FROM staking_log sl
         JOIN staking s ON sl.staking_id = s.id
         LEFT JOIN dbt_user u ON sl.user_id = u.user_id
         ORDER BY sl.id DESC`
    );

    const stakes = rows.map(r => {
        const amount = parseFloat(r.amount || 0);
        const pct = parseFloat(r.percentage || 0);
        const durationMonths = parseInt(r.duration || r.plan) || 12;
        const startDate = new Date(r.date);
        const endDate = new Date(r.enddate);
        const now = new Date();
        const isMatured = now >= endDate;

        const totalDurationMs = endDate - startDate;
        const elapsedMs = Math.max(0, now - startDate);
        const ratio = totalDurationMs > 0 ? Math.min(1.0, elapsedMs / totalDurationMs) : 1.0;
        const reward = amount * (pct / 100) * durationMonths * ratio;

        let statusStr = 'ACTIVE';
        if (r.status === 0) statusStr = 'CLAIMED';
        else if (r.status === 3) statusStr = 'UNSTAKED';
        else if (isMatured) statusStr = 'MATURED';

        return {
            id: r.id,
            staking_id: r.staking_id,
            user_stakingid: r.user_stakingid,
            user_id: r.user_id,
            coin_symbol: r.coin,
            stake_amount: amount,
            apr_percent: pct,
            duration_days: durationMonths * 30,
            start_date: r.date,
            maturity_date: r.enddate,
            status: statusStr,
            reward_amount: parseFloat(reward.toFixed(8)),
            plan_name: r.plan_name,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            price: parseFloat(r.price || 0)
        };
    });

    res.status(200).json(stakes);
});
