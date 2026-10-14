import React, { useState } from 'react';
import { fmtUsd } from '../utils/format';
import {
  Terminal,
  Cpu,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Activity,
  Layers,
  Key,
  Github,
  Zap,
  ArrowRight,
  BookOpen,
  Scale,
  Sparkles,
  Download,
  FolderArchive,
  Lock,
  Globe,
  FileCode
} from 'lucide-react';

interface GrokHandoverPanelProps {
  onCopySuccess?: (msg: string) => void;
  combinedEquityUSD?: number;
  annaEquityUSD?: number;
  lenaEquityUSD?: number;
}

export const GROK_MASTER_PROMPT = `Du är nu utsedd till Lead Quantitative Systems Architect, Exchange-Integration Specialist och Operativ Chef (Command Officer) för "Tradebot Command Center" (tradebottenanna & tradebottenaggresivalena).

DITT UPPDRAG:
Ta över det fulla tekniska, kvantitativa och strategiska ansvaret för systemet. Du ska leda utvecklingen, granska koden, hantera OKX-kopplingen, styra riskparametrarna och maximera riskjusterad avkastning (Sharpe/Sortino) utan att äventyra portföljens överlevnad.

=========================================
1. SYSTEMARKITEKTUR & REPOSITORIER
=========================================
Systemet består av tre sammanlänkade komponenter:
1. Command Center Dashboard (tradebottenanna):
   - Tech: React 19, TypeScript, Vite, Tailwind CSS.
   - API-proxy: vite.config.ts med endpoints:
     * GET /api/bots/live-status (läser realtidssaldo & orderhistorik från båda OKX-underkontona)
     * GET /api/github/status (synkroniseringsstatus för båda GitHub-repon)
     * POST /api/github/trigger-workflow (triggar GitHub Actions för Lena scalp)
     * GET /api/market/flows (topp 30 likvida par med realtids Order Book Imbalance från OKX)
     * (AI-optimering borttagen – inga AI/LLM-anrop; parameterändringar endast via PR)
     * GET /api/diagnostics (automatisk hälsokontroll)
2. Tradebotten Anna (GitHub: therog1/tradebottenanna):
   - Profil: Konservativ kvantitativ swing- och trendföljare (1h-tidsram, SMA/EMA, ATR-mål).
   - Instrument: Krypto Perpetual Swaps / Cross Margin (3x hävstång) på OKX.
   - Schema: Körs varje hel timme via GitHub Actions cron.
3. Aggressiva Lena (GitHub: therog1/tradebottenaggresivalena):
   - Profil: Högfrekvent Ken Griffin-inspirerad Order Book Imbalance (OBI) Scalper.
   - Instrument: OKX USD-M X-Perpetuals (BTC, ETH, SOL, SUI, DOGE, PEPE m.fl.) med USDC som säkerhet och 3x–5x dynamisk hävstång.
   - Schema: Körs var 15:e minut samt vid manuell dispatch via GitHub Actions.

=========================================
2. OKX-KONTRAKT & REGULATORISKA FÖRUTSÄTTNINGAR (EEA / MiCA)
=========================================
- API Gateway: https://eea.okx.com (EU/EEA-godkänd nod).
- Två separata underkonton på OKX:
  * Anna: $OKX_ANNA_KEY, $OKX_ANNA_SECRET, $OKX_ANNA_PASS. Eget kapital: okänt.
  * Lena: $OKX_AGGR_KEY, $OKX_AGGR_SECRET, $OKX_AGGR_PASS. Eget kapital: okänt.
- Viktig EEA-restriktion: Inom EU/EEA tillåter OKX inte direkt handel eller belåning mot USDT utan regulatorisk godkännandeprocess. Lösningen som är driftsatt är USD-Margined X-Perpetuals (USD_UM_XPERP) där USDC hålls som ren säkerhetsmarginal (collateral) och vinst/förlust avräknas i USDC.

=========================================
3. FINANSIELL REDOVISNING & RECONCILIATION
=========================================
Som ansvarig chef måste du upprätthålla strikt finansiell integritet:
1. Skilj alltid mellan:
   - Totalt bekräftat börskapital (Total Equity) från /api/v5/account/balance.
   - Fritt tillgänglig marginal (Available Margin).
   - Realiserad PnL (från faktiskt stängda fills på börsen).
   - Orealiserad PnL (marknadsvärde minus anskaffningsvärde på aktiva positioner).
   - Börsavgifter (maker/taker fees) och funding payments.
2. Kombinera ALDRIG hypotetiska siffror med börsbekräftade saldon.
3. Om intern tracking skiljer sig från OKX faktiska positioner: Spärra nya riskökande ordrar tills reconciliation är genomförd.

=========================================
4. LENAS RISK- OCH ORDERBOKSKONTROLLER
=========================================
1. Risk per trade (1 %, tak 3 % totalt – godkänt av Roger, införs via säkerhets-PR #1):
   - Storlek räknas från SL-avståndet; 35 % är endast tak för marginal per trade, INTE 35% total risk till noll.
   - Maximalt 3 öppna positioner parallellt (hindrar överexponering).
2. Hävstång:
   - 3x till 5x dynamisk hävstång beroende på orderbokens obalans (OBI-styrka).
   - Vid OBI > 0.60: 5x hävstång. Vid OBI 0.45–0.59: 3x–4x.
3. Skyddsordrar:
   - Hård Stop-Loss på -1.8%.
   - Trailing Stop på 0.9% distans från högsta uppnådda kurs.
   - Take Profit på +4.0%.
   - Stop-loss ska läggas som exchange-native villkorsorder (algo/conditional) direkt vid fill för att skydda mot slippage och nätverksavbrott.
4. Orderboksanalys:
   - OBI beräknas som: (Bid_Vol - Ask_Vol) / (Bid_Vol + Ask_Vol) på topp 10–20 nivåer.
   - Förkasta osorterade, inkompletta eller fördröjda orderböcker (>2 sekunder gamla).

=========================================
5. ARBETSFÖRVARING & DAGLIGA DIREKTIV
=========================================
När användaren ställer frågor, ber om analyser eller vill modifiera systemet ska du agera med auktoritet:
1. Analysera alltid de faktiska filerna och API-anropen innan du ger svar.
2. Föreslå konkreta, testbara parameterjusteringar med förväntad Sharpe-effekt och drawdown-risk.
3. Vid incidenter eller marknadsstorm: stäng av workflowet i GitHub Actions och bekräfta börsens faktiska läge.
4. Behåll befintlig svensk terminologi i Command Center (Hävstång, Orderboksobalans, Skarpt Saldo).

Bekräfta att du har tagit emot denna instruktion, sammanfatta systemets status och ange dina första tre prioriterade åtgärder som chef över Tradebot Command Center.`;

