const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');

exports.getBalanceStats = asyncMiddleware(async (req, res) => {
    const userId = req.user.user_id;
    const conn = await connect();

    const starterBalance = 200000;

    // 1. INR balance
    const [balRows] = await conn.query(
        "SELECT balance FROM dbt_balance WHERE user_id = ? AND currency_symbol = 'INR'",
        [userId]
    );
    const inrBalance = parseFloat(balRows[0]?.balance || 0);

    // 2. All balances (for holdings calculation)
    const [balanceRows] = await conn.query(
        'SELECT currency_symbol, balance FROM dbt_balance WHERE user_id = ?',
        [userId]
    );

    // 3. Latest prices for all coins
    const [priceRows] = await conn.query(`
        SELECT ch.coin_symbol, ch.last_price
        FROM dbt_coinhistory ch
        INNER JOIN (
            SELECT coin_symbol, MAX(id) AS max_id
            FROM dbt_coinhistory
            GROUP BY coin_symbol
        ) latest ON ch.id = latest.max_id
    `);
    const priceMap = {};
    for (const row of priceRows) {
        priceMap[row.coin_symbol] = parseFloat(row.last_price);
    }

    // 4. Holdings breakdown & total portfolio value
    let totalCoinValue = 0;
    const holdings = [];
    for (const bal of balanceRows) {
        const symbol = bal.currency_symbol;
        const balance = parseFloat(bal.balance);
        if (balance <= 0) continue;

        let price = 0;
        if (symbol === 'INR') {
            price = 1.0;
        } else if (priceMap[symbol]) {
            price = priceMap[symbol];
        }

        const valueInr = balance * price;
        if (symbol !== 'INR') totalCoinValue += valueInr;

        holdings.push({
            currency_symbol: symbol,
            balance: balance,
            current_price: price,
            value_inr: parseFloat(valueInr.toFixed(2))
        });
    }

    const totalPortfolioValue = parseFloat((inrBalance + totalCoinValue).toFixed(2));
    const unrealisedPnl = parseFloat((totalPortfolioValue - starterBalance).toFixed(2));
    const pnlPercent = starterBalance > 0
        ? parseFloat(((unrealisedPnl / starterBalance) * 100).toFixed(2))
        : 0;

    // 5. Realized P&L from completed trades
    const [[pnlRow]] = await conn.query(
        `SELECT COALESCE(
          SUM(CASE WHEN bid_type = 'SELL' THEN complete_amount ELSE -complete_amount END) -
          SUM(fees_amount), 0
        ) AS realized_pnl
        FROM dbt_biding_log
        WHERE user_id = ?`,
        [userId]
    );
    const realizedPnl = parseFloat(pnlRow?.realized_pnl || 0);

    // 6. Total fees paid
    const [feeRows] = await conn.query(
        `SELECT COALESCE(SUM(transaction_fees), 0) AS total_fees
         FROM dbt_balance_log
         WHERE user_id = ? AND transaction_type IN ('TRADE_BUY', 'TRADE_SELL')`,
        [userId]
    );
    const totalFeesPaid = parseFloat(feeRows[0]?.total_fees || 0);

    // 7. Balance history (daily aggregation from balance_log)
    // Daily buckets are used because the volume of trading activity is low
    // and daily snapshots give a meaningful trend without excessive granularity.
    const [historyRows] = await conn.query(
        `SELECT DATE(date) AS day,
                SUM(CASE
                    WHEN transaction_type IN ('ORDER_CANCEL_REFUND', 'ADJUSTMENT')
                    THEN transaction_amount
                    WHEN transaction_type = 'TRADE_SELL'
                    THEN transaction_amount - transaction_fees
                    WHEN transaction_type = 'ORDER_PLACE_BUY'
                    THEN -transaction_amount
                    ELSE 0
                END) AS net_change
         FROM dbt_balance_log
         WHERE user_id = ? AND currency_symbol = 'INR'
         GROUP BY DATE(date)
         ORDER BY day ASC`,
        [userId]
    );

    // Build cumulative balance history
    let cumBalance = starterBalance;
    const balanceHistory = [];
    for (const row of historyRows) {
        cumBalance += parseFloat(row.net_change || 0);
        balanceHistory.push({
            date: row.day,
            balance: parseFloat(cumBalance.toFixed(2)),
            change: parseFloat(row.net_change || 0)
        });
    }
    // Include current balance as the latest point
    if (!balanceHistory.length || balanceHistory[balanceHistory.length - 1].balance !== inrBalance) {
        balanceHistory.push({
            date: new Date().toISOString().split('T')[0],
            balance: inrBalance,
            change: 0
        });
    }

    // 8. Recent balance activity (last 20 entries)
    const [recentActivity] = await conn.query(
        `SELECT transaction_type, transaction_amount, transaction_fees, currency_symbol, date
         FROM dbt_balance_log
         WHERE user_id = ?
         ORDER BY log_id DESC
         LIMIT 20`,
        [userId]
    );

    res.status(200).json({
        user_id: userId,
        inr_balance: inrBalance,
        total_portfolio_value: totalPortfolioValue,
        starter_balance: starterBalance,
        unrealized_pnl: unrealisedPnl,
        pnl_percent: pnlPercent,
        realized_pnl: realizedPnl,
        total_fees_paid: totalFeesPaid,
        holdings,
        balance_history: balanceHistory,
        recent_activity: recentActivity
    });
});
