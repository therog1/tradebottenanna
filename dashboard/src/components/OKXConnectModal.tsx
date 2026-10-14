import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, X, CheckCircle2, RefreshCw, Wallet, DollarSign, Eye, EyeOff } from 'lucide-react';

interface OKXConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated: (balanceData: any) => void;
}

export const OKXConnectModal: React.FC<OKXConnectModalProps> = ({
  isOpen,
  onClose,
  onBalanceUpdated,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const isDemo = false; // Always live, no demo
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('tb_okx_keys_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          setApiKey(parsed.apiKey || '');
          setSecretKey(parsed.secretKey || '');
          setPassphrase(parsed.passphrase || '');
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch('/api/okx/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
          passphrase: passphrase.trim(),
          isDemo,
        }),
      });

      const data = await res.json();
      if (data.connected) {
        setResult(data);
        localStorage.setItem(
          'tb_okx_keys_v1',
          JSON.stringify({
            apiKey: apiKey.trim(),
            secretKey: secretKey.trim(),
            passphrase: passphrase.trim(),
            isDemo,
          })
        );
        onBalanceUpdated(data);
      } else {
        setErrorMessage(data.error || 'Kunde inte ansluta till OKX med angivna uppgifter.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Nätverksfel vid kontakt med OKX');
    } finally {
      setLoading(false);
    }
  };

  const handleClearKeys = () => {
    localStorage.removeItem('tb_okx_keys_v1');
    setApiKey('');
    setSecretKey('');
    setPassphrase('');
    setResult(null);
    onBalanceUpdated(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-base">
              Koppla OKX API & Live-saldo
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleTestAndConnect} className="mt-4 space-y-4 text-xs">
          {/* 100% Skarpt Läge */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
            <div>
              <span className="font-semibold text-emerald-300 block">100% Skarpt Läge (Live)</span>
              <span className="text-slate-300 text-[11px]">
                Kopplad till OKX EEA Live Gateway. Inga demolägen används.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 text-white shadow-sm">
              SKARPT
            </span>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              OKX API Key
            </label>
            <input
              type="text"
              placeholder="f.ex. 84b23a91-...."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">
                OKX Secret Key
              </label>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1"
              >
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showSecret ? 'Dölj' : 'Visa'}</span>
              </button>
            </div>
            <input
              type={showSecret ? 'text' : 'password'}
              placeholder="Secret Key"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Passphrase (Lösenfras för API)
            </label>
            <input
              type="password"
              placeholder="Din hemliga lösenfras för API-nyckeln"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Ansluten till OKX ({result.isDemo ? 'DEMO' : 'SKARPT KONTO'})
                </span>
                <span className="font-mono font-bold text-sm text-emerald-300">
                  ${result.totalEquityUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </span>
              </div>
              {result.details && result.details.length > 0 && (
                <div className="pt-2 border-t border-emerald-900/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-emerald-200/90">
                  {result.details.map((d: any) => (
                    <div key={d.ccy} className="flex justify-between bg-emerald-950/60 px-2 py-1 rounded">
                      <span>{d.ccy}:</span>
                      <span className="font-bold">{d.availBal}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {apiKey && (
              <button
                type="button"
                onClick={handleClearKeys}
                className="text-xs text-rose-400 hover:text-rose-300 underline"
              >
                Rensa sparade nycklar
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Stäng
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Verifierar...' : 'Anslut & Hämta saldo'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
