import React from 'react';
import { BotConfig } from '../types';
import { ShieldCheck, Zap, ExternalLink } from 'lucide-react';

interface BotCardsSectionProps {
  bots: BotConfig[];
}

/** Read-only botkort. Inga knappar som påstår sig styra något; status är verifierad 2026-10-14. */
export const BotCardsSection: React.FC<BotCardsSectionProps> = () => {
  const cards = [
    {
      name: 'Tradebotten Anna', icon: <ShieldCheck className="w-5 h-5" />, color: 'blue',
      repo: 'therog1/tradebottenanna', account: 'OKX_ANNA_*',
      text: 'Swing/trend (1H, EMA9/21 + RSI). Körs av demo_trading.yml varje timme. Exponeringstak mot Lena.',
    },
    {
      name: 'Aggressiva Lena', icon: <Zap className="w-5 h-5" />, color: 'amber',
      repo: 'therog1/tradebottenaggresivalena', account: 'OKX_AGGR_*',
      text: 'OBI + trendfilter (USD-M X-perps). Körs av lena_scalp.yml var 15:e min. SL läggs hos OKX vid varje inträde. Exponeringstak mot Anna.',
    },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {cards.map(c => (
        <div key={c.name} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">{c.icon}</div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">{c.name}</h3>
                <p className="text-xs text-slate-400">Konto: {c.account}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">Schemalagd</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{c.text}</p>
          <a href={`https://github.com/${c.repo}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            <ExternalLink className="w-3.5 h-3.5" /> {c.repo}
          </a>
        </div>
      ))}
    </div>
  );
};
