import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard } from '../api/leaderboard';
import { formatINR } from '../utils/formatCurrency';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    getLeaderboard().then(data => {
      if (Array.isArray(data)) {
        setEntries(data.map(u => ({
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User',
          balance: parseFloat(u.balance || 0),
          user_id: u.user_id,
        })));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0e11]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-[#848e9c] hover:text-white text-sm mb-4">← Back</button>

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-white">Global Leaderboard</h1>
          <span className="text-[10px] font-semibold text-[#f0b90b] bg-[#f0b90b]/10 px-2 py-0.5 rounded">LIVE</span>
        </div>

        <div className="bg-[#161a1e] rounded-xl border border-[#2b2f36] overflow-hidden">
          <div className="grid grid-cols-4 text-xs text-[#848e9c] px-4 py-2 border-b border-[#2b2f36] font-medium">
            <span className="w-8">#</span>
            <span>Name</span>
            <span className="text-right">Balance</span>
            <span className="text-right">User ID</span>
          </div>
          {entries.length === 0 ? (
            <div className="text-center text-[#848e9c] py-8 text-sm">No data available</div>
          ) : (
            entries.map((entry, i) => (
              <div key={entry.user_id || i} className="grid grid-cols-4 text-sm px-4 py-3 hover:bg-[#1e2329] border-b border-[#2b2f36] last:border-0">
                <span className="w-8 text-[#848e9c]">{i + 1}</span>
                <span className="text-white font-medium">{entry.name}</span>
                <span className={`text-right font-bold ${entry.balance >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{formatINR(entry.balance)}</span>
                <span className="text-right text-[#848e9c]">{entry.user_id}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
