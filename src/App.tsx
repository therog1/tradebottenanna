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
  HelpCircle,
  TrendingUp,
  Database,
  ArrowUpRight
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

interface GeminiAdvice {
  market_regime: string;
  confidence_score: number;
  analysis: string;
  proposed_parameters: StrategyParameters;
  rationale_per_field: Record<string, string>;
  risk_warnings: string[];
  disclaimer: string;
}

interface ApiStatus {
  service: string;
  status: string;
  adviceEndpoint: string;
  tradingEnabled: boolean;
  environment: string;
  killSwitchActive: boolean;
  authenticatedUser: string;
  geminiConfigured: boolean;
  version: string;
  timestamp: string;
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
  const [activeTab, setActiveTab] = useState<'strategy' | 'adviser' | 'simulation' | 'export' | 'checklist'>('strategy');
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gemini state
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [advice, setAdvice] = useState<GeminiAdvice | null>(null);
  const [marketContext, setMarketContext] = useState("Consolidation with moderate volatility and rangebound dynamics");
  const [riskGoal, setRiskGoal] = useState("Capital preservation with strict drawdowns (<3%)");
  const [showAdviceModal, setShowAdviceModal] = useState(false);

  // Simulation state
  const [simLoading, setSimLoading] = useState(false);
  const [simResults, setSimResults] = useState<any>(null);

  // Copied alert state
  const [copied, setCopied] = useState(false);

