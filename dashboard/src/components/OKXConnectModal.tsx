import React from 'react';

interface OKXConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated?: (data: any) => void;
}

/**
 * Nyckelinmatning borttagen. Dashboarden tar aldrig emot, lagrar eller skickar OKX-nycklar.
 * Ägarskap: Lena = OKX_AGGR_* (Lena-repot), Anna = OKX_ANNA_* (Annas motor). Dashboarden läser bara.
 */
export const OKXConnectModal: React.FC<OKXConnectModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-3 text-sm text-slate-300" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-slate-100">OKX-anslutning (read-only)</h2>
        <p>Nycklar matas aldrig in i dashboarden och sparas aldrig i webbläsaren.</p>
        <p>Lena använder <code>OKX_AGGR_*</code> och Anna <code>OKX_ANNA_*</code> som GitHub-secrets i respektive motor. Dashboarden visar bara status, och saldon visas som <b>okänt</b> tills de är verifierade.</p>
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">Stäng</button>
      </div>
    </div>
  );
};
