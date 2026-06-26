import { useMarketData } from '../../hooks/useMarketData';
import { formatINR } from '../../utils/formatCurrency';

export default function PriceHeader({ symbol }) {
  const { activeCoin, livePrice } = useMarketData(symbol);

  const price = livePrice?.price !== undefined ? livePrice.price : (activeCoin?.price || 0);
  const change = livePrice?.change !== undefined ? livePrice.change : (activeCoin?.change_24h || 0);
  const high = activeCoin?.high_24h || 0;
  const low = activeCoin?.low_24h || 0;
  const vol = activeCoin?.volume_24h || 0;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-[#0b0f19] border-b border-[#1e2433] text-xs">
      <span className="text-white font-bold text-sm">{symbol?.replace('-', '/')}</span>
      <span className={`text-lg font-bold ${isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
        {formatINR(price)}
      </span>
      <span className={`${isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
        {isPositive ? '+' : ''}{change?.toFixed(2)}%
      </span>
      <span className="text-[#848e9c]">24h High: <span className="text-white">{formatINR(high)}</span></span>
      <span className="text-[#848e9c]">24h Low: <span className="text-white">{formatINR(low)}</span></span>
      <span className="text-[#848e9c]">24h Vol: <span className="text-white">{vol?.toLocaleString('en-IN')}</span></span>
    </div>
  );
}
