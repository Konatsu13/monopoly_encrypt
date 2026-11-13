/** Presentation formatters shared by UI and reports. */

export function formatMoney(amount, currency = 'CR') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `0 ${currency}`;
  return `${new Intl.NumberFormat('id-ID').format(value)} ${currency}`;
}

export function formatNumber(amount) {
  return new Intl.NumberFormat('id-ID').format(Number(amount) || 0);
}

/** Break ciphertext into display rows so long card messages stay readable. */
export function wrapCiphertext(ciphertext, maxLineLength = 34) {
  const words = String(ciphertext ?? '').split(' / ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} / ${word}` : word;
    if (candidate.length > maxLineLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function ordinal(number) {
  return `${number}`;
}

export function pluralPemain(count) {
  return `${count} pemain`;
}
