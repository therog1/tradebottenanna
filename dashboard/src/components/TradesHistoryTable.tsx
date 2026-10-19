import React, { useState, useMemo } from 'react';
import { Trade } from '../types';
import { Download, Search, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Filter, Info, ShieldCheck } from 'lucide-react';

interface TradesHistoryTableProps {
  trades: Trade[];
  fromFeed?: boolean;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export const TradesHistoryTable: React.FC<TradesHistoryTableProps> = ({
  trades,
  fromFeed = false,
  onExportCSV,
  onExportJSON,
}) => {
  const [selectedBot, setSelectedBot] = useState<'ALL' | 'ANNA' | 'LENA'>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      // Bot filter
      if (selectedBot === 'ANNA' && trade.bot !== 'Tradebotten Anna') return false;
      if (selectedBot === 'LENA' && trade.bot !== 'Aggressiva Lena') return false;

      // Outcome filter
      if (selectedOutcome === 'WIN' && trade.realized_pnl <= 0) return false;
      if (selectedOutcome === 'LOSS' && trade.realized_pnl > 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSymbol = trade.symbol.toLowerCase().includes(query);
        const matchesReason = trade.exit_reason.toLowerCase().includes(query);
        const matchesId = trade.id.toLowerCase().includes(query);
        if (!matchesSymbol && !matchesReason && !matchesId) return false;
      }

      return true;
    });
  }, [trades, selectedBot, selectedOutcome, searchQuery]);

  // Aggregate stats for filtered set
  const filteredWins = filteredTrades.filter(t => t.realized_pnl > 0);
  const filteredPnl = filteredTrades.reduce((sum, t) => sum + t.realized_pnl, 0);

  const getExitReasonBadge = (reason: Trade['exit_reason']) => {
    switch (reason) {
      case 'TAKE_PROFIT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">Take Profit</span>;
      case 'TRAILING_STOP':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">Trailing Stop</span>;
      case 'STOP_LOSS':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">Stop Loss</span>;
      case 'EXCHANGE_FILL':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">Stängd på OKX</span>;
      case 'LIQUIDATION':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">Likvidation/ADL</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">Manuell stängning</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Real Orders & Profits Status Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-indigo-950/40 border border-emerald-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-200">
              {fromFeed ? 'Stängda positioner från OKX' : 'Stängda affärer'}
            </h4>
            <p className="text-xs text-slate-300/90 mt-0.5 leading-relaxed">
              {fromFeed
                ? `Read-only från OKX positions-history (senaste 50 per bot). ${filteredTrades.length} affärer · ${filteredWins.length} vinster · realiserat ${filteredPnl >= 0 ? '+' : '−'}$${Math.abs(filteredPnl).toFixed(2)} i urvalet.`
                : 'Ingen stängd-affär-data i feeden ännu. Lokala rader kan vara demo-/exempeldata och är inte avstämda mot OKX.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={onExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Bot filter pills */}
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setSelectedBot('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                selectedBot === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Alla bottar ({trades.length})
            </button>
            <button
              onClick={() => setSelectedBot('ANNA')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                selectedBot === 'ANNA'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Anna ({trades.filter(t => t.bot === 'Tradebotten Anna').length})
            </button>
            <button
              onClick={() => setSelectedBot('LENA')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                selectedBot === 'LENA'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Lena ({trades.filter(t => t.bot === 'Aggressiva Lena').length})
            </button>
          </div>

          {/* Outcome filter */}
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedOutcome('ALL')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                selectedOutcome === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Alla
            </button>
            <button
              onClick={() => setSelectedOutcome('WIN')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                selectedOutcome === 'WIN' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              Vinst ({trades.filter(t => t.realized_pnl > 0).length})
            </button>
            <button
              onClick={() => setSelectedOutcome('LOSS')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                selectedOutcome === 'LOSS' ? 'bg-rose-950 text-rose-300 border border-rose-800/50' : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              Förlust ({trades.filter(t => t.realized_pnl <= 0).length})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Sök symbol (SOL, BTC, SUI)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-600 transition"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-medium">
                <th className="py-3 px-4">Tid / Datum</th>
                <th className="py-3 px-4">Bot</th>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-4">Typ</th>
                <th className="py-3 px-4">Instegspris</th>
                <th className="py-3 px-4">Utstegspris</th>
                <th className="py-3 px-4">Volym / Värde</th>
                <th className="py-3 px-4 text-right">Realiserad PnL</th>
                <th className="py-3 px-4 text-center">Stängningsorsak</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Inga stängda ordrar matchade dina filterkriterier.
                  </td>
                </tr>
              ) : (
                filteredTrades.map(trade => {
                  const isProfit = trade.realized_pnl >= 0;
                  const dateStr = new Date(trade.exit_time).toLocaleDateString('sv-SE', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={trade.id} className="hover:bg-slate-800/40 transition">
                      {/* Date */}
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Bot Name Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {trade.bot === 'Tradebotten Anna' ? (
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

                      {/* Instrument Symbol */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {trade.symbol}
                      </td>

                      {/* Side */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${trade.side === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-indigo-950 text-indigo-400'}`}>
                          {trade.side}
                        </span>
                        {trade.leverage && trade.leverage > 1 && (
                          <span className="ml-1 text-slate-400 text-[10px]">{trade.leverage}x</span>
                        )}
                      </td>

                      {/* Entry Price */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        ${trade.entry_price < 10 ? trade.entry_price.toFixed(4) : trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Exit Price */}
                      <td className="py-3 px-4 font-mono text-slate-200 font-semibold">
                        ${trade.exit_price < 10 ? trade.exit_price.toFixed(4) : trade.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Size & Notional */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        <div>{trade.size_units} enheter</div>
                        <div className="text-slate-500">${trade.notional_usd.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
                      </td>

                      {/* Realized PnL */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <div className={`font-bold flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          <span>{isProfit ? '+' : ''}${trade.realized_pnl.toFixed(2)}</span>
                        </div>
                        <div className={`text-[11px] ${isProfit ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                          {isProfit ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                        </div>
                      </td>

                      {/* Exit Reason */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {getExitReasonBadge(trade.exit_reason)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          STÄNGD
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
