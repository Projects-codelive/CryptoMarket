import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import OrderBook from '../components/orderbook/OrderBook';
import TradingChart from '../components/chart/TradingChart';
import ErrorBoundary from '../components/ErrorBoundary';
import PriceHeader from '../components/common/PriceHeader';
import TradingPanel from '../components/trading/TradingPanel';
import BottomTabs from '../components/bottom/BottomTabs';
import { usePortfolio } from '../hooks/usePortfolio';
import { useBalanceStats } from '../hooks/useBalanceStats';
import { useMarketData } from '../hooks/useMarketData';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function TradePage() {
  const { symbol: paramSymbol } = useParams();
  const symbol = paramSymbol || 'SOL-USDT';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance, orderHistory, refreshBalance, refreshOrderHistory } = usePortfolio();
  const { stats } = useBalanceStats();
  const { coins, activeCoin, isLoading } = useMarketData(symbol);
  const { balanceUpdate } = useSocket() || {};

  useEffect(() => {
    if (!isLoading && coins.length > 0 && !activeCoin) {
      const defaultPair = coins[0]?.market_symbol;
      if (defaultPair) {
        navigate(`/trade/${defaultPair}`, { replace: true });
      }
    }
  }, [isLoading, coins, activeCoin, navigate]);

  useEffect(() => {
    if (balanceUpdate && balanceUpdate.user_id === (user?.user_id || user?.id)) {
      refreshBalance();
      refreshOrderHistory();
    }
  }, [balanceUpdate, user, refreshBalance, refreshOrderHistory]);
  const [sellFormFillData, setSellFormFillData] = useState(null);
  const [buyFormFillData, setBuyFormFillData] = useState(null);

  const currentPrice = activeCoin?.price || 0;

  const portfolioValue = stats?.total_portfolio_value || 0;

  const realizedPnl = stats?.realized_pnl || 0;

  const handleSellFormFill = (data) => {
    setSellFormFillData({ ...data, _ts: Date.now() });
  };

  const handleBuyFormFill = (data) => {
    setBuyFormFillData({ ...data, _ts: Date.now() });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b0f19] text-white">
      <Navbar balance={balance} portfolioValue={portfolioValue} realizedPnl={realizedPnl} />
      <PriceHeader symbol={symbol} />

      <div className="flex flex-1 overflow-hidden">
        <OrderBook symbol={symbol} onSellFormFill={handleSellFormFill} onBuyFormFill={handleBuyFormFill} />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 min-h-[350px]">
            <ErrorBoundary>
              <TradingChart symbol={symbol} />
            </ErrorBoundary>
          </div>

          <TradingPanel symbol={symbol} currentPrice={currentPrice} sellFormFillData={sellFormFillData} buyFormFillData={buyFormFillData} />

          <BottomTabs symbol={symbol} />
        </div>

        <Sidebar symbol={symbol} />
      </div>
    </div>
  );
}
