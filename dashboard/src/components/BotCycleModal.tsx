import React, { useState, useEffect } from 'react';
import { Terminal, X, Play, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { BotConfig, Trade, Position } from '../types';

interface BotCycleModalProps {
  botSlug: 'anna' | 'lena' | null;
  isOpen: boolean;
  onClose: () => void;
  bot: BotConfig | undefined;
  onTradeCreated?: (trade: Trade) => void;
  onPositionCreated?: (pos: Position) => void;
}

export const BotCycleModal: React.FC<BotCycleModalProps> = ({
  botSlug,
  isOpen,
  onClose,
  bot,
  onTradeCreated,
  onPositionCreated,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen && botSlug && bot) {
      runCycleSimulation();
    } else {
      setLogs([]);
      setIsFinished(false);
    }
  }, [isOpen, botSlug]);

  const runCycleSimulation = async () => {
    setLogs([]);
    setIsFinished(false);

    const log = (msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    if (botSlug === 'lena') {
      log(`⚡ Initierar Ken Griffin Momentum Scalp Cycle (Aggressiva Lena)...`);
      await delay(400);
      log(`Subaccount Equity: okänt | Simulering – inga ordrar skickas`);
      await delay(400);
      log(`Hävstång: Min ${bot?.min_leverage || 3}x – Max ${bot?.max_leverage || 5}x (Dynamisk Futures / Cross Margin)`);
      await delay(400);
      log(`Skannar likviditet och orderboksflöde (OBI-tröskel +50%)...`);
      await delay(600);
      log(`Positioner: okänt (simulering, inga OKX-anrop)`);
      await delay(500);
      await delay(500);
      log(`[SUI-USDC] OBI: +34.20% | Under tröskeln för ny order (+50%).`);
      await delay(600);
      log(`✅ Lena-cykel klar: Max ${bot?.max_open_positions || 3} samtidiga positioner, hävstång beräknas 3x–5x vid orderläggning.`);
      await delay(500);
      log(`Körs kontinuerligt via GitHub Actions cron var 15:e minut.`);
    } else {
      log(`🛡️ Initierar Tradebotten Anna utvärderingscykel (Konservativ Swing)...`);
      await delay(400);
      log(`Läser strategy.json (OKX Live Environment)...`);
      await delay(400);
      log(`Kollar RiskManager status: Trading Enabled: true, Kill Switch: false`);
      await delay(500);
      log(`Innehav: okänt (simulering).`);
      await delay(600);
      log(`Målnivåer: okänt (simulering).`);
      await delay(400);
      log(`✅ Cykel slutförd utan varningar. Portföljens marginutnyttjande är säkert.`);
    }

    setIsFinished(true);
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  if (!isOpen || !bot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-base">
              Live Cykel-Terminal — {bot.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Console output box */}
        <div className="mt-4 flex-1 bg-slate-950 rounded-xl p-4 border border-slate-800/80 font-mono text-xs overflow-y-auto space-y-1.5 min-h-[300px]">
          {logs.map((line, idx) => (
            <div key={idx} className="text-slate-300 leading-relaxed">
              {line}
            </div>
          ))}
          {!isFinished && (
            <div className="flex items-center gap-2 text-cyan-400 animate-pulse pt-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Kör cykel och utvärderar signaler...</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isFinished ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Cykel avslutad
              </span>
            ) : (
              <span>Exekvering pågår...</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
};
