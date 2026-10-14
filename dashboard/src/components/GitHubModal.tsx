import React, { useState, useEffect } from 'react';
import { Github, CheckCircle2, RefreshCw, ExternalLink, GitCommit, Play, X, ShieldCheck } from 'lucide-react';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerWorkflow: () => Promise<void>;
  isTriggering: boolean;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  onClose,
  onTriggerWorkflow,
  isTriggering,
}) => {
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/github/status');
      const data = await res.json();
      setGitStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-slate-100" />
            <h3 className="font-bold text-slate-100 text-base">
              GitHub Repositories (therog1)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Uppdatera status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Status notice */}
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              Kopplad till GitHub API via Personlig åtkomsttoken. Båda repona är synkade.
            </span>
          </div>

          {/* Repo 1: Lena */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  therog1/tradebottenaggresivalena
                </span>
              </div>
              <a
                href="https://github.com/therog1/tradebottenaggresivalena"
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
              >
                <span>Visa</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-400 text-[11px]">
              Aggressive high-frequency trading bot för OKX (Subaccount: Lena) • Ken Griffin momentum & orderbook flow scalper.
            </p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">
                Senaste commits inkluderar fixar för: marknadssäljorder, trades_history.json & OKX historikanrop.
              </span>
              <button
                onClick={onTriggerWorkflow}
                disabled={isTriggering}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition disabled:opacity-50 shrink-0"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isTriggering ? 'Startar...' : 'Kör Actions'}</span>
              </button>
            </div>
          </div>

          {/* Repo 2: Anna */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-blue-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  therog1/tradebottenanna
                </span>
              </div>
              <a
                href="https://github.com/therog1/tradebottenanna"
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
              >
                <span>Visa</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-400 text-[11px]">
              Fullstack trading bot med Express API, Vite dashboard, strategy.json och riskhanterare.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
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
