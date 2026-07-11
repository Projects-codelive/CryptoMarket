// pages/ProfilePage.jsx
// The Personal Details tab is 100% identical to the original.
// Only additions: tab bar + KYC tab + Bank Details tab.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile } from '../api/profile';
import { getKyc, saveKyc, getBankDetails, saveBankDetails } from '../api/profile';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_MAP = {
  first_name: 'First Name', last_name: 'Last Name', username: 'Username',
  language: 'Language', country: 'Country', city: 'City',
  address: 'Address', bio: 'Bio', image: 'Profile Image URL',
};
const PROFILE_FIELDS = [
  'first_name', 'last_name', 'username', 'language',
  'country', 'city', 'address', 'bio', 'image',
];

const DOC_TYPES = [
  { value: 'aadhaar',          label: 'Aadhaar Card'      },
  { value: 'pan',              label: 'PAN Card'           },
  { value: 'passport',         label: 'Passport'           },
  { value: 'driving_licence',  label: 'Driving Licence'    },
];

const ACCOUNT_TYPES = [
  { value: 'savings',  label: 'Savings'  },
  { value: 'current',  label: 'Current'  },
  { value: 'salary',   label: 'Salary'   },
  { value: 'other',    label: 'Other'    },
];

const TABS = ['Personal Details', 'KYC Details', 'Bank Details'];

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="block text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-1">
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, readOnly, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] transition ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`}
    />
  );
}

function SelectInput({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f0b90b] transition"
    >
      {children}
    </select>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending:  'bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/30',
    verified: 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/30',
    rejected: 'bg-[#f6465d]/10 text-[#f6465d] border border-[#f6465d]/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

// ── KYC Tab ───────────────────────────────────────────────────────────────────

function KycTab() {
  const [form, setForm] = useState({
    full_name: '', document_type: 'aadhaar', document_number: '',
    dob: '', address: '', city: '', state: '', country: '', postal_code: '',
  });
  const [status, setStatus]   = useState(null); // existing KYC status
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getKyc();
        if (!cancelled && res.kyc) {
          const k = res.kyc;
          setForm({
            full_name:       k.full_name       || '',
            document_type:   k.document_type   || 'aadhaar',
            document_number: k.document_number || '',
            dob:             k.dob ? k.dob.split('T')[0] : '',
            address:         k.address         || '',
            city:            k.city            || '',
            state:           k.state           || '',
            country:         k.country         || '',
            postal_code:     k.postal_code     || '',
          });
          setStatus(k.status);
        }
      } catch {
        // No KYC yet — form stays empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  // Client-side validation mirrors backend
  function validate() {
    const { full_name, document_type, document_number } = form;
    if (!full_name.trim())       { toast.error('Full name is required.');        return false; }
    if (!document_number.trim()) { toast.error('Document number is required.');  return false; }
    const doc = document_number.trim().toUpperCase();
    if (document_type === 'aadhaar'         && !/^\d{12}$/.test(doc))
      { toast.error('Aadhaar must be exactly 12 digits.');            return false; }
    if (document_type === 'pan'             && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(doc))
      { toast.error('PAN must follow format: ABCDE1234F.');           return false; }
    if (document_type === 'passport'        && !/^[A-Z0-9]{6,9}$/.test(doc))
      { toast.error('Passport must be 6–9 alphanumeric characters.'); return false; }
    if (document_type === 'driving_licence' && !/^[A-Z0-9\-]{5,20}$/.test(doc))
      { toast.error('Driving licence format is invalid.');            return false; }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await saveKyc(form);
      if (res.status === 1) {
        toast.success(res.message || 'KYC details saved.');
        setStatus(res.kyc?.status || 'pending');
      } else {
        toast.error(res.message || 'Failed to save KYC.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save KYC.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-6 h-6 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Status banner if KYC already exists */}
      {status && (
        <div className="flex items-center justify-between bg-[#1e2433] border border-[#2b3548] rounded px-4 py-2.5">
          <span className="text-xs text-[#848e9c]">KYC Status</span>
          <StatusBadge status={status} />
        </div>
      )}

      {/* Required */}
      <div className="pb-3 border-b border-[#1e2433]">
        <p className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-3">
          Required Information
        </p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Full Name <span className="text-[#f6465d]">*</span></FieldLabel>
            <TextInput value={form.full_name} onChange={set('full_name')} placeholder="As on document" />
          </div>
          <div>
            <FieldLabel>Document Type <span className="text-[#f6465d]">*</span></FieldLabel>
            <SelectInput value={form.document_type} onChange={set('document_type')}>
              {DOC_TYPES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Document Number <span className="text-[#f6465d]">*</span></FieldLabel>
            <TextInput
              value={form.document_number}
              onChange={set('document_number')}
              placeholder={
                form.document_type === 'aadhaar'         ? '12-digit Aadhaar number' :
                form.document_type === 'pan'             ? 'ABCDE1234F' :
                form.document_type === 'passport'        ? 'Passport number' :
                'Licence number'
              }
            />
          </div>
        </div>
      </div>

      {/* Optional */}
      <div>
        <p className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-3">
          Optional Information
        </p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Date of Birth</FieldLabel>
            <TextInput type="date" value={form.dob} onChange={set('dob')} />
          </div>
          <div>
            <FieldLabel>Address</FieldLabel>
            <textarea
              value={form.address}
              onChange={set('address')}
              placeholder="Street address"
              rows={2}
              className="w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b] transition resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>City</FieldLabel>
              <TextInput value={form.city} onChange={set('city')} placeholder="City" />
            </div>
            <div>
              <FieldLabel>State</FieldLabel>
              <TextInput value={form.state} onChange={set('state')} placeholder="State" />
            </div>
            <div>
              <FieldLabel>Country</FieldLabel>
              <TextInput value={form.country} onChange={set('country')} placeholder="Country" />
            </div>
            <div>
              <FieldLabel>Postal Code</FieldLabel>
              <TextInput value={form.postal_code} onChange={set('postal_code')} placeholder="Postal / ZIP code" />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-[#f0b90b] hover:bg-[#f0c92b] disabled:opacity-40 text-black font-bold py-3 rounded-lg text-sm transition cursor-pointer shadow-lg"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
            Saving...
          </span>
        ) : (
          status ? 'Update KYC Details' : 'Submit KYC Details'
        )}
      </button>
    </form>
  );
}

// ── Bank Details Tab ──────────────────────────────────────────────────────────

function BankTab() {
  const [form, setForm] = useState({
    account_holder_name: '', bank_name: '', account_number: '',
    ifsc_code: '', branch_name: '', account_type: '', upi_id: '',
  });
  const [hasRecord, setHasRecord] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getBankDetails();
        if (!cancelled && res.bank) {
          const b = res.bank;
          setForm({
            account_holder_name: b.account_holder_name || '',
            bank_name:           b.bank_name           || '',
            account_number:      b.account_number      || '',
            ifsc_code:           b.ifsc_code           || '',
            branch_name:         b.branch_name         || '',
            account_type:        b.account_type        || '',
            upi_id:              b.upi_id              || '',
          });
          setHasRecord(true);
        }
      } catch {
        // No bank details yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  function validate() {
    const { account_holder_name, bank_name, account_number, ifsc_code, upi_id } = form;
    if (!account_holder_name.trim()) { toast.error('Account holder name is required.');  return false; }
    if (!bank_name.trim())           { toast.error('Bank name is required.');             return false; }
    if (!account_number.trim())      { toast.error('Account number is required.');        return false; }
    if (!ifsc_code.trim())           { toast.error('IFSC code is required.');             return false; }
    if (!/^\d{9,18}$/.test(account_number.trim()))
      { toast.error('Account number must be 9–18 digits.');          return false; }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.trim().toUpperCase()))
      { toast.error('IFSC must follow format: ABCD0123456.');        return false; }
    if (upi_id.trim() && !/^[\w.\-_]+@[\w]+$/.test(upi_id.trim()))
      { toast.error('UPI ID format invalid (e.g. name@upi).');       return false; }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await saveBankDetails(form);
      if (res.status === 1) {
        toast.success(res.message || 'Bank details saved.');
        setHasRecord(true);
      } else {
        toast.error(res.message || 'Failed to save bank details.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save bank details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-6 h-6 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Required */}
      <div className="pb-3 border-b border-[#1e2433]">
        <p className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-3">
          Required Information
        </p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Account Holder Name <span className="text-[#f6465d]">*</span></FieldLabel>
            <TextInput value={form.account_holder_name} onChange={set('account_holder_name')} placeholder="Full name as on bank account" />
          </div>
          <div>
            <FieldLabel>Bank Name <span className="text-[#f6465d]">*</span></FieldLabel>
            <TextInput value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. State Bank of India" />
          </div>
          <div>
            <FieldLabel>Account Number <span className="text-[#f6465d]">*</span></FieldLabel>
            <TextInput value={form.account_number} onChange={set('account_number')} placeholder="9–18 digit account number" />
          </div>
          <div>
            <FieldLabel>IFSC Code <span className="text-[#f6465d]">*</span></FieldLabel>
            <TextInput value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="e.g. SBIN0001234" />
          </div>
        </div>
      </div>

      {/* Optional */}
      <div>
        <p className="text-[10px] text-[#848e9c] uppercase font-bold tracking-wider mb-3">
          Optional Information
        </p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Branch Name</FieldLabel>
            <TextInput value={form.branch_name} onChange={set('branch_name')} placeholder="e.g. MG Road Branch" />
          </div>
          <div>
            <FieldLabel>Account Type</FieldLabel>
            <SelectInput value={form.account_type} onChange={set('account_type')}>
              <option value="">Select account type</option>
              {ACCOUNT_TYPES.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>UPI ID</FieldLabel>
            <TextInput value={form.upi_id} onChange={set('upi_id')} placeholder="e.g. yourname@upi" />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-[#f0b90b] hover:bg-[#f0c92b] disabled:opacity-40 text-black font-bold py-3 rounded-lg text-sm transition cursor-pointer shadow-lg"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
            Saving...
          </span>
        ) : (
          hasRecord ? 'Update Bank Details' : 'Save Bank Details'
        )}
      </button>
    </form>
  );
}

// ── Personal Details Tab (original — unchanged) ───────────────────────────────

function PersonalDetailsTab({ profile, navigate }) {
  return (
    <div className="space-y-6">
      {/* Avatar row */}
      <div className="flex items-center gap-4 pb-4 border-b border-[#1e2433]">
        <div className="w-14 h-14 rounded-full bg-[#0ecb81] flex items-center justify-center text-xl font-bold text-black">
          {(profile.first_name?.[0] || profile.email?.[0] || 'U').toUpperCase()}
        </div>
        <div>
          <p className="text-white font-semibold text-lg">
            {profile.first_name || ''} {profile.last_name || ''}
          </p>
          <p className="text-[#848e9c] text-xs">{profile.user_id}</p>
        </div>
      </div>

      {/* Email / Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-[#1e2433]">
        <div>
          <FieldLabel>Email</FieldLabel>
          <p className="text-white text-sm font-medium">{profile.email}</p>
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <p className="text-white text-sm font-medium">{profile.phone || '-'}</p>
        </div>
      </div>

      {/* All profile fields — read-only, identical to original */}
      <div className="space-y-4">
        {PROFILE_FIELDS.map(field => (
          <div key={field}>
            <FieldLabel>{LABEL_MAP[field] || field}</FieldLabel>
            {field === 'bio' ? (
              <textarea
                readOnly value={profile[field] || ''}
                className="w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none resize-none cursor-not-allowed opacity-70"
                rows={3}
              />
            ) : (
              <input
                type={field === 'image' ? 'url' : 'text'}
                readOnly value={profile[field] || ''}
                className="w-full bg-[#1e2433] border border-[#2b3548] rounded px-3 py-2 text-sm text-white placeholder-[#848e9c] focus:outline-none cursor-not-allowed opacity-70"
              />
            )}
          </div>
        ))}
      </div>

      {/* Action buttons — identical to original */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => navigate('/balance')}
          className="flex-1 bg-[#1e2330] hover:bg-[#0ecb81]/15 border border-[#0ecb81] text-[#0ecb81] font-bold py-3 rounded-lg text-sm transition cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          Show Balance
        </button>
        <button
          onClick={() => navigate('/me/update')}
          className="flex-1 bg-[#f0b90b] hover:bg-[#f0c92b] text-black font-bold py-3 rounded-lg text-sm transition cursor-pointer shadow-lg"
        >
          Update Profile
        </button>
      </div>
    </div>
  );
}

// ── Main ProfilePage ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeTab, setActiveTab] = useState(0); // 0=Personal, 1=KYC, 2=Bank

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getProfile();
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg p-8 text-center">
          <p className="text-[#f6465d] text-sm font-semibold">{error}</p>
          <button
            onClick={() => navigate('/trade/SOL-INR')}
            className="mt-4 text-xs text-[#f0b90b] hover:underline cursor-pointer"
          >
            Back to Trading
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Back button — identical to original */}
        <button
          onClick={() => navigate('/trade/SOL-INR')}
          className="flex items-center gap-2 text-[#848e9c] hover:text-white text-xs font-semibold mb-4 transition cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-[#141822] border border-[#1e2433] rounded-lg p-6 md:p-8">
          <h1 className="text-xl font-bold mb-5 text-[#f0b90b]">My Profile</h1>

          {/* ── Tab bar ────────────────────────────────────────────────────── */}
          <div className="flex gap-1 mb-6 border-b border-[#1e2433] ">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
                  activeTab === i
                    ? 'border-[#f0b90b] text-[#f0b90b]'
                    : 'border-transparent text-[#848e9c] hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Tab content ────────────────────────────────────────────────── */}
          {activeTab === 0 && <PersonalDetailsTab profile={profile} navigate={navigate} />}
          {activeTab === 1 && <KycTab />}
          {activeTab === 2 && <BankTab />}
        </div>
      </div>
    </div>
  );
}