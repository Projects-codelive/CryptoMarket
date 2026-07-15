// AdminStakingPanel.jsx - Updated to use staking / staking_log schema fields
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

const EMPTY_FORM = {
    coin_symbol: 'MDR',
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    plan: '',
    percentage: ''
};

export default function AdminStakingPanel({ plans, allStakes, onRefresh }) {
    const [tab, setTab] = useState('plans');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    async function handleCreate(e) {
        e.preventDefault();
        try {
            const res = await api.post('/api/v1/staking/admin/plans', form);
            if (res.data.status === 1) {
                toast.success('Plan created!');
                setShowCreate(false);
                setForm(EMPTY_FORM);
                if (onRefresh) onRefresh();
            } else {
                toast.error(res.data.message || 'Failed to create plan.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong.');
        }
    }

    async function handleToggleStatus(planId, currentStatus) {
        try {
            const res = await api.put(`/api/v1/staking/admin/plans/${planId}`, {
                status: currentStatus === 1 ? 0 : 1
            });
            if (res.data.status === 1) {
                toast.success('Plan status updated.');
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update plan.');
        }
    }

    async function handleDelete(planId) {
        if (!confirm('Delete this plan? Active stakes will block deletion.')) return;
        try {
            const res = await api.delete(`/api/v1/staking/admin/plans/${planId}`);
            if (res.data.status === 1) {
                toast.success('Plan deleted.');
                if (onRefresh) onRefresh();
            } else {
                toast.error(res.data.message || 'Failed to delete plan.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong.');
        }
    }

    const activeStakes = allStakes.filter(s => s.status === 'ACTIVE');
    const maturedStakes = allStakes.filter(s => s.status === 'MATURED');
    const totalStaked = allStakes.reduce((s, x) => s + parseFloat(x.stake_amount || 0), 0);

    return (
        <div>
            {/* Tabs */}
            <div className="flex gap-1 bg-[#0b0e11] rounded-xl p-1 mb-6 border border-[#1e2433] w-fit">
                {[
                    { key: 'plans', label: 'Plans' },
                    { key: 'stakes', label: 'All Stakes' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-5 py-2 text-xs font-bold rounded-lg cursor-pointer transition ${
                            tab === t.key ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Plans Tab */}
            {tab === 'plans' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-bold text-sm">Staking Plans</h3>
                        <button
                            onClick={() => setShowCreate(!showCreate)}
                            className="text-xs bg-[#f0b90b] text-black font-bold px-4 py-2 rounded-lg hover:bg-[#ffd333] cursor-pointer transition"
                        >
                            {showCreate ? 'Cancel' : '+ New Plan'}
                        </button>
                    </div>

                    {showCreate && (
                        <form onSubmit={handleCreate} className="bg-[#0b0e11] border border-[#1e2433] rounded-xl p-5 mb-5 space-y-4">
                            <h4 className="text-white font-bold text-sm mb-2">Create New Staking Plan</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'coin_symbol', label: 'Coin Symbol', placeholder: 'e.g. MDR' },
                                    { key: 'name', label: 'Plan Name', placeholder: 'e.g. Bronze' },
                                    { key: 'plan', label: 'Duration (months)', placeholder: 'e.g. 3' },
                                    { key: 'percentage', label: '% per Month', placeholder: 'e.g. 2.5' },
                                    { key: 'start_date', label: 'Start Date', placeholder: '2023-01-01 00:00:00' },
                                    { key: 'end_date', label: 'End Date', placeholder: '2026-01-01 00:00:00' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-[10px] text-[#848e9c] block mb-1">{f.label}</label>
                                        <input
                                            value={form[f.key]}
                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            className="w-full bg-[#141822] border border-[#2b3548] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#f0b90b] transition"
                                            required
                                        />
                                    </div>
                                ))}
                                <div className="col-span-2">
                                    <label className="text-[10px] text-[#848e9c] block mb-1">Description</label>
                                    <textarea
                                        value={form.description}
                                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                        rows={2}
                                        placeholder="Stake and earn monthly rewards…"
                                        className="w-full bg-[#141822] border border-[#2b3548] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#f0b90b] transition resize-none"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="bg-[#f0b90b] text-black font-bold text-xs px-5 py-2 rounded-lg hover:bg-[#ffd333] cursor-pointer transition"
                            >
                                Create Plan
                            </button>
                        </form>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-[#1e2433]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0f1117] text-[#848e9c] text-[10px] uppercase tracking-wider border-b border-[#1e2433]">
                                    <th className="text-left py-3 px-4 font-semibold">Coin</th>
                                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                                    <th className="text-right py-3 px-4 font-semibold">Duration</th>
                                    <th className="text-right py-3 px-4 font-semibold">%/Month</th>
                                    <th className="text-center py-3 px-4 font-semibold">Status</th>
                                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e2433]/50">
                                {plans.map(p => (
                                    <tr key={p.id} className="hover:bg-[#141822]/60 transition">
                                        <td className="py-3 px-4">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]">
                                                {p.coin_symbol}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-white font-semibold text-xs">{p.name}</td>
                                        <td className="py-3 px-4 text-white text-xs text-right">{p.plan} months</td>
                                        <td className="py-3 px-4 text-[#0ecb81] text-xs text-right font-bold">{p.percentage}%</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${p.status ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                                                {p.status ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleToggleStatus(p.id, p.status)}
                                                className="text-[10px] border border-[#2b3548] text-[#848e9c] px-2.5 py-1 rounded-lg hover:border-[#f0b90b] hover:text-[#f0b90b] cursor-pointer transition"
                                            >
                                                {p.status ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="text-[10px] border border-[#f6465d]/50 text-[#f6465d] px-2.5 py-1 rounded-lg hover:bg-[#f6465d]/10 cursor-pointer transition"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* All Stakes Tab */}
            {tab === 'stakes' && (
                <div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-[#0f1117] border border-[#1e2433] rounded-xl p-4">
                            <p className="text-[#848e9c] text-[10px] uppercase tracking-wider">Total Staked</p>
                            <p className="text-white font-bold text-lg mt-1">{totalStaked.toFixed(4)}</p>
                        </div>
                        <div className="bg-[#0f1117] border border-[#1e2433] rounded-xl p-4">
                            <p className="text-[#848e9c] text-[10px] uppercase tracking-wider">Active</p>
                            <p className="text-[#0ecb81] font-bold text-lg mt-1">{activeStakes.length}</p>
                        </div>
                        <div className="bg-[#0f1117] border border-[#1e2433] rounded-xl p-4">
                            <p className="text-[#848e9c] text-[10px] uppercase tracking-wider">Matured</p>
                            <p className="text-[#f0b90b] font-bold text-lg mt-1">{maturedStakes.length}</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#1e2433]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0f1117] text-[#848e9c] text-[10px] uppercase tracking-wider border-b border-[#1e2433]">
                                    <th className="text-left py-3 px-4 font-semibold">User</th>
                                    <th className="text-left py-3 px-4 font-semibold">Plan</th>
                                    <th className="text-left py-3 px-4 font-semibold">Coin</th>
                                    <th className="text-right py-3 px-4 font-semibold">Staked</th>
                                    <th className="text-right py-3 px-4 font-semibold">Reward</th>
                                    <th className="text-right py-3 px-4 font-semibold">Maturity</th>
                                    <th className="text-center py-3 px-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e2433]/50">
                                {allStakes.map(s => (
                                    <tr key={s.id} className="hover:bg-[#141822]/60 transition">
                                        <td className="py-3 px-4">
                                            <div className="text-white font-semibold text-xs">{s.first_name || s.user_id}</div>
                                            <div className="text-[#848e9c] text-[10px]">{s.email || ''}</div>
                                        </td>
                                        <td className="py-3 px-4 text-white text-xs">{s.plan_name}</td>
                                        <td className="py-3 px-4">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0b90b]/10 text-[#f0b90b]">
                                                {s.coin_symbol}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-white text-xs text-right font-semibold">
                                            {parseFloat(s.stake_amount).toFixed(4)}
                                        </td>
                                        <td className="py-3 px-4 text-[#f0b90b] text-xs text-right">
                                            +{parseFloat(s.reward_amount || 0).toFixed(4)}
                                        </td>
                                        <td className="py-3 px-4 text-[#848e9c] text-xs text-right">
                                            {s.maturity_date ? new Date(s.maturity_date).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <StatusBadge status={s.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
