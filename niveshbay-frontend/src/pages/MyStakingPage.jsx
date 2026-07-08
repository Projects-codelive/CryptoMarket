import { useMyStaking } from '../hooks/useMyStaking';
import { useStakingPlans } from '../hooks/useStakingPlans';
import MyStakingTable from '../components/staking/MyStakingTable';
import StakingPlanCard from '../components/staking/StakingPlanCard';
import SubscribeModal from '../components/staking/SubscribeModal';
import { useState } from 'react';

export default function MyStakingPage() {
    const { stakes, isLoading, refreshMyStaking } = useMyStaking();
    const { plans, isLoading: plansLoading, refreshPlans } = useStakingPlans();
    const [selectedPlan, setSelectedPlan] = useState(null);

    async function handleRefresh() {
        await Promise.all([refreshMyStaking(), refreshPlans()]);
    }

    if (isLoading || plansLoading) {
        return (
            <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0b0e11] text-white">
            <div className="max-w-6xl mx-auto px-4 py-6">
                <h1 className="text-2xl font-bold mb-6">My Staking</h1>

                <div className="mb-8">
                    <h2 className="text-sm font-bold text-[#848e9c] uppercase tracking-wider mb-4">Your Stakes</h2>
                    <MyStakingTable stakes={stakes} onRefresh={handleRefresh} />
                </div>

                <div>
                    <h2 className="text-sm font-bold text-[#848e9c] uppercase tracking-wider mb-4">Available Plans</h2>
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
                </div>
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
