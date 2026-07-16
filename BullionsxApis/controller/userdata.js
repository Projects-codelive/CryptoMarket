const connect = require('../config/Mysqlcon');
const asyncMiddleware = require('../middleware/async');

exports.getcoin = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const data = await conn.query('select * from dbt_coinpair where status=1');
    res.status(200).send(data[0]);
});



exports.getcryptocoin = asyncMiddleware(async (req, res) => {
    const conn = await connect();
    const data = await conn.query('select * from dbt_cryptocoin where status=1');
    res.status(200).send(data[0]);
});



exports.coinhistory = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const marketSymbol = req.query.market_symbol;
        if (marketSymbol) {
                const [[pair]] = await conn.query(
                        'SELECT status FROM dbt_coinpair WHERE (symbol = ? OR market_symbol = ?) AND status = 1',
                        [marketSymbol, marketSymbol]
                );
                if (!pair) {
                        return res.status(403).json({ message: 'Trading pair is inactive or not found.' });
                }
                const data = await conn.query('SELECT * FROM dbt_coinhistory WHERE market_symbol = ? ORDER BY id DESC LIMIT 200', [marketSymbol]);
                return res.status(200).send(data[0]);
        }
        const data = await conn.query('SELECT * FROM dbt_coinhistory ORDER BY id DESC LIMIT 200');
        res.status(200).send(data[0]);
});



exports.openorder = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=2 and market_symbol=?", [req.query.market_symbol]);
        res.status(200).send(data[0]);
    });



exports.openbuyorder = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=2 and bid_type='BUY' and market_symbol=?", [req.query.market_symbol]);
        res.status(200).send(data[0]);
});


exports.opensellorder = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=2 and bid_type='SELL' and market_symbol=?", [req.query.market_symbol]);
        res.status(200).send(data[0]);
});


exports.openorderst1 = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=1 and market_symbol=?", [req.query.market_symbol]);
        res.status(200).send(data[0]);
});


exports.openorderst2 = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=1 and market_symbol=? and user_id=?", [req.query.market_symbol, req.query.user_id]);
        res.status(200).send(data[0]);
});



exports.openorderst3 = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=1 and user_id=?", [req.query.user_id]);
        res.status(200).send(data[0]);
});



exports.openorderst4 = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=2 and market_symbol=? and user_id=?", [req.query.market_symbol, req.query.user_id]);
        res.status(200).send(data[0]);
});

exports.openorderst5 = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query("select  * from dbt_biding where status=2 and user_id=?", [req.query.user_id]);
        res.status(200).send(data[0]);
});

exports.insertdata = asyncMiddleware(async (req, res) => {
        console.log(req.body);
        const conn = await connect();
        const data = await conn.query("insert into dbt_biding set ?", req.body);
        res.status(200).send(data);
});

exports.getMe = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query('select user_id, first_name, last_name, email, phone from dbt_user where user_id=?', [req.user.user_id]);
        if (!data[0].length) return res.status(404).json({ message: "User not found" });
        res.status(200).json(data[0][0]);
});

exports.getBalance = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const [rows] = await conn.query(
            "SELECT currency_symbol, SUM(balance) as balance, SUM(sharewallet) as sharewallet, SUM(fundwallet) as fundwallet FROM dbt_balance WHERE user_id = ? AND currency_symbol = 'USDT' GROUP BY currency_symbol",
            [req.query.user_id]
        );
        res.status(200).json(rows[0] || { user_id: req.query.user_id, currency_symbol: 'USDT', balance: 0 });
});

exports.getHoldings = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query(
            "select market_symbol, sum(bid_qty) as total_volume, bid_type from dbt_biding where user_id=? and status=2 group by market_symbol, bid_type",
            [req.query.user_id]
        );
        res.status(200).json(data[0]);
});

exports.getLeaderboard = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const data = await conn.query(`
            select u.user_id, u.first_name, u.last_name, coalesce(b.balance, 0) as balance
            from dbt_user u
            left join dbt_balance b on u.user_id = b.user_id and b.currency_symbol = 'USDT'
            order by b.balance desc
            limit 50
        `);
        res.status(200).json(data[0]);
});

