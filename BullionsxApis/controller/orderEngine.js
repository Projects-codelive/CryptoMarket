const connect = require('../config/Mysqlcon');

function calcFee(qty, price, feePercent) {
  return (qty * price * feePercent) / 100;
}

async function getFeePercent(conn, level, currencySymbol) {
  const [rows] = await conn.query(
    'SELECT fees FROM dbt_fees WHERE level = ? AND currency_symbol = ?',
    [level, currencySymbol]
  );
  return parseFloat(rows[0]?.fees || 0);
}

async function getBalance(conn, userId, currencySymbol) {
  const [rows] = await conn.query(
    'SELECT id, balance FROM dbt_balance WHERE user_id = ? AND currency_symbol = ?',
    [userId, currencySymbol]
  );
  return rows[0] || { id: null, balance: 0 };
}

async function adjustBalance(conn, userId, currencySymbol, delta) {
  const existing = await getBalance(conn, userId, currencySymbol);
  if (existing.id) {
    await conn.query(
      'UPDATE dbt_balance SET balance = GREATEST(balance + ?, 0) WHERE user_id = ? AND currency_symbol = ?',
      [delta, userId, currencySymbol]
    );
  } else {
    await conn.query(
      'INSERT INTO dbt_balance (user_id, currency_symbol, balance) VALUES (?, ?, ?)',
      [userId, currencySymbol, Math.max(0, delta)]
    );
  }
}

async function logBalanceChange(conn, { userId, currencySymbol, transactionType, amount, fees, ip }) {
  const bal = await getBalance(conn, userId, currencySymbol);
  if (!bal.id) return;
  await conn.query(
    'INSERT INTO dbt_balance_log (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [bal.id, userId, currencySymbol, transactionType, amount, fees || 0, ip || '0.0.0.0']
  );
}

async function findBestCounterOrder(conn, marketSymbol, side, limitPrice, orderType) {
  if (side === 'BUY') {
    let query = "SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE market_symbol = ? AND status = 2 AND bid_type = 'SELL'";
    const params = [marketSymbol];
    if (orderType === 'LIMIT') {
      query += ' AND bid_price <= ?';
      params.push(limitPrice);
    }
    query += ' ORDER BY bid_price ASC, open_order ASC LIMIT 1';
    const [rows] = await conn.query(query, params);
    return rows[0] || null;
  }
  let query = "SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE market_symbol = ? AND status = 2 AND bid_type = 'BUY'";
  const params = [marketSymbol];
  if (orderType === 'LIMIT') {
    query += ' AND bid_price >= ?';
    params.push(limitPrice);
  }
  query += ' ORDER BY bid_price DESC, open_order ASC LIMIT 1';
  const [rows] = await conn.query(query, params);
  return rows[0] || null;
}

