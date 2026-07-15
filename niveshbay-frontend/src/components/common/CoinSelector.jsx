import { useNavigate } from 'react-router-dom';
import { useMarketData } from '../../hooks/useMarketData';

export default function CoinSelector({ symbol, onSelect }) {
  const { coins } = useMarketData(symbol);
  const navigate = useNavigate();

  const pair = symbol ? symbol.replace(/[_/]/g, '-') : 'SOL-INR';
  const [base, quote] = pair.split('-');

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2329] rounded cursor-pointer hover:bg-[#2b2f36]"
      onClick={() => {
        const s = prompt('Enter symbol (e.g. BTC-INR):', pair);
        if (s) navigate(`/trade/${s.toUpperCase()}`);
      }}
    >
      <div className="w-6 h-6 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-xs font-bold text-[#f0b90b]">
        {base?.[0] || 'S'}
      </div>
      <span className="text-white text-sm font-medium">{base}/{quote}</span>
    </div>
  );
}
