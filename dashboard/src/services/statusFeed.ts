import { Position } from '../types';

/** Läser den sanerade read-only-feeden (data/status.json på gh-pages). Saknas/inaktuell => okänt. */
export const STALE_MINUTES = 75; // schema var 30:e min + marginal

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export interface FeedAccountView {
  totalEquityUSD?: number;
  ok: boolean;
  fetchedAt?: string;
  errors: string[];
  openOrders: number;
  algoOrders: number;
}

export interface FeedView {
  generatedAt?: string;
  stale: boolean;
  anna: FeedAccountView;
  lena: FeedAccountView;
  totalEquityUSD?: number;
  positions: Position[];
}

const accView = (a: any, fresh: boolean): FeedAccountView => ({
  totalEquityUSD: fresh && a?.ok ? num(a?.totalEqUsd) : undefined,
  ok: Boolean(fresh && a?.ok),
  fetchedAt: typeof a?.fetched_at === 'string' ? a.fetched_at : undefined,
  errors: a?.errors && typeof a.errors === 'object' ? Object.keys(a.errors).map(k => `${k}: ${a.errors[k]?.code ?? ''}`) : [],
  openOrders: Array.isArray(a?.open_orders) ? a.open_orders.length : 0,
  algoOrders: Array.isArray(a?.algo_orders) ? a.algo_orders.length : 0,
});

const toPositions = (a: any, bot: Position['bot']): Position[] =>
  (Array.isArray(a?.positions) ? a.positions : []).map((p: any, i: number) => {
    const pos = num(p.pos) ?? 0;
    const avg = num(p.avgPx) ?? 0;
    const mark = num(p.markPx) ?? avg;
    return {
      id: `FEED-${bot === 'Aggressiva Lena' ? 'LENA' : 'ANNA'}-${p.instId ?? i}`,
      bot,
      symbol: String(p.instId ?? 'okänt'),
      side: p.posSide === 'short' || pos < 0 ? 'SELL' : 'BUY',
      entry_price: avg,
      current_price: mark,
      high_price: Math.max(avg, mark),
      size_units: Math.abs(pos),
      allocated_usd: num(p.margin) ?? 0,
      unrealized_pnl: num(p.upl) ?? 0,
      pnl_pct: (num(p.uplRatio) ?? 0) * 100,
      opened_at: num(p.cTime) ? new Date(num(p.cTime)!).toISOString() : '',
    } as Position;
  });

export async function loadStatusFeed(): Promise<FeedView | null> {
  try {
    const res = await fetch(`./data/status.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    const gen = typeof d?.generated_at === 'string' ? Date.parse(d.generated_at) : NaN;
    const fresh = Number.isFinite(gen) && Date.now() - gen < STALE_MINUTES * 60_000;
    const anna = accView(d?.anna, fresh);
    const lena = accView(d?.lena, fresh);
    const total = anna.totalEquityUSD !== undefined && lena.totalEquityUSD !== undefined
      ? anna.totalEquityUSD + lena.totalEquityUSD : undefined;
    return {
      generatedAt: d?.generated_at, stale: !fresh, anna, lena, totalEquityUSD: total,
      positions: fresh ? [
        ...(d?.anna?.ok ? toPositions(d.anna, 'Tradebotten Anna') : []),
        ...(d?.lena?.ok ? toPositions(d.lena, 'Aggressiva Lena') : []),
      ] : [],
    };
  } catch {
    return null;
  }
}
