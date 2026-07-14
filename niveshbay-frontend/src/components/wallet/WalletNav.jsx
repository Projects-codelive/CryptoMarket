import { NavLink } from 'react-router-dom';

const WALLET_TABS = [
  { label: 'Spot Wallet',    to: '/wallet/spot'          },
  { label: 'Fund Wallet',    to: '/wallet/fund'          },
  { label: 'Share Wallet',   to: '/wallet/share'         },
  { label: 'Trade History',  to: '/wallet/trade-history' },
  { label: 'Balance Log',    to: '/wallet/balance-log'   },
];

export default function WalletNav() {
  return (
    <div className="flex items-center gap-1 mb-6 flex-wrap">
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