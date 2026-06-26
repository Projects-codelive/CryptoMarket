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
} = require('../controller/userdata');


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


module.exports = router;
