import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBalanceStats } from '../hooks/useBalanceStats';
import { createChart, AreaSeries } from 'lightweight-charts';
import { formatINR, formatINRShort, formatCurrency } from '../utils/formatCurrency';

function formatUSDTShort(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(2) + 'K';
  return '$' + Number(amount).toFixed(2);
}

function DonutChart({ data }) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  if (total === 0) return null;
  const colors = ['#f0b90b', '#0ecb81', '#f6465d', '#627eea', '#8b5cf6', '#f59e0b', '#14b8a6', '#3b82f6', '#a855f7', '#ec4899'];
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const seg = circumference * (pct / 100);
    const segOffset = offset;
    offset += seg;
    return { ...d, pct, seg, offset: segOffset, color: colors[i % colors.length] };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <g transform="translate(70, 70) rotate(-90)">
          {segments.map((s, i) => (
            <circle
              key={i}
              cx="0" cy="0" r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${s.seg} ${circumference - s.seg}`}
              strokeDashoffset={-s.offset}
            />
          ))}
          <circle cx="0" cy="0" r={radius - 10} fill="#141822" />
        </g>
        <text x="70" y="66" textAnchor="middle" fill="#eaecef" fontSize="12" fontWeight="bold">{formatUSDTShort(total)}</text>
        <text x="70" y="80" textAnchor="middle" fill="#848e9c" fontSize="9">Total</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[#848e9c] w-12">{s.currency_symbol}</span>
            <span className="text-white font-semibold w-20 text-right">{formatUSDTShort(s.value)}</span>
            <span className="text-[#848e9c] w-10 text-right">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonBlock({ className }) {
  return <div className={`bg-[#1e2433] rounded animate-pulse ${className || 'h-20'}`} />;
}

const TX_LABELS = {
  SIGNUP_BONUS: 'Signup Bonus',
  TRADE_BUY: 'Trade Buy',
  TRADE_SELL: 'Trade Sell',
  ORDER_PLACE_BUY: 'Order Placed (Buy)',
  ORDER_PLACE_SELL: 'Order Placed (Sell)',
  ORDER_CANCEL_REFUND: 'Order Cancel Refund',
  ADJUSTMENT: 'Adjustment',
};

export default function BalanceStatsPage() {
  const navigate = useNavigate();
  const { stats, loading, error } = useBalanceStats();
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);

  const nonInrHoldings = useMemo(() => {
    if (!stats) return [];
    return stats.holdings.filter(h => h.currency_symbol !== 'INR');
  }, [stats]);

  const donutData = useMemo(() => {
    if (!stats) return [];
    const usdtItem = { currency_symbol: 'USDT', value: stats.inr_balance };
    const coinItems = nonInrHoldings.map(h => ({ currency_symbol: h.currency_symbol, value: h.value_inr }));
    return [usdtItem, ...coinItems];
  }, [stats, nonInrHoldings]);

  useEffect(() => {
    if (!stats || !chartContainerRef.current || chartRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { color: '#141822' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: '#1e2433' },
        horzLines: { color: '#1e2433' },
      },
      crosshair: { vertLine: { color: '#2b3548' }, horzLine: { color: '#2b3548' } },
      timeScale: {
        borderColor: '#1e2433',
        timeVisible: false,
      },
      rightPriceScale: { borderColor: '#1e2433' },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#0ecb81',
      topColor: 'rgba(14, 203, 129, 0.3)',
      bottomColor: 'rgba(14, 203, 129, 0.01)',
      lineWidth: 2,
    });

    const history = stats.balance_history || [];
    const chartData = history.map(h => ({
      time: h.date.split('T')[0],
      value: h.balance,
    }));
    series.setData(chartData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    setChartReady(true);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <SkeletonBlock className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-28 rounded-lg" />)}
          </div>
          <SkeletonBlock className="h-[280px] rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonBlock className="h-64 rounded-lg" />
            <SkeletonBlock className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-8 text-center">
          <p className="text-[#f6465d] text-sm font-semibold">{error}</p>
          <button onClick={() => navigate('/trade/SOL-INR')} className="mt-4 text-xs text-[#f0b90b] hover:underline cursor-pointer">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const pnlPositive = stats.unrealized_pnl >= 0;
  const realizedPositive = stats.realized_pnl >= 0;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/trade/SOL-INR')}
              className="flex items-center gap-1 text-[#848e9c] hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </button>
          </div>
          <h1 className="text-lg font-bold text-[#f0b90b]">Balance Overview</h1>
        </div>

        {/* Hero Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
            <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider">USDT Balance</span>
            <p className="text-white font-bold text-lg mt-1">{formatCurrency(stats.inr_balance, 'USDT')}</p>
          </div>
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
            <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider">Portfolio Value</span>
            <p className="text-white font-bold text-lg mt-1">{formatCurrency(stats.total_portfolio_value, 'USDT')}</p>
          </div>
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
            <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider">Unrealized P&amp;L</span>
            <p className={`font-bold text-lg mt-1 ${pnlPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {pnlPositive ? '+' : ''}{formatCurrency(stats.unrealized_pnl, 'USDT')}
              <span className="text-xs ml-1">({pnlPositive ? '+' : ''}{stats.pnl_percent}%)</span>
            </p>
          </div>
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
            <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider">Realized P&amp;L</span>
            <p className={`font-bold text-lg mt-1 ${realizedPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {realizedPositive ? '+' : ''}{formatCurrency(stats.realized_pnl, 'USDT')}
            </p>
          </div>
        </div>

        {/* Balance Trend Chart */}
        <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
          <h3 className="text-xs text-[#848e9c] uppercase font-bold tracking-wider mb-3">Balance Trend</h3>
          <div ref={chartContainerRef} className="w-full" />
          {!chartReady && !chartRef.current && (
            <SkeletonBlock className="h-[280px] rounded" />
          )}
        </div>

        {/* Holdings Breakdown + Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Holdings */}
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
            <h3 className="text-xs text-[#848e9c] uppercase font-bold tracking-wider mb-4">Holdings</h3>
            {nonInrHoldings.length === 0 ? (
              <div className="py-6 text-center text-[#848e9c] text-xs">No coin holdings yet. Start trading!</div>
            ) : (
              <>
                <DonutChart data={donutData} />
                <div className="mt-4 space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {stats.holdings.filter(h => h.currency_symbol !== 'INR').map(h => (
                    <div key={h.currency_symbol} className="flex items-center justify-between text-xs py-1.5 border-b border-[#1e2433]/50 last:border-0">
                      <span className="text-white font-semibold w-16">{h.currency_symbol}</span>
                      <span className="text-[#848e9c] w-20 text-right">{h.balance}</span>
                      <span className="text-[#848e9c] w-24 text-right">{formatCurrency(h.current_price, 'USDT')}</span>
                      <span className="text-white font-semibold w-24 text-right">{formatCurrency(h.value_inr, 'USDT')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-4">
            <h3 className="text-xs text-[#848e9c] uppercase font-bold tracking-wider mb-4">Recent Activity</h3>
            {stats.recent_activity.length === 0 ? (
              <div className="py-6 text-center text-[#848e9c] text-xs">No activity yet.</div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                {stats.recent_activity.map((act, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-[#1e2433]/50 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{TX_LABELS[act.transaction_type] || act.transaction_type}</span>
                      <span className="text-[#848e9c] text-[10px]">
                        {act.currency_symbol}
                        {act.transaction_fees > 0 ? ` · Fee: ${formatCurrency(act.transaction_fees, act.currency_symbol)}` : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${act.transaction_amount >= 0 && ['SIGNUP_BONUS','TRADE_SELL','ORDER_CANCEL_REFUND','ADJUSTMENT'].includes(act.transaction_type) ? 'text-[#0ecb81]' : act.transaction_type === 'TRADE_BUY' ? 'text-[#0ecb81]' : 'text-[#848e9c]'}`}>
                        {act.transaction_amount >= 0 && !['TRADE_BUY'].includes(act.transaction_type) ? '+' : ''}
                        {act.transaction_amount}
                      </span>
                      <p className="text-[#848e9c] text-[10px]">{new Date(act.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-[#1e2433] flex justify-between text-xs">
              <span className="text-[#848e9c]">Total Fees Paid</span>
              <span className="text-white font-semibold">{formatCurrency(stats.total_fees_paid, 'USDT')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
