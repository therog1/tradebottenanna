import React from 'react';
import { fmtUsd } from '../utils/format';
import { Github, Activity, RefreshCw, Zap } from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  okxBalanceData: any;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, okxBalanceData }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Bot titles */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                Tradebot Command Center
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                {__BUILD_ID__}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              OKX Gateway • Anna (Swing) & Aggressiva Lena (Scalper)
            </p>
            <p className="text-[11px] text-slate-400" data-testid="last-updated">
              {okxBalanceData?.generatedAt
                ? `Senast uppdaterad ${String(okxBalanceData.generatedAt).slice(11, 16)} UTC (${Math.max(0, Math.round((Date.now() - Date.parse(okxBalanceData.generatedAt)) / 60000))} min sedan)${okxBalanceData.stale ? ' – inaktuell' : ''}`
                : 'Senast uppdaterad: okänt'}
              {okxBalanceData?.anna?.lastOrderAt ? ` · Anna senaste order ${String(okxBalanceData.anna.lastOrderAt).slice(5, 16).replace('T', ' ')}` : ''}
              {okxBalanceData?.lena?.lastOrderAt ? ` · Lena senaste order ${String(okxBalanceData.lena.lastOrderAt).slice(5, 16).replace('T', ' ')}` : ''}
            </p>
          </div>
        </div>

        {/* Global actions and status pills */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Saldo (read-only, ej klickbar) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              okxBalanceData?.connected
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            {okxBalanceData?.connected ? (
              <span>
                SALDO (read-only): <b>{fmtUsd(okxBalanceData.totalEquityUSD)}</b> · Anna {fmtUsd(okxBalanceData.anna?.totalEquityUSD)} · Lena {fmtUsd(okxBalanceData.lena?.totalEquityUSD)}{okxBalanceData.generatedAt ? ` · ${String(okxBalanceData.generatedAt).slice(11,16)} UTC` : ''}
              </span>
            ) : (
              <span>Saldo: okänt{okxBalanceData?.stale ? ' (inaktuell data)' : ''}</span>
            )}
          </div>

          {/* Uppdatera (läser status.json igen) */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
              title="Läs data/status.json igen"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Uppdatera</span>
            </button>
          )}

          {/* Extern länk till GitHub */}
          <a
            href="https://github.com/therog1/tradebottenanna"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <Github className="w-3.5 h-3.5 text-slate-400" />
            <span>GitHub (therog1)</span>
          </a>



        </div>
      </div>
    </header>
  );
};