async function insertTradeLog(conn, logData) {
  const columns = Object.keys(logData);
  const values = Object.values(logData);
  await conn.query(
    `INSERT INTO dbt_biding_log (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values
  );
}

async function updateCoinHistory(conn, { coinSymbol, marketSymbol, executedPrice, tradeQty }) {
  const [h1Rows] = await conn.query(
    'SELECT MAX(bid_price) AS price_high, MIN(bid_price) AS price_low FROM dbt_biding_log WHERE market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)',
    [marketSymbol]
  );
  const [h1VolRows] = await conn.query(
    "SELECT COALESCE(SUM(complete_qty), 0) AS volume FROM dbt_biding_log WHERE bid_type = 'BUY' AND market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)",
    [marketSymbol]
  );

  const [h24Rows] = await conn.query(
    'SELECT MAX(bid_price) AS price_high, MIN(bid_price) AS price_low FROM dbt_biding_log WHERE market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
    [marketSymbol]
  );
  const [h24VolRows] = await conn.query(
    "SELECT COALESCE(SUM(complete_qty), 0) AS volume FROM dbt_biding_log WHERE bid_type = 'BUY' AND market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
    [marketSymbol]
  );

  const h1High = parseFloat(h1Rows[0]?.price_high) || executedPrice;
  const h1Low = parseFloat(h1Rows[0]?.price_low) || executedPrice;
  const h1Volume = parseFloat(h1VolRows[0]?.volume) || 0;
  const h24High = parseFloat(h24Rows[0]?.price_high) || executedPrice;
  const h24Low = parseFloat(h24Rows[0]?.price_low) || executedPrice;
  const h24Volume = parseFloat(h24VolRows[0]?.volume) || 0;

  const [lastPriceRows] = await conn.query(
    'SELECT last_price FROM dbt_coinhistory WHERE market_symbol = ? ORDER BY id DESC LIMIT 1',
    [marketSymbol]
  );
  const prevClose = parseFloat(lastPriceRows[0]?.last_price) || executedPrice;

  const priceChange1h = executedPrice >= prevClose ? (h1High - h1Low) : -(h1High - h1Low);
  const priceChange24h = executedPrice >= prevClose ? (h24High - h24Low) : -(h24High - h24Low);

  await conn.query(
    'INSERT INTO dbt_coinhistory (coin_symbol, market_symbol, last_price, price_high_1h, price_low_1h, price_change_1h, volume_1h, price_high_24h, price_low_24h, price_change_24h, volume_24h, open, close, volumefrom, volumeto, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
    [
      coinSymbol, marketSymbol, executedPrice,
      h1High, h1Low, priceChange1h, h1Volume,
      h24High, h24Low, priceChange24h, h24Volume,
      prevClose, executedPrice,
      tradeQty + h24Volume, h24Volume
    ]
  );
}

async function broadcastOrderBook(io, conn, marketSymbol) {
  if (!io) return;

  let ownConn = false;
  let pool;
  if (!conn) {
    pool = await connect();
    conn = pool;
    ownConn = true;
  }

  const [buyOrders] = await conn.query(
    `SELECT bid_price, SUM(bid_qty_available) AS total_qty,
            COUNT(*) AS order_count,
            SUM(bid_qty_available * bid_price) AS total_value
     FROM dbt_biding
     WHERE market_symbol = ? AND bid_type = 'BUY' AND status = 2
     GROUP BY bid_price
     ORDER BY bid_price DESC
     LIMIT 50`,
    [marketSymbol]
  );

  const [sellOrders] = await conn.query(
    `SELECT bid_price, SUM(bid_qty_available) AS total_qty,
            COUNT(*) AS order_count,
            SUM(bid_qty_available * bid_price) AS total_value
     FROM dbt_biding
     WHERE market_symbol = ? AND bid_type = 'SELL' AND status = 2
     GROUP BY bid_price
     ORDER BY bid_price ASC
     LIMIT 50`,
    [marketSymbol]
  );

  const [[lastTradeRow]] = await conn.query(
    'SELECT bid_price FROM dbt_biding_log WHERE market_symbol = ? ORDER BY log_id DESC LIMIT 1',
    [marketSymbol]
  );

  io.to(marketSymbol).emit('orderbook_update', {
    market_symbol: marketSymbol,
    buy_orders: buyOrders,
    sell_orders: sellOrders,
    last_trade_price: lastTradeRow ? parseFloat(lastTradeRow.bid_price) : 0,
    timestamp: Date.now()
  });

  // Also emit price_update so PriceHeader updates immediately on trade
  const [[latestStats]] = await conn.query(
    `SELECT last_price, price_high_24h, price_low_24h, price_change_24h, volume_24h
     FROM dbt_coinhistory
     WHERE market_symbol = ?
     ORDER BY id DESC LIMIT 1`,
    [marketSymbol]
  );

  if (latestStats) {
    const statsLastPrice = parseFloat(latestStats.last_price);
    const change24h = parseFloat(latestStats.price_change_24h);
    const prevClose24h = statsLastPrice - change24h;
    const changePercent24h = prevClose24h > 0 ? (change24h / prevClose24h) * 100 : 0;

    io.to(marketSymbol).emit('price_update', {
      market_symbol: marketSymbol,
      price: lastTradeRow ? parseFloat(lastTradeRow.bid_price) : statsLastPrice,
      price_change_24h: change24h,
      change_percent_24h: changePercent24h,
      high_24h: parseFloat(latestStats.price_high_24h),
      low_24h: parseFloat(latestStats.price_low_24h),
      volume_24h: parseFloat(latestStats.volume_24h),
      timestamp: Date.now()
    });
  }

  if (ownConn && typeof conn.release === 'function') {
    conn.release();
  }
}

function broadcastMarketTrade(io, marketSymbol, tradeData) {
  if (!io) return;
  io.to(marketSymbol).emit('market_trade', {
    market_symbol: marketSymbol,
    price: tradeData.execPrice,
    qty: tradeData.matchQty,
    amount_usdt: tradeData.matchAmount,
    side: tradeData.initiatorSide,
    timestamp: Date.now()
  });
}

async function matchAndSettle(conn, newOrder, buyFeesPct, sellFeesPct, quoteSymbol, coinSymbol, orderType, io, ip) {
  let remainingQty = parseFloat(newOrder.bid_qty_available);

  while (remainingQty > 0.000000001) {
    const counter = await findBestCounterOrder(
      conn,
      newOrder.market_symbol,
      newOrder.bid_type,
      newOrder.bid_price,
      orderType
    );
    if (!counter) break;

    const execPrice = parseFloat(counter.bid_price);
    const matchQty = Math.min(remainingQty, parseFloat(counter.bid_qty_available));
    const matchAmount = matchQty * execPrice;

    const isNewOrderBuy = newOrder.bid_type === 'BUY';
    const buyerOrder = isNewOrderBuy ? newOrder : counter;
    const sellerOrder = isNewOrderBuy ? counter : newOrder;

    const buyerFee = calcFee(matchQty, execPrice, buyFeesPct);
    const sellerFee = calcFee(matchQty, execPrice, sellFeesPct);

    const counterNewQty = parseFloat(counter.bid_qty_available) - matchQty;
    const counterNewAmt = parseFloat(counter.amount_available) - matchAmount;
    const counterStatus = counterNewQty <= 0.000000001 ? 1 : 2;
    await conn.query(
      'UPDATE dbt_biding SET bid_qty_available = GREATEST(?, 0), amount_available = GREATEST(?, 0), status = ? WHERE id = ?',
      [counterNewQty, counterNewAmt, counterStatus, counter.id]
    );

    const matchedNewQty = remainingQty - matchQty;
    const matchedNewAmt = parseFloat(newOrder.amount_available) - matchAmount;
    const newStatus = matchedNewQty <= 0.000000001 ? 1 : 2;
    await conn.query(
      'UPDATE dbt_biding SET bid_qty_available = GREATEST(?, 0), amount_available = GREATEST(?, 0), status = ? WHERE id = ?',
      [matchedNewQty, matchedNewAmt, newStatus, newOrder.id]
    );

    const buyerLimitPrice = isNewOrderBuy
      ? parseFloat(newOrder.bid_price)
      : parseFloat(counter.bid_price);
    if (buyerLimitPrice > execPrice) {
      const priceDiff = buyerLimitPrice - execPrice;
      const baseRefund = priceDiff * matchQty;
      const feeAtBid = calcFee(matchQty, buyerLimitPrice, buyFeesPct);
      const feeAtExec = calcFee(matchQty, execPrice, buyFeesPct);
      const feeRefund = feeAtBid - feeAtExec;
      const totalRefund = baseRefund + (feeRefund > 0 ? feeRefund : 0);

      if (totalRefund > 0.000000001) {
        await adjustBalance(conn, buyerOrder.user_id, quoteSymbol, +totalRefund);
        await logBalanceChange(conn, {
          userId: buyerOrder.user_id,
          currencySymbol: quoteSymbol,
          transactionType: 'PRICE_IMPROVEMENT_REFUND',
          amount: totalRefund,
          fees: 0,
          ip
        });
      }
    }

    await adjustBalance(conn, buyerOrder.user_id, coinSymbol, +matchQty);
    await logBalanceChange(conn, {
      userId: buyerOrder.user_id,
      currencySymbol: coinSymbol,
      transactionType: 'TRADE_BUY',
      amount: matchQty,
      fees: 0,
      ip
    });
    await logBalanceChange(conn, {
      userId: buyerOrder.user_id,
      currencySymbol: quoteSymbol,
      transactionType: 'TRADE_BUY',
      amount: 0,
      fees: buyerFee,
      ip
    });

    const sellerReceives = matchAmount - sellerFee;
    if (sellerReceives > 0.000000001) {
      await adjustBalance(conn, sellerOrder.user_id, quoteSymbol, +sellerReceives);
      await logBalanceChange(conn, {
        userId: sellerOrder.user_id,
        currencySymbol: quoteSymbol,
        transactionType: 'TRADE_SELL',
        amount: matchAmount,
        fees: sellerFee,
        ip
      });
    }

    const now = new Date();
    const utcStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const unixTs = Math.floor(now.getTime() / 1000);

    const buyerLog = {
      bid_id: buyerOrder.id,
      bid_type: 'BUY',
      bid_price: execPrice,
      complete_qty: matchQty,
      complete_amount: matchAmount,
      user_id: buyerOrder.user_id,
      currency_symbol: coinSymbol,
      market_symbol: newOrder.market_symbol,
      success_time: now,
      success_time_utc: utcStr,
      success_time_unix: unixTs,
      fees_amount: buyerFee,
      available_amount: isNewOrderBuy ? Math.max(0, matchedNewQty) * execPrice : Math.max(0, counterNewQty) * execPrice,
      status: isNewOrderBuy ? newStatus : counterStatus
    };
    await insertTradeLog(conn, buyerLog);

    const sellerLog = {
      bid_id: sellerOrder.id,
      bid_type: 'SELL',
      bid_price: execPrice,
      complete_qty: matchQty,
      complete_amount: matchAmount,
      user_id: sellerOrder.user_id,
      currency_symbol: coinSymbol,
      market_symbol: newOrder.market_symbol,
      success_time: now,
      success_time_utc: utcStr,
      success_time_unix: unixTs,
      fees_amount: sellerFee,
      available_amount: isNewOrderBuy ? Math.max(0, counterNewQty) * execPrice : Math.max(0, matchedNewQty) * execPrice,
      status: isNewOrderBuy ? counterStatus : newStatus
    };
    await insertTradeLog(conn, sellerLog);

    await updateCoinHistory(conn, {
      coinSymbol,
      marketSymbol: newOrder.market_symbol,
      executedPrice: execPrice,
      tradeQty: matchQty
    });

    broadcastMarketTrade(io, newOrder.market_symbol, {
      execPrice,
      matchQty,
      matchAmount,
      initiatorSide: newOrder.bid_type
    });

    if (io) {
      io.to(`user_${buyerOrder.user_id}`).emit('balance_update', { user_id: buyerOrder.user_id });
      io.to(`user_${sellerOrder.user_id}`).emit('balance_update', { user_id: sellerOrder.user_id });
    }

    remainingQty = matchedNewQty;
    newOrder = {
      ...newOrder,
      bid_qty_available: Math.max(0, matchedNewQty),
      amount_available: Math.max(0, matchedNewAmt)
    };
  }

  await broadcastOrderBook(io, conn, newOrder.market_symbol);
}

exports.placeBuyOrder = async (req, res) => {
  let conn;
  try {
    const { market, buypricing, buyamount, user_id, order_type } = req.body;
    const userId = req.user?.user_id || user_id;
    const orderType = (order_type || 'LIMIT').toUpperCase();

    if (!market || !buyamount || !userId) {
      return res.json({ status: 0, message: 'Market, amount and user_id are required.' });
    }

    if (orderType === 'LIMIT' && (!buypricing || parseFloat(buypricing) <= 0)) {
      return res.json({ status: 0, message: 'Price must be a positive number for limit orders.' });
    }

    const qty = parseFloat(buyamount);
    if (qty <= 0) {
      return res.json({ status: 0, message: 'Amount must be a positive number.' });
    }

    const parts = market.split('_');
    const coinSymbol = parts[0];
    const quoteSymbol = parts[1] || 'USDT';

    if (quoteSymbol === 'INR') {
      return res.json({ status: 0, message: 'INR markets are no longer supported. Use USDT.' });
    }

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[pair]] = await conn.query('SELECT status FROM dbt_coinpair WHERE (symbol = ? OR market_symbol = ?) AND status = 1', [market, market]);
    if (!pair) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 0, message: 'Trading pair is inactive or not found.' });
    }

    const buyFeesPct = await getFeePercent(conn, 'BUY', quoteSymbol);
    const sellFeesPct = await getFeePercent(conn, 'SELL', quoteSymbol);

    let finalRate;
    let totalAmount;
    if (orderType === 'MARKET') {
      const [allSells] = await conn.query(
        "SELECT bid_price, bid_qty_available FROM dbt_biding WHERE market_symbol = ? AND bid_type = 'SELL' AND status = 2 ORDER BY bid_price ASC",
        [market]
      );
      if (!allSells.length) {
        await conn.rollback();
        conn.release();
        return res.json({ status: 0, message: 'No sell orders available.' });
      }
      finalRate = parseFloat(allSells[0].bid_price);
      let totalCost = 0;
      let remQty = qty;
      for (const sell of allSells) {
        const fillQty = Math.min(remQty, parseFloat(sell.bid_qty_available));
        totalCost += fillQty * parseFloat(sell.bid_price);
        remQty -= fillQty;
        if (remQty <= 0.000000001) break;
      }
      totalAmount = totalCost;
    } else {
      finalRate = parseFloat(buypricing);
      totalAmount = finalRate * qty;
    }

    const feesAmount = parseFloat(((totalAmount * buyFeesPct) / 100).toFixed(8));
    const totalDebit = parseFloat((totalAmount + feesAmount).toFixed(8));

    const buyerBal = await getBalance(conn, userId, quoteSymbol);
    if (parseFloat(buyerBal.balance || 0) < totalDebit) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 2, message: 'Insufficient balance.' });
    }

    await adjustBalance(conn, userId, quoteSymbol, -totalDebit);
    await logBalanceChange(conn, {
      userId,
      currencySymbol: quoteSymbol,
      transactionType: 'ORDER_PLACE_BUY',
      amount: totalDebit,
      fees: feesAmount,
      ip: req.ip
    });

    const openDate = new Date();
    const [insertResult] = await conn.query(
      "INSERT INTO dbt_biding (bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, open_order, fees_amount, status) VALUES ('BUY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)",
      [finalRate, qty, qty, totalAmount, totalAmount, coinSymbol, market, userId, openDate, feesAmount]
    );

    const [newOrderRows] = await conn.query(
      'SELECT * FROM dbt_biding WHERE id = ?',
      [insertResult.insertId]
    );
    const newOrder = newOrderRows[0];
    if (!newOrder) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 0, message: 'Failed to create order.' });
    }

    const io = req.app.get('io');
    await matchAndSettle(conn, newOrder, buyFeesPct, sellFeesPct, quoteSymbol, coinSymbol, orderType, io, req.ip);

    let autoCancelled = false;
    if (orderType === 'MARKET') {
      const [checkOrder] = await conn.query(
        'SELECT bid_qty, bid_qty_available, amount_available, fees_amount, status FROM dbt_biding WHERE id = ?',
        [newOrder.id]
      );
      if (checkOrder[0]?.status === 2 && parseFloat(checkOrder[0]?.bid_qty_available || 0) > 0.000000001) {
        const qtyLeft = parseFloat(checkOrder[0].bid_qty_available);
        const remainingAmt = parseFloat(checkOrder[0].amount_available || 0);
        const totalOrderQty = parseFloat(checkOrder[0].bid_qty || qty);
        const totalFee = parseFloat(checkOrder[0].fees_amount || 0);
        const proportionalFee = totalOrderQty > 0 ? parseFloat(((qtyLeft / totalOrderQty) * totalFee).toFixed(8)) : 0;
        const refundAmount = parseFloat((remainingAmt + proportionalFee).toFixed(8));
        await conn.query('UPDATE dbt_biding SET status = 3 WHERE id = ?', [newOrder.id]);
        await adjustBalance(conn, userId, quoteSymbol, +refundAmount);
        await logBalanceChange(conn, {
          userId,
          currencySymbol: quoteSymbol,
          transactionType: 'ORDER_CANCEL_REFUND',
          amount: refundAmount,
          fees: 0,
          ip: req.ip
        });
        autoCancelled = true;
      }
    }

    await conn.commit();
    conn.release();

    if (autoCancelled) {
      const ioAfter = req.app.get('io');
      if (ioAfter) await broadcastOrderBook(ioAfter, null, market);
    }

    const io2 = req.app.get('io');
    if (io2) {
      io2.to(`user_${userId}`).emit('balance_update', { user_id: userId });
    }
    return res.json({ status: 1, message: 'Buy order placed.', order_id: newOrder.id });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('placeBuyOrder error:', err);
    return res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};

exports.placeSellOrder = async (req, res) => {
  let conn;
  try {
    const { market, sellpricing, sellamount, user_id, order_type } = req.body;
    const userId = req.user?.user_id || user_id;
    const orderType = (order_type || 'LIMIT').toUpperCase();

    if (!market || !sellamount || !userId) {
      return res.json({ status: 0, message: 'Market, amount and user_id are required.' });
    }

    if (orderType === 'LIMIT' && (!sellpricing || parseFloat(sellpricing) <= 0)) {
      return res.json({ status: 0, message: 'Price must be a positive number for limit orders.' });
    }

    const qty = parseFloat(sellamount);
    if (qty <= 0) {
      return res.json({ status: 0, message: 'Amount must be a positive number.' });
    }

    const parts = market.split('_');
    const coinSymbol = parts[0];
    const quoteSymbol = parts[1] || 'USDT';

    if (quoteSymbol === 'INR') {
      return res.json({ status: 0, message: 'INR markets are no longer supported. Use USDT.' });
    }

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[pair]] = await conn.query('SELECT status FROM dbt_coinpair WHERE (symbol = ? OR market_symbol = ?) AND status = 1', [market, market]);
    if (!pair) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 0, message: 'Trading pair is inactive or not found.' });
    }

    const buyFeesPct = await getFeePercent(conn, 'BUY', quoteSymbol);
    const sellFeesPct = await getFeePercent(conn, 'SELL', quoteSymbol);

    const sellerBal = await getBalance(conn, userId, coinSymbol);
    if (parseFloat(sellerBal.balance || 0) < qty) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 2, message: 'Insufficient coin balance.' });
    }

    await adjustBalance(conn, userId, coinSymbol, -qty);
    await logBalanceChange(conn, {
      userId,
      currencySymbol: coinSymbol,
      transactionType: 'ORDER_PLACE_SELL',
      amount: qty,
      fees: 0,
      ip: req.ip
    });

    let finalRate;
    let totalAmount;
    if (orderType === 'MARKET') {
      const [allBuys] = await conn.query(
        "SELECT bid_price, bid_qty_available FROM dbt_biding WHERE market_symbol = ? AND bid_type = 'BUY' AND status = 2 ORDER BY bid_price DESC",
        [market]
      );
      if (!allBuys.length) {
        await conn.rollback();
        conn.release();
        return res.json({ status: 0, message: 'No buy orders available.' });
      }
      finalRate = parseFloat(allBuys[0].bid_price);
      let totalRevenue = 0;
      let remQty = qty;
      for (const buy of allBuys) {
        const fillQty = Math.min(remQty, parseFloat(buy.bid_qty_available));
        totalRevenue += fillQty * parseFloat(buy.bid_price);
        remQty -= fillQty;
        if (remQty <= 0.000000001) break;
      }
      totalAmount = totalRevenue;
    } else {
      finalRate = parseFloat(sellpricing);
      totalAmount = finalRate * qty;
    }
    const openDate = new Date();

    const [insertResult] = await conn.query(
      "INSERT INTO dbt_biding (bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, open_order, fees_amount, status) VALUES ('SELL', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2)",
      [finalRate, qty, qty, totalAmount, totalAmount, coinSymbol, market, userId, openDate]
    );

    const [newOrderRows] = await conn.query(
      'SELECT * FROM dbt_biding WHERE id = ?',
      [insertResult.insertId]
    );
    const newOrder = newOrderRows[0];
    if (!newOrder) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 0, message: 'Failed to create order.' });
    }

    const io = req.app.get('io');
    await matchAndSettle(conn, newOrder, buyFeesPct, sellFeesPct, quoteSymbol, coinSymbol, orderType, io, req.ip);

    let autoCancelled = false;
    if (orderType === 'MARKET') {
      const [checkOrder] = await conn.query(
        'SELECT bid_qty_available, status FROM dbt_biding WHERE id = ?',
        [newOrder.id]
      );
      if (checkOrder[0]?.status === 2 && parseFloat(checkOrder[0]?.bid_qty_available || 0) > 0.000000001) {
        const qtyLeft = parseFloat(checkOrder[0].bid_qty_available);
        await conn.query('UPDATE dbt_biding SET status = 3 WHERE id = ?', [newOrder.id]);
        await adjustBalance(conn, userId, coinSymbol, +qtyLeft);
        await logBalanceChange(conn, {
          userId,
          currencySymbol: coinSymbol,
          transactionType: 'ORDER_CANCEL_REFUND',
          amount: qtyLeft,
          fees: 0,
          ip: req.ip
        });
        autoCancelled = true;
      }
    }

    await conn.commit();
    conn.release();

    if (autoCancelled) {
      const ioAfter = req.app.get('io');
      if (ioAfter) await broadcastOrderBook(ioAfter, null, market);
    }

    const io2 = req.app.get('io');
    if (io2) {
      io2.to(`user_${userId}`).emit('balance_update', { user_id: userId });
    }
    return res.json({ status: 1, message: 'Sell order placed.', order_id: newOrder.id });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('placeSellOrder error:', err);
    return res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};

exports.cancelOrder = async (req, res) => {
  let conn;
  try {
    const { order_id } = req.body;
    const userId = req.user?.user_id || req.body.user_id;

    if (!order_id || !userId) {
      return res.json({ status: 0, message: 'Order ID and user_id are required.' });
    }

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT * FROM dbt_biding WHERE id = ? AND user_id = ? AND status = 2',
      [order_id, userId]
    );

    if (!orderRows.length) {
      await conn.rollback();
      conn.release();
      return res.json({ status: 0, message: 'Open order not found.' });
    }

    const order = orderRows[0];
    const parts = order.market_symbol.split('_');
    const coinSymbol = parts[0];
    const quoteSymbol = parts[1] || 'USDT';

    await conn.query('UPDATE dbt_biding SET status = 3 WHERE id = ?', [order.id]);

    if (order.bid_type === 'BUY') {
      const refundQty = parseFloat(order.bid_qty_available);
      const refundPrice = parseFloat(order.bid_price);
      const totalOrderQty = parseFloat(order.bid_qty || order.bid_qty_available);
      const totalFee = parseFloat(order.fees_amount || 0);
      const baseRefund = parseFloat((refundQty * refundPrice).toFixed(8));
      const proportionalFee = totalOrderQty > 0 ? parseFloat(((refundQty / totalOrderQty) * totalFee).toFixed(8)) : 0;
      const totalRefund = parseFloat((baseRefund + proportionalFee).toFixed(8));

      if (totalRefund > 0.000000001) {
        await adjustBalance(conn, userId, quoteSymbol, +totalRefund);
        await logBalanceChange(conn, {
          userId,
          currencySymbol: quoteSymbol,
          transactionType: 'ORDER_CANCEL_REFUND',
          amount: totalRefund,
          fees: 0,
          ip: req.ip
        });
      }
    } else {
      const refundQty = parseFloat(order.bid_qty_available);
      if (refundQty > 0.000000001) {
        await adjustBalance(conn, userId, coinSymbol, +refundQty);
        await logBalanceChange(conn, {
          userId,
          currencySymbol: coinSymbol,
          transactionType: 'ORDER_CANCEL_REFUND',
          amount: refundQty,
          fees: 0,
          ip: req.ip
        });
      }
    }

    const io = req.app.get('io');
    await broadcastOrderBook(io, conn, order.market_symbol);

    await conn.commit();
    conn.release();
    if (io) {
      io.to(`user_${userId}`).emit('balance_update', { user_id: userId });
    }
    return res.json({ status: 1, message: 'Order cancelled and balance refunded.' });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('cancelOrder error:', err);
    return res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};
