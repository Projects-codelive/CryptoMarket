import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { useMarketData } from '../../hooks/useMarketData';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/axiosInstance';

export default function TradingChart({ symbol }) {
  const { activeCoin } = useMarketData(symbol);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const [candleData, setCandleData] = useState([]);
  const { prices, tradeUpdates } = useSocket() || {};
  const [chartInterval, setChartInterval] = useState('1m');
  const [activeTab, setActiveTab] = useState('chart');

  const normalizedSymbol = symbol?.replace(/[_/]/g, '-') || 'SOL-USDT';
  const dbSymbol = activeCoin?.symbol_db || (symbol ? symbol.replace('-', '_') : 'SOL_INR');

  const refreshChartData = useCallback(async (interval) => {
    try {
      const res = await api.get('/candle-history', {
        params: { market_symbol: dbSymbol, interval: interval || chartInterval, limit: 200 }
      });
      const data = res.data || [];
      setCandleData(data);
      if (seriesRef.current && data.length > 0) {
        const candles = data
          .filter(c => c.time && c.open && c.high && c.low && c.close)
          .sort((a, b) => a.time - b.time);
        if (candles.length > 0) {
          seriesRef.current.setData(candles);
          lastCandleRef.current = candles[candles.length - 1];
        }
      }
    } catch (e) {
      if (seriesRef.current) seriesRef.current.setData([]);
    }
  }, [dbSymbol, chartInterval]);

  useEffect(() => {
    if (dbSymbol) refreshChartData(chartInterval);
  }, [dbSymbol, chartInterval, refreshChartData]);

  useEffect(() => {
    const lastTrade = tradeUpdates?.[0];
    if (lastTrade && lastTrade.market_symbol === dbSymbol) {
      refreshChartData(chartInterval);
    }
  }, [tradeUpdates, dbSymbol, chartInterval, refreshChartData]);

  const updateLiveCandle = useCallback((price) => {
    if (!seriesRef.current) return;
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = now - (now % 60);
    const lastCandle = lastCandleRef.current;

    if (lastCandle && lastCandle.time === currentMinute) {
      const high = Math.max(lastCandle.high, price);
      const low = Math.min(lastCandle.low, price);
      seriesRef.current.update({ time: currentMinute, open: lastCandle.open, high, low, close: price });
      lastCandleRef.current = { ...lastCandle, high, low, close: price };
    } else {
      const newCandle = { time: currentMinute, open: price, high: price, low: price, close: price };
      seriesRef.current.update(newCandle);
      lastCandleRef.current = newCandle;
    }
  }, []);

  useEffect(() => {
    const live = prices?.[normalizedSymbol];
    if (live?.price !== undefined && seriesRef.current) {
      updateLiveCandle(parseFloat(live.price));
    }
  }, [prices, normalizedSymbol, updateLiveCandle]);

  // Find the last candle to display OHLC stats
  const lastCandle = useMemo(() => {
    if (!candleData || candleData.length === 0) return null;
    const sorted = [...candleData].sort((a, b) => a.time - b.time);
    return sorted[sorted.length - 1];
  }, [candleData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0d111b' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: '#1e2433' },
        horzLines: { color: '#1e2433' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#1e2433',
      },
      timeScale: {
        borderColor: '#1e2433',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderDownColor: '#f6465d',
      borderUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candleData.length > 0) {
      const candles = candleData
        .filter(c => c.time && c.open && c.high && c.low && c.close !== undefined)
        .map(c => ({
          time: c.time,
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
        }))
        .sort((a, b) => a.time - b.time);

      if (candles.length > 0) {
        seriesRef.current.setData(candles);
        lastCandleRef.current = candles[candles.length - 1];
      }
    }
  }, [candleData]);

  return (
    <div className="flex flex-col h-full bg-[#141822] border-b border-[#1e2433] select-none">
      {/* Top Tabs Bar */}
      <div className="flex items-center justify-between border-b border-[#1e2433] px-3 bg-[#0d111b]">
        <div className="flex gap-1">
          {[
            { key: 'chart', label: 'Chart' },
            { key: 'info', label: 'Info' },
            { key: 'data', label: 'Trading Data' },
            { key: 'analysis', label: 'Trading Analysis' },
            { key: 'square', label: 'Square' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-semibold relative transition ${
                activeTab === tab.key ? 'text-[#ffd333]' : 'text-[#848e9c] hover:text-white'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffd333]" />
              )}
            </button>
          ))}
        </div>

        {/* Right side utility icons */}
        <div className="flex items-center gap-3 text-[#848e9c]">
          <button className="flex items-center gap-1 text-[10px] font-bold text-white bg-[#1a2030] px-2 py-0.5 rounded border border-[#2b3548] hover:border-[#ffd333] transition">
            AI
          </button>
          {/* Alert Bell */}
          <button className="hover:text-white transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* Full Screen */}
          <button className="hover:text-white transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" />
            </svg>
          </button>
          {/* Cog Wheel */}
          <button className="hover:text-white transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Candlestick Stats Sub-Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2433] text-[10px] bg-[#0d111b] text-[#848e9c]">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">{dbSymbol} · Crypto</span>
          {lastCandle && (
            <div className="flex gap-2">
              <span>O <span className="text-[#0ecb81]">{parseFloat(lastCandle.open).toFixed(2)}</span></span>
              <span>H <span className="text-[#0ecb81]">{parseFloat(lastCandle.high).toFixed(2)}</span></span>
              <span>L <span className="text-[#f6465d]">{parseFloat(lastCandle.low).toFixed(2)}</span></span>
              <span>C <span className="text-[#f6465d]">{parseFloat(lastCandle.close).toFixed(2)}</span></span>
              <span>V <span className="text-white">0</span></span>
            </div>
          )}
        </div>

        {/* Timeframe Selectors */}
        <div className="flex gap-1">
          {['1m', '5m', '30m', '1h', '1D'].map(i => (
            <button
              key={i}
              onClick={() => { setChartInterval(i); refreshChartData(i); }}
              className={`px-2 py-0.5 rounded-sm font-semibold transition ${
                chartInterval === i
                  ? 'bg-[#1e60ff] text-white'
                  : 'text-[#848e9c] hover:text-white'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="flex-1 min-h-[300px]" />
    </div>
  );
}

