const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');

const DEFAULT_COINS = [
  { market_symbol: 'BTC-INR', price: 5380218.77, high_24h: 5405000, low_24h: 5245600, volume_24h: 124.58 },
  { market_symbol: 'ETH-INR', price: 295872.35, high_24h: 310000, low_24h: 280000, volume_24h: 854.58 },
  { market_symbol: 'SOL-INR', price: 5741.94, high_24h: 5943.80, low_24h: 5441.08, volume_24h: 3245.87 },
  { market_symbol: 'XRP-INR', price: 48.47, high_24h: 50.80, low_24h: 47.39, volume_24h: 184512.90 },
  { market_symbol: 'DOGE-INR', price: 12.04, high_24h: 12.62, low_24h: 11.45, volume_24h: 9845120.00 },
  { market_symbol: 'ADA-INR', price: 40.26, high_24h: 42.50, low_24h: 39.18, volume_24h: 684512.00 },
  { market_symbol: 'BNB-INR', price: 26823.50, high_24h: 27896.30, low_24h: 25984.20, volume_24h: 8945.20 },
];

exports.getBalanceStats = asyncMiddleware(async (req, res) => {
    const userId = req.user.user_id;
    const conn = await connect();

    // 1. Fetch available balances
    const [balRows] = await conn.query(
        "SELECT currency_symbol, balance FROM dbt_balance WHERE user_id = ?",
        [userId]
    );

    let inrBalance = 0;
    let usdtBalance = 0;
    const balanceMap = {};

    for (const row of balRows) {
        const symbol = row.currency_symbol;
        const bal = parseFloat(row.balance || 0);
        balanceMap[symbol] = (balanceMap[symbol] || 0) + bal;
    }

    inrBalance = balanceMap['INR'] || 0;
    usdtBalance = balanceMap['USDT'] || 0;

    // 2. Latest prices for all coins/pairs
    const priceMap = {};
    // First, get default prices from dbt_coinpair
    const [pairRows] = await conn.query('SELECT symbol, initial_price FROM dbt_coinpair WHERE status = 1');
    for (const row of pairRows) {
        priceMap[row.symbol] = parseFloat(row.initial_price || 0);
    }
    // Then overwrite with latest prices from coinhistory
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

    // Dynamic USDT/INR conversion rate
    let usdtInrRate = 83.0;
    if (priceMap['USDT_INR'] && priceMap['USDT_INR'] > 0) {
        usdtInrRate = priceMap['USDT_INR'];
    } else if (priceMap['INR_USDT'] && priceMap['INR_USDT'] > 0) {
        usdtInrRate = 1.0 / priceMap['INR_USDT'];
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
        } else if (symbol === 'INR') {
            valueUsdt = balance / usdtInrRate;
            currentPriceUsdt = 1.0 / usdtInrRate;
        } else {
            const usdtPair = `${symbol}_USDT`;
            const inrPair = `${symbol}_INR`;
            if (priceMap[usdtPair] !== undefined) {
                currentPriceUsdt = priceMap[usdtPair];
                valueUsdt = balance * currentPriceUsdt;
            } else if (priceMap[inrPair] !== undefined) {
                const priceInr = priceMap[inrPair];
                currentPriceUsdt = priceInr / usdtInrRate;
                valueUsdt = balance * currentPriceUsdt;
            } else {
                // Fallback to estimated price from default coins list
                const counterpart = DEFAULT_COINS.find(c => c.market_symbol === `${symbol}-INR`);
                if (counterpart) {
                    currentPriceUsdt = counterpart.price / usdtInrRate;
                    valueUsdt = balance * currentPriceUsdt;
                }
            }
            totalCoinValueUsdt += valueUsdt;
        }

        holdings.push({
            currency_symbol: symbol,
            balance: balance,
            current_price: parseFloat(currentPriceUsdt.toFixed(8)),
            value_inr: parseFloat(valueUsdt.toFixed(2)), // naming kept for backward compatibility but value is in USDT
            value_usdt: parseFloat(valueUsdt.toFixed(4))
        });
    }

    // Available USDT is the base balance shown
    const totalPortfolioValueUsdt = parseFloat((usdtBalance + (inrBalance / usdtInrRate) + totalCoinValueUsdt).toFixed(2));
    
    // Starter balance is 200,000 INR converted to USDT
    const starterBalanceUsdt = parseFloat((200000 / usdtInrRate).toFixed(2));
    const unrealisedPnlUsdt = parseFloat((totalPortfolioValueUsdt - starterBalanceUsdt).toFixed(2));
    const pnlPercent = starterBalanceUsdt > 0
        ? parseFloat(((unrealisedPnlUsdt / starterBalanceUsdt) * 100).toFixed(2))
        : 0;

    // 4. Realized P&L from completed trades in USDT
    const [trades] = await conn.query(
        `SELECT bid_type, complete_amount, fees_amount, market_symbol FROM dbt_biding_log WHERE user_id = ?`,
        [userId]
    );

    let realizedPnlUsdt = 0;
    for (const t of trades) {
        const quote = t.market_symbol.split(/[-_/]/)[1] || 'INR';
        const rawPnl = (t.bid_type === 'SELL' ? parseFloat(t.complete_amount) : -parseFloat(t.complete_amount)) - parseFloat(t.fees_amount || 0);
        if (quote.toUpperCase() === 'USDT') {
            realizedPnlUsdt += rawPnl;
        } else {
            realizedPnlUsdt += rawPnl / usdtInrRate;
        }
    }
    realizedPnlUsdt = parseFloat(realizedPnlUsdt.toFixed(2));

    // 5. Total fees paid in USDT
    const [feeRows] = await conn.query(
        `SELECT currency_symbol, SUM(transaction_fees) AS fees
         FROM dbt_balance_log
         WHERE user_id = ? AND transaction_type IN ('TRADE_BUY', 'TRADE_SELL')
         GROUP BY currency_symbol`,
        [userId]
    );
    let totalFeesPaidUsdt = 0;
    for (const row of feeRows) {
        const fees = parseFloat(row.fees || 0);
        if (row.currency_symbol.toUpperCase() === 'USDT') {
            totalFeesPaidUsdt += fees;
        } else {
            totalFeesPaidUsdt += fees / usdtInrRate;
        }
    }
    totalFeesPaidUsdt = parseFloat(totalFeesPaidUsdt.toFixed(2));

    // 6. Balance history (daily aggregation from balance_log) in USDT
    const [historyRows] = await conn.query(
        `SELECT DATE(date) AS day, currency_symbol,
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
         WHERE user_id = ? AND currency_symbol IN ('INR', 'USDT')
         GROUP BY DATE(date), currency_symbol
         ORDER BY day ASC`,
        [userId]
    );

    const dailyChanges = {};
    for (const row of historyRows) {
        const day = row.day.toISOString ? row.day.toISOString().split('T')[0] : row.day.toString();
        const amt = parseFloat(row.net_change || 0);
        const valUsdt = row.currency_symbol === 'USDT' ? amt : amt / usdtInrRate;
        dailyChanges[day] = (dailyChanges[day] || 0) + valUsdt;
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
        inr_balance: usdtBalance, // return available USDT balance under inr_balance for seamless frontend display
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
