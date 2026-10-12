export const MAX_CREATOR_MINOR_UNITS = 100_000_000_000;

export function isIsoCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function calculatePlatformFee(amountMinor: number, platformFeeBps: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > MAX_CREATOR_MINOR_UNITS) {
    throw new RangeError("Amount must be a positive integer in minor currency units.");
  }
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new RangeError("Platform fee must be integer basis points between 0 and 10000.");
  }
  return Math.floor((amountMinor * platformFeeBps) / 10_000);
}

export function creatorNetAmount(amountMinor: number, platformFeeBps: number, paymentFeeMinor: number): number {
  if (!Number.isSafeInteger(paymentFeeMinor) || paymentFeeMinor < 0) throw new RangeError("Payment fee must be a non-negative integer.");
  const net = amountMinor - calculatePlatformFee(amountMinor, platformFeeBps) - paymentFeeMinor;
  if (net < 0) throw new RangeError("Fees cannot exceed the gross amount.");
  return net;
}

export function sumLedgerBalance(entries: readonly { currency: string; amount_minor: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (!isIsoCurrency(entry.currency) || !Number.isSafeInteger(entry.amount_minor)) throw new TypeError("Invalid creator ledger entry.");
    const total = (totals.get(entry.currency) ?? 0) + entry.amount_minor;
    if (!Number.isSafeInteger(total)) throw new RangeError("Creator ledger balance exceeds safe integer range.");
    totals.set(entry.currency, total);
  }
  return totals;
}