exports.getPortfolio = asyncMiddleware(async (req, res) => {
        const conn = await connect();
        const userId = req.query.user_id;

        if (!userId) {
            return res.status(400).json({ message: 'user_id is required.' });
        }

        const [balanceRows] = await conn.query(
            'SELECT currency_symbol, SUM(balance) as balance FROM dbt_balance WHERE user_id = ? GROUP BY currency_symbol',
            [userId]
        );

        const priceMap = {};
        // Get initial prices from dbt_coinpair
        const [pairRows] = await conn.query('SELECT symbol, initial_price FROM dbt_coinpair WHERE status = 1');
        for (const row of pairRows) {
            priceMap[row.symbol] = parseFloat(row.initial_price || 0);
        }
        // Overwrite with latest prices
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

        let totalValueUsdt = 0;
        const holdings = [];

        for (const bal of balanceRows) {
            const symbol = bal.currency_symbol;
            const balance = parseFloat(bal.balance);
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
            }

            totalValueUsdt += valueUsdt;

            holdings.push({
                currency_symbol: symbol,
                balance: balance,
                price: parseFloat(currentPriceUsdt.toFixed(8)),
                value_inr: parseFloat(valueUsdt.toFixed(2)), // keep naming but in USDT
                value_usdt: parseFloat(valueUsdt.toFixed(4))
            });
        }

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
            totalFeesPaidUsdt += fees;
        }

        const starterBalanceUsdt = 200000;
        const unrealisedPnlUsdt = totalValueUsdt - starterBalanceUsdt;
        const pnlPercent = starterBalanceUsdt > 0 ? (unrealisedPnlUsdt / starterBalanceUsdt * 100).toFixed(2) : '0.00';

        res.json({
            user_id: userId,
            total_value_inr: parseFloat(totalValueUsdt.toFixed(2)), // in USDT
            total_value_usdt: parseFloat(totalValueUsdt.toFixed(4)),
            starter_balance: parseFloat(starterBalanceUsdt.toFixed(2)),
            unrealised_pnl: parseFloat(unrealisedPnlUsdt.toFixed(2)),
            pnl_percent: pnlPercent,
            total_fees_paid: parseFloat(totalFeesPaidUsdt.toFixed(2)),
            holdings
        });
});

exports.getOrderBookStats = asyncMiddleware(async (req, res) => {
    const { market_symbol, hover_price, side } = req.query;
    if (!market_symbol || !hover_price || !side) {
        return res.status(400).json({ message: 'market_symbol, hover_price, and side are required.' });
    }

    const conn = await connect();
    const price = parseFloat(hover_price);
    const bidType = side.toUpperCase();

    const priceFilter = bidType === 'BUY'
        ? 'bid_price >= ?'
        : 'bid_price <= ?';

    const [rows] = await conn.query(
        `SELECT bid_price, bid_qty_available
         FROM dbt_biding
         WHERE market_symbol = ? AND bid_type = ? AND status = 2 AND ${priceFilter}`,
        [market_symbol, bidType, price]
    );

    if (!rows.length) {
        return res.status(200).json({ avg_price: 0, sum_coin: 0, sum_inr: 0 });
    }

    let totalQty = 0;
    let totalValue = 0;
    for (const row of rows) {
        const qty = parseFloat(row.bid_qty_available);
        const p   = parseFloat(row.bid_price);
        totalQty   += qty;
        totalValue += qty * p;
    }

    const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;

    return res.status(200).json({
        avg_price : parseFloat(avgPrice.toFixed(8)),
        sum_coin  : parseFloat(totalQty.toFixed(8)),
        sum_inr   : parseFloat(totalValue.toFixed(2))
    });
});

exports.getMarketTrades = asyncMiddleware(async (req, res) => {
    const { market_symbol, limit = 50 } = req.query;
    if (!market_symbol) return res.status(400).json({ message: 'market_symbol is required.' });

    const conn = await connect();
    const [rows] = await conn.query(
        `SELECT bid_price, complete_qty, complete_amount, success_time, bid_type
         FROM dbt_biding_log
         WHERE market_symbol = ?
         ORDER BY log_id DESC
         LIMIT ?`,
        [market_symbol, parseInt(limit)]
    );

    return res.status(200).json(rows);
});

