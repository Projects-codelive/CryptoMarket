export function formatINR(amount) {
  return '\u20B9' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatINRShort(amount) {
  if (amount >= 10000000) return '\u20B9' + (amount / 10000000).toFixed(2) + 'Cr';
  if (amount >= 100000) return '\u20B9' + (amount / 100000).toFixed(2) + 'L';
  if (amount >= 1000) return '\u20B9' + (amount / 1000).toFixed(2) + 'K';
  return formatINR(amount);
}

export function formatPrice(price, decimals = 2) {
  return Number(price).toFixed(decimals);
}

export function formatAmount(amount, decimals = 4) {
  return Number(amount).toFixed(decimals);
}
