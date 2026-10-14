import React, { useState } from 'react';
import { BotConfig } from '../types';
import { Zap, ShieldCheck, Play, Settings2, Github, Terminal, CheckCircle2, Clock } from 'lucide-react';

interface BotCardsSectionProps {
  bots: BotConfig[];
  onTriggerLenaWorkflow: () => Promise<void>;
  onRunBotCycle: (botSlug: 'anna' | 'lena') => void;
  onOpenSettings: (bot: BotConfig) => void;
  isTriggeringWorkflow: boolean;
}

export const BotCardsSection: React.FC<BotCardsSectionProps> = ({
  bots,
  onTriggerLenaWorkflow,
  onRunBotCycle,
  onOpenSettings,
  isTriggeringWorkflow,
}) => {
  const anna = bots.find(b => b.slug === 'anna') || bots[0];
  const lena = bots.find(b => b.slug === 'lena') || bots[1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Bot 1: Tradebotten Anna */}
      <div className="rounded-xl border border-blue-900/60 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-100 text-base">{anna.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/80">
                    KONSIGNATIV SWING
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{anna.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Aktiv
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            {anna.description}
          </p>

          {/* Key Parameters Matrix */}
          <div className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Risk per affär</span>
              <span className="font-mono font-bold text-slate-200">{anna.risk_per_trade_pct}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Tidsram</span>
              <span className="font-mono font-bold text-slate-200">{anna.timeframe} (1h)</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Max öppna pos</span>
              <span className="font-mono font-bold text-blue-400">{anna.max_open_positions || 3} st</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Stop Loss (ATR)</span>
              <span className="font-mono font-bold text-rose-400">-{anna.stop_loss_pct}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Take Profit</span>
              <span className="font-mono font-bold text-emerald-400">+{anna.take_profit_pct}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Hävstång / Typ</span>
              <span className="font-mono font-bold text-purple-300">3x Perps Swap</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Senaste cykel: {anna.last_cycle_time} ({anna.last_cycle_status})</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRunBotCycle('anna')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Kör utvärdering</span>
            </button>
            <button
              onClick={() => onOpenSettings(anna)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Parametrar</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            therog1/tradebottenanna
          </span>
        </div>
      </div>

      {/* Bot 2: Aggressiva Lena */}
      <div className="rounded-xl border border-amber-900/60 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-100 text-base">{lena.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/80">
                    FUTURES SCALPER 3x–5x
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{lena.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Live Cron
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            {lena.description}
          </p>

          {/* Key Parameters Matrix */}
          <div className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Risk per trade</span>
              <span className="font-mono font-bold text-amber-400">{lena.risk_per_trade_pct}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Tidsintervall</span>
              <span className="font-mono font-bold text-slate-200">Orderbok (Futures L2)</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Max öppna pos</span>
              <span className="font-mono font-bold text-amber-400">{lena.max_open_positions || 3} st</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Stop Loss</span>
              <span className="font-mono font-bold text-rose-400">-{lena.stop_loss_pct}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Take Profit</span>
              <span className="font-mono font-bold text-emerald-400">+{lena.take_profit_pct}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Hävstång (Futures)</span>
              <span className="font-mono font-bold text-amber-400">
                {lena.min_leverage || 3}x – {lena.max_leverage || 5}x Cross
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Körs automatiskt: var 15:e minut via GitHub Actions</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRunBotCycle('lena')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Kör skalp-cykel</span>
            </button>
            <button
              onClick={onTriggerLenaWorkflow}
              disabled={isTriggeringWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
              title="Trigga GitHub Actions på therog1/tradebottenaggresivalena direkt"
            >
              <Github className="w-3.5 h-3.5" />
              <span>{isTriggeringWorkflow ? 'Skickar...' : 'Kör i GitHub'}</span>
            </button>
            <button
              onClick={() => onOpenSettings(lena)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Parametrar</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            therog1/tradebottenaggresivalena
          </span>
        </div>
      </div>
    </div>
  );
};
