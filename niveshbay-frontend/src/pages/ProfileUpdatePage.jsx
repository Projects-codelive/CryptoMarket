import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '../api/profile';
import toast from 'react-hot-toast';

const LABEL_MAP = {
  first_name: 'First Name',
  last_name: 'Last Name',
  username: 'Username',
  language: 'Language',
  country: 'Country',
  city: 'City',
  address: 'Address',
  bio: 'Bio',
  image: 'Profile Image URL',
};

const PROFILE_FIELDS = [
  'first_name', 'last_name', 'username', 'language',
  'country', 'city', 'address', 'bio', 'image',
];

export default function ProfileUpdatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getProfile();
        if (!cancelled) {
          const initial = {};
          for (const f of PROFILE_FIELDS) initial[f] = data[f] || '';
          setForm(initial);
          setEmail(data.email);
          setPhone(data.phone || '');
        }
      } catch (err) {
        if (!cancelled) setFetchError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated successfully');
      navigate('/me');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-8 text-center">
          <p className="text-[#f6465d] text-sm font-semibold">{fetchError}</p>
          <button
            onClick={() => navigate('/me')}
            className="mt-4 text-xs text-[#f0b90b] hover:underline cursor-pointer"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate('/trade/SOL-USDT')}
          className="flex items-center gap-2 text-[#848e9c] hover:text-white text-xs font-semibold mb-4 transition cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
        <form
          onSubmit={handleSubmit}
          className="bg-[#141822] border border-[#1e2433] rounded-lg p-6 md:p-8"
        >
          <h1 className="text-xl font-bold mb-6 text-[#f0b90b]">Edit Profile</h1>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-[#1e2433]">
              <div>
                <label className="block text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-1">Email</label>
                <p className="text-white text-sm font-medium">{email}</p>
              </div>
              <div>
                <label className="block text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-1">Phone</label>
                <p className="text-white text-sm font-medium">{phone || '-'}</p>
              </div>
            </div>

            <div className="space-y-4">
              {PROFILE_FIELDS.map(field => (
                <div key={field}>
                  <label className="block text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-1">
                    {LABEL_MAP[field] || field}
                  </label>
                  {field === 'bio' ? (
                    <textarea
                      value={form[field] || ''}
                      onChange={e => handleChange(field, e.target.value)}
                      className="w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] transition resize-none"
                      rows={3}
                    />
                  ) : (
                    <input
                      type={field === 'image' ? 'url' : 'text'}
                      value={form[field] || ''}
                      onChange={e => handleChange(field, e.target.value)}
                      placeholder={field === 'image' ? 'https://example.com/avatar.jpg' : `Enter ${LABEL_MAP[field] || field}`}
                      className="w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] transition"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate('/me')}
              className="flex-1 bg-[#1e2433] hover:bg-[#2b3548] text-white font-bold py-3 rounded-lg text-sm transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#f0b90b] hover:bg-[#f0c92b] disabled:bg-[#1e2433] disabled:text-[#848e9c] disabled:opacity-40 text-black font-bold py-3 rounded-lg text-sm transition cursor-pointer shadow-lg"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
