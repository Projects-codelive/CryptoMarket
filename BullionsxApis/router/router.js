const express = require('express');
const router = express.Router();
const auth=require('../middleware/auth');
const createUser = require('../controller/register');
const { loginUser } = require('../controller/Login');
const { sendOtp, verifyOtp } = require('../controller/otp');
const { resetPassword } = require('../controller/resetPassword');
const { getcoin } = require('../controller/userdata');
const { getcryptocoin } = require('../controller/userdata');
const { coinhistory } = require('../controller/userdata');
const { openorder } = require('../controller/userdata');
const { openbuyorder } = require('../controller/userdata');
const { opensellorder } = require('../controller/userdata');
const { openorderst1 } = require('../controller/userdata');
const { openorderst2 } = require('../controller/userdata');
const { openorderst3 } = require('../controller/userdata');
const { openorderst4, openorderst5, insertdata, getMe, getBalance, getHoldings, getLeaderboard, getPortfolio } = require('../controller/userdata');
const { placeBuyOrder, placeSellOrder, cancelOrder } = require('../controller/orderEngine');

const {
    getOrderBookStats,
    getMarketTrades,
    getMyTrades,
    getOpenOrders,
    getOrderHistory,
    getHoldingsDetailed,
    getUserBalance,
    getLatestPrice,
    getCandleHistory,
    getRealizedPnl,
    getCancelledOrders,
} = require('../controller/userdata');
const { adminLogin } = require('../controller/adminLogin');

router
    .route('/send-otp')
    .post(sendOtp);

router
    .route('/verify-otp')
    .post(verifyOtp);

router
    .route('/reset-password')
    .post(resetPassword);

router
    .route('/create')
    .post(createUser);


router
    .route('/login')
    .post(loginUser);

router
    .route('/api/v1/admin/login')
    .post(adminLogin);


router
    .route('/me')
    .get(auth, getMe);


router
    .route('/balance')
    .get(getBalance);


router
    .route('/holdings')
    .get(getHoldings);


router
    .route('/leaderboard')
    .get(getLeaderboard);


router
    .route('/markets')
    .get(auth,getcoin);


router
    .route('/currency_symbols')
    .get(getcryptocoin);


router
    .route('/coin_history')
    .get(coinhistory);


router
    .route('/openorder')
    .get(openorder);


router
    .route('/openbuyorder')
    .get(openbuyorder);


router
    .route('/opensellorder')
    .get(opensellorder);

router
    .route('/completed_orders')
    .get(openorderst1);

router
    .route('/user_completed_order_history')
    .get(openorderst2);

router
    .route('/all_user_completed_orders')
    .get(openorderst3);


router
    .route('/user_open_orders')
    .get(openorderst4);


router
    .route('/user_all_open_orders')
    .get(openorderst5);


router
    .route('/insertdata')
    .post(insertdata);


router
    .route('/buyorder')
    .post(auth, placeBuyOrder);

router
    .route('/sellorder')
    .post(auth, placeSellOrder);

router
    .route('/cancelorder')
    .post(auth, cancelOrder);

router
    .route('/portfolio')
    .get(getPortfolio);

router
    .route('/orderbook-stats')
    .get(getOrderBookStats);

router
    .route('/market-trades')
    .get(getMarketTrades);

router
    .route('/my-trades')
    .get(auth, getMyTrades);

router
    .route('/open-orders')
    .get(auth, getOpenOrders);

router
    .route('/order-history')
    .get(auth, getOrderHistory);

router
    .route('/holdings-detailed')
    .get(getHoldingsDetailed);

router
    .route('/user-balance')
    .get(getUserBalance);

router
    .route('/latest-price')
    .get(getLatestPrice);

router
    .route('/candle-history')
    .get(getCandleHistory);

router
    .route('/realized-pnl')
    .get(getRealizedPnl);

router
    .route('/cancelled-orders')
    .get(auth, getCancelledOrders);

const stakingRouter = require('./staking');

const { getProfile, updateProfile, getKyc, saveKyc, getBankDetails, saveBankDetails } = require('../controller/profile');

router
    .route('/profile')
    .get(auth, getProfile)
    .put(auth, updateProfile);
router
  .route('/api/v1/kyc')
  .get(auth, getKyc)
  .post(auth, saveKyc);
 
router
  .route('/api/v1/bank-details')
  .get(auth, getBankDetails)
  .post(auth, saveBankDetails);
     

const { getBalanceStats } = require('../controller/balanceStats');

router
    .route('/balance-stats')
    .get(auth, getBalanceStats);

router.use('/api/v1/staking', stakingRouter);

const wallet = require('../controller/wallet');
const adminWithdraw = require('../controller/adminWithdraw');
const adminAuth = require('../middleware/adminAuth');

