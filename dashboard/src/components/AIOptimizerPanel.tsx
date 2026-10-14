import React, { useState } from 'react';
import { BotConfig, Trade, Position, MarketFlow } from '../types';
import { OptimizationProposal } from '../services/aiOptimizer';
import { Sparkles, Brain, CheckCircle2, ArrowRight, TrendingUp, Sliders, RefreshCw, Zap, ShieldCheck } from 'lucide-react';

interface AIOptimizerPanelProps {
  bots: BotConfig[];
  trades: Trade[];
  positions: Position[];
  marketFlows: MarketFlow[];
  onApplyProposal: (botSlug: 'anna' | 'lena', proposedParams: Record<string, any>) => Promise<void>;
}

export const AIOptimizerPanel: React.FC<AIOptimizerPanelProps> = ({
  bots,
  trades,
  positions,
  marketFlows,
  onApplyProposal,
}) => {
  const [selectedBotSlug, setSelectedBotSlug] = useState<'anna' | 'lena'>('anna');
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Record<'anna' | 'lena', OptimizationProposal | null>>({
    anna: null,
    lena: null,
  });
  const [applying, setApplying] = useState(false);
  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);

  const selectedBot = bots.find(b => b.slug === selectedBotSlug) || bots[0];
  const currentProposal = proposals[selectedBotSlug];

  const handleRunOptimization = async () => {
    setLoading(true);
    setAppliedStatus(null);
    try {
      const res = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botSlug: selectedBotSlug,
          currentConfig: selectedBot,
          trades,
          positions,
          marketFlows,
        }),
      });
      const data = await res.json();
      if (data.success && data.proposal) {
        setProposals(prev => ({
          ...prev,
          [selectedBotSlug]: data.proposal,
        }));
      }
    } catch (err) {
      console.error('Failed to optimize:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!currentProposal) return;
    setApplying(true);
    try {
      await onApplyProposal(selectedBotSlug, currentProposal.proposedParams);
      setAppliedStatus(`Förslagen applicerades framgångsrikt på ${selectedBot.name}!`);
    } catch (err: any) {
      setAppliedStatus(`Fel: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-cyan-950/40 border border-indigo-800/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">
                AI Kvantitativ Strategi-Optimering (Gemini)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                gemini-3.8-flash
              </span>
            </div>
            <p className="text-xs text-slate-300/80 mt-1 max-w-2xl leading-relaxed">
              Kör separat AI-analys för Tradebotten Anna och Aggressiva Lena. Modellen analyserar verklig handelshistorik, orderboksflöde och rådande volatilitet på OKX och genererar matematiskt optimerade parametrar som du kan granska och applicera med ett klick.
            </p>
          </div>
        </div>

        {/* Bot Switcher Tab in Header */}
        <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0">
          <button
            onClick={() => setSelectedBotSlug('anna')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedBotSlug === 'anna'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Anna (Swing)</span>
          </button>
          <button
            onClick={() => setSelectedBotSlug('lena')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedBotSlug === 'lena'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Lena (Scalper)</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Run Optimization Button */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Vald bot:</span>
          <b className="text-slate-100">{selectedBot.name}</b>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">{selectedBot.type}</span>
        </div>

        <button
          onClick={handleRunOptimization}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition shadow-lg shadow-purple-600/20 disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Analyserar orderbok och PnL...' : `Kör AI-Optimering för ${selectedBotSlug === 'anna' ? 'Anna' : 'Lena'}`}</span>
        </button>
      </div>

      {/* Results Container */}
      {currentProposal ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Executive Verdict Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Brain className="w-4 h-4" />
                AI Kvantitativ Bedömning
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                Förtroendegrad: {currentProposal.confidenceScore}%
              </span>
            </div>

            <p className="text-sm text-slate-100 font-medium leading-relaxed">
              "{currentProposal.executiveSummary}"
            </p>

            <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 font-semibold block mb-1">Marknadskontext & Volatilitet</span>
                <span className="text-slate-300">{currentProposal.marketContextVerdict}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 font-semibold block mb-1">Beräknad Förbättringseffekt</span>
                <span className="text-emerald-300 font-medium">{currentProposal.expectedImpact}</span>
              </div>
            </div>
          </div>

          {/* Parameter Comparison Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Föreslagna Parameterjusteringar
              </h4>
              <span className="text-xs text-slate-400">
                Jämför nuvarande inställning mot AI-förslaget
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              {currentProposal.changes.map((c, i) => (
                <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/30 transition">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-200 text-xs">{c.label}</span>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xl">{c.reason}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-center min-w-[70px]">
                      <span className="text-[10px] text-slate-500 block">Nuvarande</span>
                      <span className="font-bold">{c.current}</span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-purple-400" />

                    <div className="px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-700 text-purple-200 text-center min-w-[70px]">
                      <span className="text-[10px] text-purple-400 block">AI Förslag</span>
                      <span className="font-bold text-purple-300">{c.proposed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Apply Button Footer */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                {appliedStatus ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {appliedStatus}
                  </span>
                ) : (
                  <span>Granska värdena och tryck applicera för att uppdatera boten direkt.</span>
                )}
              </div>

              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{applying ? 'Applicerar och synkar till GitHub...' : `Applicera förslag på ${selectedBotSlug === 'anna' ? 'Anna' : 'Lena'}`}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
          <Brain className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">
            Ingen AI-analys genererad än för {selectedBot.name}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tryck på knappen ovan för att låta Gemini analysera aktuellt orderboksflöde, vinsthistorik och föreslå finjusterade parametrar.
          </p>
        </div>
      )}
    </div>
  );
};
