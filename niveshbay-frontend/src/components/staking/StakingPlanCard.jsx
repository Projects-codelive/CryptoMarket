// StakingPlanCard.jsx - Premium redesigned card for the new staking/staking_log schema
// Fields from staking table: id, coin_symbol, name, description, start_date, end_date, plan, percentage, status

export default function StakingPlanCard({ plan, onSubscribe }) {
    const pct = parseFloat(plan.percentage || 0);
    const months = parseInt(plan.plan) || 12;
    const coin = plan.coin_symbol || 'MDR';

    // Color per tier
    const tierColors = {
        'Bronze': { accent: '#cd7f32', glow: 'rgba(205,127,50,0.15)', badge: '#cd7f32' },
        'Silver': { accent: '#a8a9ad', glow: 'rgba(168,169,173,0.15)', badge: '#a8a9ad' },
        'Gold': { accent: '#f0b90b', glow: 'rgba(240,185,11,0.15)', badge: '#f0b90b' },
        'Platinum': { accent: '#0ecb81', glow: 'rgba(14,203,129,0.15)', badge: '#0ecb81' },
    };
    const tierKey = Object.keys(tierColors).find(k => plan.name?.includes(k)) || null;
    const accent = tierKey ? tierColors[tierKey].accent : '#f0b90b';
    const glow = tierKey ? tierColors[tierKey].glow : 'rgba(240,185,11,0.1)';

    return (
        <div
            className="relative bg-[#0f1117] border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
            style={{
                borderColor: accent + '44',
                boxShadow: `0 0 0 0 ${glow}`,
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 28px 4px ${glow}`}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 transparent'}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                            style={{ background: accent + '22', color: accent }}
                        >
                            {coin}
                        </span>
                    </div>
                    <h3 className="text-white font-bold text-base leading-tight">{plan.name}</h3>
                    <p className="text-[#848e9c] text-[11px] mt-0.5">{months} Month Lock-In</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-extrabold" style={{ color: accent }}>{pct}%</div>
                    <div className="text-[#848e9c] text-[10px] uppercase tracking-wider">/Month</div>
                </div>
            </div>

            {/* Description */}
            {plan.description && (
                <p className="text-[#848e9c] text-[11px] leading-relaxed line-clamp-2">{plan.description}</p>
            )}

            {/* Stats */}
            <div className="border-t pt-3 space-y-2" style={{ borderColor: accent + '22' }}>
                <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#848e9c]">Duration</span>
                    <span className="text-white font-semibold">{months} Months</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#848e9c]">Monthly Return</span>
                    <span className="font-bold" style={{ color: accent }}>{pct}%</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#848e9c]">Total Estimated Return</span>
                    <span className="text-[#0ecb81] font-semibold">+{(pct * months).toFixed(1)}%</span>
                </div>
            </div>

            {/* Maturity dates */}
            {plan.end_date && (
                <div className="text-[10px] text-[#848e9c] flex justify-between">
                    <span>Plan ends</span>
                    <span>{new Date(plan.end_date).toLocaleDateString()}</span>
                </div>
            )}

            {/* Subscribe Button */}
            <button
                onClick={() => onSubscribe && onSubscribe(plan)}
                className="mt-auto w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
                style={{
                    background: `linear-gradient(135deg, ${accent}cc, ${accent})`,
                    color: accent === '#f0b90b' || accent === '#cd7f32' ? '#000' : '#fff',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
                Get Started →
            </button>
        </div>
    );
}
