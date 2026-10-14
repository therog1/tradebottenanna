import React from 'react';
import { fmtUsd } from '../utils/format';
import { ShieldAlert, Github, Activity, RefreshCw, Zap, Power, Cpu } from 'lucide-react';

interface HeaderProps {
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  onPanicCloseAll: () => void;
  onOpenGitHubModal: () => void;
  onOpenOKXModal: () => void;
  onOpenGrokBridge?: () => void;
  okxBalanceData: any;
  openPositionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  killSwitchActive,
  onToggleKillSwitch,
  onPanicCloseAll,
  onOpenGitHubModal,
  onOpenOKXModal,
  onOpenGrokBridge,
  okxBalanceData,
  openPositionsCount,
}) => {
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
                v2.2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              OKX Gateway • Anna (Swing) & Aggressiva Lena (Scalper)
            </p>
          </div>
        </div>

        {/* Global actions and status pills */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* OKX Live Balance Pill / Connect Button */}
          <button
            onClick={onOpenOKXModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              okxBalanceData?.connected
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Klicka för att se OKX-kontouppgifter"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            {okxBalanceData?.connected ? (
              <span>
                SALDO (read-only): <b>{fmtUsd(okxBalanceData.totalEquityUSD)}</b> · Anna {fmtUsd(okxBalanceData.anna?.totalEquityUSD)} · Lena {fmtUsd(okxBalanceData.lena?.totalEquityUSD)}{okxBalanceData.generatedAt ? ` · ${String(okxBalanceData.generatedAt).slice(11,16)} UTC` : ''}
              </span>
            ) : (
              <span>Saldo: okänt{okxBalanceData?.stale ? ' (inaktuell data)' : ''}</span>
            )}
          </button>

          {/* GitHub Sync Status */}
          <button
            onClick={onOpenGitHubModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <Github className="w-3.5 h-3.5 text-slate-400" />
            <span>GitHub (therog1)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>

          {/* Grok Handover Bridge Button */}
          {onOpenGrokBridge && (
            <button
              onClick={onOpenGrokBridge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/80 border border-indigo-700/80 text-indigo-200 hover:bg-indigo-900 transition shadow-sm"
              title="Öppna Grok Command Bridge och överlämningsinstruktioner"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Grok Befäl</span>
            </button>
          )}

          {/* Emergency Kill Switch */}
          <button
            onClick={onToggleKillSwitch}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              killSwitchActive
                ? 'bg-red-950/80 text-red-300 border-red-700 hover:bg-red-900'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-red-400 hover:border-red-900/60'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${killSwitchActive ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{killSwitchActive ? 'KILL-SWITCH AKTIV' : 'Kill-Switch'}</span>
          </button>

          {/* Panic Close All Button */}
          {openPositionsCount > 0 && (
            <button
              onClick={onPanicCloseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
              title="Stäng alla öppna positioner till marknadspris omedelbart"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Nödstäng alla ({openPositionsCount})</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
