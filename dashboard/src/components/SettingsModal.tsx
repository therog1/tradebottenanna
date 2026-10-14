import React, { useState } from 'react';
import { BotConfig } from '../types';
import { X, Save, Sliders, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  bot: BotConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedBot: BotConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  bot,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !bot) return null;

  const [riskPct, setRiskPct] = useState(bot.risk_per_trade_pct);
  const [stopLossPct, setStopLossPct] = useState(bot.stop_loss_pct);
  const [takeProfitPct, setTakeProfitPct] = useState(bot.take_profit_pct);
  const [trailingStopPct, setTrailingStopPct] = useState(bot.trailing_stop_pct);
  const [minEquity, setMinEquity] = useState(bot.min_equity_threshold);
  const [maxOpenPositions, setMaxOpenPositions] = useState(bot.max_open_positions || 3);
  const [minLeverage, setMinLeverage] = useState(bot.min_leverage || 3);
  const [maxLeverage, setMaxLeverage] = useState(bot.max_leverage || 10);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...bot,
      risk_per_trade_pct: Number(riskPct),
      stop_loss_pct: Number(stopLossPct),
      take_profit_pct: Number(takeProfitPct),
      trailing_stop_pct: Number(trailingStopPct),
      min_equity_threshold: Number(minEquity),
      max_open_positions: Math.max(1, Math.min(10, Number(maxOpenPositions) || 1)),
      min_leverage: Math.max(1, Math.min(Number(maxLeverage), Number(minLeverage) || 3)),
      max_leverage: Math.max(Number(minLeverage), Math.min(20, Number(maxLeverage) || 10)),
      current_leverage: Math.min(Number(maxLeverage), Math.max(Number(minLeverage), bot.current_leverage || 5)),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-base">
              Strategiparametrar — {bot.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Risk allokerad per trade (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={riskPct}
              onChange={e => setRiskPct(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {bot.slug === 'lena' ? 'Aggressiv skalp är standard på 35% av subkonto-equity.' : 'Konservativ swing är normalt 1.0 - 2.5%.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Stop Loss (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={stopLossPct}
                onChange={e => setStopLossPct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Take Profit (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={takeProfitPct}
                onChange={e => setTakeProfitPct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Trailing Stop Lock (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={trailingStopPct}
                onChange={e => setTrailingStopPct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Kill-Switch Min. Equity ($)
              </label>
              <input
                type="number"
                step="1"
                value={minEquity}
                onChange={e => setMinEquity(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Max samtidiga öppna positioner
            </label>
            <input
              type="number"
              min="1"
              max="10"
              step="1"
              value={maxOpenPositions}
              onChange={e => setMaxOpenPositions(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Begränsar hur många innehav botten tillåts ha öppna parallellt (standard 2–4 st) för att inte splittra likviditeten för mycket.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                Hävstångsintervall (Leverage)
              </label>
              <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                {minLeverage}x – {maxLeverage}x
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Min Hävstång (x)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={minLeverage}
                  onChange={e => setMinLeverage(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Max Hävstång (x)
                </label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  step="1"
                  value={maxLeverage}
                  onChange={e => setMaxLeverage(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Dynamisk hävstång: Skalar automatiskt mellan {minLeverage}x (vid OBI +50%) och {maxLeverage}x (vid extrem köpar-absorption &gt;+85%).
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span>Sparat!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Spara ändringar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
