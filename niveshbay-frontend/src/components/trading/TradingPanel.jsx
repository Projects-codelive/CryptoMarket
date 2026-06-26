import { useState, useCallback } from 'react';
import BuyForm from './BuyForm';
import SellForm from './SellForm';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../hooks/usePortfolio';

export default function TradingPanel({ symbol, currentPrice, sellFormFillData }) {
  const { user } = useAuth();
  const { balance, holdings, refreshBalance, refreshHoldings, refreshOpenOrders, refreshMyTrades } = usePortfolio();
  const [orderType, setOrderType] = useState('limit');

  const base = symbol?.split('-')[0] || 'SOL';

  const baseBalance = (holdings || [])
    .filter(h => h.currency_symbol === base)
    .reduce((acc, x) => acc + parseFloat(x.balance || 0), 0);

  const onOrderPlaced = useCallback(() => {
    refreshBalance();
    refreshHoldings();
    refreshOpenOrders();
    refreshMyTrades();
  }, [refreshBalance, refreshHoldings, refreshOpenOrders, refreshMyTrades]);

  return (
    <div className="border-t border-[#1e2433] bg-[#0d111b] select-none">
      <div className="flex items-center border-b border-[#1e2433] bg-[#0d111b] justify-between">
        <div className="flex">
          <span className="text-xs text-[#ffd333] px-4 py-2 border-b-2 border-[#ffd333] font-bold tracking-wide">
            Spot
          </span>
          {['Cross', 'Isolated', 'Grid'].map(t => (
            <span key={t} className="text-xs text-[#848e9c] px-4 py-2 hover:text-white cursor-pointer font-medium transition">
              {t}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-[#848e9c]/70 px-4 font-semibold hover:text-white cursor-pointer">% Fee Level</span>
      </div>

      <div className="flex border-b border-[#1e2433] bg-[#0d111b]">
        {['Limit', 'Market', 'Stop Limit'].map(t => {
          const key = t.toLowerCase().replace(' ', '_');
          const isActive = orderType === key;
          return (
            <button
              key={t}
              onClick={() => setOrderType(key)}
              className={`px-5 py-2 text-xs font-bold transition relative ${
                isActive ? 'text-white border-b-2 border-[#ffd333]' : 'text-[#848e9c] hover:text-white'
              }`}
            >
              {t} {t === 'Stop Limit' && '▼'}
            </button>
          );
        })}
      </div>

      <div className="flex p-3 gap-4 bg-[#0d111b]">
        <BuyForm
          symbol={symbol}
          currentPrice={currentPrice}
          balance={balance}
          user={user}
          onOrderPlaced={onOrderPlaced}
          orderType={orderType}
        />
        <SellForm
          key={sellFormFillData?._ts || 'default'}
          symbol={symbol}
          currentPrice={currentPrice}
          baseBalance={baseBalance}
          user={user}
          onOrderPlaced={onOrderPlaced}
          fillData={sellFormFillData}
          orderType={orderType}
        />
      </div>
    </div>
  );
}
