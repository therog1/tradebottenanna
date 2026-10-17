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
  lastOrderAt?: string;
  /** Summa realizedPnl ur OKX positions-history (USD). */
  realizedPnl?: number;
  /** Realiserad PnL idag (Europe/Stockholm). */
  realizedPnlToday?: number;
}

export interface FeedView {
  generatedAt?: string;
  stale: boolean;
  anna: FeedAccountView;
  lena: FeedAccountView;
  totalEquityUSD?: number;
  positions: Position[];
  updatedAt?: string;
  feedOk?: boolean;
}

const accView = (a: any, fresh: boolean): FeedAccountView => ({
  totalEquityUSD: fresh && a?.ok ? num(a?.totalEqUsd) : undefined,
  ok: Boolean(fresh && a?.ok),
  fetchedAt: typeof a?.fetched_at === 'string' ? a.fetched_at : undefined,
  errors: a?.errors && typeof a.errors === 'object' ? Object.keys(a.errors).map(k => `${k}: ${a.errors[k]?.code ?? ''}`) : [],
  openOrders: Array.isArray(a?.open_orders) ? a.open_orders.length : 0,
  algoOrders: Array.isArray(a?.algo_orders) ? a.algo_orders.length : 0,
  lastOrderAt: typeof a?.last_order_at === 'string' ? a.last_order_at : undefined,
  realizedPnl: fresh && a?.ok ? num(a?.realized_pnl) : undefined,
  realizedPnlToday: fresh && a?.ok ? num(a?.realized_pnl_today) : undefined,
});

const isFresh = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && Date.now() - t < STALE_MINUTES * 60_000;
};

const toPositions = (a: any, bot: Position['bot']): Position[] =>
  (Array.isArray(a?.positions) ? a.positions : []).map((p: any, i: number) => {
    const pos = num(p.pos) ?? 0;
    const avg = num(p.avgPx) ?? 0;
    const mark = num(p.markPx) ?? avg;
    return {
      id: `FEED-${bot === 'Aggressiva Lena' ? 'LENA' : 'ANNA'}-${p.instId ?? i}`,
      bot,
      symbol: `${String(p.instId ?? 'okänt')}${p.product ? ` · ${p.product}` : ''}${
        (Array.isArray(a?.algo_orders) ? a.algo_orders : []).some((o: any) => o?.instId === p.instId && o?.slTriggerPx != null)
          ? ' · SL hos OKX' : ' · INGEN SL hos OKX'}`,
      side: p.posSide === 'short' || pos < 0 ? 'SELL' : 'BUY',
      entry_price: avg,
      current_price: mark,
      high_price: Math.max(avg, mark),
      size_units: Math.abs(pos),
      allocated_usd: num(p.margin) ?? 0,
      unrealized_pnl: num(p.upl) ?? 0,
      pnl_pct: (num(p.uplRatio) ?? 0) * 100,
      leverage: num(p.lever) ?? undefined,
      margin_mode: p.mgnMode ? String(p.mgnMode) : undefined,
      opened_at: num(p.cTime) ? new Date(num(p.cTime)!).toISOString() : '',
    } as Position;
  });

export async function loadStatusFeed(): Promise<FeedView | null> {
  try {
    const url = `${import.meta.env.BASE_URL}data/status.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    const annaFresh = isFresh(d?.anna?.fetched_at);
    const lenaFresh = isFresh(d?.lena?.fetched_at);
    const anna = accView(d?.anna, annaFresh);
    const lena = accView(d?.lena, lenaFresh);
    const total = anna.totalEquityUSD !== undefined && lena.totalEquityUSD !== undefined
      ? anna.totalEquityUSD + lena.totalEquityUSD : undefined;
    const updatedAt = [anna.ok ? d?.anna?.fetched_at : undefined, lena.ok ? d?.lena?.fetched_at : undefined, d?.health?.last_success]
      .filter((x): x is string => typeof x === 'string').sort().pop();
    return {
      generatedAt: d?.generated_at, stale: !(annaFresh || lenaFresh), anna, lena, totalEquityUSD: total,
      updatedAt, feedOk: d?.health?.feed_ok,
      positions: [
        ...(anna.ok ? toPositions(d.anna, 'Tradebotten Anna') : []),
        ...(lena.ok ? toPositions(d.lena, 'Aggressiva Lena') : []),
      ],
    };
  } catch {
    return null;
  }
}
