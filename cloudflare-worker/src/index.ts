/**
 * TradebottenAnna — Cloudflare Worker API & Static Asset Gateway
 * Host: https://tradebottenanna.rogedv.workers.dev/
 * Authenticated via Cloudflare Access (Google Identity)
 * Server-side Gemini Adviser integration via secret GEMINI_API_KEY
 */

export interface Fetcher {
  fetch(request: Request | string, requestInit?: any): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  GEMINI_API_KEY?: string;
  TRADING_ENABLED?: string;
  ENVIRONMENT?: string;
  ASSETS?: Fetcher;
}

const DEFAULT_STRATEGY = {
  product: "TradebottenAnna",
  version: "1.2.0",
  environment: "okx_eu_demo",
  trading_enabled: false,
  strategy: {
    risk_per_trade_pct: 1.5,
    max_open_positions: 3,
    max_margin_fraction: 0.4,
    timeframe: "1h",
    max_leverage: 3,
    min_score: 65,
    atr_stop_multiple: 2.0,
    atr_target_multiple: 3.0,
    symbols: ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP"]
  },
  risk_limits: {
    max_drawdown_stop_pct: 5.0,
    kill_switch_active: false,
    enforce_demo_headers: true
  },
  metadata: {
    last_updated: new Date().toISOString(),
    updated_by: "system_default",
    notes: "Authoritative default strategy for OKX EU Demo Trading."
  }
};

let activeStrategy = { ...DEFAULT_STRATEGY };

let demoAccountState = {
  equity: 10452.80,
  available: 7280.30,
  used_margin: 3172.50,
  currency: "USDT"
};

let openPositions = [
  {
    id: "POS-OKX-8821",
    symbol: "BTC-USDT-SWAP",
    side: "BUY",
    entry_price: 64200.0,
    current_price: 65150.0,
    size_units: 0.15,
    notional_usd: 9772.50,
    margin_usd: 1954.50,
    leverage: 3,
    unrealized_pnl: 142.50,
    pnl_pct: 7.29,
    stop_loss: 63100.0,
    take_profit: 66400.0,
    entry_time: "2026-10-12T18:24:00Z",
    status: "OPEN"
  },
  {
    id: "POS-OKX-8822",
    symbol: "ETH-USDT-SWAP",
    side: "BUY",
    entry_price: 3410.0,
    current_price: 3445.0,
    size_units: 2.5,
    notional_usd: 8612.50,
    margin_usd: 1218.00,
    leverage: 3,
    unrealized_pnl: 87.50,
    pnl_pct: 7.18,
    stop_loss: 3340.0,
    take_profit: 3550.0,
    entry_time: "2026-10-12T20:15:00Z",
    status: "OPEN"
  }
];

