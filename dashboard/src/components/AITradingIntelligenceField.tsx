import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Intelligence Field – ORBIT-läge (read-only, ingen AI, inga trade-anrop).
 * Varje bot = planet, varje position = måne. All geometri härleds från ./data/status.json:
 *  - månens storlek = risk i USD = |entry − SL| × ctVal × kontrakt
 *  - färg = uPnL i förhållande till risken (grön → röd)
 *  - banradie = hur långt kvar till SL (SL vid planetytan, entry mitt, TP ytterring)
 *  - longs medurs, shorts moturs; puls när < 30 % av avståndet entry→SL återstår
 *  - båge runt planeten = andel av 3 %-risktaket som används
 * Saknade värden visas som "okänt" – inget hittas på.
 */

type Mode = 'ORBIT' | 'ANNA' | 'LENA' | 'RESEARCH';
type BotKey = 'anna' | 'lena';
const STALE_MINUTES = 75;
const RISK_CAP_PCT = 0.03;
const OKANT = 'okänt';
const COLORS: Record<BotKey, { core: string; glow: string; name: string }> = {
  anna: { core: '#22d3ee', glow: 'rgba(34,211,238,', name: 'ANNA' },
  lena: { core: '#fbbf24', glow: 'rgba(251,191,36,', name: 'LENA' },
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

interface Moon {
  id: string; bot: BotKey; instId: string; coin: string; long: boolean; contracts: number;
  entry?: number; mark?: number; sl?: number; tp?: number; lever?: number; mgnMode?: string;
  upl?: number; ctVal?: number; ctValCcy?: string; risk?: number;
  slLeft?: number; // 1 = vid entry, 0 = vid SL, >1 = i vinst
  orbit?: number;  // 0..1 normaliserad banradie
  phase: number;
}
interface Bot {
  key: BotKey; ok: boolean; fetchedAt?: string; ageMin?: number; stale: boolean;
  equity?: number; cap?: number; used: number; unknownRisk: number; moons: Moon[];
}
interface LogEvent { t: number; bot: BotKey; text: string; kind: 'open' | 'close' | 'order' | 'info'; }
interface FieldData { loaded: boolean; missing: boolean; generatedAt?: string; bots: Record<BotKey, Bot>; history: LogEvent[]; }

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const emptyBot = (key: BotKey): Bot => ({ key, ok: false, stale: true, used: 0, unknownRisk: 0, moons: [] });

function buildBot(key: BotKey, a: any): Bot {
  if (!a || typeof a !== 'object') return emptyBot(key);
  const fetchedAt = typeof a.fetched_at === 'string' ? a.fetched_at : undefined;
  const t = fetchedAt ? Date.parse(fetchedAt) : NaN;
  const ageMin = Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : undefined;
  const equity = a.ok === true ? num(a.totalEqUsd) : undefined;
  const algos: any[] = Array.isArray(a.algo_orders) ? a.algo_orders : [];
  const moons: Moon[] = (Array.isArray(a.positions) ? a.positions : []).filter((p: any) => num(p?.pos)).map((p: any) => {
    const pos = num(p.pos)!; const long = pos > 0; const instId = String(p.instId || OKANT);
    const algo = algos.find(o => o?.instId === instId && (num(o.slTriggerPx) || num(o.tpTriggerPx)));
    const sl = num(algo?.slTriggerPx), tp = num(algo?.tpTriggerPx);
    const entry = num(p.avgPx), mark = num(p.markPx), ctVal = num(p.ctVal);
    const contracts = Math.abs(pos);
    const risk = entry !== undefined && sl !== undefined && ctVal !== undefined ? Math.abs(entry - sl) * ctVal * contracts : undefined;
    let slLeft: number | undefined, orbit: number | undefined;
    if (entry !== undefined && sl !== undefined && mark !== undefined && entry !== sl) {
      slLeft = (mark - sl) / (entry - sl);
      if (slLeft <= 1) orbit = 0.5 * Math.max(0, slLeft);
      else if (tp !== undefined && tp !== entry) orbit = 0.5 + 0.5 * Math.min(1, (mark - entry) / (tp - entry));
      else orbit = Math.min(1, 0.5 + 0.5 * (slLeft - 1));
    }
    return { id: `${key}:${instId}:${long ? 'L' : 'S'}`, bot: key, instId, coin: instId.split('-')[0], long, contracts,
      entry, mark, sl, tp, lever: num(p.lever), mgnMode: typeof p.mgnMode === 'string' ? p.mgnMode : undefined,
      upl: num(p.upl), ctVal, ctValCcy: typeof p.ctValCcy === 'string' ? p.ctValCcy : undefined, risk, slLeft, orbit, phase: hash(instId) };
  });
  return { key, ok: a.ok === true, fetchedAt, ageMin, stale: ageMin === undefined || ageMin >= STALE_MINUTES, equity,
    cap: equity !== undefined ? equity * RISK_CAP_PCT : undefined,
    used: moons.reduce((s, m) => s + (m.risk ?? 0), 0), unknownRisk: moons.filter(m => m.risk === undefined).length, moons };
}

function historyEvents(key: BotKey, a: any): LogEvent[] {
  const out: LogEvent[] = [];
  for (const o of Array.isArray(a?.recent_orders) ? a.recent_orders : []) {
    const t = num(o?.cTime); if (!t || o?.state !== 'filled') continue;
    out.push({ t, bot: key, kind: 'order', text: `${String(o.side || '?').toUpperCase()} ${num(o.accFillSz) ?? num(o.sz) ?? '?'} ${String(o.instId || '').split('-')[0]} @ ${num(o.avgPx) ?? OKANT}` });
  }
  return out;
}

async function loadFieldData(): Promise<FieldData> {
  const base: FieldData = { loaded: true, missing: true, bots: { anna: emptyBot('anna'), lena: emptyBot('lena') }, history: [] };
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/status.json?orbit=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return base;
    const text = await res.text(); if (!text.trim()) return base;
    const d = JSON.parse(text); if (!d || typeof d !== 'object') return base;
    return { loaded: true, missing: false, generatedAt: typeof d.generated_at === 'string' ? d.generated_at : undefined,
      bots: { anna: buildBot('anna', d.anna), lena: buildBot('lena', d.lena) },
      history: [...historyEvents('anna', d.anna), ...historyEvents('lena', d.lena)].sort((x, y) => y.t - x.t).slice(0, 12) };
  } catch { return base; }
}

