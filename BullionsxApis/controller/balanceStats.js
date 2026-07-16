const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');

exports.getBalanceStats = asyncMiddleware(async (req, res) => {
    const userId = req.user.user_id;
    const conn = await connect();

    // 1. Fetch available balances
    const [balRows] = await conn.query(
        "SELECT currency_symbol, balance FROM dbt_balance WHERE user_id = ?",
        [userId]
    );

    let usdtBalance = 0;
    const balanceMap = {};

    for (const row of balRows) {
        const symbol = row.currency_symbol;
        const bal = parseFloat(row.balance || 0);
        balanceMap[symbol] = (balanceMap[symbol] || 0) + bal;
    }

    usdtBalance = balanceMap['USDT'] || 0;

    // 2. Latest prices for all coins/pairs
    const priceMap = {};
    const [pairRows] = await conn.query('SELECT symbol, initial_price FROM dbt_coinpair WHERE status = 1');
    for (const row of pairRows) {
        priceMap[row.symbol] = parseFloat(row.initial_price || 0);
    }
    const [priceRows] = await conn.query(`
        SELECT ch.market_symbol, ch.last_price
        FROM dbt_coinhistory ch
        INNER JOIN (
            SELECT market_symbol, MAX(id) AS max_id
            FROM dbt_coinhistory
            GROUP BY market_symbol
        ) latest ON ch.id = latest.max_id
    `);
    for (const row of priceRows) {
        priceMap[row.market_symbol] = parseFloat(row.last_price || 0);
    }

    // 3. Holdings breakdown & total portfolio value in USDT
    let totalCoinValueUsdt = 0;
    const holdings = [];

    for (const symbol of Object.keys(balanceMap)) {
        const balance = balanceMap[symbol];
        if (balance <= 0) continue;

        let valueUsdt = 0;
        let currentPriceUsdt = 0;

        if (symbol === 'USDT') {
            valueUsdt = balance;
            currentPriceUsdt = 1.0;
        } else {
            const usdtPair = `${symbol}_USDT`;
            if (priceMap[usdtPair] !== undefined) {
                currentPriceUsdt = priceMap[usdtPair];
                valueUsdt = balance * currentPriceUsdt;
            }
            totalCoinValueUsdt += valueUsdt;
        }

        holdings.push({
            currency_symbol: symbol,
            balance: balance,
            current_price: parseFloat(currentPriceUsdt.toFixed(8)),
            value_inr: parseFloat(valueUsdt.toFixed(2)),
            value_usdt: parseFloat(valueUsdt.toFixed(4))
        });
    }

    // Available USDT is the base balance shown
    const totalPortfolioValueUsdt = parseFloat((usdtBalance + totalCoinValueUsdt).toFixed(2));
    
    // Starter balance is 200,000 USDT
    const starterBalanceUsdt = 200000;
    const unrealisedPnlUsdt = parseFloat((totalPortfolioValueUsdt - starterBalanceUsdt).toFixed(2));
    const pnlPercent = starterBalanceUsdt > 0
        ? parseFloat(((unrealisedPnlUsdt / starterBalanceUsdt) * 100).toFixed(2))
        : 0;

    // 4. Realized P&L from completed trades in USDT
    const [trades] = await conn.query(
        `SELECT bid_type, complete_amount, fees_amount, market_symbol FROM dbt_biding_log WHERE user_id = ? AND market_symbol LIKE '%_USDT'`,
        [userId]
    );

    let realizedPnlUsdt = 0;
    for (const t of trades) {
        const rawPnl = (t.bid_type === 'SELL' ? parseFloat(t.complete_amount) : -parseFloat(t.complete_amount)) - parseFloat(t.fees_amount || 0);
        realizedPnlUsdt += rawPnl;
    }
    realizedPnlUsdt = parseFloat(realizedPnlUsdt.toFixed(2));

    // 5. Total fees paid in USDT
    const [feeRows] = await conn.query(
        `SELECT SUM(transaction_fees) AS fees
         FROM dbt_balance_log
         WHERE user_id = ? AND transaction_type IN ('TRADE_BUY', 'TRADE_SELL')`,
        [userId]
    );
    let totalFeesPaidUsdt = parseFloat(feeRows[0]?.fees || 0);
    totalFeesPaidUsdt = parseFloat(totalFeesPaidUsdt.toFixed(2));

    // 6. Balance history (daily aggregation from balance_log) in USDT
    const [historyRows] = await conn.query(
        `SELECT DATE(date) AS day,
                SUM(CASE
                    WHEN transaction_type IN ('ORDER_CANCEL_REFUND', 'ADJUSTMENT', 'SIGNUP_BONUS')
                    THEN transaction_amount
                    WHEN transaction_type = 'TRADE_SELL'
                    THEN transaction_amount - transaction_fees
                    WHEN transaction_type = 'ORDER_PLACE_BUY'
                    THEN -transaction_amount
                    ELSE 0
                END) AS net_change
         FROM dbt_balance_log
         WHERE user_id = ? AND currency_symbol = 'USDT'
         GROUP BY DATE(date)
         ORDER BY day ASC`,
        [userId]
    );

    const dailyChanges = {};
    for (const row of historyRows) {
        const day = row.day.toISOString ? row.day.toISOString().split('T')[0] : row.day.toString();
        dailyChanges[day] = (dailyChanges[day] || 0) + parseFloat(row.net_change || 0);
    }

    let cumBalance = 0;
    const balanceHistory = [];
    const sortedDays = Object.keys(dailyChanges).sort();
    for (const day of sortedDays) {
        cumBalance += dailyChanges[day];
        balanceHistory.push({
            date: day,
            balance: parseFloat(cumBalance.toFixed(2)),
            change: parseFloat(dailyChanges[day].toFixed(2))
        });
    }

    if (!balanceHistory.length || balanceHistory[balanceHistory.length - 1].balance !== usdtBalance) {
        balanceHistory.push({
            date: new Date().toISOString().split('T')[0],
            balance: parseFloat(usdtBalance.toFixed(2)),
            change: 0
        });
    }

    // 7. Recent activity log
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
        inr_balance: usdtBalance,
        usdt_balance: usdtBalance,
        total_portfolio_value: totalPortfolioValueUsdt,
        starter_balance: starterBalanceUsdt,
        unrealized_pnl: unrealisedPnlUsdt,
        pnl_percent: pnlPercent,
        realized_pnl: realizedPnlUsdt,
        total_fees_paid: totalFeesPaidUsdt,
        holdings,
        balance_history: balanceHistory,
        recent_activity: recentActivity
    });
});
