import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axiosInstance';
import { useSocket } from '../context/SocketContext';

export function useOrderBook(symbol) {
  const normalizedSymbol = symbol ? symbol.replace(/[_/]/g, '-') : 'SOL-USDT';
  const dbSymbol = normalizedSymbol.replace(/-/g, '_');
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastTradePrice, setLastTradePrice] = useState(0);
  const { orderBookUpdates, subscribeMarket, unsubscribeMarket, connected } = useSocket() || {};
  const subscribedRef = useRef(false);

  const fetchOrderBook = useCallback(async () => {
    try {
      const [buyRes, sellRes, priceRes] = await Promise.all([
        api.get('/openbuyorder', { params: { market_symbol: dbSymbol } }),
        api.get('/opensellorder', { params: { market_symbol: dbSymbol } }),
        api.get('/latest-price', { params: { market_symbol: dbSymbol } }).catch(() => null),
      ]);

      const buyOrders = (buyRes.data || []).map(o => ({
        price: parseFloat(o.bid_price || o.price),
        amount: parseFloat(o.bid_qty_available || o.bid_qty || o.volume || 0),
        total: parseFloat(o.bid_price || o.price) * parseFloat(o.bid_qty_available || o.bid_qty || 0),
      }));

      const sellOrders = (sellRes.data || []).map(o => ({
        price: parseFloat(o.bid_price || o.price),
        amount: parseFloat(o.bid_qty_available || o.bid_qty || o.volume || 0),
        total: parseFloat(o.bid_price || o.price) * parseFloat(o.bid_qty_available || o.bid_qty || 0),
      }));

      setBids(buyOrders);
      setAsks(sellOrders);
      setLoading(false);

      if (priceRes?.data?.last_trade_price) {
        setLastTradePrice(parseFloat(priceRes.data.last_trade_price));
      }
    } catch {
      setLoading(false);
    }
  }, [dbSymbol]);

  useEffect(() => {
    setLoading(true);
    fetchOrderBook();

    if (connected && !subscribedRef.current) {
      subscribeMarket(dbSymbol);
      subscribedRef.current = true;
    }

    return () => {
      if (subscribedRef.current) {
        unsubscribeMarket(dbSymbol);
        subscribedRef.current = false;
      }
    };
  }, [dbSymbol, connected, fetchOrderBook, subscribeMarket, unsubscribeMarket]);

  useEffect(() => {
    if (orderBookUpdates && orderBookUpdates.market_symbol === dbSymbol) {
      const buyOrders = (orderBookUpdates.buy_orders || []).map(o => ({
        price: parseFloat(o.bid_price),
        amount: parseFloat(o.total_qty),
        total: parseFloat(o.bid_price) * parseFloat(o.total_qty),
      }));
      const sellOrders = (orderBookUpdates.sell_orders || []).map(o => ({
        price: parseFloat(o.bid_price),
        amount: parseFloat(o.total_qty),
        total: parseFloat(o.bid_price) * parseFloat(o.total_qty),
      }));
      setBids(buyOrders);
      setAsks(sellOrders);
      if (orderBookUpdates.last_trade_price) {
        setLastTradePrice(parseFloat(orderBookUpdates.last_trade_price));
      }
    }
  }, [orderBookUpdates, dbSymbol]);

  return {
    bids,
    asks,
    lastTradePrice,
    isLoading: loading,
  };
}