// ---------- format ----------
const fmtPx = (v?: number) => (v === undefined ? OKANT : v >= 1000 ? v.toFixed(1) : v >= 1 ? v.toFixed(3) : v.toPrecision(4));
const fmtUsd = (v?: number, d = 2) => (v === undefined ? OKANT : `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(d)}`);
const fmtAge = (m?: number) => (m === undefined ? OKANT : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const fmtTime = (t: number) => { const d = new Date(t); const hm = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === new Date().toDateString() ? hm : `${d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'numeric' })} ${hm}`; };
const botStatus = (b: Bot) => (!b.fetchedAt ? OKANT : !b.ok ? 'FEL' : b.stale ? 'gammal data' : 'LIVE');

/** grön (vinst) → gul → röd (förlust), skalat mot positionens risk */
function pnlColor(m: Moon): [number, number, number] {
  let x: number;
  if (m.upl === undefined) return [148, 163, 184];
  if (m.risk) x = Math.max(-1, Math.min(1, m.upl / m.risk));
  else x = m.upl > 0 ? 0.5 : m.upl < 0 ? -0.5 : 0;
  const g: [number, number, number] = [52, 211, 153], y: [number, number, number] = [250, 204, 21], r: [number, number, number] = [244, 63, 94];
  const [a, b, k] = x >= 0 ? [y, g, x] : [y, r, -x];
  return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * k)) as [number, number, number];
}

interface Hit { id: string; x: number; y: number; r: number; }
interface Flash { kind: 'open' | 'close'; bot: BotKey; moonId: string; t0: number; x?: number; y?: number; }

