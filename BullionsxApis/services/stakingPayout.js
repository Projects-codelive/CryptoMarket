const connect = require('../config/Mysqlcon');

async function processMaturedStakes(io) {
    let conn;
    try {
        const pool = await connect();
        conn = await pool.getConnection();

        const [matured] = await conn.query(
            `SELECT sl.*, s.percentage, s.plan
             FROM staking_log sl
             JOIN staking s ON sl.staking_id = s.id
             WHERE sl.status = 1 AND sl.enddate <= NOW()
             LIMIT 100`
        );

        conn.release();
    } catch (err) {
        if (conn) conn.release();
        console.error('[stakingPayout] error:', err.message);
    }
}

function startStakingPayout(io, intervalMs = 60000) {
    console.log('[stakingPayout] Starting maturity payout job, interval:', intervalMs, 'ms');
    processMaturedStakes(io);
    const timer = setInterval(() => processMaturedStakes(io), intervalMs);
    return () => clearInterval(timer);
}

module.exports = { startStakingPayout };