exports.getMyTrades = asyncMiddleware(async (req, res) => {
    const user_id = req.user.user_id;
    if (!user_id) return res.status(401).json({ message: 'Authentication required.' });

    const { market_symbol, limit = 50 } = req.query;

    const conn = await connect();
    let query = `SELECT * FROM dbt_biding_log WHERE user_id = ?`;
    const params = [user_id];

    if (market_symbol) {
        query += ' AND market_symbol = ?';
        params.push(market_symbol);
    }

    query += ' ORDER BY log_id DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await conn.query(query, params);
    return res.status(200).json(rows);
});

exports.getOpenOrders = asyncMiddleware(async (req, res) => {
    const { user_id, market_symbol } = req.query;
    if (!user_id) return res.status(400).json({ message: 'user_id is required.' });

    const conn = await connect();
    let query = `SELECT * FROM dbt_biding WHERE user_id = ? AND status = 2`;
    const params = [user_id];

    if (market_symbol) {
        query += ' AND market_symbol = ?';
        params.push(market_symbol);
    }

    query += ' ORDER BY open_order DESC';

    const [rows] = await conn.query(query, params);
    return res.status(200).json(rows);
});

exports.getOrderHistory = asyncMiddleware(async (req, res) => {
    const { user_id, market_symbol, limit = 50 } = req.query;
    if (!user_id) return res.status(400).json({ message: 'user_id is required.' });

    const conn = await connect();
    let query = `SELECT * FROM dbt_biding WHERE user_id = ? AND status = 1`;
    const params = [user_id];

    if (market_symbol) {
        query += ' AND market_symbol = ?';
        params.push(market_symbol);
    }

    query += ' ORDER BY open_order DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await conn.query(query, params);
    return res.status(200).json(rows);
});

exports.getCancelledOrders = asyncMiddleware(async (req, res) => {
    const { user_id, market_symbol, limit = 50 } = req.query;
    if (!user_id) return res.status(400).json({ message: 'user_id is required.' });

    const conn = await connect();
    let query = `SELECT * FROM dbt_biding WHERE user_id = ? AND status = 3`;
    const params = [user_id];

    if (market_symbol) {
        query += ' AND market_symbol = ?';
        params.push(market_symbol);
    }

    query += ' ORDER BY open_order DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await conn.query(query, params);
    return res.status(200).json(rows);
});

exports.getHoldingsDetailed = asyncMiddleware(async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'user_id is required.' });

    const conn = await connect();

    const [balances] = await conn.query(
        `SELECT currency_symbol, SUM(balance) as balance FROM dbt_balance
         WHERE user_id = ?
         GROUP BY currency_symbol
         HAVING SUM(balance) > 0`,
        [user_id]
    );

    if (!balances.length) return res.status(200).json([]);

    const [prices] = await conn.query(`
        SELECT h1.coin_symbol, h1.last_price
        FROM dbt_coinhistory h1
        INNER JOIN (
            SELECT coin_symbol, MAX(id) AS max_id
            FROM dbt_coinhistory GROUP BY coin_symbol
        ) h2 ON h1.coin_symbol = h2.coin_symbol AND h1.id = h2.max_id
    `);

    const priceMap = {};
    for (const p of prices) priceMap[p.coin_symbol] = parseFloat(p.last_price);

    const holdings = balances.map(b => {
        const price    = b.currency_symbol === 'USDT' ? 1 : (priceMap[b.currency_symbol] || 0);
        const valueUsdt = parseFloat(b.balance) * price;
        return {
            currency_symbol : b.currency_symbol,
            balance         : parseFloat(b.balance),
            current_price   : price,
            value_usdt      : parseFloat(valueUsdt.toFixed(2))
        };
    });

    return res.status(200).json(holdings);
});

exports.getUserBalance = asyncMiddleware(async (req, res) => {
    const { user_id, currency_symbol } = req.query;
    if (!user_id || !currency_symbol) {
        return res.status(400).json({ message: 'user_id and currency_symbol are required.' });
    }

    const conn = await connect();
    const [rows] = await conn.query(
        'SELECT currency_symbol, SUM(balance) as balance, SUM(sharewallet) as sharewallet, SUM(fundwallet) as fundwallet FROM dbt_balance WHERE user_id = ? AND currency_symbol = ? GROUP BY currency_symbol',
        [user_id, currency_symbol]
    );

    if (!rows.length) {
        return res.status(200).json({ currency_symbol, balance: 0 });
    }

    return res.status(200).json(rows[0]);
});