router
  .route('/api/v1/wallet/overview')
  .get(auth, wallet.getOverview);

router
  .route('/api/v1/wallet/coin/:symbol')
  .get(auth, wallet.getCoinDetail);

router
  .route('/api/v1/wallet/deposit-address')
  .get(auth, wallet.getDepositAddress);

router
  .route('/api/v1/wallet/deposits')
  .get(auth, wallet.getDeposits);

router
  .route('/api/v1/wallet/withdraw/initiate')
  .post(auth, wallet.initiateWithdraw);

router
  .route('/api/v1/wallet/withdraw/confirm')
  .post(auth, wallet.confirmWithdraw);

router
  .route('/api/v1/wallet/withdrawals')
  .get(auth, wallet.getWithdrawals);

router
  .route('/api/v1/wallet/transfer')
  .post(auth, wallet.transfer);

router
  .route('/api/v1/wallet/history')
  .get(auth, wallet.getHistory);

// Admin withdrawal management
router
  .route('/api/v1/admin/withdrawals')
  .get(auth, adminAuth, adminWithdraw.getWithdrawals);

router
  .route('/api/v1/admin/withdrawal/:id/approve')
  .patch(auth, adminAuth, adminWithdraw.approveWithdrawal);

router
  .route('/api/v1/admin/withdrawal/:id/reject')
  .patch(auth, adminAuth, adminWithdraw.rejectWithdrawal);

// Dev: credit funds (no auth — dev only)
const connect = require('../config/Mysqlcon');
router.get('/api/v1/dev/credit/:user_id/:currency/:amount', async (req, res) => {
  try {
    const { user_id, currency, amount } = req.params;
    if (!user_id || !currency || !amount) {
      return res.status(400).json({ message: 'user_id, currency, amount required' });
    }
    const conn = await connect();
    await conn.query(
      'INSERT INTO dbt_balance (user_id, currency_symbol, balance, sharewallet, fundwallet) VALUES (?, ?, ?, 0, 0) ON DUPLICATE KEY UPDATE balance = balance + ?',
      [user_id, currency, parseFloat(amount), parseFloat(amount)]
    );
    res.json({ message: `Credited ${amount} ${currency} to ${user_id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug: check DB state
router
  .route('/api/v1/debug/db-check')
  .get(async (_req, res) => {
    try {
      const pool = await connect();
      const conn = await pool.getConnection();
      const [networks] = await conn.query('SELECT * FROM dbt_coin_network');
      const [cols] = await conn.query("SHOW COLUMNS FROM dbt_coin_network");
      const [cryptoCols] = await conn.query("SHOW COLUMNS FROM dbt_cryptocoin");
      const [withdrawCols] = await conn.query("SHOW COLUMNS FROM tbl_withdraw");
      const [pendingWithdrawals] = await conn.query("SELECT COUNT(*) AS cnt FROM tbl_withdraw WHERE status = 'pending'");
      const [totalWithdrawals] = await conn.query('SELECT COUNT(*) AS cnt FROM tbl_withdraw');
      const [adminUsers] = await conn.query("SELECT user_id, email, is_admin FROM dbt_user WHERE is_admin = 1");
      // Test the exact admin query
      const [adminQueryTest] = await conn.query(
        'SELECT w.*, u.first_name, u.last_name, u.email FROM tbl_withdraw w LEFT JOIN dbt_user u ON w.user_id = u.user_id COLLATE utf8mb4_general_ci WHERE w.status = ? ORDER BY w.date DESC LIMIT 5',
        ['pending']
      );
      const [bidingLogCount] = await conn.query('SELECT COUNT(*) AS cnt FROM dbt_biding_log');
      const [bidingLogRows] = await conn.query('SELECT log_id, bid_type, bid_price, complete_qty, market_symbol, success_time FROM dbt_biding_log ORDER BY log_id DESC LIMIT 20');
      const [openOrderCount] = await conn.query("SELECT COUNT(*) AS cnt FROM dbt_biding WHERE status = 2");
      conn.release();
      res.json({
        dbt_cryptocoin_columns: cryptoCols.map(c => c.Field),
        tbl_withdraw_columns: withdrawCols.map(c => c.Field),
        dbt_coin_network_columns: cols.map(c => c.Field),
        dbt_coin_network_data: networks,
        pending_withdrawals: pendingWithdrawals[0].cnt,
        total_withdrawals: totalWithdrawals[0].cnt,
        admin_users: adminUsers,
        admin_query_test: adminQueryTest,
        dbt_biding_log_count: bidingLogCount[0].cnt,
        dbt_biding_log_recent: bidingLogRows,
        dbt_biding_open_orders: openOrderCount[0].cnt
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;