  // Fetch status and config
  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [statusRes, stratRes] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/strategy').then(r => r.json())
      ]);
      setStatus(statusRes);
      setConfig(stratRes);
    } catch (err: any) {
      setErrorMessage("Could not connect to TradebottenAnna API: " + (err.message || String(err)));
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

  const toggleSymbol = (sym: string) => {
    if (!config) return;
    const current = config.strategy.symbols;
    const updated = current.includes(sym)
      ? current.filter(s => s !== sym)
      : [...current, sym];
    if (updated.length === 0) return; // Keep at least one
    handleParamChange('symbols', updated);
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
      if (!res.ok) {
        throw new Error(data.error || "Failed to save strategy");
      }
      setConfig(data.strategy);
      setSaveSuccessMessage("Saved and persisted to strategy.json successfully.");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      // Refresh status
      const s = await fetch('/api/status').then(r => r.json());
      setStatus(s);
    } catch (err: any) {
      setErrorMessage(err.message || "Save error");
    } finally {
      setSaving(false);
    }
  };

  const requestGeminiAdvice = async () => {
    setAdviceLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/gemini-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: config?.strategy,
          market_context: marketContext,
          risk_goal: riskGoal
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to fetch Gemini advice");
      }
      setAdvice(data.advice);
      setShowAdviceModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Gemini adviser error");
    } finally {
      setAdviceLoading(false);
    }
  };

  const applyGeminiAdvice = () => {
    if (!advice || !config) return;
    const updated = {
      ...config,
      strategy: {
        ...config.strategy,
        ...advice.proposed_parameters
      },
      metadata: {
        ...config.metadata,
        notes: `Updated with Gemini recommendation for regime: ${advice.market_regime}`
      }
    };
    setConfig(updated);
    setShowAdviceModal(false);
    saveStrategyConfig(updated);
  };

  const runSimulationAudit = async () => {
    setSimLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/run-simulation', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Simulation failed");
      }
      setSimResults(data);
    } catch (err: any) {
      setErrorMessage("Simulation run error: " + err.message);
    } finally {
      setSimLoading(false);
    }
  };

  const copyStrategyJson = () => {
    if (!config) return;
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadStrategyJson = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategy.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Security & Identity Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
              <Activity className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">TradebottenAnna</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  OKX EU Demo
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">therog1/tradebottenanna</p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center space-x-3">
            {/* Identity Badge */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Identity:</span>
              <span className="font-mono text-slate-200 font-medium">
                {status?.authenticatedUser || "rogedv@icloud.com"}
              </span>
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
                  <span>KILL SWITCH: ACTIVE</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Kill Switch: Disarmed</span>
                </>
              )}
            </button>

            {/* Complete Delivery Download */}
            <a
              href="/api/download-zip"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-md shadow-amber-500/10 transition-colors"
              title="Download entire standalone project zip archive"
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

        {/* Safety Overview Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Environment</span>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">OKX EU Demo</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">x-simulated-trading: 1</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Execution State</span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono">
              {config?.trading_enabled ? (
                <span className="text-amber-400">Demo Active</span>
              ) : (
                <span className="text-slate-300">Dry-Run / Audit Only</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Orders blocked by default</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Gemini Adviser</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-lg font-bold font-mono text-purple-300">gemini-3.8-flash</div>
            <div className="text-xs text-slate-500 mt-0.5">Server-side secret only</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Risk Per Trade Cap</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-lg font-bold font-mono text-blue-300">
              {config?.strategy.risk_per_trade_pct ?? 1.5}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Max {config?.strategy.max_leverage ?? 3}x Leverage</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4">
          <button
            onClick={() => setActiveTab('strategy')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'strategy'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Strategy Parameters</span>
          </button>

          <button
            onClick={() => setActiveTab('adviser')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'adviser'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Gemini Adviser</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'simulation'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Dry-Run Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>strategy.json & Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'checklist'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Deployment Guide</span>
          </button>
        </div>

        {/* TAB 1: STRATEGY CONFIGURATION */}
        {activeTab === 'strategy' && config && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Authoritative Strategy Controls</h2>
                <p className="text-xs text-slate-400">
                  Settings are directly validated against strict bounds before saving to <code className="text-amber-300">strategy.json</code>.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1.5 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Reload</span>
                </button>
                <button
                  onClick={() => saveStrategyConfig()}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5 shadow-md shadow-amber-500/10 transition-colors"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Save to strategy.json</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Parameter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Risk Per Trade Pct */}
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
                <p className="text-[11px] text-slate-400">Max portfolio risk per individual position (0.1% – 5.0%).</p>
              </div>

              {/* Max Leverage */}
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
                <p className="text-[11px] text-slate-400">Conservative leverage cap for OKX swap orders (1x – 10x).</p>
              </div>

              {/* Max Open Positions */}
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
                <p className="text-[11px] text-slate-400">Max concurrent open trades allowed across the account.</p>
              </div>

              {/* Max Margin Fraction */}
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">max_margin_fraction</label>
                  <span className="font-mono text-sm font-bold text-amber-400">{(config.strategy.max_margin_fraction * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={config.strategy.max_margin_fraction}
                  onChange={(e) => handleParamChange('max_margin_fraction', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800"
                />
                <p className="text-[11px] text-slate-400">Total portfolio margin ceiling as a fraction of equity.</p>
              </div>

              {/* Min Score Threshold */}
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
                <p className="text-[11px] text-slate-400">Minimum technical indicator confirmation score to trigger.</p>
              </div>

              {/* Timeframe */}
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-300">timeframe</label>
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleParamChange('timeframe', tf)}
                      className={`py-1.5 text-xs font-mono font-medium rounded-lg transition-colors ${
                        config.strategy.timeframe === tf
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">Candle aggregation period for EMA & RSI calculations.</p>
              </div>

              {/* ATR Stop Multiple */}
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
                <p className="text-[11px] text-slate-400">Distance multiplier for dynamic ATR stop-loss.</p>
              </div>

              {/* ATR Target Multiple */}
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
                <p className="text-[11px] text-slate-400">Take-profit distance multiplier based on ATR volatility.</p>
              </div>

              {/* Demo Trading Switch (Safety Enforced) */}
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">trading_enabled</label>
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                    config.trading_enabled ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {config.trading_enabled ? "SIMULATED ORDERS ON" : "DRY RUN ONLY"}
                  </span>
                </div>
                <button
                  onClick={() => setConfig({ ...config, trading_enabled: !config.trading_enabled })}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                    config.trading_enabled
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {config.trading_enabled ? 'Disable Demo Trading' : 'Enable Demo Trading (OKX Simulated Only)'}
                </button>
                <p className="text-[11px] text-slate-400">Strictly routes to OKX EU Demo. Live trading is rejected.</p>
              </div>
            </div>

            {/* Trading Symbols Selector */}
            <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Whitelisted Instruments (symbols)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_PAIRS.map((sym) => {
                  const isSelected = config.strategy.symbols.includes(sym);
                  return (
                    <button
                      key={sym}
                      onClick={() => toggleSymbol(sym)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sym} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">
                Only instruments in this list are scanned by the Python trading bot and evaluated by Gemini.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: GEMINI ADVISER */}
        {activeTab === 'adviser' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-6 rounded-xl border border-purple-500/20 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h2 className="text-base font-bold text-white">Gemini Quantitative Risk Adviser</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Gemini advises on optimal parameter boundaries based on market conditions.
                    In accordance with strict safety rules, Gemini <strong className="text-slate-200">cannot authorize or execute trades</strong>.
                    All proposed parameters require your manual review and approval.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Model: gemini-3.8-flash
                </span>
              </div>

              {/* Consultation Input Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Observed Market Conditions</label>
                  <select
                    value={marketContext}
                    onChange={(e) => setMarketContext(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Consolidation with moderate volatility and rangebound dynamics">Consolidation / Rangebound</option>
                    <option value="High volatility breakout with expanding ATR and heavy volume">High Volatility Breakout</option>
                    <option value="Strong bullish trend with sustained EMA separation">Strong Bullish Trend</option>
                    <option value="Bearish expansion with declining momentum and low RSI">Bearish Expansion</option>
                    <option value="Weekend low-liquidity chopped compression">Low Liquidity / Chop</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Portfolio Risk Posture</label>
                  <select
                    value={riskGoal}
                    onChange={(e) => setRiskGoal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Capital preservation with strict drawdowns (<3%)">Conservative (Preserve Capital)</option>
                    <option value="Balanced risk/reward targeting high probability setups">Balanced Growth</option>
                    <option value="Selective high-conviction trades with tighter stops">High Conviction (Tight Stops)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={requestGeminiAdvice}
                  disabled={adviceLoading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 flex items-center justify-center space-x-2 transition-all"
                >
                  {adviceLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Consulting Gemini Adviser...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Request Strategy Advice (/api/gemini-advice)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Display Most Recent Advice */}
            {advice && (
              <div className="bg-slate-900/90 p-6 rounded-xl border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono text-purple-400 font-bold uppercase tracking-wider">
                      Regime: {advice.market_regime}
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">Adviser Analysis</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">Confidence:</span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-500/20 text-purple-300">
                      {advice.confidence_score}%
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                  {advice.analysis}
                </p>

                {/* Diff Comparison Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Parameter Comparison</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-3 font-semibold">Parameter</th>
                          <th className="py-2 px-3 font-semibold">Current Value</th>
                          <th className="py-2 px-3 font-semibold text-purple-300">Gemini Proposed</th>
                          <th className="py-2 px-3 font-semibold">Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {config && Object.entries(advice.proposed_parameters).map(([key, val]) => {
                          if (key === 'symbols') return null;
                          const currentVal = (config.strategy as any)[key];
                          const changed = currentVal !== val;
                          const rationale = advice.rationale_per_field[key] || "Optimized for volatility regime";

                          return (
                            <tr key={key} className={changed ? 'bg-purple-950/20' : ''}>
                              <td className="py-2.5 px-3 text-slate-300 font-sans font-medium">{key}</td>
                              <td className="py-2.5 px-3 text-slate-400">{String(currentVal)}</td>
                              <td className="py-2.5 px-3 text-purple-300 font-bold">
                                {String(val)} {changed && <span className="text-[10px] text-amber-400 font-sans ml-1">Δ</span>}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">{rationale}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Risk Warnings */}
                {advice.risk_warnings && advice.risk_warnings.length > 0 && (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1 text-xs">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Key Risk Considerations</span>
                    </div>
                    <ul className="list-disc list-inside text-amber-300/80 space-y-0.5 pt-1">
                      {advice.risk_warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <p className="text-[11px] text-slate-500 italic">
                    {advice.disclaimer}
                  </p>
                  <button
                    onClick={applyGeminiAdvice}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center space-x-1.5 shadow-md shadow-purple-600/20"
                  >
                    <span>Explicitly Accept & Apply Proposed Strategy</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DRY-RUN SIMULATION */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-white">Controlled Single-Cycle Dry Run</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Invokes the Python trading engine (<code className="text-slate-300">python3 main.py</code>) to evaluate indicator signals,
                    calculate exact position sizing, and verify OKX EU Demo risk rules.
                  </p>
                </div>
                <button
                  onClick={runSimulationAudit}
                  disabled={simLoading}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-2 shadow-md shadow-emerald-600/20"
                >
                  {simLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Evaluating Cycle...</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Execute Controlled Cycle</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results Output */}
            {simResults && (
              <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-3">
                  <span className="text-slate-400">
                    Status: <strong className="text-emerald-400">{simResults.status || "OK"}</strong>
                  </span>
                  <span className="text-slate-400">
                    Demo Balance: <strong className="text-white">${simResults.account_equity?.toLocaleString()} USDT</strong>
                  </span>
                  <span className="text-slate-400">
                    Symbols Evaluated: <strong className="text-white">{simResults.symbols_scanned}</strong>
                  </span>
                </div>

                {/* Scanned Symbols Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {simResults.results?.map((res: any) => {
                    const sig = res.signal;
                    const sz = res.sizing;
                    return (
                      <div key={res.symbol} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white">{res.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sig.action === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : sig.action === 'SELL'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {sig.action} ({sig.score}/100)
                          </span>
                        </div>

                        <div className="space-y-1 text-slate-400 text-[11px]">
                          <div>Price: <span className="text-slate-200">${sig.current_price?.toLocaleString()}</span></div>
                          <div>Stop Loss: <span className="text-rose-300">${sig.stop_loss?.toLocaleString()}</span></div>
                          <div>Take Profit: <span className="text-emerald-300">${sig.take_profit?.toLocaleString()}</span></div>
                          <div>ATR: <span className="text-slate-200">${sig.atr}</span></div>
                        </div>

                        {sz?.valid ? (
                          <div className="pt-2 border-t border-slate-800 text-[11px] space-y-0.5 text-slate-300">
                            <div>Units: <strong className="text-amber-300">{sz.units}</strong></div>
                            <div>Notional: <strong>${sz.notional_usd}</strong></div>
                            <div>Risk: <strong>${sz.dollar_risk} ({sz.risk_pct_of_equity}%)</strong></div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 italic">
                            {sz?.reason || "No actionable position"}
                          </div>
                        )}

                        <div className="pt-1 text-[10px] text-slate-500">
                          Order: {res.order?.status || (res.order?.simulated ? "DRY_RUN_SAFE" : "IDLE")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXPORT & SYNC BRIDGE */}
        {activeTab === 'export' && config && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Configuration Export & Sync Bridge</h2>
                  <p className="text-xs text-slate-400">
                    Inspect the authoritative JSON structure and understand how settings reach the Python bot.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={copyStrategyJson}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1.5 border border-slate-700"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                  <button
                    onClick={downloadStrategyJson}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download strategy.json</span>
                  </button>
                </div>
              </div>

              {/* Strategy Sync Pathways Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>1. Local / Workspace Sync</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Clicking "Save to strategy.json" writes directly to the disk file <code className="text-slate-300">strategy.json</code>.
                    The Python bot reads this file on every cycle.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>2. GitHub Actions Secrets</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Committed to private repo <code className="text-slate-300">therog1/tradebottenanna</code>.
                    Triggered manually via <code className="text-slate-300">workflow_dispatch</code> in GitHub Actions.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>3. Cloudflare Edge State</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Stored in-memory or Cloudflare KV on the worker, protected behind Cloudflare Access Google authentication.
                  </p>
                </div>
              </div>

              {/* JSON Viewer */}
              <div className="pt-2">
                <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[420px] border border-slate-800/90 leading-relaxed">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DEPLOYMENT GUIDE & CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white">TradebottenAnna Deployment & Verification Guide</h2>
                  <p className="text-xs text-slate-400">
                    Step-by-step instructions matching the actual project source tree.
                  </p>
                </div>
                <a
                  href="/api/download-zip"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center space-x-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Complete Repository ZIP</span>
                </a>
              </div>

              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">1</span>
                  <h3 className="text-sm font-bold text-white">Deploy Unified Cloudflare Worker & Static Assets</h3>
                </div>
                <p className="text-xs text-slate-400 pl-8">
                  Deploys both the compiled control panel dashboard and API endpoints to <code className="text-amber-300">tradebottenanna.rogedv.workers.dev</code>:
                </p>
                <div className="pl-8 pt-1">
                  <pre className="p-3 rounded-lg bg-slate-900 text-xs font-mono text-slate-200 border border-slate-800">
{`# 1. Build the production React control panel
npm run build

# 2. Configure Gemini secret on the worker
npx wrangler secret put GEMINI_API_KEY

# 3. Deploy unified worker with static assets
npx wrangler deploy`}
                  </pre>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">2</span>
                  <h3 className="text-sm font-bold text-white">Configure Cloudflare Access (Google Login for Roger Only)</h3>
                </div>
                <p className="text-xs text-slate-400 pl-8">
                  In Cloudflare Zero Trust dashboard, create a Self-Hosted Application protecting <code className="text-slate-300">tradebottenanna.rogedv.workers.dev</code>:
                </p>
                <ul className="pl-12 list-disc text-xs text-slate-300 space-y-1 pt-1">
                  <li><strong>Application Domain:</strong> tradebottenanna.rogedv.workers.dev</li>
                  <li><strong>Identity Provider:</strong> Google OAuth</li>
                  <li><strong>Policy Rule:</strong> Allow emails: <code className="text-amber-300">rogedv@icloud.com</code></li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">3</span>
                  <h3 className="text-sm font-bold text-white">Execute Python Trading Bot Tests & Manual Demo Runs</h3>
                </div>
                <p className="text-xs text-slate-400 pl-8">
                  Verify the test suite and execute a controlled dry-run:
                </p>
                <div className="pl-8 pt-1">
                  <pre className="p-3 rounded-lg bg-slate-900 text-xs font-mono text-slate-200 border border-slate-800">
{`# 1. Run unit test suite (16 tests verifying risk, math, and demo flags)
python3 -m unittest discover -s tests

# 2. Run single controlled cycle
python3 main.py`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">TradebottenAnna v1.2.0</span>
            <span>•</span>
            <span>OKX EU Demo Trading System</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">x-simulated-trading: 1</span>
          </div>
          <div>
            Authorized for <strong className="text-slate-400">rogedv@icloud.com</strong> via Cloudflare Access
          </div>
        </div>
      </footer>
    </div>
  );
}
