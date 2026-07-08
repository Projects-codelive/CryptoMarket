import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStakingPlans } from '../hooks/useStakingPlans';
import { useMyStaking } from '../hooks/useMyStaking';
import StakingPlanCard from '../components/staking/StakingPlanCard';
import SubscribeModal from '../components/staking/SubscribeModal';
import MyStakingTable from '../components/staking/MyStakingTable';

export default function StakingPage() {
    const navigate = useNavigate();
    const { plans, isLoading, refreshPlans } = useStakingPlans();
    const { stakes, refreshMyStaking } = useMyStaking();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [tab, setTab] = useState('plans');

    async function handleRefresh() {
        await Promise.all([refreshPlans(), refreshMyStaking()]);
    }

    return (
        <div className="min-h-screen bg-[#0b0e11] text-white">
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Staking</h1>
                        <p className="text-[#848e9c] text-sm mt-1">Stake INR and earn rewards</p>
                    </div>
                    <button
                        onClick={() => navigate('/trade/SOL-INR')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-[#2b3548] text-[#848e9c] hover:text-white rounded bg-[#141822] hover:bg-[#1e2433] transition cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                        </svg>
                        Go to Dashboard
                    </button>
                </div>

                <div className="flex gap-1 bg-[#141822] rounded-lg p-1 border border-[#1e2433] mb-6 w-fit">
                    {[
                        { key: 'plans', label: 'Available Plans' },
                        { key: 'my', label: 'My Staking' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition ${
                                tab === t.key ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-white'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'plans' && (
                    isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-[#141822] border border-[#1e2433] rounded-lg p-5 animate-pulse h-56" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {plans.map(plan => {
                                const subscribed = stakes.some(s => s.plan_id === plan.id && (s.status === 'ACTIVE' || s.status === 'MATURED'));
                                return (
                                    <StakingPlanCard
                                        key={plan.id}
                                        plan={plan}
                                        subscribed={subscribed}
                                        onSubscribe={subscribed ? undefined : setSelectedPlan}
                                    />
                                );
                            })}
                        </div>
                    )
                )}

                {tab === 'my' && (
                    <MyStakingTable stakes={stakes} onRefresh={handleRefresh} />
                )}
            </div>

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
