// SubscribeModal.jsx - Redesigned subscribe modal using coin_symbol from staking table
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axiosInstance';
import { useWalletOverview } from '../../hooks/useWalletOverview';

export default function SubscribeModal({ plan, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const { overview } = useWalletOverview();

    const coin = plan.coin_symbol || 'MDR';
    const pct = parseFloat(plan.percentage || 0);
    const months = parseInt(plan.plan) || 12;
    const numAmount = parseFloat(amount) || 0;
    const estimatedReward = numAmount * (pct / 100) * months;
    const totalAtMaturity = numAmount + estimatedReward;

    // Find coin balance from wallet
    const coinBalance = overview.find(c => c.coin?.toUpperCase() === coin.toUpperCase());
    const availableBal = coinBalance ? parseFloat(coinBalance.spot || 0) : 0;

    const tierColors = {
        'Bronze': '#cd7f32',
        'Silver': '#a8a9ad',
        'Gold': '#f0b90b',
        'Platinum': '#0ecb81',
    };
    const tierKey = Object.keys(tierColors).find(k => plan.name?.includes(k)) || null;
    const accent = tierKey ? tierColors[tierKey] : '#f0b90b';
    const textColor = (accent === '#f0b90b' || accent === '#cd7f32') ? '#000' : '#fff';

    async function handleSubmit(e) {
        e.preventDefault();
        if (!numAmount || numAmount <= 0) {
            toast.error('Please enter a valid amount.');
            return;
        }
        if (numAmount > availableBal) {
            toast.error(`Insufficient ${coin} balance. Available: ${availableBal.toFixed(8)} ${coin}`);
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/api/v1/staking/subscribe', {
                plan_id: plan.id,
                stake_amount: numAmount
            });
            if (res.data.status === 1) {
                toast.success('Staking subscription successful!');
                onSuccess();
                onClose();
            } else {
                toast.error(res.data.message || 'Subscription failed.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#0f1117] border rounded-2xl p-6 w-[420px] max-w-[92vw] shadow-2xl"
                style={{ borderColor: accent + '44' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block"
                            style={{ background: accent + '22', color: accent }}
                        >
                            {coin}
                        </span>
                        <h2 className="text-white font-bold text-lg leading-tight">Subscribe {plan.name}</h2>
                        <p className="text-[#848e9c] text-xs mt-0.5">{months} Month Plan · {pct}% /Month</p>
                    </div>
                    <button onClick={onClose} className="text-[#848e9c] hover:text-white text-2xl cursor-pointer leading-none">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Balance display */}
                    <div className="flex items-center justify-between text-xs bg-[#1a1f2e] rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 text-[#848e9c]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            Available Balance
                        </div>
                        <div className="text-white font-semibold">
                            {availableBal.toFixed(8)} <span style={{ color: accent }}>{coin}</span>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="text-[#848e9c] text-xs block mb-2">Enter Investment Amount ({coin})</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="any"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder={`Enter ${coin} amount`}
                                className="w-full bg-[#141822] border border-[#2b3548] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#f0b90b]/60 pr-24 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setAmount(String(availableBal))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition"
                                style={{ background: accent + '22', color: accent }}
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* Summary Box */}
                    <div className="bg-[#141822] rounded-xl px-4 py-4 space-y-2.5 border" style={{ borderColor: accent + '22' }}>
                        <div className="flex justify-between text-xs">
                            <span className="text-[#848e9c]">Monthly Return</span>
                            <span className="font-bold" style={{ color: accent }}>{pct}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-[#848e9c]">Duration</span>
                            <span className="text-white font-semibold">{months} Months</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-[#848e9c]">Estimated Reward</span>
                            <span className="text-[#0ecb81] font-semibold">
                                {numAmount > 0 ? `+${estimatedReward.toFixed(8)}` : '—'} {coin}
                            </span>
                        </div>
                        <div className="border-t pt-2.5 flex justify-between text-sm" style={{ borderColor: accent + '22' }}>
                            <span className="text-[#848e9c] font-semibold">Total at Maturity</span>
                            <span className="text-white font-bold">
                                {numAmount > 0 ? totalAtMaturity.toFixed(8) : '—'} {coin}
                            </span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-[#1a1f2e] text-[#848e9c] font-semibold text-sm rounded-xl hover:text-white hover:bg-[#242a3b] transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !numAmount}
                            className="flex-1 py-2.5 font-bold text-sm rounded-xl transition disabled:opacity-50 cursor-pointer"
                            style={{
                                background: `linear-gradient(135deg, ${accent}cc, ${accent})`,
                                color: textColor
                            }}
                        >
                            {loading ? 'Processing…' : 'Apply Staking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
