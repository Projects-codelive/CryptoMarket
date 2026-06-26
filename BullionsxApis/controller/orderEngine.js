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
    'SELECT id, user_id, currency_symbol, balance FROM dbt_balance WHERE user_id = ? AND currency_symbol = ?',
    [userId, currencySymbol]
  );
  return rows[0] || { id: null, balance: 0 };
}

async function adjustBalance(conn, userId, currencySymbol, delta) {
  const existing = await getBalance(conn, userId, currencySymbol);
  if (existing.id) {
    await conn.query(
      'UPDATE dbt_balance SET balance = balance + ? WHERE user_id = ? AND currency_symbol = ?',
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

async function findBestMarketPrice(conn, marketSymbol, side) {
  if (side === 'BUY') {
    const [rows] = await conn.query(
      'SELECT bid_price FROM dbt_biding WHERE market_symbol = ? AND status = 2 AND bid_type = "SELL" ORDER BY bid_price ASC LIMIT 1',
      [marketSymbol]
    );
    return rows[0] ? parseFloat(rows[0].bid_price) : null;
  }
  const [rows] = await conn.query(
    'SELECT bid_price FROM dbt_biding WHERE market_symbol = ? AND status = 2 AND bid_type = "BUY" ORDER BY bid_price DESC LIMIT 1',
    [marketSymbol]
  );
  return rows[0] ? parseFloat(rows[0].bid_price) : null;
}

async function findBestCounterOrder(conn, marketSymbol, side, limitPrice) {
  if (side === 'BUY') {
    const [rows] = await conn.query(
      'SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE market_symbol = ? AND status = 2 AND bid_type = "SELL" AND bid_price <= ? ORDER BY bid_price ASC, open_order ASC LIMIT 1',
      [marketSymbol, limitPrice]
    );
    return rows[0] || null;
  }
  const [rows] = await conn.query(
    'SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE market_symbol = ? AND status = 2 AND bid_type = "BUY" AND bid_price >= ? ORDER BY bid_price DESC, open_order ASC LIMIT 1',
    [marketSymbol, limitPrice]
  );
  return rows[0] || null;
}

async function insertTradeLog(conn, logData) {
  const columns = Object.keys(logData);
  const values = Object.values(logData);
  await conn.query(
    `INSERT INTO dbt_biding_log (${columns.join(', ')}) VALUES (?)`,
    [values]
  );
}

async function updateCoinHistory(conn, { coinSymbol, marketSymbol, executedPrice, tradeQty }) {
  const [h1Rows] = await conn.query(
    'SELECT MAX(bid_price) AS price_high, MIN(bid_price) AS price_low FROM dbt_biding_log WHERE market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)',
    [marketSymbol]
  );
  const [h1VolRows] = await conn.query(
    'SELECT SUM(complete_qty) AS volume FROM dbt_biding_log WHERE bid_type = "BUY" AND market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)',
    [marketSymbol]
  );

  const [h24Rows] = await conn.query(
    'SELECT MAX(bid_price) AS price_high, MIN(bid_price) AS price_low FROM dbt_biding_log WHERE market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
    [marketSymbol]
  );
  const [h24VolRows] = await conn.query(
    'SELECT SUM(complete_qty) AS volume FROM dbt_biding_log WHERE bid_type = "BUY" AND market_symbol = ? AND success_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
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

async function broadcastOrderBook(req, conn, marketSymbol) {
  const io = req.app.get('io');
  if (!io) return;

  const [buyOrders] = await conn.query(
    `SELECT bid_price, SUM(bid_qty_available) AS total_qty,
            COUNT(*) AS order_count
     FROM dbt_biding
     WHERE market_symbol = ? AND bid_type = 'BUY' AND status = 2
     GROUP BY bid_price
     ORDER BY bid_price DESC
     LIMIT 20`,
    [marketSymbol]
  );

  const [sellOrders] = await conn.query(
    `SELECT bid_price, SUM(bid_qty_available) AS total_qty,
            COUNT(*) AS order_count
     FROM dbt_biding
     WHERE market_symbol = ? AND bid_type = 'SELL' AND status = 2
     GROUP BY bid_price
     ORDER BY bid_price ASC
     LIMIT 20`,
    [marketSymbol]
  );

  io.to(marketSymbol).emit('orderbook_update', {
    market_symbol: marketSymbol,
    buy_orders: buyOrders,
    sell_orders: sellOrders,
    timestamp: Date.now()
  });
}

async function matchAndSettle(conn, newOrder, buyFeesPct, sellFeesPct, market, coinSymbol, ip, req) {
  let remainingQty = parseFloat(newOrder.bid_qty_available);
  let remainingAmount = parseFloat(newOrder.amount_available);

  while (remainingQty > 0) {
    const counter = await findBestCounterOrder(
      conn,
      newOrder.market_symbol,
      newOrder.bid_type,
      newOrder.bid_price
    );
    if (!counter) break;

    const execPrice = parseFloat(counter.bid_price);
    const matchQty = Math.min(remainingQty, parseFloat(counter.bid_qty_available));
    const matchAmount = matchQty * execPrice;

    const isNewOrderBuy = newOrder.bid_type === 'BUY';
    const buyerOrder = isNewOrderBuy ? newOrder : counter;
    const sellerOrder = isNewOrderBuy ? counter : newOrder;

    const buyerFeePct = buyFeesPct;
    const sellerFeePct = sellFeesPct;

    const counterNewQty = parseFloat(counter.bid_qty_available) - matchQty;
    const counterNewAmt = parseFloat(counter.amount_available) - matchAmount;
    const counterStatus = counterNewQty <= 0 ? 1 : 2;
    await conn.query(
      'UPDATE dbt_biding SET bid_qty_available = ?, amount_available = ?, status = ? WHERE id = ?',
      [counterNewQty, Math.max(0, counterNewAmt), counterStatus, counter.id]
    );

    remainingQty -= matchQty;
    remainingAmount -= matchAmount;
    const newStatus = remainingQty <= 0 ? 1 : 2;
    await conn.query(
      'UPDATE dbt_biding SET bid_qty_available = ?, amount_available = ?, status = ? WHERE id = ?',
      [remainingQty, Math.max(0, remainingAmount), newStatus, newOrder.id]
    );

    if (parseFloat(buyerOrder.bid_price) > execPrice) {
      const priceDiff = parseFloat(buyerOrder.bid_price) - execPrice;
      const baseRefund = priceDiff * matchQty;
      const feeAtBid = calcFee(matchQty, parseFloat(buyerOrder.bid_price), buyerFeePct);
      const feeAtExec = calcFee(matchQty, execPrice, buyerFeePct);
      const feeRefund = feeAtBid - feeAtExec;
      const totalRefund = baseRefund + feeRefund;

      if (totalRefund > 0) {
        await adjustBalance(conn, buyerOrder.user_id, market, totalRefund);
        await logBalanceChange(conn, {
          userId: buyerOrder.user_id,
          currencySymbol: market,
          transactionType: 'ADJUSTMENT',
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

    const sellerFee = calcFee(matchQty, execPrice, sellerFeePct);
    const sellerReceives = matchAmount - sellerFee;
    if (sellerReceives > 0) {
      await adjustBalance(conn, sellerOrder.user_id, market, +sellerReceives);
      await logBalanceChange(conn, {
        userId: sellerOrder.user_id,
        currencySymbol: market,
        transactionType: 'TRADE_SELL',
        amount: sellerReceives,
        fees: sellerFee,
        ip
      });
    }

    const now = new Date();
    const utcStr = now.toISOString();
    const unixTs = Math.floor(now.getTime() / 1000);

    const buyerLog = {
      bid_id: buyerOrder.id,
      bid_type: buyerOrder.bid_type,
      bid_price: execPrice,
      complete_qty: matchQty,
      complete_amount: matchAmount,
      user_id: buyerOrder.user_id,
      currency_symbol: coinSymbol,
      market_symbol: newOrder.market_symbol,
      success_time: now,
      success_time_utc: utcStr,
      success_time_unix: unixTs,
      fees_amount: calcFee(matchQty, execPrice, buyerFeePct),
      available_amount: isNewOrderBuy ? remainingAmount : parseFloat(counterNewAmt),
      status: isNewOrderBuy ? newStatus : counterStatus
    };
    await insertTradeLog(conn, buyerLog);

    const sellerLog = {
      bid_id: sellerOrder.id,
      bid_type: sellerOrder.bid_type,
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
      available_amount: isNewOrderBuy ? parseFloat(counterNewAmt) : remainingAmount,
      status: isNewOrderBuy ? counterStatus : newStatus
    };
    await insertTradeLog(conn, sellerLog);

    await updateCoinHistory(conn, {
      coinSymbol,
      marketSymbol: newOrder.market_symbol,
      executedPrice: execPrice,
      tradeQty: matchQty
    });

    const io = req?.app?.get('io');
    if (io) {
      io.to(newOrder.market_symbol).emit('market_trade', {
        market_symbol: newOrder.market_symbol,
        price: execPrice,
        qty: matchQty,
        amount_inr: matchAmount,
        side: newOrder.bid_type,
        timestamp: Date.now()
      });
    }
  }

  if (req) {
    await broadcastOrderBook(req, conn, newOrder.market_symbol);
  }
}

exports.placeBuyOrder = async (req, res) => {
  let conn;
  try {
    const { market, buypricing, buyamount } = req.body;
    const userId = req.user?.user_id || req.body.user_id;

    if (!market || !buypricing || !buyamount || !userId) {
      return res.json({ status: 0, message: 'Market, price, amount and user_id are required.' });
    }

    const isMarketOrder = buypricing === '0' || buypricing?.toLowerCase() === 'market';
    if (!isMarketOrder && (!buypricing || parseFloat(buypricing) <= 0)) {
      return res.json({ status: 0, message: 'Price must be a positive number.' });
    }
    const qty = parseFloat(buyamount);
    if (qty <= 0) {
      return res.json({ status: 0, message: 'Amount must be a positive number.' });
    }

    const parts = market.split('_');
    const coinSymbol = parts[0];
    const quoteSymbol = parts[1] || 'INR';

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const buyFeesPct = await getFeePercent(conn, 'BUY', quoteSymbol);
    const sellFeesPct = await getFeePercent(conn, 'SELL', quoteSymbol);

    let finalRate;
    if (isMarketOrder) {
      finalRate = await findBestMarketPrice(conn, market, 'BUY');
      if (!finalRate) {
        await conn.rollback();
        conn.release();
        conn = null;
        return res.json({ status: 0, message: 'No sellers available for market order.' });
      }
    } else {
      finalRate = parseFloat(buypricing);
    }

    const feesAmount = calcFee(qty, finalRate, buyFeesPct);
    const totalAmount = finalRate * qty;
    const totalDebit = totalAmount + feesAmount;

    const buyerBal = await getBalance(conn, userId, quoteSymbol);
    const balanceAvailable = parseFloat(buyerBal.balance || 0);
    if (balanceAvailable < totalDebit) {
      await conn.rollback();
      conn.release();
      conn = null;
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
      'INSERT INTO dbt_biding (bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, open_order, fees_amount, status) VALUES ("BUY", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)',
      [finalRate, qty, qty, totalAmount, totalAmount, coinSymbol, market, userId, openDate, feesAmount]
    );

    const [newOrderRows] = await conn.query(
      'SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE id = ?',
      [insertResult.insertId]
    );
    const newOrder = newOrderRows[0];
    if (!newOrder) {
      await conn.rollback();
      conn.release();
      conn = null;
      return res.json({ status: 0, message: 'Failed to create order.' });
    }

    await matchAndSettle(conn, newOrder, buyFeesPct, sellFeesPct, quoteSymbol, coinSymbol, req.ip, req);

    await conn.commit();
    conn.release();
    conn = null;
    return res.json({ status: 1, message: 'Buy order placed successfully.', order_id: newOrder.id });
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
    const { market, sellpricing, sellamount } = req.body;
    const userId = req.user?.user_id || req.body.user_id;

    if (!market || !sellpricing || !sellamount || !userId) {
      return res.json({ status: 0, message: 'Market, price, amount and user_id are required.' });
    }

    const isMarketOrder = sellpricing === '0' || sellpricing?.toLowerCase() === 'market';
    if (!isMarketOrder && (!sellpricing || parseFloat(sellpricing) <= 0)) {
      return res.json({ status: 0, message: 'Price must be a positive number.' });
    }
    const qty = parseFloat(sellamount);
    if (qty <= 0) {
      return res.json({ status: 0, message: 'Amount must be a positive number.' });
    }

    const parts = market.split('_');
    const coinSymbol = parts[0];
    const quoteSymbol = parts[1] || 'INR';

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const sellerBal = await getBalance(conn, userId, coinSymbol);
    const balanceAvailable = parseFloat(sellerBal.balance || 0);
    if (balanceAvailable < qty) {
      await conn.rollback();
      conn.release();
      conn = null;
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

    const buyFeesPct = await getFeePercent(conn, 'BUY', quoteSymbol);
    const sellFeesPct = await getFeePercent(conn, 'SELL', quoteSymbol);

    let finalRate;
    if (isMarketOrder) {
      finalRate = await findBestMarketPrice(conn, market, 'SELL');
      if (!finalRate) {
        await conn.rollback();
        conn.release();
        conn = null;
        return res.json({ status: 0, message: 'No buyers available for market order.' });
      }
    } else {
      finalRate = parseFloat(sellpricing);
    }

    const totalAmount = finalRate * qty;
    const openDate = new Date();

    const [insertResult] = await conn.query(
      'INSERT INTO dbt_biding (bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, open_order, fees_amount, status) VALUES ("SELL", ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2)',
      [finalRate, qty, qty, totalAmount, totalAmount, coinSymbol, market, userId, openDate]
    );

    const [newOrderRows] = await conn.query(
      'SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE id = ?',
      [insertResult.insertId]
    );
    const newOrder = newOrderRows[0];
    if (!newOrder) {
      await conn.rollback();
      conn.release();
      conn = null;
      return res.json({ status: 0, message: 'Failed to create order.' });
    }

    await matchAndSettle(conn, newOrder, buyFeesPct, sellFeesPct, quoteSymbol, coinSymbol, req.ip, req);

    await conn.commit();
    conn.release();
    conn = null;
    return res.json({ status: 1, message: 'Sell order placed successfully.', order_id: newOrder.id });
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
      'SELECT id, bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, fees_amount, status FROM dbt_biding WHERE id = ? AND user_id = ? AND status = 2',
      [order_id, userId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      conn.release();
      conn = null;
      return res.json({ status: 0, message: 'Open order not found.' });
    }

    const order = orderRows[0];
    const parts = order.market_symbol.split('_');
    const coinSymbol = parts[0];
    const quoteSymbol = parts[1] || 'INR';

    await conn.query(
      'UPDATE dbt_biding SET status = 3 WHERE id = ?',
      [order.id]
    );

    if (order.bid_type === 'BUY') {
      const buyFeesPct = await getFeePercent(conn, 'BUY', quoteSymbol);
      const refundQty = parseFloat(order.bid_qty_available);
      const refundPrice = parseFloat(order.bid_price);
      const baseRefund = refundQty * refundPrice;
      const feeRefund = calcFee(refundQty, refundPrice, buyFeesPct);
      const totalRefund = baseRefund + feeRefund;

      if (totalRefund > 0) {
        await adjustBalance(conn, userId, quoteSymbol, totalRefund);
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
      if (refundQty > 0) {
        await adjustBalance(conn, userId, coinSymbol, refundQty);
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

    await broadcastOrderBook(req, conn, order.market_symbol);

    await conn.commit();
    conn.release();
    conn = null;
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
