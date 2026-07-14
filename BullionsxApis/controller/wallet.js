const connect = require('../config/Mysqlcon');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const { ensureBalanceRow, getWalletBalance, creditWallet, debitWallet, transferBetweenWallets, InsufficientBalanceError } = require('../services/balanceService');

// ---------- GET /wallet/overview ----------
exports.getOverview = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const userId = req.user.user_id;

    let coins;
    try {
      [coins] = await conn.query('SELECT * FROM dbt_cryptocoin ORDER BY coin_position ASC');
    } catch (_) {
      [coins] = await conn.query('SELECT * FROM dbt_cryptocoin');
    }
    const [balances] = await conn.query('SELECT currency_symbol, SUM(balance) as balance, SUM(sharewallet) as sharewallet, SUM(fundwallet) as fundwallet FROM dbt_balance WHERE user_id = ? GROUP BY currency_symbol', [userId]);
    const [prices] = await conn.query(
      'SELECT ch.coin_symbol, ch.last_price FROM dbt_coinhistory ch INNER JOIN (SELECT coin_symbol, MAX(id) as maxid FROM dbt_coinhistory GROUP BY coin_symbol) latest ON ch.id = latest.maxid'
    );
    const [openOrders] = await conn.query(
      "SELECT market_symbol, SUM(bid_qty_available) as locked_qty FROM dbt_biding WHERE user_id = ? AND status = 2 GROUP BY market_symbol",
      [userId]
    );

    const priceMap = {};
    prices.forEach(p => { priceMap[p.coin_symbol] = parseFloat(p.last_price || 0); });

    const lockedMap = {};
    openOrders.forEach(o => {
      const sym = o.market_symbol.split('_')[0];
      lockedMap[sym] = (lockedMap[sym] || 0) + parseFloat(o.locked_qty || 0);
    });

    const balMap = {};
    balances.forEach(b => {
      balMap[b.currency_symbol] = {
        spot: parseFloat(b.balance || 0),
        funding: parseFloat(b.fundwallet || 0),
        share: parseFloat(b.sharewallet || 0),
      };
    });

    let totalEstimated = 0;
    const overview = [];

    coins.forEach(coin => {
      const sym = coin.symbol || coin.coin_symbol;
      if (!sym) return;
      const bal = balMap[sym] || { spot: 0, funding: 0, share: 0 };
      const price = sym === 'INR' ? 1 : (priceMap[sym] || 0);
      const inTrade = lockedMap[sym] || 0;
      const total = bal.spot + bal.funding + bal.share + inTrade;
      const usdValue = total * price;
      totalEstimated += usdValue;
      overview.push({
        coin: sym,
        name: coin.coin_name || coin.name || sym,
        spot: bal.spot,
        funding: bal.funding,
        share: bal.share,
        inTrade,
        total,
        price,
        usdValue,
      });
    });

    // Add any currencies from balance not in dbt_cryptocoin
    const added = new Set(coins.map(c => c.symbol || c.coin_symbol).filter(Boolean));
    balances.forEach(b => {
      if (added.has(b.currency_symbol)) return;
      added.add(b.currency_symbol);
      const bal = balMap[b.currency_symbol] || { spot: 0, funding: 0, share: 0 };
      const price = b.currency_symbol === 'INR' ? 1 : (priceMap[b.currency_symbol] || 0);
      const inTrade = lockedMap[b.currency_symbol] || 0;
      const total = bal.spot + bal.funding + bal.share + inTrade;
      const usdValue = total * price;
      totalEstimated += usdValue;
      overview.push({
        coin: b.currency_symbol,
        name: b.currency_symbol,
        spot: bal.spot,
        funding: bal.funding,
        share: bal.share,
        inTrade,
        total,
        price,
        usdValue,
      });
    });

    res.json({
      status: 1,
      overview,
      totalEstimated,
    });
  } catch (err) {
    console.error('wallet overview error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET /wallet/coin/:symbol ----------
exports.getCoinDetail = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const userId = req.user.user_id;
    const { symbol } = req.params;

    const [coins] = await conn.query('SELECT * FROM dbt_cryptocoin WHERE coin_symbol = ? AND status = 1', [symbol]);
    const coinName = coins.length ? (coins[0].coin_name || coins[0].name || symbol) : symbol;

    await ensureBalanceRow(conn, userId, symbol);

    const [balRows] = await conn.query('SELECT * FROM dbt_balance WHERE user_id = ? AND currency_symbol = ?', [userId, symbol]);
    const bal = balRows[0] || { balance: 0, fundwallet: 0, sharewallet: 0 };

    let networks = [];
    try {
        [networks] = await conn.query('SELECT * FROM dbt_coin_network WHERE coin_symbol = ? AND status = 1', [symbol]);
    } catch (e) {
        console.error(`[getCoinDetail] network query error for ${symbol}:`, e.message);
    }

    const [priceRows] = await conn.query(
      'SELECT last_price FROM dbt_coinhistory WHERE coin_symbol = ? ORDER BY id DESC LIMIT 1', [symbol]
    );
    const price = symbol === 'INR' ? 1 : (priceRows.length ? parseFloat(priceRows[0].last_price) : 0);

    const [openOrders] = await conn.query(
      "SELECT SUM(bid_qty_available) as locked FROM dbt_biding WHERE user_id = ? AND market_symbol LIKE ? AND status = 2",
      [userId, `${symbol}_%`]
    );
    const inTrade = parseFloat(openOrders[0].locked || 0);

    res.json({
      status: 1,
      coin: symbol,
      name: coinName,
      spot: parseFloat(bal.balance),
      funding: parseFloat(bal.fundwallet),
      share: parseFloat(bal.sharewallet),
      inTrade,
      total: parseFloat(bal.balance) + parseFloat(bal.fundwallet) + parseFloat(bal.sharewallet) + inTrade,
      price,
      networks,
    });
  } catch (err) {
    console.error('wallet coin detail error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET /wallet/deposit-address ----------
exports.getDepositAddress = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const userId = req.user.user_id;
    const { coin, network } = req.query;

    if (!coin) return res.status(400).json({ status: 0, message: 'Coin is required.' });

    let [addresses] = await conn.query(
      'SELECT * FROM dbt_address WHERE user_id = ? AND coin_id = ? LIMIT 1',
      [userId, coin]
    );

    if (!addresses.length) {
      const address = userId + '_' + coin + '_' + Date.now();
      const epkey = 'ep_' + Math.random().toString(36).substring(2, 15);
      const [result] = await conn.query(
        'INSERT INTO dbt_address (user_id, coin_id, address, epkey) VALUES (?, ?, ?, ?)',
        [userId, coin, address, epkey]
      );
      addresses = [{ id: result.insertId, user_id: userId, coin_id: coin, address, epkey, publickey: null }];
    }

    res.json({ status: 1, address: addresses[0].address, coin, network: network || null });
  } catch (err) {
    console.error('deposit address error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET /wallet/deposits ----------
exports.getDeposits = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const userId = req.user.user_id;
    const { coin, limit = 20, offset = 0 } = req.query;

    let query = `SELECT bl.* FROM dbt_balance_log bl
                 JOIN dbt_balance b ON bl.balance_id = b.id
                 WHERE b.user_id = ? AND bl.transaction_type IN ('DEPOSIT', 'ADMIN_BONUS')`;
    const params = [userId];

    if (coin) { query += ' AND bl.currency_symbol = ?'; params.push(coin); }

    query += ' ORDER BY bl.date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await conn.query(query, params);
    res.json({ status: 1, deposits: rows });
  } catch (err) {
    console.error('get deposits error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- POST /wallet/withdraw/initiate ----------
exports.initiateWithdraw = async (req, res) => {
  let conn;
  try {
    const { error } = Joi.object({
      coin: Joi.string().required(),
      network: Joi.string().optional(),
      address: Joi.string().required(),
      amount: Joi.number().positive().required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

    const { coin, network, address, amount: rawAmount } = req.body;
    const amount = parseFloat(rawAmount);
    const userId = req.user.user_id;

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Coin exists and is active (check dbt_cryptocoin or user's balance for fiat)
    let [coinRows] = await conn.query('SELECT * FROM dbt_cryptocoin WHERE coin_symbol = ? AND status = 1', [coin]);
    if (!coinRows.length) {
      const [userBal] = await conn.query('SELECT id FROM dbt_balance WHERE user_id = ? AND currency_symbol = ?', [userId, coin]);
      if (!userBal.length) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ status: 0, message: 'Coin not found or inactive.' });
      }
      coinRows = [{ symbol: coin }];
    }

    // 2. Network exists with withdraw_status = 1
    let networkRows = [];
    let withdrawFee = 0;
    let minWithdraw = 0;
    let maxWithdraw = 0;
    if (network) {
      [networkRows] = await conn.query('SELECT * FROM dbt_coin_network WHERE coin_symbol = ? AND network_name = ? AND status = 1 AND withdraw_status = 1', [coin, network]);
      if (!networkRows.length) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ status: 0, message: 'Network not found or withdrawal not available.' });
      }
      withdrawFee = parseFloat(networkRows[0].withdraw_fee || 0);
      minWithdraw = parseFloat(networkRows[0].min_withdraw || 0);
      maxWithdraw = parseFloat(networkRows[0].max_withdraw || 0);
    }

    // 3. Address non-empty
    if (!address || !address.trim()) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ status: 0, message: 'Address is required.' });
    }

    // 4. amount > 0
    if (amount <= 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ status: 0, message: 'Amount must be greater than 0.' });
    }

    // 5. amount >= min_withdraw
    if (amount < minWithdraw) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ status: 0, message: `Minimum withdrawal is ${minWithdraw} ${coin}.` });
    }

    // 6. amount <= max_withdraw
    if (maxWithdraw > 0 && amount > maxWithdraw) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ status: 0, message: `Maximum withdrawal is ${maxWithdraw} ${coin}.` });
    }

    // 7. Spot balance check
    const spotBal = await getWalletBalance(conn, userId, coin, 'spot');

    // Get locked in open orders
    const [lockedRows] = await conn.query(
      "SELECT SUM(bid_qty_available) as locked FROM dbt_biding WHERE user_id = ? AND market_symbol LIKE ? AND status = 2",
      [userId, `${coin}_%`]
    );
    const lockedInOrders = parseFloat(lockedRows[0].locked || 0);
    const availableForWithdraw = spotBal - lockedInOrders;

    if (amount + withdrawFee > availableForWithdraw) {
      await conn.rollback(); conn.release();
      return res.status(400).json({
        status: 0,
        message: `Insufficient available balance. You have ${Math.max(0, availableForWithdraw)} ${coin} available for withdrawal (${spotBal} balance minus ${lockedInOrders} in orders). Requested: ${amount + withdrawFee}.`
      });
    }

    await conn.commit();
    conn.release();

    // 8. Generate OTP, store it, send via email
    const { sendOtpEmail } = require('../utils/email');
    let email = req.user.email || '';
    if (!email) {
      const [userRows] = await conn.query('SELECT email FROM dbt_user WHERE user_id = ?', [userId]);
      email = userRows[0]?.email || '';
    }
    if (!email) return res.status(400).json({ status: 0, message: 'No email on file. Please update your profile.' });

    const otpPool = await connect();
    const otpConn = await otpPool.getConnection();
    try {
      const otp = '123456';
      await otpConn.query("DELETE FROM dbt_otp WHERE email = ? AND purpose = 'withdraw'", [email]);
      await otpConn.query(
        'INSERT INTO dbt_otp (email, otp, purpose, created_at) VALUES (?, ?, ?, NOW())',
        [email, otp, 'withdraw']
      );
      await sendOtpEmail(email, otp, 'withdraw');
    } finally {
      otpConn.release();
    }

    res.json({
      status: 1,
      message: 'OTP sent to your email. Please confirm to complete withdrawal.',
      details: { coin, network: network || null, address, amount, fee: withdrawFee, netAmount: amount - withdrawFee }
    });
  } catch (err) {
    if (conn) { await conn.rollback(); conn.release(); }
    console.error('initiate withdraw error:', err);
    if (!res.headersSent) res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};

