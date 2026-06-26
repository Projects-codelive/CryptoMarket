import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [prices, setPrices] = useState({});
  const [orderBookUpdates, setOrderBookUpdates] = useState(null);
  const [tradeUpdates, setTradeUpdates] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('price_update', (data) => {
      setPrices(prev => ({ ...prev, [data.pair]: data }));
    });

    socket.on('orderbook_update', (data) => {
      setOrderBookUpdates(data);
    });

    socket.on('market_trade', (data) => {
      setTradeUpdates(prev => [data, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribeMarket = useCallback((marketSymbol) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_market', marketSymbol);
    }
  }, []);

  const unsubscribeMarket = useCallback((marketSymbol) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe_market', marketSymbol);
    }
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      prices,
      orderBookUpdates,
      tradeUpdates,
      subscribeMarket,
      unsubscribeMarket,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
