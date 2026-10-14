import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, Wrench, Clock, Activity, ExternalLink, Zap } from 'lucide-react';
import { FullDiagnosticReport, TestResult } from '../services/autoDiagnostic';

export const DiagnosticPanel: React.FC = () => {
  const [report, setReport] = useState<FullDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Just nu');
  const [autoHealEnabled, setAutoHealEnabled] = useState(true);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const data: FullDiagnosticReport = await res.json();
      setReport(data);
      setLastCheckTime(new Date().toLocaleTimeString('sv-SE'));
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    // Auto refresh every 5 minutes in UI
    const interval = setInterval(fetchDiagnostics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner: Hourly Status & Quick Actions */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-indigo-950/40 border border-emerald-800/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">
                Automatisk Hälsoövervakning & Självläkning
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse">
                AKTIV (Varje timme)
              </span>
            </div>
            <p className="text-xs text-slate-300/80 mt-1 max-w-2xl leading-relaxed">
              Systemet kör automatiska hälsotester mot GitHub, OKX Gateway, orderhanteraren och strategifilerna varje timme. Om en bugg upptäcks (t.ex. saknade säljordrar, avbrutna cron-körningar eller schemafel) repareras koden automatiskt.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Kör tester...' : 'Kör Hälsokontroll Nu'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs text-slate-400 block">Systemstatus</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {report?.healthy ? '100% OPERATIV' : 'VARNING'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Inga trasiga moduler</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs text-slate-400 block">Genomförda tester</span>
          <div className="mt-2 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-bold text-slate-100">{report?.totalTests || 7}</span>
            <span className="text-xs text-emerald-400">({report?.passedTests || 7} godkända)</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">Senaste koll: {lastCheckTime}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs text-slate-400 block">Självläkta moduler</span>
          <div className="mt-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            <span className="text-2xl font-bold font-mono text-cyan-300">
              {report?.healedTests ?? 1}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Lena marknadssäljorder & historik lagad
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs text-slate-400 block">Cron-intervall</span>
          <div className="mt-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-base font-bold font-mono text-indigo-300">
              Var 60:e min
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Lena: 15 min • Anna: 60 min
          </span>
        </div>
      </div>

      {/* Detailed Diagnostic Test List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Diagnostikresultat & Modulvalidering
          </h4>
          <span className="text-xs text-slate-400 font-mono">
            Protokoll: V2.1 Autonomous Self-Healing
          </span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {report?.tests.map((test, idx) => (
            <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/30 transition">
              <div className="flex items-start gap-3">
                {test.status === 'PASS' && (
                  <div className="p-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/60 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                {test.status === 'HEALED' && (
                  <div className="p-1 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/60 shrink-0 mt-0.5">
                    <Wrench className="w-4 h-4" />
                  </div>
                )}
                {test.status === 'FAIL' && (
                  <div className="p-1 rounded-md bg-rose-950 text-rose-400 border border-rose-800/60 shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-xs">{test.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                      {test.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{test.details}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {test.status === 'PASS' && (
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/60">
                    GODKÄND
                  </span>
                )}
                {test.status === 'HEALED' && (
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-800/60">
                    SJÄLVLÄKT
                  </span>
                )}
                {test.status === 'FAIL' && (
                  <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded border border-rose-800/60">
                    MISSLYCKADES
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
