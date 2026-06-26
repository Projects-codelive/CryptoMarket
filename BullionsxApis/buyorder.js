const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// MySQL connection
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'yourpassword',
  database: 'yourdb'
});

app.post('/buyorder', async (req, res) => {
  const connection = con.promise();
  const body = req.body;

  try {
    const coinSymbol = body.market.split('_');
    const marketSymbol = body.market;
    const rate = parseFloat(body.buypricing);
    const qty = parseFloat(body.buyamount);
    const userId = body.user_id;

    if (!marketSymbol || !rate || !qty || !userId) {
      let empty;
      if (!qty) empty = 'Quantity Required';
      else if (!rate) empty = 'Price Required';
      else if (!marketSymbol) empty = 'Market Symbol Required';
      else if (!userId) empty = 'Userid Required';
      return res.json({ status: 0, message: empty });
    }

    const market = coinSymbol[1];
    const currencySymbol = coinSymbol[0];

    // BUY fees
    const [buyFeesRow] = await connection.query(
      "SELECT * FROM dbt_fees WHERE level='BUY' AND currency_symbol=?",
      [market]
    );
    const buyFees = buyFeesRow[0]?.fees || 0;
    const feesAmount = (rate * qty * buyFees) / 100;

    // SELL fees
    const [sellFeesRow] = await connection.query(
      "SELECT * FROM dbt_fees WHERE level='SELL' AND currency_symbol=?",
      [market]
    );
    const sellFees = sellFeesRow[0]?.fees || 0;

    const amountWithoutFees = rate * qty;
    const amountWithFees = amountWithoutFees + feesAmount;

    // Balance check
    const [balanceC1Row] = await connection.query(
      "SELECT * FROM dbt_balance WHERE user_id=? AND currency_symbol=?",
      [userId, market]
    );
    const balanceC1 = balanceC1Row[0]?.balance || 0;

    if (balanceC1 >= amountWithFees && balanceC1 > 0 && amountWithFees > 0) {
      const openDate = new Date();

      // Insert trade
      const [insertResult] = await connection.query(
        `INSERT INTO dbt_biding 
        (bid_type, bid_price, bid_qty, bid_qty_available, total_amount, amount_available, currency_symbol, market_symbol, user_id, open_order, fees_amount, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'BUY',
          rate,
          qty,
          qty,
          amountWithoutFees,
          amountWithoutFees,
          currencySymbol,
          marketSymbol,
          userId,
          openDate,
          feesAmount,
          2
        ]
      );

      const exchangeId = insertResult.insertId;
      if (!exchangeId) {
        return res.json({ status: 0, message: 'Error! Try again' });
      }

      // Deduct buyer balance
      const updateBalance = balanceC1 - (amountWithoutFees + feesAmount);
      await connection.query(
        "UPDATE dbt_balance SET balance=? WHERE user_id=? AND currency_symbol=?",
        [updateBalance, userId, market]
      );

      // === SELL order update ===
      await connection.query(
        "UPDATE dbt_biding SET bid_qty_available=?, amount_available=?, status=? WHERE id=?",
        [seller_available_qty, seller_amount_available, exchangeselldatastatus, sellexchangeid]
      );

      // === Adjustment logic ===
      if (last_exchangebid_price > sellexchangebid_price) {
        const totalExchangeQty = buyer_complete_qty_log;
        const buyRemainingRate = last_exchangebid_price - sellexchangebid_price;
        const buyerBalance = buyRemainingRate * totalExchangeQty;

        let returnFees = 0;
        const buyerFees = (totalExchangeQty * last_exchangebid_price * buyFees) / 100;
        const sellerFees = (totalExchangeQty * sellexchangebid_price * sellFees) / 100;
        const buyerReturnFees = buyerFees - sellerFees;
        if (buyerReturnFees > 0) returnFees = buyerReturnFees;

        const buyerUserId = last_exchangeuser_id;
        const [balanceRow] = await connection.query(
          "SELECT * FROM dbt_balance WHERE user_id=? AND currency_symbol=?",
          [buyerUserId, market]
        );
        const updateBalance1 = balanceRow[0]?.balance || 0;
        const updateBalance1Id = balanceRow[0]?.id;
        const updateBalanceReturn = updateBalance1 + buyerBalance + returnFees;

        await connection.query(
          "UPDATE dbt_balance SET balance=? WHERE user_id=? AND currency_symbol=?",
          [updateBalanceReturn, buyerUserId, market]
        );

        await connection.query(
          `INSERT INTO dbt_balance_log 
          (balance_id, user_id, currency_symbol, transaction_type, transaction_amount, transaction_fees, ip, date)
          VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?)`,
          [updateBalance1Id, buyerUserId, market, buyerBalance, returnFees, req.ip, new Date()]
        );
      }

      // === Buyer & Seller logs ===
      const dateTimeUTC = new Date(openDate.toISOString());
      const unix = Math.floor(dateTimeUTC.getTime() / 1000);

      const buyTraderLog = {
        bid_id: last_exchangeid,
        bid_type: last_exchangebid_type,
        complete_qty: buyer_complete_qty_log,
        bid_price: sellexchangebid_price,
        complete_amount: buyer_complete_qty_log * sellexchangebid_price,
        user_id: last_exchangeuser_id,
        currency_symbol: last_exchangecurrency_symbol,
        market_symbol: last_exchangemarket_symbol,
        success_time: openDate,
        success_time_utc: dateTimeUTC,
        success_time_unix: unix,
        fees_amount: last_exchangefees_amount,
        available_amount: buyer_amount_available_log,
        status:
          last_exchangeamount_available -
            last_exchangebid_qty_available * sellexchangebid_price <=
          0
            ? 1
            : 2,
      };
      await connection.query(
        `INSERT INTO dbt_biding_log (${Object.keys(buyTraderLog).join(",")}) VALUES (?)`,
        [Object.values(buyTraderLog)]
      );

      const sellTraderLog = {
        bid_id: sellexchangeid,
        bid_type: sellexchangebid_type,
        complete_qty: seller_complete_qty_log,
        bid_price: sellexchangebid_price,
        complete_amount: seller_complete_qty_log * sellexchangebid_price,
        user_id: sellexchangeuser_id,
        currency_symbol: sellexchangecurrency_symbol,
        market_symbol: sellexchangemarket_symbol,
        success_time: openDate,
        success_time_utc: dateTimeUTC,
        success_time_unix: unix,
        fees_amount: sellexchangefees_amount,
        available_amount: sellexchangebid_qty_available * sellexchangebid_price,
        status:
          sellexchangeamount_available -
            sellexchangebid_qty_available * sellexchangebid_price <=
          0
            ? 1
            : 2,
      };
      await connection.query(
        `INSERT INTO dbt_biding_log (${Object.keys(sellTraderLog).join(",")}) VALUES (?)`,
        [Object.values(sellTraderLog)]
      );

      // === Buyer balance update ===
      const [buyerBalanceRows] = await connection.query(
        "SELECT * FROM dbt_balance WHERE user_id=? AND currency_symbol=?",
        [last_exchangeuser_id, currencySymbol]
      );
      if (buyerBalanceRows.length === 0) {
        await connection.query(
          `INSERT INTO dbt_balance (user_id, currency_id, currency_symbol, balance, sharewallet, fundwallet) 
           VALUES (?, 0, ?, ?, 0, 0)`,
          [last_exchangeuser_id, currencySymbol, buyer_complete_qty_log]
        );
      } else {
        const buyerBalance = buyerBalanceRows[0].balance;
        const updateBuyerBalance = buyerBalance + buyer_complete_qty_log;
        await connection.query(
          "UPDATE dbt_balance SET balance=? WHERE user_id=? AND currency_symbol=?",
          [updateBuyerBalance, last_exchangeuser_id, currencySymbol]
        );
      }

      // === Seller balance update ===
      const [sellerBalanceRows] = await connection.query(
        "SELECT * FROM dbt_balance WHERE user_id=? AND currency_symbol=?",
        [sellexchangeuser_id, market]
      );
      if (sellerBalanceRows.length === 0) {
        const updatedSellerBalance =
          buyer_complete_qty_log * sellexchangebid_price - sellexchangefees_amount;
        await connection.query(
          `INSERT INTO dbt_balance (user_id, currency_symbol, balance, last_update) 
           VALUES (?, ?, ?, ?)`,
          [sellexchangeuser_id, market, updatedSellerBalance, openDate]
        );
      } else


       
       {
        const sellerBalance = sellerBalanceRows[0].balance;
        const updateSellerBalance =
          sellerBalance + buyer_complete_qty_log * sellexchangebid_price;
        await connection.query(
          "UPDATE dbt_balance SET balance=? WHERE user_id=? AND currency_symbol=?",
          [updateSellerBalance, sellexchangeuser_id, market]
        );
      }

      // === Market data (1h and 24h) ===
      const [h1HighRow] = await connection.query(
        "SELECT MAX(bid_price) AS bid_price FROM dbt_biding_log WHERE success_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND market_symbol=?",
        [last_exchangemarket_symbol]
      );
      const h1High = h1HighRow[0]?.bid_price || sellexchangebid_price;

      const [h1LowRow] = await connection.query(
        "SELECT MIN(bid_price) AS bid_price FROM dbt_biding_log WHERE success_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND market_symbol=?",
        [last_exchangemarket_symbol]
      );
      const h1Low = h1LowRow[0]?.bid_price || sellexchangebid_price;

      const [h1VolumeRow] = await connection.query(
        "SELECT SUM(complete_qty) AS complete_qty FROM dbt_biding_log WHERE bid_type='BUY' AND market_symbol=?",
        [last_exchangemarket_symbol]
      );
      const h1Volume = h1VolumeRow[0]?.complete_qty || 0;

      const [h24HighRow] = await connection.query(
        "SELECT MAX(bid_price) AS bid_price FROM dbt_biding_log WHERE success_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND market_symbol=?",
        [last_exchangemarket_symbol]
      );
      const h24High = h24HighRow[0]?.bid_price || sellexchangebid_price;

      const [h24LowRow] = await connection.query(
        "SELECT MIN(bid_price) AS bid_price FROM dbt_biding_log WHERE success_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND market_symbol=?",
        [last_exchangemarket_symbol]
      );
      const h24Low = h24LowRow[0]?.bid_price || sellexchangebid_price;

      const [h24VolumeRow] = await connection.query(
        "SELECT SUM(complete_qty) AS complete_qty FROM dbt_biding_log WHERE bid_type='BUY' AND market_symbol=?",
        [last_exchangemarket_symbol]
      );
      const h24Volume = h24VolumeRow[0]?.complete_qty || 0;

      const [lastPriceRow] = await connection.query(
        "SELECT last_price FROM dbt_coinhistory WHERE market_symbol=? ORDER BY id DESC LIMIT 1",
        [marketSymbol]
      );
      const lastPrice = lastPriceRow[0]?.last_price || sellexchangebid_price;

      const priceChange1h =
        sellexchangebid_price < lastPrice ? -(h1High - h1Low) : h1High - h1Low;
      const priceChange24h =
        sellexchangebid_price < lastPrice ? -(h24High - h24Low) : h24High - h24Low;

      // === Insert coin history ===
      const coinHistory = {
        coin_symbol: last_exchangecurrency_symbol,
        market_symbol: last_exchangemarket_symbol,
        last_price: sellexchangebid_price,
        total_coin_supply: buyer_complete_qty_log + h24Volume,
        price_high_1h: h1High,
        price_low_1h: h1Low,
        price_change_1h: priceChange1h,
        volume_1h: h1Volume,
        price_high_24h: h24High,
        price_low_24h: h24Low,
        price_change_24h: priceChange24h,
        volume_24h: h24Volume,
        open: last_exchangebid_price,
        close: sellexchangebid_price,
        volumefrom: buyer_complete_qty_log + h24Volume,
        volumeto: h24Volume,
        date: openDate,
      };

      await connection.query(
        `INSERT INTO dbt_coinhistory (${Object.keys(coinHistory).join(",")}) VALUES (?)`,
        [Object.values(coinHistory)]
      );

      // === Final response ===
      return res.json({ status: 1, message: "Trade Submitted successfully" });
    } else {
      return res.json({ status: 2, message: "Insufficient Balance" });
    }
  } catch (err) {
    console.error(err);
    return res.json({ status: 0, message: "Error! Try again" });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
