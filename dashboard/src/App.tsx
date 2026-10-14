import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OverviewStats } from './components/OverviewStats';
import { BotCardsSection } from './components/BotCardsSection';
import { TradesHistoryTable } from './components/TradesHistoryTable';
import { ActivePositionsTable } from './components/ActivePositionsTable';
import { OrderBookScanner } from './components/OrderBookScanner';
import { SettingsModal } from './components/SettingsModal';
import { GitHubModal } from './components/GitHubModal';
import { BotCycleModal } from './components/BotCycleModal';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { OKXConnectModal } from './components/OKXConnectModal';
import { TradingStore } from './services/tradingStore';
import { Trade, Position, BotConfig, MarketFlow } from './types';
import {
  Layers,
  History,
  Activity,
  Flame,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  ShieldCheck,
  Wrench,
  Sparkles,
  Terminal,
  Cpu
} from 'lucide-react';
import { GrokHandoverPanel } from './components/GrokHandoverPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'POSITIONS' | 'SCANNER' | 'DIAGNOSTICS' | 'GROK_BRIDGE'>('OVERVIEW');

  // Core Trading State
  const [bots, setBots] = useState<BotConfig[]>(() => TradingStore.getBots());
  const [trades, setTrades] = useState<Trade[]>(() => TradingStore.getTrades());
  const [positions, setPositions] = useState<Position[]>(() => TradingStore.getPositions());
  const [flows, setFlows] = useState<MarketFlow[]>(() => TradingStore.getFlows());
  const [killSwitchActive, setKillSwitchActive] = useState(false);

  // Modals & Triggers
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isOKXModalOpen, setIsOKXModalOpen] = useState(false);
  const [okxBalanceData, setOkxBalanceData] = useState<any>(() => {
    try {
      localStorage.removeItem('tb_okx_balance_cache_v1');
      localStorage.removeItem('tb_okx_keys_v1'); // rensa ev. tidigare sparade nycklar
      return null;
    } catch {
      return null;
    }
  });
  const [settingsBot, setSettingsBot] = useState<BotConfig | null>(null);
  const [cycleModalSlug, setCycleModalSlug] = useState<'anna' | 'lena' | null>(null);
  const [isTriggeringWorkflow, setIsTriggeringWorkflow] = useState(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auto-load live balances from OKX on mount (supports both Vite API & GitHub Pages static)
  useEffect(() => {
    const fetchLiveOKX = async () => {
      try {
        let data: any = null;
        try {
          const res = await fetch('/api/bots/live-status');
          if (res.ok) {
            data = await res.json();
          }
        } catch {
          // Dev proxy unavailable, likely static deployment
        }

        // Ingen statisk status.json: den publicerade sidan visar inga saldon/positioner/order (okänt).

        if (data && data.success && typeof data.combinedEquityUSD === 'number') {
          setOkxBalanceData({
            connected: true,
            isDemo: false,
            totalEquityUSD: data.combinedEquityUSD,
            anna: data.anna,
            lena: data.lena,
            source: data.source || 'LIVE'
          });

          // Merge real OKX orders from Anna and Lena
          const allOkxOrders = [...(data.anna?.orders || []), ...(data.lena?.orders || [])];
          if (allOkxOrders.length > 0) {
            setTrades(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const newOrders = allOkxOrders.filter((o: any) => !existingIds.has(o.id));
              return [...newOrders, ...prev];
            });
          }

          // Build live positions directly from real OKX account holdings
          const livePositions: Position[] = [];

          // Positioner härleds inte längre från saldon med hårdkodade entry-priser/allokeringar (påhittad PnL).
          // Visas först när en verifierad positionskälla (OKX /account/positions via botarnas egen state) finns.
          setPositions(livePositions);
        }
      } catch (err) {
        console.error('Failed to load OKX live status:', err);
      }
    };

    const fetchLiveFlows = async () => {
      try {
        const res = await fetch('/api/market/flows');
        const data = await res.json();
        if (data.success && Array.isArray(data.flows) && data.flows.length > 0) {
          setFlows(data.flows);
          TradingStore.saveFlows(data.flows);
        }
      } catch (err) {
        console.error('Failed to fetch live 30 market flows:', err);
      }
    };

    fetchLiveOKX();
    fetchLiveFlows();
  }, []);

  const [isRefreshingFlows, setIsRefreshingFlows] = useState(false);
  const handleRefreshFlows = async () => {
    setIsRefreshingFlows(true);
    try {
      const res = await fetch('/api/market/flows');
      const data = await res.json();
      if (data.success && Array.isArray(data.flows) && data.flows.length > 0) {
        setFlows(data.flows);
        TradingStore.saveFlows(data.flows);
        showToast(`Orderböcker uppdaterade: ${data.flows.length} par live från OKX.`);
      }
    } catch (err: any) {
      showToast(`Kunde inte hämta marknadsflöden: ${err.message}`);
    } finally {
      setIsRefreshingFlows(false);
    }
  };

  // 1. Close a single position
  const handleClosePosition = (positionId: string) => {
    try {
      const { closedTrade, updatedPositions, updatedTrades } = TradingStore.closePosition(positionId);
      setPositions(updatedPositions);
      setTrades(updatedTrades);
      showToast(`Position stängd! Realiserad PnL: ${closedTrade.realized_pnl >= 0 ? '+' : ''}$${closedTrade.realized_pnl} sparad i historiken.`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // 2. Panic Close All
  const handlePanicCloseAll = () => {
    const { closedCount, updatedTrades } = TradingStore.panicCloseAll();
    setPositions([]);
    setTrades(updatedTrades);
    showToast(`Nödstängning utförd: ${closedCount} positioner stängdes och registrerades i orderhistoriken.`);
  };

  // 3. Toggle Kill Switch
  const handleToggleKillSwitch = () => {
    setKillSwitchActive(prev => {
      const nextState = !prev;
      setBots(currentBots => {
        const updated = currentBots.map(b => ({ ...b, kill_switch: nextState }));
        TradingStore.saveBots(updated);
        return updated;
      });
      showToast(nextState ? '⚠️ Kill-Switch AKTIVERAD! Nya ordrar blockeras.' : '✅ Kill-Switch avaktiverad.');
      return nextState;
    });
  };

  // 4. Save Bot Strategy Settings
  const handleSaveSettings = (updatedBot: BotConfig) => {
    setBots(prev => {
      const updated = prev.map(b => b.slug === updatedBot.slug ? updatedBot : b);
      TradingStore.saveBots(updated);
      return updated;
    });
    showToast(`Parametrar för ${updatedBot.name} sparade.`);
  };

  // Trigger av GitHub-workflows borttagen: dashboarden är read-only.

  // 6. Simulate scalping a pair in scanner
  const handleSimulateScalp = (symbol: string) => {
    const flow = flows.find(f => f.symbol === symbol);
    const lastPrice = flow ? flow.last_price : 156.40;
    const newPos: Position = {
      id: `POS-LENA-${Date.now().toString().slice(-4)}`,
      bot: 'Aggressiva Lena',
      symbol,
      side: 'BUY',
      entry_price: lastPrice,
      current_price: lastPrice * 1.012,
      high_price: lastPrice * 1.015,
      size_units: symbol.includes('SUI') ? 1400 : 20,
      allocated_usd: 2800,
      unrealized_pnl: 33.6,
      pnl_pct: 1.2,
      trailing_stop_dist_pct: 0.3,
      opened_at: new Date().toISOString()
    };
    const nextPositions = [newPos, ...positions];
    setPositions(nextPositions);
    TradingStore.savePositions(nextPositions);
    showToast(`Ny position skapad för ${symbol} på Aggressiva Lena!`);
    setActiveTab('POSITIONS');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Bot', 'Symbol', 'Side', 'Entry Price', 'Exit Price', 'Units', 'Notional USD', 'Realized PnL', 'PnL %', 'Exit Reason', 'Time', 'Status'];
    const rows = trades.map(t => [
      t.id,
      t.bot,
      t.symbol,
      t.side,
      t.entry_price,
      t.exit_price,
      t.size_units,
      t.notional_usd,
      t.realized_pnl,
      t.pnl_pct,
      t.exit_reason,
      t.exit_time,
      t.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tradebot_closed_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Orderhistorik exporterad som CSV!');
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trades, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tradebot_closed_orders_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Orderhistorik exporterad som JSON!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom duration-200">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        killSwitchActive={killSwitchActive}
        onToggleKillSwitch={handleToggleKillSwitch}
        onPanicCloseAll={handlePanicCloseAll}
        onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        onOpenOKXModal={() => setIsOKXModalOpen(true)}
        onOpenGrokBridge={() => setActiveTab('GROK_BRIDGE')}
        okxBalanceData={okxBalanceData}
        openPositionsCount={positions.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Översikt & Bottar</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'HISTORY'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span>Stängda ordrar & Historik</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
              {trades.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('POSITIONS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'POSITIONS'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Öppna positioner</span>
            {positions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-800/60 font-mono">
                {positions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'SCANNER'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Orderboksanalys (Lena OBI)</span>
          </button>

          <button
            onClick={() => setActiveTab('DIAGNOSTICS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'DIAGNOSTICS'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span>Hälsokontroll & Självläkning</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>


          <button
            onClick={() => setActiveTab('GROK_BRIDGE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'GROK_BRIDGE'
                ? 'bg-indigo-900/70 text-indigo-200 border border-indigo-600 shadow-sm'
                : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-900/50'
            }`}
          >
            <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Grok Command Bridge</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
              BEFÄL
            </span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Stat Bar */}
            <OverviewStats
              trades={trades}
              positions={positions}
              totalEquityUSD={okxBalanceData?.totalEquityUSD}
              annaEquityUSD={okxBalanceData?.anna?.totalEquityUSD}
              lenaEquityUSD={okxBalanceData?.lena?.totalEquityUSD}
            />

            {/* Side-by-side bot cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  Aktiva Trading-motorer
                </h2>
                <span className="text-xs text-slate-500">
                  Kopplade till OKX & GitHub (therog1)
                </span>
              </div>
              <BotCardsSection
                bots={bots}
                onRunBotCycle={slug => setCycleModalSlug(slug)}
                onOpenSettings={bot => setSettingsBot(bot)}
                isTriggeringWorkflow={isTriggeringWorkflow}
              />
            </div>

            {/* Active Positions Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  Aktuella positioner ({positions.length})
                </h2>
                {positions.length > 0 && (
                  <button
                    onClick={() => setActiveTab('POSITIONS')}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Hantera alla positioner &rarr;
                  </button>
                )}
              </div>
              <ActivePositionsTable
                positions={positions}
                onClosePosition={handleClosePosition}
              />
            </div>

            {/* Order Book Flow Scanner Preview */}
            <OrderBookScanner
              flows={flows}
              onSimulateScalp={handleSimulateScalp}
              onRefreshFlows={handleRefreshFlows}
              isRefreshing={isRefreshingFlows}
            />
          </div>
        )}

        {/* TAB 2: CLOSED ORDERS & TRADE HISTORY */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <TradesHistoryTable
              trades={trades}
              onExportCSV={handleExportCSV}
              onExportJSON={handleExportJSON}
            />
          </div>
        )}

        {/* TAB 3: ACTIVE POSITIONS */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">Öppna positioner</h3>
                <p className="text-xs text-slate-400">
                  Stäng enstaka positioner manuellt eller övervaka flytande vinst/förlust.
                </p>
              </div>
            </div>
            <ActivePositionsTable
              positions={positions}
              onClosePosition={handleClosePosition}
            />
          </div>
        )}

        {/* TAB 4: SCANNER */}
        {activeTab === 'SCANNER' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <OrderBookScanner
              flows={flows}
              onSimulateScalp={handleSimulateScalp}
              onRefreshFlows={handleRefreshFlows}
              isRefreshing={isRefreshingFlows}
            />
          </div>
        )}

        {/* TAB 5: DIAGNOSTICS & SELF-HEALING */}
        {activeTab === 'DIAGNOSTICS' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <DiagnosticPanel />
          </div>
        )}

        {/* TAB 7: GROK COMMAND BRIDGE (HANDOVER & LEADERSHIP) */}
        {activeTab === 'GROK_BRIDGE' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <GrokHandoverPanel
              onCopySuccess={msg => showToast(msg)}
              combinedEquityUSD={okxBalanceData?.totalEquityUSD}
              annaEquityUSD={okxBalanceData?.anna?.totalEquityUSD}
              lenaEquityUSD={okxBalanceData?.lena?.totalEquityUSD}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-600">
        Tradebot Command Center • Anna (Swing) & Aggressiva Lena (Scalper) • Google AI Studio • GitHub therog1
      </footer>

      {/* Modals */}
      <SettingsModal
        bot={settingsBot}
        isOpen={Boolean(settingsBot)}
        onClose={() => setSettingsBot(null)}
        onSave={handleSaveSettings}
      />

      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        isTriggering={isTriggeringWorkflow}
      />

      <OKXConnectModal
        isOpen={isOKXModalOpen}
        onClose={() => setIsOKXModalOpen(false)}
        onBalanceUpdated={data => {
          setOkxBalanceData(data);
          if (data) {
            showToast('Saldo uppdaterat (read-only).');
          }
        }}
      />

      <BotCycleModal
        botSlug={cycleModalSlug}
        isOpen={Boolean(cycleModalSlug)}
        onClose={() => setCycleModalSlug(null)}
        bot={bots.find(b => b.slug === cycleModalSlug)}
        onPositionCreated={pos => {
          setPositions(p => [pos, ...p]);
          TradingStore.savePositions([pos, ...positions]);
        }}
      />
    </div>
  );
}
