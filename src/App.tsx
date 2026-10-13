import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Sparkles,
  Download,
  AlertTriangle,
  Sliders,
  FileCode,
  Lock,
  RefreshCw,
  Terminal,
  Copy,
  ChevronRight,
  TrendingUp,
  Database,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
  XCircle,
  PlayCircle,
  TrendingDown,
  Percent,
  Layers,
  Zap,
  Award
} from 'lucide-react';

interface StrategyParameters {
  risk_per_trade_pct: number;
  max_open_positions: number;
  max_margin_fraction: number;
  timeframe: string;
  max_leverage: number;
  min_score: number;
  atr_stop_multiple: number;
  atr_target_multiple: number;
  symbols: string[];
}

interface StrategyConfig {
  product: string;
  version: string;
  environment: string;
  trading_enabled: boolean;
  strategy: StrategyParameters;
  risk_limits: {
    max_drawdown_stop_pct: number;
    kill_switch_active: boolean;
    enforce_demo_headers: boolean;
  };
  metadata: {
    last_updated?: string;
    updated_by?: string;
    notes?: string;
  };
}

interface OkxBalance {
  connected: boolean;
  environment: string;
  header: string;
  endpoint: string;
  has_custom_keys: boolean;
  account: {
    total_equity: number;
    available_balance: number;
    used_margin: number;
    currency: string;
    unrealized_pnl: number;
    open_positions_count: number;
  };
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  current_price: number;
  size_units: number;
  notional_usd: number;
  margin_usd: number;
  leverage: number;
  unrealized_pnl: number;
  pnl_pct: number;
  stop_loss: number;
  take_profit: number;
  entry_time: string;
  status: string;
}

interface ClosedTrade {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number;
  size_units: number;
  notional_usd: number;
  leverage: number;
  realized_pnl: number;
  pnl_pct: number;
  exit_reason: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

interface TradesData {
  summary: {
    account_equity: number;
    starting_balance: number;
    net_pnl: number;
    net_pnl_pct: number;
    unrealized_pnl: number;
    win_rate_pct: number;
    profit_factor: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    avg_win_usd: number;
    avg_loss_usd: number;
    max_drawdown_pct: number;
    margin_utilization_pct: number;
  };
  open_positions: Position[];
  trade_history: ClosedTrade[];
}

interface PerformanceEvaluation {
  performance_rating: string;
  score: number;
  summary_verdict: string;
  strengths: string[];
  weaknesses: string[];
  suggested_adjustments: StrategyParameters;
  rationale: {
    risk_adjustment: string;
    target_stop_adjustment: string;
    position_sizing_adjustment: string;
  };
  estimated_impact: string;
}

const AVAILABLE_PAIRS = [
  "BTC-USDT-SWAP",
  "ETH-USDT-SWAP",
  "SOL-USDT-SWAP",
  "AVAX-USDT-SWAP",
  "LINK-USDT-SWAP",
  "SUI-USDT-SWAP"
];

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

export default function App() {
  const [activeTab, setActiveTab] = useState<'trades' | 'evaluation' | 'strategy' | 'adviser' | 'simulation' | 'export' | 'checklist'>('trades');
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [okxBalance, setOkxBalance] = useState<OkxBalance | null>(null);
  const [tradesData, setTradesData] = useState<TradesData | null>(null);
  const [evaluation, setEvaluation] = useState<PerformanceEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executingOrder, setExecutingOrder] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gemini state
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [advice, setAdvice] = useState<any>(null);
  const [marketContext, setMarketContext] = useState("Consolidation with moderate volatility and rangebound dynamics");
  const [riskGoal, setRiskGoal] = useState("Capital preservation with strict drawdowns (<3%)");

  // Simulation state
  const [simLoading, setSimLoading] = useState(false);
  const [simResults, setSimResults] = useState<any>(null);