export function AITradingIntelligenceField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<FieldData>({ loaded: false, missing: true, bots: { anna: emptyBot('anna'), lena: emptyBot('lena') }, history: [] });
  const [mode, setMode] = useState<Mode>('ORBIT');
  const [paused, setPaused] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const prevIds = useRef<Map<string, Moon> | null>(null);
  const hits = useRef<Hit[]>([]);
  const flashes = useRef<Flash[]>([]);
  const live = useRef({ data, mode, paused, lowPower, selected });
  live.current = { data, mode, paused, lowPower, selected };

  // datahämtning + diff → flash/logg
  useEffect(() => {
    let alive = true;
    const run = () => loadFieldData().then(d => {
      if (!alive) return;
      const now = Date.now();
      const cur = new Map<string, Moon>();
      for (const b of [d.bots.anna, d.bots.lena]) for (const m of b.moons) cur.set(m.id, m);
      const prev = prevIds.current; const diff: LogEvent[] = [];
      if (prev && !d.missing) {
        for (const [id, m] of cur) if (!prev.has(id)) {
          flashes.current.push({ kind: 'open', bot: m.bot, moonId: id, t0: performance.now() });
          diff.push({ t: now, bot: m.bot, kind: 'open', text: `Ny ${m.long ? 'LONG' : 'SHORT'} ${m.coin} ×${m.contracts}` });
        }
        for (const [id, m] of prev) if (!cur.has(id)) {
          const h = hits.current.find(x => x.id === id);
          flashes.current.push({ kind: 'close', bot: m.bot, moonId: id, t0: performance.now(), x: h?.x, y: h?.y });
          diff.push({ t: now, bot: m.bot, kind: 'close', text: `Stängd ${m.long ? 'LONG' : 'SHORT'} ${m.coin}` });
        }
      }
      if (!d.missing) prevIds.current = cur;
      setEvents(e => [...diff, ...e].slice(0, 20));
      setData(d);
    });
    run();
    const iv = setInterval(run, 2 * 60 * 1000);
    window.addEventListener('tb-refresh', run);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('tb-refresh', run); };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReducedMotion(mq.matches); on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // ---------- rendering (Canvas 2D med glöd) ----------
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let raf = 0, simT = 0, last = performance.now(), lastDraw = 0;
    const dprOf = () => Math.min(window.devicePixelRatio || 1, live.current.lowPower ? 1 : 2);
    const resize = () => {
      const dpr = dprOf();
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; ro?.observe(canvas);

    // deterministiska bakgrundsstjärnor (ren dekor, ingen data)
    let s = 987654; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 70 }, () => [rnd(), rnd(), rnd()]);

    const draw = (now: number) => {
      const L = live.current, D = L.data, dpr = dprOf();
      const W = canvas.clientWidth, H = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const glow = !L.lowPower;
      for (const [x, y, z] of stars) { ctx.fillStyle = `rgba(148,163,184,${0.08 + z * 0.25})`; ctx.fillRect(x * W, y * H, z > 0.85 ? 1.5 : 1, z > 0.85 ? 1.5 : 1); }

      const keys: BotKey[] = L.mode === 'ANNA' ? ['anna'] : L.mode === 'LENA' ? ['lena'] : ['anna', 'lena'];
      const vertical = keys.length === 2 && H > W * 0.9;
      const allRisk = Math.max(0.0001, ...keys.flatMap(k => D.bots[k].moons.map(m => m.risk ?? 0)));
      const newHits: Hit[] = [];
      const centers: Record<string, { x: number; y: number; R: number; P: number }> = {};

      keys.forEach((k, i) => {
        const b = D.bots[k], col = COLORS[k];
        const cellW = vertical || keys.length === 1 ? W : W / 2, cellH = vertical ? H / 2 : H;
        const cx = vertical || keys.length === 1 ? W / 2 : cellW * (i + 0.5);
        const cy = vertical ? cellH * (i + 0.5) + 6 : H / 2 + 6;
        const R = Math.min(cellW, cellH) * 0.42; const P = Math.max(12, R * 0.2);
        centers[k] = { x: cx, y: cy, R, P };
        const dim = b.stale ? 0.45 : 1;
        ctx.globalAlpha = dim;

        // banor: SL-yta, entry, TP-ring
        const rAt = (o: number) => P + 10 + o * (R - P - 10);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(244,63,94,.35)'; ctx.beginPath(); ctx.arc(cx, cy, rAt(0), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = 'rgba(148,163,184,.14)'; ctx.beginPath(); ctx.arc(cx, cy, rAt(0.5), 0, Math.PI * 2); ctx.stroke();
        if (b.moons.some(m => m.tp !== undefined)) { ctx.strokeStyle = 'rgba(52,211,153,.18)'; ctx.setLineDash([1, 6]); ctx.beginPath(); ctx.arc(cx, cy, rAt(1), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }

        // planet
        const g = ctx.createRadialGradient(cx - P * 0.3, cy - P * 0.3, P * 0.1, cx, cy, P * 2.4);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, col.core); g.addColorStop(0.42, col.glow + '0.25)'); g.addColorStop(1, col.glow + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, P * 2.4, 0, Math.PI * 2); ctx.fill();

        // risktak-båge
        const capR = P + 5;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(51,65,85,.8)'; ctx.beginPath(); ctx.arc(cx, cy, capR, 0, Math.PI * 2); ctx.stroke();
        if (b.cap) {
          const f = Math.min(1, b.used / b.cap);
          ctx.strokeStyle = f > 0.9 ? '#f43f5e' : f > 0.6 ? '#facc15' : col.core;
          if (glow) { ctx.shadowColor = ctx.strokeStyle as string; ctx.shadowBlur = 8; }
          ctx.beginPath(); ctx.arc(cx, cy, capR, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
        }

        // etiketter
        ctx.font = '600 11px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = col.core; ctx.fillText(col.name, cx, cy - R - 2 < 12 ? 12 : cy - R - 2);
        ctx.font = '10px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.fillStyle = 'rgba(203,213,225,.8)';
        const riskTxt = b.cap ? `risk ${fmtUsd(b.used)}${b.unknownRisk ? '+?' : ''} / ${fmtUsd(b.cap)}` : `risk ${OKANT}`;
        ctx.fillText(riskTxt, cx, Math.min(cy + R + 14, (vertical ? cellH * (i + 1) : H) - 4));

        // månar
        for (const m of b.moons) {
          const dir = m.long ? 1 : -1; // canvas: positiv vinkel = medurs
          const ang = m.phase * Math.PI * 2 + dir * simT * (0.35 + m.phase * 0.2);
          const r = rAt(m.orbit ?? 0.5);
          const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
          const size = m.risk !== undefined ? 4 + 9 * Math.sqrt(m.risk / allRisk) : 5;
          const danger = m.slLeft !== undefined && m.slLeft < 0.3;
          const pulse = danger ? 1 + 0.35 * Math.sin(now / 160) : 1;
          const [cr, cg, cb] = pnlColor(m);
          if (m.orbit === undefined) { ctx.setLineDash([2, 3]); }
          // trail
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},.25)`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, r, ang - dir * 0.5, ang, dir < 0); ctx.stroke(); ctx.setLineDash([]);
          if (glow) { ctx.shadowColor = `rgb(${cr},${cg},${cb})`; ctx.shadowBlur = danger ? 22 : 12; }
          ctx.fillStyle = m.risk === undefined ? 'rgba(15,23,42,.9)' : `rgb(${cr},${cg},${cb})`;
          ctx.strokeStyle = `rgb(${cr},${cg},${cb})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, size * pulse, 0, Math.PI * 2); ctx.fill(); if (m.risk === undefined) ctx.stroke();
          ctx.shadowBlur = 0;
          if (L.selected === m.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, size * pulse + 5, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = 'rgba(226,232,240,.85)'; ctx.font = '9px ui-monospace,Menlo,monospace';
          ctx.fillText(`${m.coin}${m.long ? '▲' : '▼'}`, x, y - size * pulse - 4);
          newHits.push({ id: m.id, x, y, r: Math.max(size + 8, 18) });
        }
        ctx.globalAlpha = 1;
      });

      // flash-effekter (öppnad = ljusstråle planet→måne, stängd = expanderande ring)
      const tNow = performance.now();
      flashes.current = flashes.current.filter(f => tNow - f.t0 < 2500);
      for (const f of flashes.current) {
        const c = centers[f.bot]; if (!c) continue; const a = 1 - (tNow - f.t0) / 2500; const col = COLORS[f.bot];
        if (f.kind === 'open') {
          const h = newHits.find(x => x.id === f.moonId); if (!h) continue;
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2; if (glow) { ctx.shadowColor = col.core; ctx.shadowBlur = 16; }
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(h.x, h.y); ctx.stroke(); ctx.shadowBlur = 0;
        } else {
          const x = f.x ?? c.x, y = f.y ?? c.y;
          ctx.strokeStyle = `rgba(244,63,94,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6 + (1 - a) * 40, 0, Math.PI * 2); ctx.stroke();
        }
      }
      hits.current = newHits;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const L = live.current;
      if (!L.paused) simT += dt;
      const minGap = L.lowPower ? 66 : 0; // lågeffekt ≈ 15 fps
      if (now - lastDraw >= minGap) { draw(now); lastDraw = now; }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && !reducedMotion && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    if (reducedMotion) { draw(performance.now()); (canvas as any).__orbitRedraw = () => draw(performance.now()); } else start();
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); ro?.disconnect(); delete (canvas as any).__orbitRedraw; };
  }, [reducedMotion, lowPower]);

  useEffect(() => { (canvasRef.current as any)?.__orbitRedraw?.(); }, [data, mode, selected]);

  const onPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: Hit | null = null, bd = Infinity;
    for (const h of hits.current) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { best = h; bd = d; } }
    setSelected(best ? best.id : null);
  }, []);

  const allMoons = useMemo(() => [...data.bots.anna.moons, ...data.bots.lena.moons], [data]);
  const visibleMoons = mode === 'ANNA' ? data.bots.anna.moons : mode === 'LENA' ? data.bots.lena.moons : mode === 'ORBIT' ? allMoons : [];
  const sel = allMoons.find(m => m.id === selected);
  const anyStale = data.missing || (mode === 'ANNA' ? data.bots.anna.stale : mode === 'LENA' ? data.bots.lena.stale : data.bots.anna.stale || data.bots.lena.stale);
  const log = useMemo(() => [...events, ...data.history].slice(0, 20), [events, data.history]);

  const tabBtn = (m: Mode, cls: string) => (
    <button key={m} type="button" onClick={() => { setMode(m); setSelected(null); }} aria-pressed={mode === m}
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold font-mono border transition ${mode === m ? cls : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>{m}</button>
  );
  const row = (k: string, v: string, cls = 'text-slate-100') => (
    <React.Fragment key={k}><dt className="text-slate-500">{k}</dt><dd className={`text-right ${v === OKANT ? 'text-slate-500 italic' : cls}`}>{v}</dd></React.Fragment>
  );

  return (
    <section data-testid="aitif" aria-label="Intelligence Field – Orbit"
      className="relative rounded-xl border border-slate-800 bg-[radial-gradient(ellipse_at_center,_#0b1220_0%,_#020617_75%)] overflow-hidden font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200">Orbit</h2>
          <span className="text-[10px] px-1.5 rounded bg-slate-800/80 text-slate-400">read-only</span>
          {data.loaded && (data.missing
            ? <span data-testid="aitif-missing" className="text-[10px] px-1.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60">status.json saknas – okänt</span>
            : anyStale && mode !== 'RESEARCH' && <span data-testid="aitif-stale" className="text-[10px] px-1.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">INAKTUELL DATA</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tabBtn('ORBIT', 'border-fuchsia-500/60 text-fuchsia-300 bg-fuchsia-950/40')}
          {tabBtn('ANNA', 'border-cyan-500/60 text-cyan-300 bg-cyan-950/40')}
          {tabBtn('LENA', 'border-amber-500/60 text-amber-300 bg-amber-950/40')}
          {tabBtn('RESEARCH', 'border-purple-500/60 text-purple-300 bg-purple-950/40')}
          <button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused}
            className="px-2 py-1 rounded-md text-[11px] border border-slate-700 text-slate-300">{paused ? 'Spela' : 'Paus'}</button>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            <input type="checkbox" checked={lowPower} onChange={e => setLowPower(e.target.checked)} />Lågeffekt
          </label>
        </div>
      </div>

      {mode === 'RESEARCH' ? (
        <div className="h-48 flex items-center justify-center text-[11px] text-slate-500">Ingen research-feed ansluten – {OKANT}</div>
      ) : (
        <div className={`relative ${mode === 'ORBIT' ? 'h-[520px] sm:h-80' : 'h-80'}`}>
          <canvas key={`${lowPower}-${reducedMotion}`} ref={canvasRef} onPointerDown={onPointer} data-testid="orbit-canvas"
            className="absolute inset-0 w-full h-full touch-manipulation cursor-pointer" aria-label="Orbit: botar som planeter, positioner som månar" />
          {/* status per bot */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 text-[10px] pointer-events-none">
            {(['anna', 'lena'] as BotKey[]).filter(k => mode === 'ORBIT' || mode.toLowerCase() === k).map(k => {
              const b = data.bots[k];
              return <span key={k} className="px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-800" style={{ color: COLORS[k].core }}>
                {COLORS[k].name} · {botStatus(b)} · eq {fmtUsd(b.equity)} · {fmtAge(b.ageMin)}</span>;
            })}
          </div>
          {sel && (
            <div data-testid="orbit-card" className="absolute right-2 bottom-2 w-60 rounded-lg border border-slate-700 bg-slate-950/90 backdrop-blur px-3 py-2 text-[11px] shadow-[0_0_24px_rgba(34,211,238,.15)]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold" style={{ color: COLORS[sel.bot].core }}>{COLORS[sel.bot].name} · {sel.coin}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-slate-500 px-1" aria-label="Stäng">✕</button>
              </div>
              <div className="text-[9px] text-slate-400 mb-1 break-all">{sel.instId}</div>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                
                {row('Riktning', sel.long ? 'LONG' : 'SHORT', sel.long ? 'text-emerald-300' : 'text-rose-300')}
                {row('Storlek', `${sel.contracts} ct${sel.ctVal !== undefined ? ` (${+(sel.contracts * sel.ctVal).toPrecision(6)} ${sel.ctValCcy ?? ''})` : ''}`)}
                {row('Entry', fmtPx(sel.entry))}
                {row('Mark', fmtPx(sel.mark))}
                {row('Stop loss', fmtPx(sel.sl), 'text-rose-300')}
                {row('Take profit', fmtPx(sel.tp), 'text-emerald-300')}
                {row('Hävstång', sel.lever !== undefined ? `${sel.lever}x ${sel.mgnMode ?? ''}` : OKANT)}
                {row('Risk', fmtUsd(sel.risk, 3))}
                {row('Kvar till SL', sel.slLeft !== undefined ? `${Math.round(Math.max(0, sel.slLeft) * 100)} %` : OKANT, sel.slLeft !== undefined && sel.slLeft < 0.3 ? 'text-rose-400' : 'text-slate-100')}
                {row('uPnL', fmtUsd(sel.upl, 3), sel.upl !== undefined && sel.upl < 0 ? 'text-rose-300' : 'text-emerald-300')}
              </dl>
            </div>
          )}
        </div>
      )}

      {mode !== 'RESEARCH' && (
        <div className="flex flex-wrap gap-1 px-3 py-1.5 border-t border-slate-800/80" aria-label="Positioner">
          {visibleMoons.length === 0 && <span className="text-[10px] text-slate-500">{data.loaded ? 'Inga öppna positioner' : 'Laddar…'}</span>}
          {visibleMoons.map(m => {
            const [r, g, b] = pnlColor(m);
            return <button key={m.id} type="button" data-testid="orbit-chip" onClick={() => setSelected(s => (s === m.id ? null : m.id))}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${selected === m.id ? 'border-white' : 'border-slate-700'} text-slate-200`}>
              <span style={{ color: COLORS[m.bot].core }}>●</span> {m.coin}{m.long ? '▲' : '▼'} <span style={{ color: `rgb(${r},${g},${b})` }}>{fmtUsd(m.upl, 2)}</span>
            </button>;
          })}
        </div>
      )}

      <div data-testid="orbit-log" className="h-20 overflow-y-auto px-3 py-1.5 border-t border-slate-800/80 text-[10px] leading-4 bg-slate-950/60">
        {log.length === 0 ? <div className="text-slate-500">Ingen händelselogg ännu – {OKANT}</div> : log.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-500">{fmtTime(e.t)}</span>
            <span style={{ color: COLORS[e.bot].core }}>{COLORS[e.bot].name}</span>
            <span className={e.kind === 'open' ? 'text-emerald-300' : e.kind === 'close' ? 'text-rose-300' : 'text-slate-300'}>{e.text}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-1.5 text-[9px] text-slate-600 bg-slate-950/60">
        Storlek = risk (USD) · färg = uPnL/risk · inre streckad ring = SL · yttre = TP · ▲ long medurs · ▼ short moturs · båge = andel av 3 %-risktak
      </div>
    </section>
  );
}

export default AITradingIntelligenceField;
