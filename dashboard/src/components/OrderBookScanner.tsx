import React, { useState, useMemo } from 'react';
import { MarketFlow } from '../types';
import { Flame, ArrowUpRight, ArrowDownRight, Zap, RefreshCw, Filter, Search, TrendingUp, BarChart3 } from 'lucide-react';

interface OrderBookScannerProps {
  flows: MarketFlow[];
  onSimulateScalp: (symbol: string) => void;
  onRefreshFlows?: () => void;
  isRefreshing?: boolean;
}

export const OrderBookScanner: React.FC<OrderBookScannerProps> = ({
  flows,
  onSimulateScalp,
  onRefreshFlows,
  isRefreshing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'TRIGGERS' | 'BUY_FLOW' | 'HIGH_VOL'>('ALL');
  const [sortBy, setSortBy] = useState<'VOLUME' | 'IMBALANCE' | 'CHANGE' | 'NAME'>('VOLUME');

  // Filter & sort flows
  const filteredFlows = useMemo(() => {
    return flows
      .filter(f => {
        const matchesSearch = f.symbol.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (filterMode === 'TRIGGERS') return f.imbalance >= 0.50;
        if (filterMode === 'BUY_FLOW') return f.imbalance > 0.15;
        if (filterMode === 'HIGH_VOL') return (f.volUSD || 0) > 2000000;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'VOLUME') return (b.volUSD || 0) - (a.volUSD || 0);
        if (sortBy === 'IMBALANCE') return b.imbalance - a.imbalance;
        if (sortBy === 'CHANGE') return Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0);
        if (sortBy === 'NAME') return a.symbol.localeCompare(b.symbol);
        return 0;
      });
  }, [flows, searchTerm, filterMode, sortBy]);

  const triggerCount = flows.filter(f => f.imbalance >= 0.50).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Flame className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Lena Realtids-Orderboksanalys (Order Book Imbalance)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-bold">
              30 Mest Omsatta & Volatila Par
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-950/80 text-purple-300 border border-purple-800/80 font-bold">
              3x–5x Futures Leverage
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-amber-950/80 text-amber-300 border border-amber-800/80">
              Tröskel: &gt;+45.0% OBI
            </span>
            {triggerCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse font-bold">
                {triggerCount} SIGNAL{triggerCount > 1 ? 'ER' : ''} JUST NU
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Övervakar <b>topp 30</b> par på OKX efter köpar-absorption och volymavvikelse (Bids vs Asks). När obalansen överstiger <b>+50.0%</b> sker omedelbar skalporder.
          </p>
        </div>

        {onRefreshFlows && (
          <button
            onClick={onRefreshFlows}
            disabled={isRefreshing}
            className="self-start lg:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Uppdatera orderböcker</span>
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Sök bland de 30 paren..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              filterMode === 'ALL'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Alla ({flows.length})
          </button>
          <button
            onClick={() => setFilterMode('TRIGGERS')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 ${
              filterMode === 'TRIGGERS'
                ? 'bg-amber-900/60 text-amber-200 border border-amber-700 font-bold'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/40'
            }`}
          >
            <Flame className="w-3 h-3 text-amber-400" />
            <span>Köp-tröskel (&gt;50%)</span>
          </button>
          <button
            onClick={() => setFilterMode('HIGH_VOL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              filterMode === 'HIGH_VOL'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Hög volym (&gt;$2M)
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 ml-2 text-slate-400">
            <span className="text-[10px]">Sortera:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="VOLUME">24h Volym ($)</option>
              <option value="IMBALANCE">Orderboks-obalans (OBI)</option>
              <option value="CHANGE">Volatilitet (24h %)</option>
              <option value="NAME">Namn (A-Ö)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of 30 Pairs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {filteredFlows.map(flow => {
          const isTrigger = flow.imbalance >= 0.50;
          const bidPercent = Math.max(5, Math.min(95, Math.round((flow.bid_vol / (flow.bid_vol + flow.ask_vol || 1)) * 100)));
          const askPercent = 100 - bidPercent;

          return (
            <div
              key={flow.symbol}
              className={`p-3.5 rounded-xl border transition relative flex flex-col justify-between ${
                isTrigger
                  ? 'bg-amber-950/30 border-amber-500/70 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-200">{flow.symbol}</span>
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    ${flow.last_price < 0.01 
                      ? flow.last_price.toFixed(6) 
                      : flow.last_price < 10 
                      ? flow.last_price.toFixed(4) 
                      : flow.last_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Sub-info: 24h Vol & Change */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>
                    Vol: {flow.volUSD 
                      ? `$${(flow.volUSD / 1_000_000).toFixed(1)}M` 
                      : 'Aktiv'}
                  </span>
                  {typeof flow.change24h === 'number' && (
                    <span className={flow.change24h >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      {flow.change24h >= 0 ? '+' : ''}{flow.change24h.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Imbalance Meter */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span className="text-emerald-400 font-medium">Köp ({bidPercent}%)</span>
                    <span className="text-rose-400 font-medium">Sälj ({askPercent}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${bidPercent}%` }}
                    ></div>
                    <div
                      className="h-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${askPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Imbalance Score */}
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[10px]">OBI Obalans</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      flow.imbalance >= 0.5
                        ? 'text-amber-400 font-extrabold'
                        : flow.imbalance > 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {flow.imbalance >= 0 ? '+' : ''}{(flow.imbalance * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Status / Trigger Action */}
              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isTrigger
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : flow.imbalance > 0.2
                      ? 'bg-emerald-950 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isTrigger ? 'KÖPSIGNAL' : flow.signal}
                </span>

                <button
                  onClick={() => onSimulateScalp(flow.symbol)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition ${
                    isTrigger
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                  }`}
                  title="Simulera momentum-köp och skalp för denna symbol"
                >
                  Skalpa nu
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFlows.length === 0 && (
        <div className="text-center py-8 text-xs text-slate-500">
          Inga par matchade sökningen. Prova att ändra filter eller sökord.
        </div>
      )}
    </div>
  );
};
