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

const { getProfile, updateProfile } = require('../controller/profile');

router
    .route('/profile')
    .get(auth, getProfile)
    .put(auth, updateProfile);

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

// Debug: check DB state
const connect = require('../config/Mysqlcon');
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
      conn.release();
      res.json({
        dbt_cryptocoin_columns: cryptoCols.map(c => c.Field),
        tbl_withdraw_columns: withdrawCols.map(c => c.Field),
        dbt_coin_network_columns: cols.map(c => c.Field),
        dbt_coin_network_data: networks
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;
