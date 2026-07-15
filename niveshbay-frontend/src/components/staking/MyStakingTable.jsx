// MyStakingTable.jsx - Redesigned history table using staking_log + staking schema
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axiosInstance';

function StatusBadge({ status }) {
    const map = {
        ACTIVE:   { bg: '#0ecb81' + '22', text: '#0ecb81', label: '● Active' },
        MATURED:  { bg: '#f0b90b' + '22', text: '#f0b90b', label: '★ Matured' },
        CLAIMED:  { bg: '#2b3548',         text: '#848e9c', label: '✓ Claimed' },
        UNSTAKED: { bg: '#f6465d' + '22', text: '#f6465d', label: '✕ Unstaked' },
    };
    const s = map[status] || map.CLAIMED;
    return (
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
            {s.label}
        </span>
    );
}

function ProgressBar({ start, end }) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const now = new Date();
    const total = endDate - startDate;
    const elapsed = now - startDate;
    const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;

    return (
        <div className="w-full bg-[#1e2433] rounded-full h-1 mt-1">
            <div
                className="h-1 rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct >= 100 ? '#f0b90b' : '#0ecb81' }}
            />
        </div>
    );
}

export default function MyStakingTable({ stakes, onRefresh }) {
    const [claiming, setClaiming] = useState(null);
    const [unstaking, setUnstaking] = useState(null);

    async function handleClaim(stakeId, coin) {
        setClaiming(stakeId);
        try {
            const res = await api.post('/api/v1/staking/claim', { stake_id: stakeId });
            if (res.data.status === 1) {
                toast.success(`✓ Claimed ${res.data.total?.toFixed(8) || ''} ${coin} successfully!`);
                if (onRefresh) onRefresh();
            } else {
                toast.error(res.data.message || 'Claim failed.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong.');
        } finally {
            setClaiming(null);
        }
    }

    async function handleUnstake(stakeId) {
        if (!confirm('Unstake early? You will receive only your principal — no rewards will be paid.')) return;
        setUnstaking(stakeId);
        try {
            const res = await api.post('/api/v1/staking/unsubscribe', { stake_id: stakeId });
            if (res.data.status === 1) {
                toast.success('Stake unstaked. Principal refunded.');
                if (onRefresh) onRefresh();
            } else {
                toast.error(res.data.message || 'Unstake failed.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong.');
        } finally {
            setUnstaking(null);
        }
    }

    if (!stakes.length) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#1a1f2e] flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-[#848e9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
                <p className="text-[#848e9c] text-sm">No active staking plans yet.</p>
                <p className="text-[#848e9c] text-xs mt-1 opacity-70">Subscribe to a plan to start earning rewards.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-[#1e2433]">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-[#0f1117] text-[#848e9c] text-[10px] uppercase tracking-widest border-b border-[#1e2433]">
                            <th className="text-left py-3.5 px-4 font-semibold">Plan</th>
                            <th className="text-left py-3.5 px-4 font-semibold">Coin</th>
                            <th className="text-right py-3.5 px-4 font-semibold">Staked</th>
                            <th className="text-right py-3.5 px-4 font-semibold">Return %</th>
                            <th className="text-right py-3.5 px-4 font-semibold">Earned</th>
                            <th className="text-right py-3.5 px-4 font-semibold">Maturity</th>
                            <th className="text-center py-3.5 px-4 font-semibold">Status</th>
                            <th className="text-right py-3.5 px-4 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2433]/50">
                        {stakes.map(s => (
                            <tr key={s.id} className="hover:bg-[#141822]/60 transition">
                                <td className="py-3.5 px-4">
                                    <div className="text-white font-semibold text-xs">{s.plan_name}</div>
                                    <div className="text-[#848e9c] text-[10px] mt-0.5">{s.duration_days}d lock-in</div>
                                </td>
                                <td className="py-3.5 px-4">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]">
                                        {s.coin_symbol}
                                    </span>
                                </td>
                                <td className="py-3.5 px-4 text-white text-xs text-right font-semibold">
                                    {parseFloat(s.stake_amount).toFixed(4)} {s.coin_symbol}
                                </td>
                                <td className="py-3.5 px-4 text-[#0ecb81] text-xs text-right font-bold">
                                    {s.apr_percent}% <span className="text-[#848e9c] font-normal">/mo</span>
                                </td>
                                <td className="py-3.5 px-4 text-[#f0b90b] text-xs text-right font-semibold">
                                    +{parseFloat(s.reward_amount || 0).toFixed(4)} {s.coin_symbol}
                                    <ProgressBar start={s.start_date} end={s.maturity_date} />
                                </td>
                                <td className="py-3.5 px-4 text-[#848e9c] text-xs text-right">
                                    {s.maturity_date ? new Date(s.maturity_date).toLocaleDateString() : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                    <StatusBadge status={s.status} />
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                    {s.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => handleUnstake(s.id)}
                                            disabled={unstaking === s.id}
                                            className="text-[10px] border border-[#f6465d]/50 text-[#f6465d] px-3 py-1.5 rounded-lg hover:bg-[#f6465d]/10 cursor-pointer transition disabled:opacity-50"
                                        >
                                            {unstaking === s.id ? '…' : 'Unstake'}
                                        </button>
                                    )}
                                    {s.status === 'MATURED' && (
                                        <button
                                            onClick={() => handleClaim(s.id, s.coin_symbol)}
                                            disabled={claiming === s.id}
                                            className="text-[10px] bg-[#f0b90b] text-black font-bold px-3 py-1.5 rounded-lg hover:bg-[#ffd333] cursor-pointer transition disabled:opacity-50"
                                        >
                                            {claiming === s.id ? '…' : 'Claim'}
                                        </button>
                                    )}
                                    {(s.status === 'CLAIMED' || s.status === 'UNSTAKED') && (
                                        <span className="text-[10px] text-[#848e9c]">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {stakes.map(s => (
                    <div key={s.id} className="bg-[#0f1117] border border-[#1e2433] rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-white font-bold text-sm">{s.plan_name}</div>
                                <div className="text-[#848e9c] text-xs mt-0.5">{s.duration_days}d · {s.apr_percent}%/mo</div>
                            </div>
                            <StatusBadge status={s.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <div className="text-[#848e9c]">Staked</div>
                                <div className="text-white font-semibold">{parseFloat(s.stake_amount).toFixed(4)} {s.coin_symbol}</div>
                            </div>
                            <div>
                                <div className="text-[#848e9c]">Earned</div>
                                <div className="text-[#f0b90b] font-semibold">+{parseFloat(s.reward_amount || 0).toFixed(4)}</div>
                            </div>
                        </div>
                        <ProgressBar start={s.start_date} end={s.maturity_date} />
                        <div className="text-[10px] text-[#848e9c]">
                            Matures: {s.maturity_date ? new Date(s.maturity_date).toLocaleDateString() : '-'}
                        </div>
                        <div className="flex gap-2">
                            {s.status === 'ACTIVE' && (
                                <button
                                    onClick={() => handleUnstake(s.id)}
                                    className="flex-1 py-2 text-xs border border-[#f6465d]/50 text-[#f6465d] rounded-lg hover:bg-[#f6465d]/10 cursor-pointer"
                                >
                                    Unstake Early
                                </button>
                            )}
                            {s.status === 'MATURED' && (
                                <button
                                    onClick={() => handleClaim(s.id, s.coin_symbol)}
                                    className="flex-1 py-2 text-xs bg-[#f0b90b] text-black font-bold rounded-lg hover:bg-[#ffd333] cursor-pointer"
                                >
                                    Claim Rewards
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