exports.getLatestPrice = asyncMiddleware(async (req, res) => {
    const { market_symbol } = req.query;
    if (!market_symbol) {
        return res.status(400).json({ message: 'market_symbol is required.' });
    }

    const conn = await connect();

    const [[pair]] = await conn.query(
        'SELECT status FROM dbt_coinpair WHERE (symbol = ? OR market_symbol = ?) AND status = 1',
        [market_symbol, market_symbol]
    );
    if (!pair) {
        return res.status(403).json({ message: 'Trading pair is inactive or not found.' });
    }

    const [[row]] = await conn.query(
        `SELECT last_price, price_high_24h, price_low_24h,
                price_change_24h, volume_24h, date
         FROM dbt_coinhistory
         WHERE market_symbol = ?
         ORDER BY id DESC LIMIT 1`,
        [market_symbol]
    );

    if (!row) {
        const [[pairRow]] = await conn.query(
            `SELECT initial_price FROM dbt_coinpair WHERE (symbol = ? OR market_symbol = ?) AND status = 1`,
            [market_symbol, market_symbol]
        );
        if (pairRow) {
            const fallbackPrice = parseFloat(pairRow.initial_price || 0);
            return res.status(200).json({
                price: fallbackPrice,
                change_24h: 0,
                change_percent_24h: 0,
                high_24h: fallbackPrice,
                low_24h: fallbackPrice,
                volume_24h: 0,
                date: new Date(),
            });
        }
        return res.status(404).json({ message: 'No price data found for this market.' });
    }

    const currentPrice = parseFloat(row.last_price);

    const [[prevDayRow]] = await conn.query(
        'SELECT last_price FROM dbt_coinhistory WHERE market_symbol = ? AND date <= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY id DESC LIMIT 1',
        [market_symbol]
    );

    let prevClose = 0;
    if (prevDayRow && parseFloat(prevDayRow.last_price) > 0) {
        prevClose = parseFloat(prevDayRow.last_price);
    } else {
        const [[prevRow]] = await conn.query(
            'SELECT last_price FROM dbt_coinhistory WHERE market_symbol = ? ORDER BY id DESC LIMIT 1,1',
            [market_symbol]
        );
        if (prevRow) prevClose = parseFloat(prevRow.last_price);
    }

    let changePercent24h = 0;
    if (prevClose > 0) {
        changePercent24h = ((currentPrice - prevClose) / prevClose) * 100;
    }

    const [[tradeRow]] = await conn.query(
        'SELECT bid_price FROM dbt_biding_log WHERE market_symbol = ? ORDER BY log_id DESC LIMIT 1',
        [market_symbol]
    );

    return res.status(200).json({
        market_symbol,
        price              : currentPrice,
        high_24h           : parseFloat(row.price_high_24h),
        low_24h            : parseFloat(row.price_low_24h),
        change_24h         : parseFloat(row.price_change_24h),
        change_percent_24h : changePercent24h,
        volume_24h         : parseFloat(row.volume_24h),
        last_trade_price   : tradeRow ? parseFloat(tradeRow.bid_price) : 0,
        updated_at         : row.date
    });
});

