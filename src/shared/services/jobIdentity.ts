// Collision-proof job ID: date + random suffix (never reused after auto-deletion).
export const createJobId = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  return `JOB-${date}-${random}`;
};

/**
 * Monotonic pickup-code allocator. Returns the next code given every token code
 * currently visible (so reloads re-seed correctly) and the session's last issued
 * number. Codes never decrease within a session and never collide with any
 * visible job — the core guarantee behind BUG-002.
 */
export const nextTokenNumber = (existingTokens: Iterable<string>, currentSequence: number): number => {
  let max = Math.max(127, currentSequence);
  for (const token of existingTokens) {
    const value = Number(token);
    if (Number.isInteger(value) && value > max) max = value;
  }
  return max + 1;
};
