import { useState, useEffect } from 'react';
import { formatAmount, formatINR } from '../../utils/formatCurrency';
import { placeSellOrder } from '../../api/orders';
import toast from 'react-hot-toast';

export default function SellForm({ symbol, currentPrice, baseBalance, user, onOrderPlaced, fillData, orderType }) {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [useTPSL, setUseTPSL] = useState(false);
  const [slider, setSlider] = useState(0);

  useEffect(() => {
    if (fillData) {
      setPrice(fillData.price?.toString() || '');
      setAmount(fillData.amount?.toFixed(4) || '');
      setSlider(0);
      return;
    }
    setPrice(currentPrice ? currentPrice.toString() : '');
    setAmount('');
    setSlider(0);
  }, [symbol, currentPrice, fillData]);

  const isMarket = orderType === 'market';
  const priceINR = isMarket ? (currentPrice || 5741.94) : (parseFloat(price) || currentPrice || 5741.94);
  const amountNum = parseFloat(amount) || 0;
  const totalINR = amountNum * priceINR;

  const coin = symbol?.split('-')[0] || 'SOL';

  function handleSlider(pct) {
    setSlider(pct);
    if (baseBalance > 0) {
      const amt = (pct / 100) * baseBalance;
      setAmount(amt.toFixed(4));
    }
  }

  async function handleSell() {
    if (!user || !amount || !symbol) return;
    try {
      const dbSymbol = symbol.replace('-', '_');

      const res = await placeSellOrder({
        market: dbSymbol,
        sellpricing: isMarket ? 'market' : priceINR.toString(),
        sellamount: amountNum.toString(),
      });

      if (res.status === 1) {
        toast.success('Sell order placed successfully');
        setAmount('');
        setPrice('');
        setSlider(0);
        if (onOrderPlaced) onOrderPlaced();
      } else {
        toast.error(res.message || 'Sell order failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sell order placement failed');
    }
  }

  return (
    <div className="flex-1 bg-[#141822] p-4 rounded-lg border border-[#1e2433] flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider">Sell {coin}</span>
          <p className="text-xs text-[#848e9c]">
            Avbl: <span className="text-[#f6465d] font-bold">{formatAmount(baseBalance)} {coin}</span>
          </p>
        </div>

        <div className="space-y-3">
          {!isMarket && (
            <div className="flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-xs focus-within:border-[#f6465d] transition">
              <span className="text-[#848e9c] w-14 font-semibold">Price</span>
              <input
                type="number"
                value={price}
                onChange={e => { setPrice(e.target.value); setSlider(0); }}
                placeholder={currentPrice?.toFixed(2) || '0.00'}
                className="flex-1 bg-transparent text-white text-right focus:outline-none pr-2 font-bold"
              />
              <span className="text-[#848e9c] font-semibold">INR</span>
            </div>
          )}

          <div className="flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-xs focus-within:border-[#f6465d] transition">
            <span className="text-[#848e9c] w-14 font-semibold">Amount</span>
            <input
              type="number"
              value={amount}
              onChange={e => {
                setAmount(e.target.value);
                setSlider(0);
              }}
              placeholder="0.00"
              className="flex-1 bg-transparent text-white text-right focus:outline-none pr-2 font-bold"
            />
            <span className="text-[#848e9c] uppercase font-semibold">{coin}</span>
          </div>

          <div className="py-2 px-1">
            <input
              type="range"
              min="0"
              max="100"
              step="25"
              value={slider}
              onChange={e => handleSlider(Number(e.target.value))}
              className="w-full accent-[#f6465d] h-1 bg-[#2b3548] rounded appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#848e9c] px-1 mt-1.5 font-bold">
              {[0, 25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => handleSlider(pct)}
                  className={`hover:text-white transition ${slider === pct ? 'text-[#f6465d]' : ''}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-xs focus-within:border-[#f6465d] transition">
            <span className="text-[#848e9c] w-14 font-semibold">Total</span>
            <span className="flex-1 text-white text-right font-bold pr-2">
              {totalINR > 0 ? formatINR(totalINR) : '0.00'}
            </span>
            <span className="text-[#848e9c] font-semibold">INR</span>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#848e9c] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useTPSL}
              onChange={e => setUseTPSL(e.target.checked)}
              className="accent-[#f6465d] w-3.5 h-3.5"
            />
            TP/SL
          </label>
        </div>
      </div>

      <button
        onClick={handleSell}
        disabled={amountNum <= 0 || !user}
        className="w-full bg-[#f6465d] hover:bg-[#ff5a72] disabled:bg-[#1e2433] disabled:text-[#848e9c] disabled:opacity-40 text-white font-bold py-3 rounded-lg text-sm transition mt-4 shadow-lg cursor-pointer"
      >
        {isMarket ? 'Market Sell' : 'Limit Sell'} {coin}
      </button>
    </div>
  );
}
