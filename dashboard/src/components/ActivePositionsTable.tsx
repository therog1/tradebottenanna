import React from 'react';
import { Position } from '../types';
import { ArrowUpRight, ArrowDownRight, XCircle, TrendingUp, ShieldCheck } from 'lucide-react';

interface ActivePositionsTableProps {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
}

export const ActivePositionsTable: React.FC<ActivePositionsTableProps> = ({
  positions,
  onClosePosition,
}) => {
  if (positions.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
        <ShieldCheck className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-300">Inga öppna positioner just nu</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Båda bottarna bevakar marknaden och inväntar signal (Anna via ATR-trend och Lena via Order Book Imbalance &gt;40%).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-medium">
              <th className="py-3 px-4">Bot</th>
              <th className="py-3 px-4">Par / Instrument</th>
              <th className="py-3 px-4">Sida</th>
              <th className="py-3 px-4">Instegspris</th>
              <th className="py-3 px-4">Aktuellt pris</th>
              <th className="py-3 px-4">Högsta notering</th>
              <th className="py-3 px-4">Allokerat kapital</th>
              <th className="py-3 px-4 text-right">Orealiserad PnL</th>
              <th className="py-3 px-4 text-center">Åtgärd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {positions.map(pos => {
              const isProfit = pos.unrealized_pnl >= 0;
              return (
                <tr key={pos.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 whitespace-nowrap">
                    {pos.bot === 'Tradebotten Anna' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/70 text-blue-300 border border-blue-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        Anna
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        Lena
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono font-semibold text-slate-100">
                    {pos.symbol}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400">
                      {pos.side}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-300">
                    ${pos.entry_price < 10 ? pos.entry_price.toFixed(4) : pos.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-100 font-bold">
                    ${pos.current_price < 10 ? pos.current_price.toFixed(4) : pos.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    ${pos.high_price < 10 ? pos.high_price.toFixed(4) : pos.high_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {pos.trailing_stop_dist_pct !== undefined && (
                      <span className="block text-slate-500 text-[10px]">
                        Drop: {pos.trailing_stop_dist_pct.toFixed(2)}%
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-300">
                    ${pos.allocated_usd.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    <span className="block text-[11px] text-slate-500 font-normal">
                      {pos.size_units} enheter
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                    <div className={`font-bold flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      <span>{isProfit ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}</span>
                    </div>
                    <div className={`text-[11px] ${isProfit ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                      {isProfit ? '+' : ''}{pos.pnl_pct.toFixed(2)}%
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => onClosePosition(pos.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/80 hover:bg-rose-900 transition"
                      title="Stäng positionen till rådande marknadspris och spara i historiken"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Stäng vid marknad</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