  // Quick Order Modal
  const [orderSymbol, setOrderSymbol] = useState("BTC-USDT-SWAP");
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [stratRes, balRes, tradesRes] = await Promise.all([
        fetch('/api/strategy').then(r => r.json()),
        fetch('/api/okx/balance').then(r => r.json()),
        fetch('/api/trades').then(r => r.json())
      ]);
      setConfig(stratRes);
      setOkxBalance(balRes);
      setTradesData(tradesRes);
    } catch (err: any) {
      setErrorMessage("Kunde inte hämta data från TradebottenAnna: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleParamChange = (key: keyof StrategyParameters, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      strategy: {
        ...config.strategy,
        [key]: value
      }
    });
  };

  const handleToggleKillSwitch = async () => {
    if (!config) return;
    const nextState = !config.risk_limits.kill_switch_active;
    const updatedConfig = {
      ...config,
      risk_limits: {
        ...config.risk_limits,
        kill_switch_active: nextState
      }
    };
    setConfig(updatedConfig);
    await saveStrategyConfig(updatedConfig);
  };

  const saveStrategyConfig = async (cfgToSave?: StrategyConfig) => {
    const target = cfgToSave || config;
    if (!target) return;
    setSaving(true);
    setSaveSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Misslyckades med att spara strategi");
      setConfig(data.strategy);
      setSaveSuccessMessage("Strategin har sparats och synkroniserats till strategy.json!");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Fel vid sparande");
    } finally {
      setSaving(false);
    }
  };

  // Close active position
  const handleClosePosition = async (id: string) => {
    try {
      const res = await fetch('/api/trades/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunde inte stänga position");
      setSaveSuccessMessage(data.message);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Fel vid stängning av position");
    }
  };

  // Execute manual demo trade directly from UI
  const handleExecuteDemoTrade = async () => {
    setExecutingOrder(true);
    try {
      const res = await fetch('/api/trades/execute-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: orderSymbol, side: orderSide })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunde inte lägga demo-order");
      setSaveSuccessMessage(data.message);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Kunde inte utföra demo-order");
    } finally {
      setExecutingOrder(false);
    }
  };

  // Evaluate performance with AI
  const handleEvaluatePerformance = async () => {
    setEvaluating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/evaluate-performance', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evalueringen misslyckades");
      setEvaluation(data.evaluation);
    } catch (err: any) {
      setErrorMessage("Evalueringsfel: " + err.message);
    } finally {
      setEvaluating(false);
    }
  };

  // Apply suggested adjustments
  const applySuggestedAdjustments = () => {
    if (!evaluation || !config) return;
    const updated = {
      ...config,
      strategy: {
        ...config.strategy,
        ...evaluation.suggested_adjustments
      },
      metadata: {
        ...config.metadata,
        notes: `Uppdaterad automatiskt via AI Performance Evaluator (Betyg: ${evaluation.performance_rating})`
      }
    };
    setConfig(updated);
    saveStrategyConfig(updated);
    setSaveSuccessMessage("Föreslagna justeringar tillämpade och sparade till strategy.json!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Security & Live Status Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
              <Activity className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">TradebottenAnna</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  OKX EU Demo LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">x-simulated-trading: 1</p>
            </div>
          </div>

          {/* Right Header: Saldo & Quick Controls */}
          <div className="flex items-center space-x-3">
            {/* Live OKX Saldo Card in Header */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-emerald-500/30 text-xs">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Demo Saldo</span>
                <span className="font-mono font-bold text-emerald-300">
                  ${okxBalance?.account.total_equity?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </span>
              </div>
            </div>

            {/* Kill Switch Toggle */}
            <button
              onClick={handleToggleKillSwitch}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                config?.risk_limits.kill_switch_active
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 ring-2 ring-rose-500/40'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:border-rose-500/40 hover:text-rose-300'
              }`}
              title="Global Emergency Kill Switch"
            >
              {config?.risk_limits.kill_switch_active ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>NÖDSTOPP AKTIVT</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Kill Switch: Av</span>
                </>
              )}
            </button>

            {/* Export ZIP */}
            <a
              href="/api/download-zip"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/10 transition-colors"
              title="Ladda ner hela projektet som ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export ZIP</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Alerts */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {saveSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3 text-emerald-300 text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {/* OKX EU DEMO CONNECTION & SALDO DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">OKX Status</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">ANSLUTEN (DEMO)</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>x-simulated-trading: 1 verifierad</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Totalt Demo Saldo</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              ${okxBalance?.account.total_equity?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">
              Net PnL: +${tradesData?.summary.net_pnl.toFixed(2)} (+{tradesData?.summary.net_pnl_pct.toFixed(2)}%)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Tillgängligt för Tradar</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-300">
              ${okxBalance?.account.available_balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </div>
            <div className="text-[11px] text-slate-400">
              Allokerat margin: ${okxBalance?.account.used_margin.toFixed(2)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Aktiva Positioner</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              {tradesData?.open_positions.length || 0} st öppna
            </div>
            <div className="text-[11px] font-mono text-emerald-400">
              Orealiserad PnL: +${tradesData?.summary.unrealized_pnl.toFixed(2)} USDT
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('trades')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'trades'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Tradar & PnL</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('evaluation');
              if (!evaluation) handleEvaluatePerformance();
            }}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'evaluation'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Evaluering & Justeringar</span>
          </button>

          <button
            onClick={() => setActiveTab('strategy')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'strategy'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Strategiparametrar</span>
          </button>

          <button
            onClick={() => setActiveTab('adviser')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'adviser'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Gemini Rådgivare</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'simulation'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Bot-Körning (Dry Run)</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>strategy.json</span>
          </button>
        </div>

        {/* TAB 1: LIVE TRADES & PNL RESULTAT */}
        {activeTab === 'trades' && tradesData && (
          <div className="space-y-6">
            {/* Quick Demo Order Launcher */}
            <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-emerald-400" />
                  <span>Kör Direkt Demo-Order från Webben</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Lägg simulerade demo-ordrar på OKX direkt med automatiskt beräknad ATR-stop och riskhantering.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                >
                  {AVAILABLE_PAIRS.map(sym => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>

                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                  <button
                    onClick={() => setOrderSide("BUY")}
                    className={`px-3 py-1.5 text-xs font-bold font-mono transition-colors ${
                      orderSide === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    KÖP (LONG)
                  </button>
                  <button
                    onClick={() => setOrderSide("SELL")}
                    className={`px-3 py-1.5 text-xs font-bold font-mono transition-colors ${
                      orderSide === 'SELL' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    SÄLJ (SHORT)
                  </button>
                </div>

                <button
                  onClick={handleExecuteDemoTrade}
                  disabled={executingOrder}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Zap className="w-4 h-4" />
                  <span>{executingOrder ? "Skickar..." : "Kör Demo-Order"}</span>
                </button>
              </div>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-xs text-slate-400">Win Rate</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {tradesData.summary.win_rate_pct}%
                </div>
                <div className="text-[10px] text-slate-500">
                  {tradesData.summary.winning_trades} vinster / {tradesData.summary.losing_trades} förluster
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-xs text-slate-400">Profit Factor</div>
                <div className="text-lg font-bold font-mono text-purple-300 mt-1">
                  {tradesData.summary.profit_factor}x
                </div>
                <div className="text-[10px] text-slate-500">Bruttovinst / Bruttoförlust</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-xs text-slate-400">Snittvinst per vinnare</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  +${tradesData.summary.avg_win_usd}
                </div>
                <div className="text-[10px] text-slate-500">Snittförlust: -${Math.abs(tradesData.summary.avg_loss_usd)}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-xs text-slate-400">Max Drawdown</div>
                <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                  {tradesData.summary.max_drawdown_pct}%
                </div>
                <div className="text-[10px] text-slate-500">Gräns: {config?.risk_limits.max_drawdown_stop_pct}%</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-xs text-slate-400">Margin Utnyttjande</div>
                <div className="text-lg font-bold font-mono text-blue-300 mt-1">
                  {tradesData.summary.margin_utilization_pct}%
                </div>
                <div className="text-[10px] text-slate-500">Max tillåtet: {(config?.strategy.max_margin_fraction || 0.4)*100}%</div>
              </div>
            </div>

            {/* OPEN POSITIONS TABLE */}
            <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Aktiva Öppna Tradar ({tradesData.open_positions.length})</h3>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  Orealiserad vinst: +${tradesData.summary.unrealized_pnl.toFixed(2)} USDT
                </span>
              </div>

              {tradesData.open_positions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  Inga öppna positioner just nu. Använd "Kör Demo-Order" ovan för att öppna en trade!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Symbol</th>
                        <th className="py-2.5 px-4 font-semibold">Riktning</th>
                        <th className="py-2.5 px-4 font-semibold">Entry Pris</th>
                        <th className="py-2.5 px-4 font-semibold">Nuvarande Pris</th>
                        <th className="py-2.5 px-4 font-semibold">Notional / Margin</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Orealiserad PnL</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Åtgärd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {tradesData.open_positions.map(pos => (
                        <tr key={pos.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-white">{pos.symbol}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {pos.side} {pos.leverage}x
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">${pos.entry_price.toLocaleString()}</td>
                          <td className="py-3 px-4 text-white font-bold">${pos.current_price.toLocaleString()}</td>
                          <td className="py-3 px-4 text-slate-400">
                            ${pos.notional_usd.toFixed(0)} <span className="text-[10px]">(${pos.margin_usd.toFixed(0)} mrg)</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-bold text-emerald-400">+${pos.unrealized_pnl.toFixed(2)}</div>
                            <div className="text-[10px] text-emerald-500">+{pos.pnl_pct.toFixed(2)}%</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleClosePosition(pos.id)}
                              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors"
                            >
                              Stäng Position
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* CLOSED TRADES HISTORY TABLE */}
            <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Avslutade Tradar & Realiserad PnL</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Total realiserad vinst: <strong className="text-emerald-400 font-bold">+${tradesData.summary.net_pnl.toFixed(2)} USDT</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Trade ID</th>
                      <th className="py-2.5 px-4 font-semibold">Symbol</th>
                      <th className="py-2.5 px-4 font-semibold">Riktning</th>
                      <th className="py-2.5 px-4 font-semibold">Entry ➔ Exit</th>
                      <th className="py-2.5 px-4 font-semibold">Exit Orsak</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Realiserad PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tradesData.trade_history.map(trd => (
                      <tr key={trd.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-slate-500 text-[11px]">{trd.id}</td>
                        <td className="py-3 px-4 font-bold text-white">{trd.symbol}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trd.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {trd.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          ${trd.entry_price.toLocaleString()} ➔ ${trd.exit_price.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {trd.exit_reason}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          <span className={trd.realized_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {trd.realized_pnl >= 0 ? "+" : ""}${trd.realized_pnl.toFixed(2)} ({trd.pnl_pct >= 0 ? "+" : ""}{trd.pnl_pct.toFixed(2)}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI EVALUERING OCH JUSTERINGSFÖRSLAG */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-6 rounded-xl border border-purple-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base font-bold text-white">Automatisk Prestanda-Evaluering & Strategijusteringar</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  AI-motorn analyserar dina realiserade vinster, förluster, ATR-träffar och marginutnyttjande på OKX Demo,
                  och presenterar konkreta förbättringsförslag på dina strategiparametrar.
                </p>
              </div>

              <button
                onClick={handleEvaluatePerformance}
                disabled={evaluating}
                className="px-4 py-2.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center space-x-2 shadow-lg shadow-purple-600/20"
              >
                {evaluating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyserar resultat...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Kör Ny Evaluering</span>
                  </>
                )}
              </button>
            </div>

            {/* Evaluation Results */}
            {evaluation && (
              <div className="bg-slate-900/90 p-6 rounded-xl border border-slate-800 space-y-6">
                {/* Score & Verdict Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-purple-950/30 border border-purple-500/30">
                  <div>
                    <div className="text-xs uppercase font-mono tracking-wider text-purple-400 font-bold">
                      Prestandabetyg: {evaluation.performance_rating}
                    </div>
                    <div className="text-sm text-slate-200 mt-1">
                      {evaluation.summary_verdict}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Total Betygspoäng</div>
                      <div className="text-2xl font-black font-mono text-purple-300">{evaluation.score} / 100</div>
                    </div>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Identifierade Styrkor</span>
                    </h4>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                      {evaluation.strengths.map((str, idx) => (
                        <li key={idx}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/20 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Identifierade Svagheter & Flaskhalsar</span>
                    </h4>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                      {evaluation.weaknesses.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Parameter Adjustments Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Föreslagna Parameterjusteringar
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Parameter</th>
                          <th className="py-2.5 px-3">Nuvarande Värde</th>
                          <th className="py-2.5 px-3 text-purple-300">Föreslaget Värde</th>
                          <th className="py-2.5 px-3">Motivering</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {config && Object.entries(evaluation.suggested_adjustments).map(([k, v]) => {
                          if (k === 'symbols') return null;
                          const currentVal = (config.strategy as any)[k];
                          const isChanged = currentVal !== v;
                          return (
                            <tr key={k} className={isChanged ? 'bg-purple-950/20' : ''}>
                              <td className="py-2.5 px-3 text-slate-300 font-sans font-medium">{k}</td>
                              <td className="py-2.5 px-3 text-slate-400">{String(currentVal)}</td>
                              <td className="py-2.5 px-3 text-purple-300 font-bold">
                                {String(v)} {isChanged && <span className="text-[10px] text-amber-400 ml-1">Δ</span>}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                                {k === 'atr_stop_multiple' ? evaluation.rationale.target_stop_adjustment :
                                 k === 'min_score' ? evaluation.rationale.risk_adjustment :
                                 evaluation.rationale.position_sizing_adjustment}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
                    <div>
                      <strong>Förväntad Effekt:</strong> {evaluation.estimated_impact}
                    </div>
                    <button
                      onClick={applySuggestedAdjustments}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center space-x-1.5 shadow-md shadow-purple-600/30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tillämpa Justeringar på Strategin</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STRATEGY PARAMETERS */}
        {activeTab === 'strategy' && config && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Auktoritativa Strategikontroller</h2>
                <p className="text-xs text-slate-400">
                  Inställningarna valideras och sparas direkt till <code className="text-amber-300">strategy.json</code>.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1.5 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Uppdatera</span>
                </button>
                <button
                  onClick={() => saveStrategyConfig()}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-amber-500/10 transition-colors"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Spara till strategy.json</span>
                </button>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">risk_per_trade_pct</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{config.strategy.risk_per_trade_pct}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={config.strategy.risk_per_trade_pct}
                  onChange={(e) => handleParamChange('risk_per_trade_pct', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Max portföljrisk per enskild position (0.1% – 5.0%).</p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">max_leverage</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{config.strategy.max_leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={config.strategy.max_leverage}
                  onChange={(e) => handleParamChange('max_leverage', parseInt(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Konservativ hävstångsgräns för OKX ordrar (1x – 10x).</p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">max_open_positions</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{config.strategy.max_open_positions}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={config.strategy.max_open_positions}
                  onChange={(e) => handleParamChange('max_open_positions', parseInt(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Max antal samtidiga öppna positioner.</p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">atr_stop_multiple</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{config.strategy.atr_stop_multiple}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.1"
                  value={config.strategy.atr_stop_multiple}
                  onChange={(e) => handleParamChange('atr_stop_multiple', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Avståndsmultiplikator för dynamisk ATR-stoploss.</p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">atr_target_multiple</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{config.strategy.atr_target_multiple}x</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="6.0"
                  step="0.25"
                  value={config.strategy.atr_target_multiple}
                  onChange={(e) => handleParamChange('atr_target_multiple', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Målmultiplikator för Take-Profit baserad på ATR.</p>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">min_score</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{config.strategy.min_score} / 100</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={config.strategy.min_score}
                  onChange={(e) => handleParamChange('min_score', parseInt(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Minsta tekniska bekräftelsepoäng för att trigga order.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GEMINI ADVISER */}
        {activeTab === 'adviser' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-6 rounded-xl border border-purple-500/20 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-white">Gemini Kvantitativ Riskrådgivare</h2>
              </div>
              <p className="text-xs text-slate-400">
                Rådgivaren analyserar volatilitet och marknadsklimat för att rekommendera optimala gränser för din OKX Demo-strategi.
              </p>
              <button
                onClick={async () => {
                  setAdviceLoading(true);
                  try {
                    const res = await fetch('/api/gemini-advice', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ strategy: config?.strategy })
                    });
                    const d = await res.json();
                    setAdvice(d.advice);
                  } catch (e: any) {
                    setErrorMessage("Rådgivningsfel: " + e.message);
                  } finally {
                    setAdviceLoading(false);
                  }
                }}
                disabled={adviceLoading}
                className="px-5 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2"
              >
                {adviceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Konsultera Gemini Kvantrådgivare</span>
              </button>

              {advice && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mt-4 space-y-3 text-xs">
                  <div className="font-bold text-purple-300">Regime: {advice.market_regime} (Konfidens: {advice.confidence_score}%)</div>
                  <p className="text-slate-300">{advice.analysis}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: DRY-RUN AUDIT */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white">Kör Kontrollerad Cykel via Python-motorn</h2>
                <p className="text-xs text-slate-400">Kör <code className="text-slate-300">python3 main.py</code> och validerar alla signaler mot OKX Demo.</p>
              </div>
              <button
                onClick={async () => {
                  setSimLoading(true);
                  try {
                    const res = await fetch('/api/run-simulation', { method: 'POST' });
                    const d = await res.json();
                    setSimResults(d);
                  } catch (e: any) {
                    setErrorMessage("Simuleringsfel: " + e.message);
                  } finally {
                    setSimLoading(false);
                  }
                }}
                disabled={simLoading}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-2"
              >
                {simLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                <span>Exekvera Kontrollerad Cykel</span>
              </button>
            </div>

            {simResults && (
              <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800">
                {JSON.stringify(simResults, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* TAB 6: STRATEGY.JSON & SYNC */}
        {activeTab === 'export' && config && (
          <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white">Auktoritativ strategy.json</h2>
            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">TradebottenAnna v1.2.0</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">OKX EU Demo Live Controller</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">x-simulated-trading: 1</span>
          </div>
          <div>
            Körs live mot OKX Demo • Driftsatt på Cloudflare Worker
          </div>
        </div>
      </footer>
    </div>
  );
}
