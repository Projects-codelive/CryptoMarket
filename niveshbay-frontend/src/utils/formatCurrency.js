// formatCurrency.js — All prices are now displayed in USDT ($)
// formatINR is kept as an alias so existing imports don't break, but outputs $ now

export function formatINR(amount) {
  return '$' + Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatINRShort(amount) {
  const n = Number(amount || 0);
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000)    return '$' + (n / 1000).toFixed(2) + 'K';
  return formatINR(n);
}

export function formatPrice(price, decimals = 2) {
  return Number(price).toFixed(decimals);
}

export function formatAmount(amount, decimals = 4) {
  return Number(amount).toFixed(decimals);
}

export function formatCurrency(amount, quoteSymbol = 'USDT') {
  const sym = (quoteSymbol || 'USDT').toUpperCase();
  if (sym === 'USDT') {
    return '$' + Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ' + sym;
}
