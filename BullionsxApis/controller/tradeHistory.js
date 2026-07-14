// controller/tradeHistory.js
// New controller for paginated, filtered trade history from dbt_biding_log.
// The existing getMyTrades (userdata.js) is NOT modified — it stays as-is
// for the trade page. This is a separate endpoint for the wallet history page.

const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');

// GET /api/v1/trade-history
// Query params:
//   market_symbol  – e.g. SOL_INR
//   bid_type       – BUY | SELL
//   status         – 0 | 1
//   search         – log_id exact match
//   from           – date string YYYY-MM-DD
//   to             – date string YYYY-MM-DD
//   sort           – asc | desc (default: desc)
//   limit          – default 30
//   offset         – default 0
exports.getTradeHistory = asyncMiddleware(async (req, res) => {
    const userId = req.user.user_id;
    const {
        market_symbol,
        bid_type,
        status,
        search,
        from,
        to,
        sort = 'desc',
        limit = 30,
        offset = 0,
    } = req.query;

    const pool = await connect();
    const conn = await pool.getConnection();

    try {
        const params  = [userId];
        const filters = ['user_id = ?'];

        if (market_symbol) { filters.push('market_symbol = ?');        params.push(market_symbol); }
        if (bid_type)       { filters.push('bid_type = ?');             params.push(bid_type.toUpperCase()); }
        if (status !== undefined && status !== '') {
                              filters.push('status = ?');               params.push(parseInt(status)); }
        if (search)         { filters.push('log_id = ?');               params.push(parseInt(search)); }
        if (from)           { filters.push('success_time >= ?');        params.push(from); }
        if (to)             { filters.push('success_time <= DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }

        const where   = filters.join(' AND ');
        const sortDir = sort === 'asc' ? 'ASC' : 'DESC';
        const lim     = Math.min(parseInt(limit)  || 30, 100);
        const off     = parseInt(offset) || 0;

        // Data query
        const [rows] = await conn.query(
            `SELECT log_id, bid_id, bid_type, bid_price, complete_qty,
                    complete_amount, currency_symbol, market_symbol,
                    success_time, fees_amount, available_amount, status
             FROM dbt_biding_log
             WHERE ${where}
             ORDER BY log_id ${sortDir}
             LIMIT ? OFFSET ?`,
            [...params, lim, off]
        );

        // Count query (for pagination total)
        const [[{ total }]] = await conn.query(
            `SELECT COUNT(*) AS total FROM dbt_biding_log WHERE ${where}`,
            params
        );

        // Distinct market_symbol list for filter dropdown
        const [pairs] = await conn.query(
            `SELECT DISTINCT market_symbol FROM dbt_biding_log WHERE user_id = ? ORDER BY market_symbol ASC`,
            [userId]
        );

        return res.status(200).json({
            status : 1,
            trades : rows,
            total,
            limit  : lim,
            offset : off,
            pairs  : pairs.map(p => p.market_symbol),
        });
    } finally {
        conn.release();
    }
});