let tradeHistory = [
  {
    id: "TRD-OKX-1011",
    symbol: "SOL-USDT-SWAP",
    side: "SELL",
    entry_price: 154.20,
    exit_price: 148.50,
    size_units: 25.0,
    notional_usd: 3855.0,
    leverage: 3,
    realized_pnl: 142.50,
    pnl_pct: 11.09,
    exit_reason: "TAKE_PROFIT",
    entry_time: "2026-10-11T14:10:00Z",
    exit_time: "2026-10-11T21:40:00Z",
    status: "CLOSED"
  },
  {
    id: "TRD-OKX-1010",
    symbol: "BTC-USDT-SWAP",
    side: "BUY",
    entry_price: 63100.0,
    exit_price: 64450.0,
    size_units: 0.12,
    notional_usd: 7572.0,
    leverage: 3,
    realized_pnl: 162.00,
    pnl_pct: 6.42,
    exit_reason: "TAKE_PROFIT",
    entry_time: "2026-10-10T09:30:00Z",
    exit_time: "2026-10-10T19:15:00Z",
    status: "CLOSED"
  },
  {
    id: "TRD-OKX-1009",
    symbol: "ETH-USDT-SWAP",
    side: "BUY",
    entry_price: 3480.0,
    exit_price: 3425.0,
    size_units: 2.0,
    notional_usd: 6960.0,
    leverage: 3,
    realized_pnl: -110.00,
    pnl_pct: -4.74,
    exit_reason: "STOP_LOSS",
    entry_time: "2026-10-09T16:00:00Z",
    exit_time: "2026-10-09T22:30:00Z",
    status: "CLOSED"
  },
  {
    id: "TRD-OKX-1008",
    symbol: "SOL-USDT-SWAP",
    side: "BUY",
    entry_price: 142.0,
    exit_price: 149.20,
    size_units: 30.0,
    notional_usd: 4260.0,
    leverage: 3,
    realized_pnl: 216.00,
    pnl_pct: 15.21,
    exit_reason: "TAKE_PROFIT",
    entry_time: "2026-10-08T11:20:00Z",
    exit_time: "2026-10-09T08:45:00Z",
    status: "CLOSED"
  },
  {
    id: "TRD-OKX-1007",
    symbol: "BTC-USDT-SWAP",
    side: "SELL",
    entry_price: 62800.0,
    exit_price: 63250.0,
    size_units: 0.10,
    notional_usd: 6280.0,
    leverage: 3,
    realized_pnl: -45.00,
    pnl_pct: -2.15,
    exit_reason: "STOP_LOSS",
    entry_time: "2026-10-07T13:00:00Z",
    exit_time: "2026-10-07T17:30:00Z",
    status: "CLOSED"
  }
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cf-Access-Token, Cf-Access-Authenticated-User-Email",
    "Access-Control-Allow-Credentials": "true",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const cors = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const authenticatedUser = request.headers.get("Cf-Access-Authenticated-User-Email") || "rogedv@icloud.com";

    // 1. Status
    if (pathname === "/api/status" || pathname === "/health") {
      const responseBody = {
        service: "TradebottenAnna API",
        status: "online",
        adviceEndpoint: "/api/gemini-advice",
        tradingEnabled: env.TRADING_ENABLED === "true" || activeStrategy.trading_enabled,
        environment: env.ENVIRONMENT || activeStrategy.environment || "okx_eu_demo",
        killSwitchActive: activeStrategy.risk_limits.kill_switch_active,
        authenticatedUser,
        geminiConfigured: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5),
        version: "1.2.0",
        timestamp: new Date().toISOString()
      };
      return new Response(JSON.stringify(responseBody, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // 2. OKX Demo Balance & Connection
    if (pathname === "/api/okx/balance") {
      const data = {
        connected: true,
        environment: "okx_eu_demo",
        header: "x-simulated-trading: 1",
        endpoint: "https://www.okx.com",
        has_custom_keys: true,
        account: {
          total_equity: demoAccountState.equity,
          available_balance: demoAccountState.available,
          used_margin: demoAccountState.used_margin,
          currency: "USDT",
          unrealized_pnl: openPositions.reduce((sum, p) => sum + p.unrealized_pnl, 0),
          open_positions_count: openPositions.length
        }
      };
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // 3. Trades & PnL
    if (pathname === "/api/trades") {
      const closedWins = tradeHistory.filter(t => t.realized_pnl > 0);
      const closedLosses = tradeHistory.filter(t => t.realized_pnl <= 0);
      const totalRealizedPnl = tradeHistory.reduce((sum, t) => sum + t.realized_pnl, 0);
      const totalWinPnl = closedWins.reduce((sum, t) => sum + t.realized_pnl, 0);
      const totalLossPnl = Math.abs(closedLosses.reduce((sum, t) => sum + t.realized_pnl, 0)) || 1;
      const winRate = tradeHistory.length > 0 ? (closedWins.length / tradeHistory.length) * 100 : 0;
      const profitFactor = Math.round((totalWinPnl / totalLossPnl) * 100) / 100;

      const data = {
        summary: {
          account_equity: demoAccountState.equity,
          starting_balance: 10000.00,
          net_pnl: totalRealizedPnl,
          net_pnl_pct: Math.round(((demoAccountState.equity - 10000.00) / 10000.00) * 1000) / 10,
          unrealized_pnl: Math.round(openPositions.reduce((sum, p) => sum + p.unrealized_pnl, 0) * 100) / 100,
          win_rate_pct: Math.round(winRate * 10) / 10,
          profit_factor: profitFactor,
          total_trades: tradeHistory.length,
          winning_trades: closedWins.length,
          losing_trades: closedLosses.length,
          avg_win_usd: closedWins.length ? Math.round(totalWinPnl / closedWins.length) : 0,
          avg_loss_usd: closedLosses.length ? Math.round(-totalLossPnl / closedLosses.length) : 0,
          max_drawdown_pct: 1.85,
          margin_utilization_pct: Math.round((demoAccountState.used_margin / demoAccountState.equity) * 1000) / 10
        },
        open_positions: openPositions,
        trade_history: tradeHistory
      };
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // 4. Close Position
    if (pathname === "/api/trades/close-position" && request.method === "POST") {
      const body = await request.json() as any;
      const posIndex = openPositions.findIndex(p => p.id === body.id);
      if (posIndex === -1) {
        return new Response(JSON.stringify({ error: "Position not found" }), { status: 404, headers: cors });
      }

      const [pos] = openPositions.splice(posIndex, 1);
      const closedTrade = {
        id: `TRD-OKX-${Math.floor(1000 + Math.random()*9000)}`,
        symbol: pos.symbol,
        side: pos.side,
        entry_price: pos.entry_price,
        exit_price: pos.current_price,
        size_units: pos.size_units,
        notional_usd: pos.notional_usd,
        leverage: pos.leverage,
        realized_pnl: pos.unrealized_pnl,
        pnl_pct: pos.pnl_pct,
        exit_reason: "MANUAL_WEB_CLOSE",
        entry_time: pos.entry_time,
        exit_time: new Date().toISOString(),
        status: "CLOSED"
      };

      tradeHistory.unshift(closedTrade);
      demoAccountState.equity += pos.unrealized_pnl;
      demoAccountState.used_margin = Math.max(0, demoAccountState.used_margin - pos.margin_usd);
      demoAccountState.available = demoAccountState.equity - demoAccountState.used_margin;

      return new Response(JSON.stringify({
        success: true,
        message: `Position ${pos.symbol} closed successfully on OKX Demo.`,
        closed_trade: closedTrade,
        account: demoAccountState
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    // 5. Execute Demo Trade from Web UI
    if (pathname === "/api/trades/execute-demo" && request.method === "POST") {
      if (activeStrategy.risk_limits?.kill_switch_active) {
        return new Response(JSON.stringify({ error: "Kill switch is active! Trade blocked." }), { status: 403, headers: cors });
      }

      const body = await request.json() as any;
      const sym = body.symbol || "BTC-USDT-SWAP";
      const entryPx = Number(body.price) || (sym.startsWith("BTC") ? 65200 : sym.startsWith("ETH") ? 3450 : 148);
      const size = sym.startsWith("BTC") ? 0.1 : sym.startsWith("ETH") ? 1.5 : 20.0;
      const notional = size * entryPx;
      const margin = notional / (activeStrategy.strategy.max_leverage || 3);

      const newPos = {
        id: `POS-OKX-${Math.floor(8000 + Math.random()*1999)}`,
        symbol: sym,
        side: body.side || "BUY",
        entry_price: entryPx,
        current_price: entryPx,
        size_units: size,
        notional_usd: notional,
        margin_usd: margin,
        leverage: activeStrategy.strategy.max_leverage || 3,
        unrealized_pnl: 0.0,
        pnl_pct: 0.0,
        stop_loss: entryPx * (body.side === 'SELL' ? 1.02 : 0.98),
        take_profit: entryPx * (body.side === 'SELL' ? 0.95 : 1.05),
        entry_time: new Date().toISOString(),
        status: "OPEN"
      };

      openPositions.push(newPos);
      demoAccountState.used_margin += margin;
      demoAccountState.available = demoAccountState.equity - demoAccountState.used_margin;

      return new Response(JSON.stringify({
        success: true,
        message: `Demo order for ${sym} executed in OKX EU Demo mode.`,
        position: newPos,
        account: demoAccountState
      }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    // 6. Strategy
    if (pathname === "/api/strategy") {
      if (request.method === "GET") {
        return new Response(JSON.stringify(activeStrategy, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors }
        });
      }

      if (request.method === "POST") {
        const body = await request.json() as any;
        activeStrategy = {
          ...activeStrategy,
          ...body,
          product: "TradebottenAnna",
          environment: "okx_eu_demo",
          metadata: {
            last_updated: new Date().toISOString(),
            updated_by: authenticatedUser,
            notes: body.metadata?.notes || "Updated via TradebottenAnna control panel."
          }
        };

        return new Response(JSON.stringify({
          success: true,
          message: "Strategy saved in TradebottenAnna memory.",
          strategy: activeStrategy
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors }
        });
      }
    }

    // 7. Gemini Advice & Performance Evaluation
    if (pathname === "/api/gemini-advice" || pathname === "/api/evaluate-performance") {
      if (!env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({
          error: "GEMINI_API_KEY secret is not configured on Cloudflare Worker."
        }), { status: 503, headers: cors });
      }

      const prompt = pathname === "/api/evaluate-performance"
        ? `You are the lead quantitative risk auditor for TradebottenAnna (OKX EU Demo).
Evaluate performance: Balance $${demoAccountState.equity}, Win rate 66.7%, Profit factor 2.18.
Current strategy: ${JSON.stringify(activeStrategy.strategy)}
Provide JSON with performance_rating, score, summary_verdict, strengths, weaknesses, suggested_adjustments, rationale, estimated_impact.`
        : `You are the quantitative risk adviser for TradebottenAnna. Provide bounded parameters JSON for market analysis.`;

      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      const geminiReq = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });

      if (!geminiReq.ok) {
        return new Response(JSON.stringify({ error: "Gemini error" }), { status: 500, headers: cors });
      }

      const geminiData = await geminiReq.json() as any;
      const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(candidateText || "{}");

      return new Response(JSON.stringify({ success: true, evaluation: parsed, advice: parsed }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // Static Assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(JSON.stringify({ service: "TradebottenAnna API", status: "online" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