export const GrokHandoverPanel: React.FC<GrokHandoverPanelProps> = ({
  onCopySuccess,
  combinedEquityUSD,
  annaEquityUSD,
  lenaEquityUSD
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedGitCmds, setCopiedGitCmds] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'PROMPT' | 'ARCHITECTURE' | 'CHECKLIST' | 'EXPORT_KODAREN'>('PROMPT');

  const handleCopy = () => {
    navigator.clipboard.writeText(GROK_MASTER_PROMPT);
    setCopied(true);
    if (onCopySuccess) {
      onCopySuccess('Master-instruktionen har kopierats till urklipp! Klistra in den direkt i Grok.');
    }
    setTimeout(() => setCopied(false), 3000);
  };

  const GIT_SETUP_COMMANDS = `# 1. Packa upp projektet
mkdir -p tradebottenanna && cd tradebottenanna
unzip ../tradebottenanna-v2.3-export.zip

# 2. Initiera Git & pusha till GitHub
git init
git add .
git commit -m "feat: Tradebot Command Center v2.3 with zero-key GitHub Actions engine"
git branch -M main
git remote add origin https://github.com/therog1/tradebottenanna.git
# Ingen force-push. Import sker via branch + draft-PR (import/dashboard-v2.3).

# 3. Aktivera GitHub Pages
# Gå till GitHub Repo -> Settings -> Pages -> Source: 'GitHub Actions'`;

  const handleCopyGitCmds = () => {
    navigator.clipboard.writeText(GIT_SETUP_COMMANDS);
    setCopiedGitCmds(true);
    if (onCopySuccess) {
      onCopySuccess('Git-kommandona har kopierats till urklipp för Kodaren!');
    }
    setTimeout(() => setCopiedGitCmds(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-purple-950/40 border border-indigo-700/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Terminal className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                GROK OPERATIONAL DIRECTIVE v1.0
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                REDO FÖR ÖVERLÄMNING
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Cpu className="w-7 h-7 text-indigo-400" />
              Grok Command Bridge — Överlämning av Befälet
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Här finns den kompletta, certifierade master-instruktionen för att ge Grok fullt operativt och kvantitativt ansvar över Tradebot Command Center, underkontona på OKX (Anna & Lena) och GitHub Actions-automatiseringen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-500/25 transition transform active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Kopierat till urklipp!' : 'Kopiera Master Prompt till Grok'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('PROMPT')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeSubTab === 'PROMPT'
              ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📜 Master Prompt (Färdig att klistra in)
        </button>
        <button
          onClick={() => setActiveSubTab('EXPORT_KODAREN')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeSubTab === 'EXPORT_KODAREN'
              ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
          <span>📦 Källkodsexport (.ZIP) & Kodarens Guide</span>
        </button>
        <button
          onClick={() => setActiveSubTab('ARCHITECTURE')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeSubTab === 'ARCHITECTURE'
              ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🗺️ Systemarkitektur & Variabler
        </button>
        <button
          onClick={() => setActiveSubTab('CHECKLIST')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            activeSubTab === 'CHECKLIST'
              ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ✅ Groks Operativa Checklista
        </button>
      </div>

      {/* TAB 1: MASTER PROMPT TEXT BOX */}
      {activeSubTab === 'PROMPT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Klicka på knappen nedan eller markera texten för att skicka till Grok:</span>
            <span className="font-mono text-indigo-400">{GROK_MASTER_PROMPT.length} tecken • Fullständig systembriefing</span>
          </div>

          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto shadow-inner">
            <div className="absolute top-4 right-4">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopierat' : 'Kopiera'}</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs md:text-sm text-slate-200">
              {GROK_MASTER_PROMPT}
            </pre>
          </div>
        </div>
      )}

      {/* TAB: EXPORT TILL KODAREN & GITHUB SETUP */}
      {activeSubTab === 'EXPORT_KODAREN' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Security Guarantee Box */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-slate-100">Säkerhetsgaranti: "Noll nycklar i webbläsaren"</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Globe className="w-4 h-4" />
                  <span>1. Dashboarden (GitHub Pages)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Dashboarden kompileras till ren statisk HTML/CSS/JS. Den innehåller <strong className="text-slate-200">inga OKX-nycklar, passphrases eller privata tokens</strong>. Dashboarden fungerar som en ren telemetri-skärm som hämtar verifierad portföljstatus från <code className="text-indigo-300 font-mono">./data/status.json</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <Github className="w-4 h-4" />
                  <span>2. Handelsmotorn (GitHub Actions)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  All skarp handel, OBI-analys och signering sker i isolerade GitHub Actions runners. Alla nycklar hämtas från krypterade <strong className="text-slate-200">GitHub Repository Secrets</strong>. Efter varje cykel uppdateras status-filen automatiskt.
                </p>
              </div>
            </div>
          </div>

          {/* Kodarens Terminal Guide */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                <h4 className="font-bold text-slate-100">Kodarens 3-stegsguide: Från ZIP till GitHub Pages</h4>
              </div>
              <button
                onClick={handleCopyGitCmds}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                {copiedGitCmds ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedGitCmds ? 'Kopierat!' : 'Kopiera Git-kommandon'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
              <pre className="whitespace-pre-wrap">{GIT_SETUP_COMMANDS}</pre>
            </div>

            {/* Secrets Table */}
            <div className="pt-2 space-y-2">
              <h5 className="text-xs font-bold text-slate-300">Konfigurera följande i GitHub Repository Secrets:</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">OKX_AGGR_KEY</span>
                  <span className="text-[10px] text-amber-400">Lena Subkonto API Key</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">OKX_AGGR_SECRET</span>
                  <span className="text-[10px] text-amber-400">Lena Subkonto Secret</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">OKX_AGGR_PASS</span>
                  <span className="text-[10px] text-amber-400">Lena Subkonto Passphrase</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">OKX_ANNA_KEY</span>
                  <span className="text-[10px] text-cyan-400">Anna Subkonto API Key</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">OKX_ANNA_SECRET</span>
                  <span className="text-[10px] text-cyan-400">Anna Subkonto Secret</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-bold">OKX_ANNA_PASS</span>
                  <span className="text-[10px] text-cyan-400">Anna Subkonto Passphrase</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ARCHITECTURE & ENV MAP */}
      {activeSubTab === 'ARCHITECTURE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Anna card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
                <h4 className="font-bold text-slate-100">Tradebotten Anna</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                SWING / TREND
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Handlar huvudsakligen beprövade krypto-swappar (BTC, ETH, SOL, SUI) på 1-timmars tidsram med trendfilter och ATR-baserade take-profit-nivåer.
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>GitHub Repo:</span>
                <span className="text-slate-200">therog1/tradebottenanna</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Hävstång:</span>
                <span className="text-cyan-400 font-bold">3x Perpetual Swaps</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Risk per trade:</span>
                <span className="text-slate-200">1.5%</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Subkonto Saldo:</span>
                <span className="text-emerald-400 font-bold">{fmtUsd(annaEquityUSD)} USD</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Körschema:</span>
                <span className="text-slate-200">Varje hel timme (cron)</span>
              </div>
            </div>
          </div>

          {/* Lena card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                <h4 className="font-bold text-slate-100">Aggressiva Lena</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
                SCALPER / OBI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Ken Griffin-inspirerad mikroskalper som utnyttjar obalanser i orderboken (OBI). Handlar USD-M X-Perpetuals på OKX med 3x–5x dynamisk hävstång och USDC-säkerhet.
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>GitHub Repo:</span>
                <span className="text-slate-200">therog1/tradebottenaggresivalena</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Hävstång:</span>
                <span className="text-amber-400 font-bold">3x–5x Dynamisk (Futures)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Risk per trade:</span>
                <span className="text-slate-200">1 % (tak 3 % totalt) – säkerhets-PR #1, ej mergad</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Subkonto Saldo:</span>
                <span className="text-emerald-400 font-bold">{fmtUsd(lenaEquityUSD)} USD</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Körschema:</span>
                <span className="text-slate-200">Var 15:e minut + vid signal</span>
              </div>
            </div>
          </div>

          {/* Environment Secrets Overview */}
          <div className="md:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h4 className="font-bold text-slate-100">Integrationsnycklar & Miljövariabler i Systemet</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">OKX ANNA SUBKONTO</span>
                <span className="text-slate-200 font-bold">OKX_ANNA_KEY</span>
                <span className="text-[10px] text-emerald-400 block mt-1">✓ Ansluten (Live EEA)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">OKX LENA SUBKONTO</span>
                <span className="text-slate-200 font-bold">OKX_AGGR_KEY</span>
                <span className="text-[10px] text-emerald-400 block mt-1">✓ Ansluten (Live EEA)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">GITHUB ACTIONS INTEGRATION</span>
                <span className="text-slate-200 font-bold">GITHUB_KEY (therog1)</span>
                <span className="text-[10px] text-indigo-400 block mt-1">✓ Dispatch behörighet</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GROK OPERATIONAL CHECKLIST */}
      {activeSubTab === 'CHECKLIST' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Groks Operativa Mandat & Ansvarsområden</h3>
              <p className="text-xs text-slate-400">Dessa protokoll ska Grok följa i alla situationer för att säkerställa kapitalets säkerhet.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                1. Reconciliation före Riskökning
              </span>
              <p className="text-slate-400 leading-relaxed">
                Innan nya köp tillåts måste systemets interna positionslista matcha OKX exakta faktiska kontoinnehav. Om en diskrepans uppstår stoppas nya ordrar tills kontot är synkroniserat.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                2. Hävstångs- & Likvidationskontroll
              </span>
              <p className="text-slate-400 leading-relaxed">
                Vid 3x–5x hävstång övervakas avståndet till likvidationskurs kontinuerligt. Skyddande stop-loss (-1.8%) måste placeras som exchange-native villkorsorder i samma millisekund som fylld order.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                3. Orderbokens Datafärskhet
              </span>
              <p className="text-slate-400 leading-relaxed">
                OBI-signaler förkastas om orderboken är äldre än 2 sekunder eller om spreaden överstiger 0.15%. Inga dubblerade ordrar tillåts på samma snapshot.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                4. Nödstopp & Kill-Switch
              </span>
              <p className="text-slate-400 leading-relaxed">
                Nödstopp görs i GitHub (Actions → Disable workflow) eller med filen KILL_SWITCH i Lena-repot (säkerhets-PR #1). Dashboarden kan inte stoppa, stänga eller lägga ordrar.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Kopierat!' : 'Kopiera hela direktivet till Grok'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
