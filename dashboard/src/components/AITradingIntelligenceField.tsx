import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * AITradingIntelligenceField – isolerat, read-only visualiseringsfält.
 * - Ren WebGL (inga nya beroenden, inget CDN), NOLL AI-anrop.
 * - Data: endast ./data/status.json. Saknade värden visas som "okänt" – inget hittas på.
 * - Botarna är pausade: fältet visar "stoppad" och simulerar ingen handelsaktivitet.
 */

type Mode = 'ANNA' | 'LENA' | 'RESEARCH';
const STALE_MINUTES = 75; // samma gräns som statusFeed.ts
const OKANT = 'okänt';

interface AccMetrics {
  ok: boolean;
  fetchedAt?: string;
  ageMin?: number;
  stale: boolean;
  equity?: number;
  positions?: number;
  openOrders?: number;
  algoOrders?: number;
  lastOrderAt?: string;
}
interface FieldData {
  loaded: boolean;
  missing: boolean; // filen saknas, är tom eller ogiltig
  generatedAt?: string;
  feedOk?: boolean;
  anna: AccMetrics;
  lena: AccMetrics;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const emptyAcc: AccMetrics = { ok: false, stale: true };

function accMetrics(a: any): AccMetrics {
  if (!a || typeof a !== 'object') return emptyAcc;
  const fetchedAt = typeof a.fetched_at === 'string' ? a.fetched_at : undefined;
  const t = fetchedAt ? Date.parse(fetchedAt) : NaN;
  const ageMin = Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : undefined;
  const stale = ageMin === undefined || ageMin >= STALE_MINUTES;
  return {
    ok: a.ok === true,
    fetchedAt,
    ageMin,
    stale,
    equity: a.ok === true ? num(a.totalEqUsd) : undefined,
    positions: Array.isArray(a.positions) ? a.positions.length : undefined,
    openOrders: Array.isArray(a.open_orders) ? a.open_orders.length : undefined,
    algoOrders: Array.isArray(a.algo_orders) ? a.algo_orders.length : undefined,
    lastOrderAt: typeof a.last_order_at === 'string' ? a.last_order_at : undefined,
  };
}

async function loadFieldData(): Promise<FieldData> {
  const base: FieldData = { loaded: true, missing: true, anna: emptyAcc, lena: emptyAcc };
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/status.json?aitif=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return base;
    const text = await res.text();
    if (!text.trim()) return base;
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object') return base;
    return {
      loaded: true,
      missing: false,
      generatedAt: typeof d.generated_at === 'string' ? d.generated_at : undefined,
      feedOk: typeof d.health?.feed_ok === 'boolean' ? d.health.feed_ok : undefined,
      anna: accMetrics(d.anna),
      lena: accMetrics(d.lena),
    };
  } catch {
    return base;
  }
}

// ---------- visuella lägen ----------
interface ModeLook { a: [number, number, number]; b: [number, number, number]; flow: number; spread: number; }
const LOOKS: Record<Mode, ModeLook> = {
  ANNA: { a: [0.15, 0.55, 1.0], b: [0.2, 0.95, 0.95], flow: 0.35, spread: 0.85 },     // blå/cyan, lugn
  LENA: { a: [1.0, 0.45, 0.08], b: [1.0, 0.78, 0.25], flow: 0.6, spread: 1.0 },        // orange/bärnsten
  RESEARCH: { a: [0.55, 0.25, 0.95], b: [0.85, 0.55, 1.0], flow: 0.45, spread: 0.95 }, // lila
};

const VERT = `
attribute vec3 aSeed;
uniform float uTime, uFlow, uSpread, uEnergy, uPointScale, uAspect;
varying float vMix; varying float vDepth;
void main(){
  float r = 0.35 + 0.65 * aSeed.x;
  float th = aSeed.y * 6.2831853;
  float ph = (aSeed.z - 0.5) * 3.1415926;
  float t = uTime * uFlow;
  float w = sin(th * 3.0 + t) * 0.08 + sin(ph * 4.0 - t * 0.7) * 0.06;
  float rr = (r + w * uEnergy) * uSpread;
  vec3 p = vec3(rr * cos(ph) * cos(th + t * 0.15), rr * sin(ph) * 0.6, rr * cos(ph) * sin(th + t * 0.15));
  float z = p.z + 2.2;
  vDepth = clamp(1.4 - z * 0.45, 0.15, 1.0);
  vMix = aSeed.x;
  gl_Position = vec4(p.x / z * 1.9 / uAspect, p.y / z * 1.9, 0.0, 1.0);
  gl_PointSize = uPointScale * (1.5 + 2.0 * (1.0 - aSeed.x)) / z * 2.2;
}`;
const FRAG = `
precision mediump float;
uniform vec3 uColA, uColB; uniform float uDim;
varying float vMix; varying float vDepth;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d) * vDepth * uDim * 0.35;
  vec3 col = mix(uColA, uColB, vMix);
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(mix(vec3(g), col, uDim), a);
}`;

