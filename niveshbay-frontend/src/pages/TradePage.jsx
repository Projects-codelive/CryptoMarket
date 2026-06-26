import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import OrderBook from '../components/orderbook/OrderBook';
import TradingChart from '../components/chart/TradingChart';
import ErrorBoundary from '../components/ErrorBoundary';
import PriceHeader from '../components/common/PriceHeader';
import TradingPanel from '../components/trading/TradingPanel';
import BottomTabs from '../components/bottom/BottomTabs';
import { usePortfolio } from '../hooks/usePortfolio';
import { useMarketData } from '../hooks/useMarketData';

export default function TradePage() {
  const { symbol: paramSymbol } = useParams();
  const symbol = paramSymbol || 'SOL-INR';
  const { balance, orderHistory } = usePortfolio();
  const { activeCoin, livePrice } = useMarketData(symbol);
  const [sellFormFillData, setSellFormFillData] = useState(null);

  const currentPrice = livePrice?.price || activeCoin?.price || 5741.94;

  const portfolioValue = useMemo(() => {
    const bal = parseFloat(balance || 0);
    return bal || 0;
  }, [balance]);

  const realizedPnl = useMemo(() => {
    return (orderHistory || []).reduce((sum, o) => {
      return sum + parseFloat(o.complete_amount || o.amount || 0);
    }, 0);
  }, [orderHistory]);

  const handleSellFormFill = (data) => {
    setSellFormFillData({ ...data, _ts: Date.now() });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b0f19] text-white">
      <Navbar balance={balance} portfolioValue={portfolioValue} realizedPnl={realizedPnl} />
      <PriceHeader symbol={symbol} />

      <div className="flex flex-1 overflow-hidden">
        <OrderBook symbol={symbol} onSellFormFill={handleSellFormFill} />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          <div className="flex-1 min-h-[350px]">
            <ErrorBoundary>
              <TradingChart symbol={symbol} />
            </ErrorBoundary>
          </div>

          <TradingPanel symbol={symbol} currentPrice={currentPrice} sellFormFillData={sellFormFillData} />

          <BottomTabs symbol={symbol} />
        </div>

        <Sidebar symbol={symbol} />
      </div>
    </div>
  );
}
