// components/wallet/WalletNav.jsx
// Tab bar rendered at the top of every wallet page so users can switch wallets.

import { NavLink } from 'react-router-dom';

const WALLET_TABS = [
  { label: 'Spot Wallet',  to: '/wallet/spot'  },
  { label: 'Fund Wallet',  to: '/wallet/fund'  },
  { label: 'Share Wallet', to: '/wallet/share' },
];

export default function WalletNav() {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto">
      {WALLET_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `px-4 py-2 text-xs font-semibold rounded transition whitespace-nowrap ${
              isActive
                ? 'bg-[#f0b90b] text-black'
                : 'text-[#848e9c] hover:text-white hover:bg-[#1e2433]'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}