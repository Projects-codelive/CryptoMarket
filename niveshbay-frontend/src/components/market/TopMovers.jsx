import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../utils/formatCurrency';

const TOP_MOVERS = [
  { symbol: 'BTC-USDT', price: 64000, change: 1.58 },
  { symbol: 'ETH-USDT', price: 3500, change: 2.16 },
  { symbol: 'SOL-USDT', price: 68, change: -2.43 },
  { symbol: 'XRP-USDT', price: 0.58, change: -2.05 },
];

export default function TopMovers() {
  const navigate = useNavigate();

  return (
    <div className="px-3 py-2 border-t border-[#2b2f36]">
      <h4 className="text-xs text-[#848e9c] font-medium mb-2">Top Movers</h4>
      <div className="space-y-1">
        {TOP_MOVERS.map(coin => (
          <div
            key={coin.symbol}
            onClick={() => navigate(`/trade/${coin.symbol}`)}
            className="flex items-center justify-between py-1 cursor-pointer hover:bg-[#1e2329] px-1 rounded text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{coin.symbol.split('-')[0]}</span>
              <span className="text-[#848e9c]">/USDT</span>
            </div>
            <div className="text-right">
              <p className="text-white">{formatINR(coin.price)}</p>
              <span className={coin.change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {coin.change >= 0 ? '+' : ''}{coin.change}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