function particleBudget(lowPower: boolean): number {
  if (lowPower) return 1200;
  const mobile = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 640);
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  if (mobile) return 3000;
  return cores >= 8 ? 12000 : 6000;
}

const fmtAge = (m?: number) => (m === undefined ? OKANT : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const fmtUsd = (v?: number) => (v === undefined ? OKANT : `$${v.toFixed(2)}`);
const fmtN = (v?: number) => (v === undefined ? OKANT : String(v));

export function AITradingIntelligenceField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<FieldData>({ loaded: false, missing: true, anna: emptyAcc, lena: emptyAcc });
  const [mode, setMode] = useState<Mode>('ANNA');
  const [paused, setPaused] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [intensity, setIntensity] = useState(0.6);
  const [lowPower, setLowPower] = useState(false);
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // parametrar som renderloopen läser utan att starta om
  const live = useRef({ mode, paused, intensity, stale: true });
  const acc = mode === 'LENA' ? data.lena : data.anna;
  const stale = data.missing || (mode === 'RESEARCH' ? true : acc.stale);
  live.current = { mode, paused, intensity, stale };

  useEffect(() => {
    let alive = true;
    const run = () => loadFieldData().then(d => alive && setData(d));
    run();
    const iv = setInterval(run, 5 * 60 * 1000);
    window.addEventListener('tb-refresh', run);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('tb-refresh', run); };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReducedMotion(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext('webgl', { antialias: false, alpha: true, powerPreference: 'low-power' }) ||
        canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    } catch { gl = null; }
    if (!gl) { setWebglOk(false); return; }

    const mk = (type: number, src: string) => {
      const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) || 'shader');
      return s;
    };
    let prog: WebGLProgram, vs: WebGLShader, fs: WebGLShader;
    try {
      vs = mk(gl.VERTEX_SHADER, VERT); fs = mk(gl.FRAGMENT_SHADER, FRAG);
      prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    } catch { setWebglOk(false); return; }
    setWebglOk(true);

    const count = particleBudget(lowPower);
    const seeds = new Float32Array(count * 3);
    let s = 1234567; // deterministisk pseudo-slump för geometrin (rent visuellt, inte data)
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.useProgram(prog);
    const loc = gl.getAttribLocation(prog, 'aSeed');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl!.getUniformLocation(prog, n);
    const u = { time: U('uTime'), flow: U('uFlow'), spread: U('uSpread'), energy: U('uEnergy'), ps: U('uPointScale'),
      aspect: U('uAspect'), a: U('uColA'), b: U('uColB'), dim: U('uDim') };
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // mjuk övergång mellan lägen: interpolera uniforms
    const cur = { ...LOOKS[live.current.mode], a: [...LOOKS[live.current.mode].a], b: [...LOOKS[live.current.mode].b], dim: 1 } as any;
    let raf = 0, last = performance.now(), simT = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2);

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr)); canvas.height = Math.max(1, Math.floor(h * dpr));
      gl!.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const draw = (dt: number) => {
      const L = live.current, tgt = LOOKS[L.mode];
      const k = Math.min(1, dt * 2.5);
      for (let i = 0; i < 3; i++) { cur.a[i] += (tgt.a[i] - cur.a[i]) * k; cur.b[i] += (tgt.b[i] - cur.b[i]) * k; }
      cur.flow += (tgt.flow - cur.flow) * k; cur.spread += (tgt.spread - cur.spread) * k;
      cur.dim += ((L.stale ? 0.35 : 1) - cur.dim) * k; // inaktuell data => avmättad/dimmad
      gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1f(u.time, simT); gl!.uniform1f(u.flow, cur.flow); gl!.uniform1f(u.spread, cur.spread);
      gl!.uniform1f(u.energy, 0.3 + L.intensity); gl!.uniform1f(u.ps, (lowPower ? 2.2 : 3) * dpr);
      gl!.uniform1f(u.aspect, canvas.width / canvas.height);
      gl!.uniform3fv(u.a, cur.a); gl!.uniform3fv(u.b, cur.b); gl!.uniform1f(u.dim, cur.dim);
      gl!.drawArrays(gl!.POINTS, 0, count);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      // Botarna är stoppade: rörelsen är långsam "andning", ingen simulerad handelsaktivitet.
      if (!live.current.paused) simT += dt * (0.25 + live.current.intensity * 0.5);
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && !reducedMotion && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    if (reducedMotion) {
      // statisk bild; ritas om när läge ändras via separat effekt-trigger
      for (let i = 0; i < 40; i++) draw(0.1);
      (canvas as any).__aitifRedraw = () => { for (let i = 0; i < 40; i++) draw(0.1); };
    } else start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      ro?.disconnect();
      delete (canvas as any).__aitifRedraw;
      gl!.deleteBuffer(buf); gl!.deleteProgram(prog); gl!.deleteShader(vs); gl!.deleteShader(fs);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [lowPower, reducedMotion]);

  // reduced motion: rita om stillbilden när läge/intensitet/data ändras
  useEffect(() => { (canvasRef.current as any)?.__aitifRedraw?.(); }, [mode, intensity, stale, webglOk]);

  const accent = mode === 'ANNA' ? 'text-cyan-300' : mode === 'LENA' ? 'text-amber-300' : 'text-purple-300';
  const fallbackBg = mode === 'ANNA'
    ? 'radial-gradient(circle at 50% 50%, rgba(34,211,238,.35), rgba(37,99,235,.12) 45%, transparent 70%)'
    : mode === 'LENA'
      ? 'radial-gradient(circle at 50% 50%, rgba(251,191,36,.35), rgba(234,88,12,.12) 45%, transparent 70%)'
      : 'radial-gradient(circle at 50% 50%, rgba(192,132,252,.35), rgba(126,34,206,.12) 45%, transparent 70%)';

  const metrics = useMemo((): [string, string][] => {
    if (mode === 'ANNA') return [
      ['Botstatus', 'STOPPAD (pausad)'],
      ['Trend', OKANT],
      ['Volatilitet', OKANT],
      ['Equity', fmtUsd(data.anna.equity)],
      ['Positioner', fmtN(data.anna.positions)],
      ['Öppna ordrar', fmtN(data.anna.openOrders)],
      ['Datans ålder', fmtAge(data.anna.ageMin)],
    ];
    if (mode === 'LENA') return [
      ['Botstatus', 'STOPPAD (pausad)'],
      ['OBI', OKANT],
      ['Spread', OKANT],
      ['Avvisade signaler', OKANT],
      ['Datans ålder', fmtAge(data.lena.ageMin)],
      ['Positioner', fmtN(data.lena.positions)],
      ['SL-ordrar hos OKX', fmtN(data.lena.algoOrders)],
    ];
    return [
      ['Forskningshändelser', OKANT],
      ['Källa', 'ingen research-feed ansluten'],
    ];
  }, [mode, data]);

  const tabBtn = (m: Mode, label: string, cls: string) => (
    <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${mode === m ? cls : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
      {label}
    </button>
  );

  return (
    <section data-testid="aitif" aria-label="AI Trading Intelligence Field"
      className="relative rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">Intelligence Field</h2>
          <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400">read-only · ingen AI</span>
          {data.loaded && (data.missing
            ? <span data-testid="aitif-missing" className="text-[10px] px-1.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60">status.json saknas – okänt</span>
            : stale && <span data-testid="aitif-stale" className="text-[10px] px-1.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">INAKTUELL DATA</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tabBtn('ANNA', 'ANNA', 'border-cyan-500/60 text-cyan-300 bg-cyan-950/40')}
          {tabBtn('LENA', 'LENA', 'border-amber-500/60 text-amber-300 bg-amber-950/40')}
          {tabBtn('RESEARCH', 'RESEARCH', 'border-purple-500/60 text-purple-300 bg-purple-950/40')}
          <button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused}
            className="px-2 py-1 rounded-md text-[11px] border border-slate-700 text-slate-300">{paused ? 'Spela' : 'Paus'}</button>
          <button type="button" onClick={() => setShowInfo(v => !v)} aria-pressed={showInfo}
            className="px-2 py-1 rounded-md text-[11px] border border-slate-700 text-slate-300">{showInfo ? 'Dölj info' : 'Visa info'}</button>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">Intensitet
            <input type="range" min={0} max={1} step={0.05} value={intensity} onChange={e => setIntensity(Number(e.target.value))} className="w-16" />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            <input type="checkbox" checked={lowPower} onChange={e => setLowPower(e.target.checked)} />Lågeffekt
          </label>
        </div>
      </div>
      <div className="relative h-56 sm:h-64">
        {webglOk !== false
          ? <canvas key={`${lowPower ? "lp" : "hp"}-${reducedMotion ? "rm" : "m"}`} ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
          : <div data-testid="aitif-fallback" className="absolute inset-0 flex items-end justify-center pb-3" style={{ background: fallbackBg, filter: stale ? 'grayscale(.65)' : undefined }}>
              <span className="text-[10px] text-slate-500">Statisk vy – WebGL ej tillgängligt</span>
            </div>}
        {reducedMotion && webglOk && <span className="absolute bottom-2 right-3 text-[10px] text-slate-500">Reducerad rörelse: stillbild</span>}
        {showInfo && (
          <dl data-testid="aitif-metrics" className="absolute top-3 left-3 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 rounded-lg bg-slate-950/75 border border-slate-800 px-3 py-2 text-[11px]">
            {metrics.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className={`font-mono ${v === OKANT ? 'text-slate-500 italic' : accent}`}>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

export default AITradingIntelligenceField;
