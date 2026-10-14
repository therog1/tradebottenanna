/** Visar 'okänt' när ett belopp inte är ett verifierat tal. Inga hårdkodade fallback-saldon. */
export const isKnown = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const fmtUsd = (v: unknown, digits = 2): string => (isKnown(v) ? `$${v.toFixed(digits)}` : 'okänt');