exports.getCandleHistory = asyncMiddleware(async (req, res) => {
    const { market_symbol, interval = '1m', limit = 200 } = req.query;
    if (!market_symbol) {
        return res.status(400).json({ message: 'market_symbol is required.' });
    }

    const conn = await connect();

    const [[pair]] = await conn.query(
        'SELECT status FROM dbt_coinpair WHERE (symbol = ? OR market_symbol = ?) AND status = 1',
        [market_symbol, market_symbol]
    );
    if (!pair) {
        return res.status(403).json({ message: 'Trading pair is inactive or not found.' });
    }

    let rows;

    if (interval === '1m') {
        [rows] = await conn.query(
            `SELECT
               DATE_FORMAT(date, '%Y-%m-%d %H:%i:00') AS time_bucket,
               MAX(last_price) AS high,
               MIN(last_price) AS low,
               SUM(volume_1h)  AS volume
             FROM dbt_coinhistory
             WHERE market_symbol = ?
             GROUP BY time_bucket
             ORDER BY time_bucket ASC
             LIMIT ?`,
            [market_symbol, parseInt(limit)]
        );
    } else if (interval === '5m') {
        [rows] = await conn.query(
            `SELECT
               FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(date)/300)*300) AS time_bucket,
               MAX(last_price) AS high,
               MIN(last_price) AS low,
               SUM(volume_1h)  AS volume
             FROM dbt_coinhistory
             WHERE market_symbol = ?
             GROUP BY time_bucket
             ORDER BY time_bucket ASC
             LIMIT ?`,
            [market_symbol, parseInt(limit)]
        );
    } else if (interval === '30m') {
        [rows] = await conn.query(
            `SELECT
               FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(date)/1800)*1800) AS time_bucket,
               MAX(last_price) AS high,
               MIN(last_price) AS low,
               SUM(volume_1h)  AS volume
             FROM dbt_coinhistory
             WHERE market_symbol = ?
             GROUP BY time_bucket
             ORDER BY time_bucket ASC
             LIMIT ?`,
            [market_symbol, parseInt(limit)]
        );
    } else if (interval === '1h') {
        [rows] = await conn.query(
            `SELECT
               DATE_FORMAT(date, '%Y-%m-%d %H:00:00') AS time_bucket,
               MAX(last_price) AS high,
               MIN(last_price) AS low,
               SUM(volume_24h) AS volume
             FROM dbt_coinhistory
             WHERE market_symbol = ?
             GROUP BY time_bucket
             ORDER BY time_bucket ASC
             LIMIT ?`,
            [market_symbol, parseInt(limit)]
        );
    } else {
        [rows] = await conn.query(
            `SELECT
               DATE(date) AS time_bucket,
               MAX(last_price) AS high,
               MIN(last_price) AS low,
               SUM(volume_24h) AS volume
             FROM dbt_coinhistory
             WHERE market_symbol = ?
             GROUP BY time_bucket
             ORDER BY time_bucket ASC
             LIMIT ?`,
            [market_symbol, parseInt(limit)]
        );
    }

    if (!rows.length) return res.status(200).json([]);

    const candleData = [];
    for (let i = 0; i < rows.length; i++) {
        const bucket = rows[i];
        const open  = i === 0 ? parseFloat(bucket.high) : candleData[i - 1].close;
        const close = parseFloat(bucket.high);

        const [[bucketDetail]] = await conn.query(
            `SELECT
               (SELECT last_price FROM dbt_coinhistory
                WHERE market_symbol = ? AND DATE_FORMAT(date, ?) = ?
                ORDER BY id ASC LIMIT 1) AS open_price,
               (SELECT last_price FROM dbt_coinhistory
                WHERE market_symbol = ? AND DATE_FORMAT(date, ?) = ?
                ORDER BY id DESC LIMIT 1) AS close_price`,
            [market_symbol, '%Y-%m-%d %H:%i:00', bucket.time_bucket,
             market_symbol, '%Y-%m-%d %H:%i:00', bucket.time_bucket]
        );

        candleData.push({
            time   : Math.floor(new Date(bucket.time_bucket).getTime() / 1000),
            open   : parseFloat(bucketDetail?.open_price  || open),
            high   : parseFloat(bucket.high),
            low    : parseFloat(bucket.low),
            close  : parseFloat(bucketDetail?.close_price || close),
            volume : parseFloat(bucket.volume || 0)
        });
    }

    return res.status(200).json(candleData);
});

exports.getRealizedPnl = asyncMiddleware(async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'user_id is required.' });

    const conn = await connect();
    const [[row]] = await conn.query(
        `SELECT COALESCE(
          SUM(CASE WHEN bid_type = 'SELL' THEN complete_amount ELSE -complete_amount END) -
          SUM(fees_amount), 0
        ) AS realized_pnl
        FROM dbt_biding_log
        WHERE user_id = ? AND market_symbol LIKE '%_USDT'`,
        [user_id]
    );

    return res.status(200).json({
        user_id,
        realized_pnl: parseFloat(row?.realized_pnl || 0)
    });
});
