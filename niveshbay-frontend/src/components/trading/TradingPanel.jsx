import { useState, useCallback, useEffect } from 'react';
import BuyForm from './BuyForm';
import SellForm from './SellForm';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useSocket } from '../../context/SocketContext';
import { useMarketData } from '../../hooks/useMarketData';
import { getUserBalance } from '../../api/orders';

export default function TradingPanel({ symbol, currentPrice, sellFormFillData, buyFormFillData }) {
  const { user } = useAuth();
  const { refreshOpenOrders, refreshMyTrades } = usePortfolio();
  const { balanceUpdate } = useSocket() || {};
  const { activeCoin } = useMarketData(symbol);
  const [orderType, setOrderType] = useState('limit');
  const [coinBalance, setCoinBalance] = useState(0);
  const [inrBalance, setInrBalance] = useState(0);

  const base = activeCoin?.currency_symbol || symbol?.split(/[-_/]/)[0] || 'SOL';
  const quote = activeCoin?.quote_symbol || symbol?.split(/[-_/]/)[1] || 'INR';

  const loadBalances = useCallback(() => {
    if (!user) return;
    getUserBalance(user.user_id || user.id, base).then(r => {
      setCoinBalance(parseFloat(r.balance || 0));
    }).catch(() => {});
    getUserBalance(user.user_id || user.id, quote).then(r => {
      setInrBalance(parseFloat(r.balance || 0));
    }).catch(() => {});
  }, [user, base, quote]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  useEffect(() => {
    if (balanceUpdate && user && (balanceUpdate.user_id === (user.user_id || user.id))) {
      loadBalances();
    }
  }, [balanceUpdate, user, loadBalances]);

  const onOrderPlaced = useCallback(() => {
    refreshOpenOrders();
    refreshMyTrades();
    loadBalances();
  }, [refreshOpenOrders, refreshMyTrades, loadBalances]);

  return (
    <div className="border-t border-[#1e2433] bg-[#0d111b] select-none">
      <div className="flex items-center border-b border-[#1e2433] bg-[#0d111b] justify-between">
        <div className="flex">
          <span className="text-xs text-[#ffd333] px-4 py-2 border-b-2 border-[#ffd333] font-bold tracking-wide">
            Spot
          </span>
        </div>
      </div>

      <div className="flex border-b border-[#1e2433] bg-[#0d111b]">
        {['Limit', 'Market'].map(t => {
          const key = t.toLowerCase();
          const isActive = orderType === key;
          return (
            <button
              key={t}
              onClick={() => setOrderType(key)}
              className={`px-5 py-2 text-xs font-bold transition relative ${
                isActive ? 'text-white border-b-2 border-[#ffd333]' : 'text-[#848e9c] hover:text-white'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="flex p-3 gap-4 bg-[#0d111b]">
        <BuyForm
          symbol={symbol}
          currentPrice={currentPrice}
          balance={inrBalance}
          user={user}
          onOrderPlaced={onOrderPlaced}
          orderType={orderType}
          fillData={buyFormFillData}
          base={base}
          quote={quote}
        />
        <SellForm
          symbol={symbol}
          currentPrice={currentPrice}
          baseBalance={coinBalance}
          user={user}
          onOrderPlaced={onOrderPlaced}
          fillData={sellFormFillData}
          orderType={orderType}
          base={base}
          quote={quote}
        />
      </div>
    </div>
  );
}
