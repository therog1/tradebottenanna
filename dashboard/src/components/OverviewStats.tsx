import React from 'react';
import { fmtUsd, isKnown } from '../utils/format';
import { Trade, Position } from '../types';
import { TrendingUp, TrendingDown, Wallet, ShieldCheck, DollarSign, Layers } from 'lucide-react';

interface OverviewStatsProps {
  trades: Trade[];
  positions: Position[];
  totalEquityUSD?: number;
  annaEquityUSD?: number;
  lenaEquityUSD?: number;
}

export const OverviewStats: React.FC<OverviewStatsProps> = ({
  trades,
  positions,
  totalEquityUSD,
  annaEquityUSD,
  lenaEquityUSD,
}) => {
  // Realized PnL from closed exits
  const closedWins = trades.filter(t => t.realized_pnl > 0);
  const totalRealizedPnl = trades.reduce((sum, t) => sum + t.realized_pnl, 0);

  // Unrealized PnL on active holdings
  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + p.unrealized_pnl, 0);
  const totalExposure = positions.reduce((acc, p) => acc + p.allocated_usd, 0);

  return (
    <div className="space-y-3">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Live Portfolio Equity */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Totalt Skarpt Portföljvärde</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-slate-100">
              {fmtUsd(totalEquityUSD)}
            </span>
            <span className="text-xs text-emerald-400 font-sans">USD</span>
          </div>
          <div className="mt-1 text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Anna: <b className="text-slate-300">{fmtUsd(annaEquityUSD)}</b></span>
            <span>Lena: <b className="text-slate-300">{fmtUsd(lenaEquityUSD)}</b></span>
          </div>
        </div>

        {/* 2. Secured / Realized Profits */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Säkrade vinster (Stängda)</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 font-mono">
            <span className={`text-2xl font-bold tracking-tight ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span>{trades.length} genomförda ordrar på OKX</span>
          </div>
        </div>

        {/* 3. Floating / Unrealized PnL */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Orealiserad PnL (Öppet innehav)</span>
            {totalUnrealizedPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 font-mono">
            <span className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span>Positioner: okänt</span>
          </div>
        </div>

        {/* 4. Active Crypto Exposure */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Aktiv krypto-exponering</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-slate-100">
              ${totalExposure.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span>Innehav: okänt</span>
          </div>
        </div>

        {/* 5. Free Cash Ready */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm col-span-2 md:col-span-4 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Tillgänglig kassa (USDC)</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-slate-100">
              {isKnown(totalEquityUSD) ? fmtUsd(totalEquityUSD - totalExposure) : 'okänt'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            <span>Lena: okänt • Anna: okänt</span>
          </div>
        </div>
      </div>

      {/* Clear Profit & Status Explainer Bar */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-200">
            Datakälla:
          </span>
          <span className="text-slate-400">
            Read-only-feed från OKX (endast GET) via GitHub Actions, data/status.json. Okända värden visas som okänt.
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px]">
          <span>Anna: <b className="text-emerald-400">okänt</b></span>
          <span className="text-slate-600">|</span>
          <span>Lena: <b className="text-cyan-400">okänt</b> (ej verifierat mot OKX)</span>
        </div>
      </div>
    </div>
  );
};
