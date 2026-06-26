import { useState, useEffect } from 'react';
import { usePortfolio } from '../../hooks/usePortfolio';
import { cancelOrder } from '../../api/orders';
import { formatINR, formatAmount } from '../../utils/formatCurrency';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function BottomTabs({ symbol }) {
  const [activeTab, setActiveTab] = useState('holdings');
  const { openOrders, orderHistory, holdings, myTrades, refreshOpenOrders, refreshOrderHistory, refreshHoldings, refreshBalance } = usePortfolio();
  const { orderBookUpdates } = useSocket() || {};
  const [marketTrades, setMarketTrades] = useState([]);
  const dbSymbol = symbol ? symbol.replace('-', '_') : 'SOL_INR';

  useEffect(() => {
    api.get('/market-trades', { params: { market_symbol: dbSymbol, limit: 50 } })
      .then(res => setMarketTrades(res.data || []))
      .catch(() => {});
  }, [dbSymbol]);

  useEffect(() => {
    if (orderBookUpdates) {
      refreshOpenOrders();
    }
  }, [orderBookUpdates, refreshOpenOrders]);

  const tabs = [
    { key: 'open', label: `Open Orders (${openOrders.length})` },
    { key: 'history', label: 'Order History' },
    { key: 'holdings', label: 'Holdings' },
    { key: 'trades', label: 'My Trades' },
    { key: 'marketTrades', label: 'Market Trades' },
  ];

  async function handleCancelOrder(orderId) {
    try {
      const res = await cancelOrder(orderId);
      if (res.status === 1) {
        toast.success('Order cancelled');
        refreshOpenOrders();
        refreshBalance();
        refreshHoldings();
      } else {
        toast.error(res.message || 'Cancel failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    }
  }

  function formatPriceINR(price) {
    return formatINR(parseFloat(price || 0));
  }

  function formatQty(order) {
    return formatAmount(parseFloat(order.bid_qty_available || order.bid_qty || order.volume || 0));
  }

  function formatTotal(order) {
    return formatINR(parseFloat(order.total_amount || order.amount || 0));
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function formatCoinBalance(order) {
    return formatAmount(parseFloat(order.balance || 0));
  }

  return (
    <div className="border-t border-[#1e2433] bg-[#0d111b]">
      <div className="flex border-b border-[#1e2433] overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]'
                : 'text-[#848e9c] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="text-[#848e9c] text-xs min-h-[120px] max-h-[250px] overflow-y-auto">
        {activeTab === 'open' && (
          <div className="w-full">
            {openOrders.length === 0 ? (
              <div className="flex items-center justify-center h-[120px] text-sm">No open orders</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[#848e9c] border-b border-[#1e2433] sticky top-0 bg-[#0d111b]">
                    <th className="text-left px-3 py-1.5 font-semibold">Date</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Pair</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Type</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Price (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Amount</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Filled</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Total (INR)</th>
                    <th className="text-center px-3 py-1.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((order, i) => {
                    const filled = order.bid_qty > 0
                      ? ((order.bid_qty - order.bid_qty_available) / order.bid_qty * 100).toFixed(1)
                      : '0.0';
                    return (
                      <tr key={order.id || i} className="border-b border-[#1e2433]/50 hover:bg-[#1e2433]/30">
                        <td className="px-3 py-2 text-white">{formatDate(order.open_order)}</td>
                        <td className="px-3 py-2 text-white font-medium">{order.market_symbol?.replace('_', '-')}</td>
                        <td className={`px-3 py-2 font-bold ${order.bid_type === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{order.bid_type}</td>
                        <td className="px-3 py-2 text-right text-white">{formatPriceINR(order.bid_price)}</td>
                        <td className="px-3 py-2 text-right text-white">{formatAmount(parseFloat(order.bid_qty), 4)}</td>
                        <td className="px-3 py-2 text-right text-white">{filled}%</td>
                        <td className="px-3 py-2 text-right text-white">{formatTotal(order)}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="text-[#f6465d] hover:text-white hover:bg-[#f6465d] px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="w-full">
            {orderHistory.length === 0 ? (
              <div className="flex items-center justify-center h-[120px] text-sm">No order history</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[#848e9c] border-b border-[#1e2433] sticky top-0 bg-[#0d111b]">
                    <th className="text-left px-3 py-1.5 font-semibold">Date</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Pair</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Type</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Price (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Amount</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Total (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Fee (INR)</th>
                    <th className="text-center px-3 py-1.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map((order, i) => (
                    <tr key={order.id || i} className="border-b border-[#1e2433]/50 hover:bg-[#1e2433]/30">
                      <td className="px-3 py-2 text-white">{formatDate(order.open_order)}</td>
                      <td className="px-3 py-2 text-white font-medium">{order.market_symbol?.replace('_', '-')}</td>
                      <td className={`px-3 py-2 font-bold ${order.bid_type === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{order.bid_type}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(order.bid_price)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatAmount(parseFloat(order.bid_qty), 4)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatTotal(order)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(order.fees_amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          order.status === 1 ? 'text-[#0ecb81] bg-[#0ecb81]/10' :
                          order.status === 3 ? 'text-[#848e9c] bg-[#848e9c]/10' :
                          'text-[#f0b90b] bg-[#f0b90b]/10'
                        }`}>
                          {order.status === 1 ? 'Filled' : order.status === 3 ? 'Cancelled' : 'Open'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'holdings' && (
          <div className="w-full">
            {holdings.length === 0 ? (
              <div className="flex items-center justify-center h-[120px] text-sm">No coin holdings</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[#848e9c] border-b border-[#1e2433] sticky top-0 bg-[#0d111b]">
                    <th className="text-left px-3 py-1.5 font-semibold">Coin</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Balance</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Price (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Value (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#1e2433]/50 hover:bg-[#1e2433]/30">
                    <td className="px-3 py-2 text-white font-medium">INR</td>
                    <td className="px-3 py-2 text-right text-white">{formatPriceINR(balance)}</td>
                    <td className="px-3 py-2 text-right text-white">{formatINR(1)}</td>
                    <td className="px-3 py-2 text-right text-white">{formatPriceINR(balance)}</td>
                  </tr>
                  {holdings.map((h, i) => (
                    <tr key={h.currency_symbol || i} className="border-b border-[#1e2433]/50 hover:bg-[#1e2433]/30">
                      <td className="px-3 py-2 text-white font-medium">{h.currency_symbol}</td>
                      <td className="px-3 py-2 text-right text-white">{formatAmount(h.balance, 4)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(h.current_price)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(h.value_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="w-full">
            {myTrades.length === 0 ? (
              <div className="flex items-center justify-center h-[120px] text-sm">No trades yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[#848e9c] border-b border-[#1e2433] sticky top-0 bg-[#0d111b]">
                    <th className="text-left px-3 py-1.5 font-semibold">Date</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Price (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Amount</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Total (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Fee (INR)</th>
                    <th className="text-center px-3 py-1.5 font-semibold">Side</th>
                  </tr>
                </thead>
                <tbody>
                  {myTrades.map((trade, i) => (
                    <tr key={trade.log_id || i} className="border-b border-[#1e2433]/50 hover:bg-[#1e2433]/30">
                      <td className="px-3 py-2 text-white">{formatDate(trade.success_time)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(trade.bid_price)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatAmount(parseFloat(trade.complete_qty), 4)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(trade.complete_amount)}</td>
                      <td className="px-3 py-2 text-right text-white">{formatPriceINR(trade.fees_amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] font-bold ${trade.bid_type === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {trade.bid_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'marketTrades' && (
          <div className="w-full">
            {marketTrades.length === 0 ? (
              <div className="flex items-center justify-center h-[120px] text-sm">No market trades yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[#848e9c] border-b border-[#1e2433] sticky top-0 bg-[#0d111b]">
                    <th className="text-right px-3 py-1.5 font-semibold">Price (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Amount</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Total (INR)</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {marketTrades.map((trade, i) => {
                    const prevPrice = i > 0 ? parseFloat(marketTrades[i - 1].bid_price) : parseFloat(trade.bid_price);
                    const currPrice = parseFloat(trade.bid_price);
                    const isUp = currPrice >= prevPrice;
                    return (
                      <tr key={trade.log_id || i} className="border-b border-[#1e2433]/50 hover:bg-[#1e2433]/30">
                        <td className={`px-3 py-2 text-right font-bold ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {formatPriceINR(trade.bid_price)}
                        </td>
                        <td className="px-3 py-2 text-right text-white">{formatAmount(parseFloat(trade.complete_qty), 4)}</td>
                        <td className="px-3 py-2 text-right text-white">{formatPriceINR(trade.complete_amount)}</td>
                        <td className="px-3 py-2 text-right text-[#848e9c]">{formatDate(trade.success_time)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
