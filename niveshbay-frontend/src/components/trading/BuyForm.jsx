import { useState, useMemo, useEffect } from 'react';
import { formatINR } from '../../utils/formatCurrency';
import { placeBuyOrder } from '../../api/orders';
import toast from 'react-hot-toast';

export default function BuyForm({ symbol, currentPrice, balance, user, onOrderPlaced, orderType, fillData }) {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [slider, setSlider] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fillData) {
      setPrice(fillData.price?.toString() || '');
      setAmount(fillData.amount?.toFixed(4) || '');
      setSlider(0);
      return;
    }
    setPrice(currentPrice ? currentPrice.toString() : '');
  }, [symbol, currentPrice, fillData]);

  useEffect(() => {
    if (!fillData) {
      setAmount('');
      setSlider(0);
    }
  }, [symbol, fillData]);

  const isMarket = orderType === 'market';
  const priceINR = isMarket ? (currentPrice || 5741.94) : (parseFloat(price) || currentPrice || 5741.94);
  const amountNum = parseFloat(amount) || 0;
  const totalINR = amountNum * priceINR;
  const feeINR = totalINR * 0.001;
  const youPay = totalINR + feeINR;

  const coin = symbol?.split('-')[0] || 'SOL';

  function handleSlider(pct) {
    setSlider(pct);
    if (balance > 0 && priceINR > 0) {
      const targetINR = (pct / 100) * balance;
      const inclusivePrice = priceINR * 1.001;
      const amt = targetINR / inclusivePrice;
      setAmount(amt.toFixed(4));
    }
  }

  async function handleBuy() {
    if (!user || !amount || !symbol || submitting) return;
    setSubmitting(true);
    try {
      const dbSymbol = symbol.replace('-', '_');

      const res = await placeBuyOrder({
        market: dbSymbol,
        buypricing: isMarket ? '0' : priceINR.toString(),
        buyamount: amountNum.toString(),
        user_id: user.user_id || user.id,
        order_type: isMarket ? 'MARKET' : 'LIMIT',
      });

      if (res.status === 1) {
        toast.success('Buy order placed successfully');
        setAmount('');
        setSlider(0);
        if (onOrderPlaced) onOrderPlaced();
      } else {
        toast.error(res.message || 'Buy order failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Buy order placement failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 bg-[#141822] p-4 rounded-lg border border-[#1e2433] flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider">Buy {coin}</span>
          <p className="text-xs text-[#848e9c]">
            Avbl: <span className="text-[#0ecb81] font-bold">{formatINR(balance)}</span>
          </p>
        </div>

        <div className="space-y-3">
          {!isMarket && (
            <div className="flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-xs focus-within:border-[#ffd333] transition">
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

          <div className="flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-xs focus-within:border-[#ffd333] transition">
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
              className="w-full accent-[#00c076] h-1 bg-[#2b3548] rounded appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#848e9c] px-1 mt-1.5 font-bold">
              {[0, 25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => handleSlider(pct)}
                  className={`hover:text-white transition ${slider === pct ? 'text-[#00c076]' : ''}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-xs focus-within:border-[#ffd333] transition">
            <span className="text-[#848e9c] w-14 font-semibold">Total</span>
            <span className="flex-1 text-white text-right font-bold pr-2">
              {totalINR > 0 ? formatINR(totalINR) : '0.00'}
            </span>
            <span className="text-[#848e9c] font-semibold">INR</span>
          </div>

          <div className="flex justify-between text-[10px] text-[#848e9c] px-1">
            <span>Fee (0.1%): {formatINR(feeINR)}</span>
            <span>You pay: <span className="text-white font-bold">{formatINR(youPay)}</span></span>
          </div>
        </div>
      </div>

      <button
        onClick={handleBuy}
        disabled={amountNum <= 0 || !user || submitting}
        className="w-full bg-[#00c076] hover:bg-[#00e08b] disabled:bg-[#1e2433] disabled:text-[#848e9c] disabled:opacity-40 text-black font-bold py-3 rounded-lg text-sm transition mt-4 shadow-lg cursor-pointer flex items-center justify-center gap-2"
      >
        {submitting && (
          <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
        )}
        {submitting ? 'Placing Order...' : `${isMarket ? 'Market Buy' : 'Limit Buy'} ${coin}`}
      </button>
    </div>
  );
}
