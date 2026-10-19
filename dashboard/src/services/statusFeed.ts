import { Position, Trade } from '../types';

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
  /** Tillgänglig USDC (availEq). */
  availUsd?: number;
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
  /** Stängda positioner ur OKX positions-history; undefined om feeden saknar fältet. */
  closedTrades?: Trade[];
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
  availUsd: fresh && a?.ok ? num((Array.isArray(a?.balances) ? a.balances : []).find((b: any) => b?.ccy === 'USDC')?.availEq) : undefined,
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
    const lev = num(p.lever);
    const notional = Math.abs(pos) * (num(p.ctVal) ?? 0) * mark;
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
      allocated_usd: num(p.margin) ?? (lev ? notional / lev : 0),
      notional_usd: notional,
      unrealized_pnl: num(p.upl) ?? 0,
      pnl_pct: (num(p.uplRatio) ?? 0) * 100,
      leverage: num(p.lever) ?? undefined,
      margin_mode: p.mgnMode ? String(p.mgnMode) : undefined,
      opened_at: num(p.cTime) ? new Date(num(p.cTime)!).toISOString() : '',
    } as Position;
  });

// OKX positions-history type: 1/2 = stängd (delvis/helt), 3/4 = likvidation, 5 = ADL
const exitReason = (t: unknown): Trade['exit_reason'] =>
  ['3', '4', '5'].includes(String(t)) ? 'LIQUIDATION' : 'EXCHANGE_FILL';

const toClosedTrades = (a: any, bot: Trade['bot']): Trade[] | undefined => {
  if (!Array.isArray(a?.closed_positions)) return undefined;
  return a.closed_positions.map((c: any, i: number) => {
    const pnl = num(c.realizedPnl) ?? 0;
    const ratio = num(c.pnlRatio);
    const lever = num(c.lever);
    const gross = num(c.pnl) ?? pnl;
    // notional ≈ marginal × hävstång, där marginal = pnl / pnlRatio
    const notional = ratio && lever ? Math.abs((gross / ratio) * lever) : 0;
    const dir = String(c.direction || c.posSide || '').toLowerCase();
    const t0 = num(c.cTime), t1 = num(c.uTime);
    return {
      id: `OKX-${bot === 'Aggressiva Lena' ? 'LENA' : 'ANNA'}-${c.instId ?? i}-${t1 ?? i}`,
      bot,
      symbol: `${String(c.instId ?? 'okänt')}${c.product ? ` · ${c.product}` : ''}`,
      side: dir === 'short' ? 'SELL' : 'BUY',
      entry_price: num(c.openAvgPx) ?? 0,
      exit_price: num(c.closeAvgPx) ?? 0,
      size_units: num(c.closeTotalPos) ?? 0,
      notional_usd: Math.round(notional),
      leverage: lever,
      realized_pnl: pnl,
      pnl_pct: (ratio ?? 0) * 100,
      exit_reason: exitReason(c.type),
      entry_time: t0 ? new Date(t0).toISOString() : '',
      exit_time: t1 ? new Date(t1).toISOString() : '',
      status: 'CLOSED',
    } as Trade;
  });
};

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
    const annaClosed = anna.ok ? toClosedTrades(d.anna, 'Tradebotten Anna') : undefined;
    const lenaClosed = lena.ok ? toClosedTrades(d.lena, 'Aggressiva Lena') : undefined;
    const closedTrades = annaClosed || lenaClosed
      ? [...(annaClosed ?? []), ...(lenaClosed ?? [])].sort((x, y) => y.exit_time.localeCompare(x.exit_time))
      : undefined;
    return {
      generatedAt: d?.generated_at, closedTrades, stale: !(annaFresh || lenaFresh), anna, lena, totalEquityUSD: total,
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