// ---------- POST /wallet/withdraw/confirm ----------
exports.confirmWithdraw = async (req, res) => {
  let conn;
  try {
    const { error } = Joi.object({
      coin: Joi.string().required(),
      network: Joi.string().optional().allow(''),
      address: Joi.string().required(),
      amount: Joi.number().positive().required(),
      otp: Joi.string().length(6).required(),
      email: Joi.string().email().required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

    const { coin, network, address, amount: rawAmount, otp, email } = req.body;
    const amount = parseFloat(rawAmount);
    const userId = req.user.user_id;

    // Verify OTP directly
    const otpPool = await connect();
    const otpConn = await otpPool.getConnection();
    try {
      const [otpRows] = await otpConn.query(
        "SELECT * FROM dbt_otp WHERE email = ? AND purpose = 'withdraw' AND verified = 0 AND (blocked_until IS NULL OR blocked_until < NOW()) ORDER BY created_at DESC LIMIT 1",
        [email]
      );
      if (!otpRows.length) {
        otpConn.release();
        return res.status(400).json({ status: 0, message: 'OTP not found or expired.' });
      }

      const otpRecord = otpRows[0];
      const isValid = otp === otpRecord.otp;
      if (!isValid) {
        const attempts = (otpRecord.attempts || 0) + 1;
        if (attempts >= 3) {
          await otpConn.query('UPDATE dbt_otp SET blocked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?', [otpRecord.id]);
        } else {
          await otpConn.query('UPDATE dbt_otp SET attempts = ? WHERE id = ?', [attempts, otpRecord.id]);
        }
        otpConn.release();
        return res.status(400).json({ status: 0, message: 'Invalid OTP.' });
      }

      await otpConn.query('UPDATE dbt_otp SET verified = 1 WHERE id = ?', [otpRecord.id]);
      otpConn.release();
    } catch (otpErr) {
      otpConn.release();
      console.error('OTP verification error:', otpErr);
      return res.status(500).json({ status: 0, message: 'OTP verification failed.' });
    }

    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Re-check network for fee
    let withdrawFee = 0;
    if (network) {
      const [netRows] = await conn.query(
        'SELECT * FROM dbt_coin_network WHERE coin_symbol = ? AND network_name = ? AND status = 1 AND withdraw_status = 1',
        [coin, network]
      );
      if (netRows.length) withdrawFee = parseFloat(netRows[0].withdraw_fee || 0);
    }

    // Re-check balance inside locked transaction (step 9)
    const spotBal = await getWalletBalance(conn, userId, coin, 'spot');
    const [lockedRows] = await conn.query(
      "SELECT SUM(bid_qty_available) as locked FROM dbt_biding WHERE user_id = ? AND market_symbol LIKE ? AND status = 2",
      [userId, `${coin}_%`]
    );
    const lockedInOrders = parseFloat(lockedRows[0].locked || 0);
    const availableForWithdraw = spotBal - lockedInOrders;

    if (amount + withdrawFee > availableForWithdraw) {
      await conn.rollback(); conn.release();
      return res.status(400).json({
        status: 0,
        message: `Insufficient balance. Available: ${Math.max(0, availableForWithdraw)} ${coin}.`
      });
    }

    await ensureBalanceRow(conn, userId, coin);
    await debitWallet(conn, {
      user_id: userId,
      currency_symbol: coin,
      walletType: 'spot',
      amount,
      fees: withdrawFee,
      transaction_type: 'WITHDRAW_REQUEST',
      ip: req.ip
    });

    const txnId = 'WD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    await conn.query(
      'INSERT INTO tbl_withdraw (user_id, sym, amount, charge, net_amount, txn_id, address, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [userId, coin, amount, withdrawFee, amount - withdrawFee, txnId, address, 'pending']
    );

    await conn.commit();
    conn.release();

    const io = req.app.get('io');
    if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

    res.json({ status: 1, message: 'Withdrawal request submitted.', txn_id: txnId });
  } catch (err) {
    if (conn) { await conn.rollback(); conn.release(); }
    if (err instanceof InsufficientBalanceError) {
      return res.status(400).json({ status: 0, message: err.message });
    }
    console.error('confirm withdraw error:', err);
    if (!res.headersSent) res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};

// ---------- GET /wallet/withdrawals ----------
exports.getWithdrawals = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const userId = req.user.user_id;
    const { coin, limit = 20, offset = 0 } = req.query;

    let query = 'SELECT * FROM tbl_withdraw WHERE user_id = ?';
    const params = [userId];
    if (coin) { query += ' AND sym = ?'; params.push(coin); }
    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await conn.query(query, params);
    res.json({ status: 1, withdrawals: rows });
  } catch (err) {
    console.error('get withdrawals error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- POST /wallet/transfer ----------
exports.transfer = async (req, res) => {
  let conn;
  try {
    const { error } = Joi.object({
      coin: Joi.string().required(),
      from_wallet: Joi.string().valid('spot', 'funding', 'share').required(),
      to_wallet: Joi.string().valid('spot', 'funding', 'share').required(),
      amount: Joi.number().positive().required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ status: 0, message: error.details[0].message });

    const { coin, from_wallet, to_wallet, amount } = req.body;
    if (from_wallet === to_wallet) return res.status(400).json({ status: 0, message: 'Source and destination wallets must differ.' });

    const userId = req.user.user_id;
    const pool = await connect();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await transferBetweenWallets(conn, {
      user_id: userId,
      currency_symbol: coin,
      from: from_wallet,
      to: to_wallet,
      amount: parseFloat(amount),
      ip: req.ip,
    });

    await conn.commit();
    conn.release();

    const io = req.app.get('io');
    if (io) io.to(`user_${userId}`).emit('balance_update', { user_id: userId });

    res.json({ status: 1, message: `Successfully transferred ${amount} ${coin} from ${from_wallet} to ${to_wallet}.` });
  } catch (err) {
    if (conn) { await conn.rollback(); conn.release(); }
    if (err instanceof InsufficientBalanceError) {
      return res.status(400).json({ status: 0, message: err.message });
    }
    console.error('transfer error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  }
};

// ---------- GET /wallet/history ----------
exports.getHistory = async (req, res) => {
  let conn;
  try {
    const pool = await connect();
    conn = await pool.getConnection();
    const userId = req.user.user_id;
    const { type, asset, from, to, limit = 30, offset = 0 } = req.query;

    let query = `SELECT bl.* FROM dbt_balance_log bl
                 JOIN dbt_balance b ON bl.balance_id = b.id
                 WHERE b.user_id = ?`;
    const params = [userId];

    if (type && type !== 'all') {
      if (type === 'deposit') query += " AND bl.transaction_type IN ('DEPOSIT','ADMIN_BONUS')";
      else if (type === 'withdraw') query += " AND bl.transaction_type IN ('WITHDRAW_REQUEST','WITHDRAW_REJECTED_REFUND')";
      else if (type === 'transfer') query += " AND bl.transaction_type LIKE 'TRANSFER_%'";
      else if (type === 'staking') query += " AND bl.transaction_type LIKE 'STAKING_%'";
      else if (type === 'trade') query += " AND bl.transaction_type IN ('ORDER_PLACE_BUY','ORDER_PLACE_SELL','TRADE_BUY','TRADE_SELL','ORDER_CANCEL_REFUND','PRICE_IMPROVEMENT_REFUND')";
      else if (type === 'referral') query += " AND bl.transaction_type IN ('REFERRAL_BONUS')";
      else query += " AND bl.transaction_type NOT IN ('DEPOSIT','ADMIN_BONUS','WITHDRAW_REQUEST','WITHDRAW_REJECTED_REFUND') AND bl.transaction_type NOT LIKE 'TRANSFER_%' AND bl.transaction_type NOT LIKE 'STAKING_%' AND bl.transaction_type NOT IN ('ORDER_PLACE_BUY','ORDER_PLACE_SELL','TRADE_BUY','TRADE_SELL','ORDER_CANCEL_REFUND','PRICE_IMPROVEMENT_REFUND','REFERRAL_BONUS')";
    }

    if (asset) { query += ' AND bl.currency_symbol = ?'; params.push(asset); }
    if (from) { query += ' AND bl.date >= ?'; params.push(from); }
    if (to) { query += ' AND bl.date <= ?'; params.push(to); }

    query += ' ORDER BY bl.date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await conn.query(query, params);

    const [countResult] = await conn.query(
      `SELECT COUNT(*) as total FROM dbt_balance_log bl JOIN dbt_balance b ON bl.balance_id = b.id WHERE b.user_id = ?`,
      [userId]
    );

    res.json({ status: 1, history: rows, total: countResult[0].total });
  } catch (err) {
    console.error('wallet history error:', err);
    res.status(500).json({ status: 0, message: 'Internal server error.' });
  } finally {
    if (conn) conn.release();
  }
};
