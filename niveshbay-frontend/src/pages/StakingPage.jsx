// StakingPage.jsx - Premium redesign backed by staking / staking_log tables
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStakingPlans } from '../hooks/useStakingPlans';
import { useMyStaking } from '../hooks/useMyStaking';
import Navbar from '../components/layout/Navbar';
import StakingPlanCard from '../components/staking/StakingPlanCard';
import SubscribeModal from '../components/staking/SubscribeModal';
import MyStakingTable from '../components/staking/MyStakingTable';
import { useBalanceStats } from '../hooks/useBalanceStats';

export default function StakingPage() {
    const navigate = useNavigate();
    const { plans, isLoading } = useStakingPlans();
    const { stakes, refreshMyStaking } = useMyStaking();
    const { stats } = useBalanceStats();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [tab, setTab] = useState('plans');

    const inrBal = stats?.inr_balance || 0;
    const totalPortfolio = stats?.total_portfolio_value || 0;
    const realizedPnl = stats?.realized_pnl || 0;

    const activeCount = stakes.filter(s => s.status === 'ACTIVE').length;
    const maturedCount = stakes.filter(s => s.status === 'MATURED').length;
    const totalStaked = stakes
        .filter(s => s.status === 'ACTIVE' || s.status === 'MATURED')
        .reduce((acc, s) => acc + parseFloat(s.stake_amount || 0), 0);
    const totalEarned = stakes.reduce((acc, s) => acc + parseFloat(s.reward_amount || 0), 0);

    async function handleRefresh() {
        await refreshMyStaking();
    }

    return (
        <div className="min-h-screen bg-[#0b0e11] text-white">
            <Navbar balance={inrBal} portfolioValue={totalPortfolio} realizedPnl={realizedPnl} />

            {/* Hero Banner */}
            <div className="relative overflow-hidden border-b border-[#1e2433]"
                style={{ background: 'linear-gradient(135deg, #0b0e11 0%, #111827 50%, #0b0e11 100%)' }}>
                <div className="absolute inset-0 opacity-20"
                    style={{ background: 'radial-gradient(ellipse at 60% 50%, #f0b90b33, transparent 60%)' }} />
                <div className="relative max-w-7xl mx-auto px-4 py-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-[#f0b90b]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                </div>
                                <span className="text-[#f0b90b] text-xs font-bold uppercase tracking-widest">Staking Rewards</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                                Stake &amp; Earn
                            </h1>
                            <p className="text-[#848e9c] mt-2 text-sm max-w-md">
                                Lock your coins, earn monthly rewards. Choose a plan, subscribe with your balance, and claim at maturity.
                            </p>
                        </div>

                        {/* Stats Row */}
                        <div className="flex gap-4 flex-wrap">
                            {[
                                { label: 'Active Plans', value: activeCount, color: '#0ecb81' },
                                { label: 'Matured', value: maturedCount, color: '#f0b90b' },
                                { label: 'Total Earned', value: totalEarned.toFixed(4), color: '#f0b90b', suffix: '' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-[#1a1f2e]/80 rounded-xl px-4 py-3 min-w-[100px] border border-[#1e2433]">
                                    <div className="text-xl font-bold" style={{ color: stat.color }}>
                                        {stat.value}{stat.suffix}
                                    </div>
                                    <div className="text-[#848e9c] text-[10px] mt-0.5 uppercase tracking-wider">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* Tab Switch */}
                <div className="flex gap-1 bg-[#0f1117] rounded-xl p-1 border border-[#1e2433] mb-8 w-fit">
                    {[
                        { key: 'plans', label: 'Available Plans', icon: '◈' },
                        { key: 'my', label: 'My Staking', icon: '◉', badge: activeCount + maturedCount },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all duration-200 ${
                                tab === t.key
                                    ? 'bg-[#f0b90b] text-black'
                                    : 'text-[#848e9c] hover:text-white'
                            }`}
                        >
                            <span>{t.icon}</span>
                            {t.label}
                            {t.badge > 0 && tab !== t.key && (
                                <span className="bg-[#f0b90b] text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                                    {t.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Plans Grid */}
                {tab === 'plans' && (
                    <>
                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="bg-[#0f1117] border border-[#1e2433] rounded-2xl p-5 animate-pulse h-72" />
                                ))}
                            </div>
                        ) : plans.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-[#848e9c] text-sm">No staking plans available at the moment.</div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {plans.map(plan => (
                                    <StakingPlanCard
                                        key={plan.id}
                                        plan={plan}
                                        onSubscribe={setSelectedPlan}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* My Staking */}
                {tab === 'my' && (
                    <div className="bg-[#0f1117] border border-[#1e2433] rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-white font-bold text-base">Staking History</h2>
                            <button
                                onClick={handleRefresh}
                                className="text-xs text-[#848e9c] hover:text-white flex items-center gap-1.5 cursor-pointer transition"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                        <MyStakingTable stakes={stakes} onRefresh={handleRefresh} />
                    </div>
                )}
            </div>

            {/* Subscribe Modal */}
            {selectedPlan && (
                <SubscribeModal
                    plan={selectedPlan}
                    onClose={() => setSelectedPlan(null)}
                    onSuccess={handleRefresh}
                />
            )}
        </div>
    );
}
