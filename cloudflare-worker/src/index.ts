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

// In-worker in-memory cache for live strategy state
let activeStrategy = { ...DEFAULT_STRATEGY };

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

    // Identify user via Cloudflare Access headers if present
    const authenticatedUser = request.headers.get("Cf-Access-Authenticated-User-Email") || "rogedv@icloud.com";

    // API Route: /api/status or /health
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
        headers: {
          "Content-Type": "application/json",
          ...cors
        }
      });
    }

    // API Route: /api/strategy (GET / POST)
    if (pathname === "/api/strategy") {
      if (request.method === "GET") {
        return new Response(JSON.stringify(activeStrategy, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors }
        });
      }

      if (request.method === "POST") {
        try {
          const body = await request.json() as any;
          if (!body || !body.strategy) {
            return new Response(JSON.stringify({ error: "Invalid payload: 'strategy' object required" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors }
            });
          }

          // Strict validation
          const s = body.strategy;
          if (s.risk_per_trade_pct < 0.1 || s.risk_per_trade_pct > 5.0) {
            return new Response(JSON.stringify({ error: "risk_per_trade_pct must be between 0.1 and 5.0" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors }
            });
          }
          if (s.max_leverage < 1 || s.max_leverage > 10) {
            return new Response(JSON.stringify({ error: "max_leverage must be between 1 and 10" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors }
            });
          }

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
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message || "Failed to parse JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...cors }
          });
        }
      }
    }

    // API Route: /api/gemini-advice
    if (pathname === "/api/gemini-advice" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({
          error: "GEMINI_API_KEY secret is not configured on Cloudflare Worker. Run: npx wrangler secret put GEMINI_API_KEY"
        }), {
          status: 503,
          headers: { "Content-Type": "application/json", ...cors }
        });
      }

      try {
        const body = await request.json() as any;
        const currentParams = body.strategy || activeStrategy.strategy;
        const marketContext = body.market_context || "Normal volatility, rangebound with breakout potential";
        const riskGoal = body.risk_goal || "Capital preservation with controlled risk";

        const prompt = `You are the conservative quantitative risk adviser for TradebottenAnna, a crypto trading bot operating exclusively in the OKX EU Demo environment.
Your purpose is to advise on strategy parameters based on market conditions.
YOU CANNOT AUTHORIZE OR EXECUTE TRADES. You only recommend bounded strategy settings.

Current Parameters:
${JSON.stringify(currentParams, null, 2)}

Context:
Market: ${marketContext}
Risk Goal: ${riskGoal}

Enforce these strict parameter limits:
- risk_per_trade_pct: 0.2 to 3.0 (default max 2.0%)
- max_open_positions: 1 to 5
- max_margin_fraction: 0.1 to 0.5
- timeframe: one of ["15m", "30m", "1h", "4h", "1d"]
- max_leverage: 1 to 5 (strictly capped for safety)
- min_score: 55 to 85 (signal quality threshold)
- atr_stop_multiple: 1.5 to 3.5
- atr_target_multiple: 2.0 to 6.0
- symbols: array of approved perpetual swaps, e.g. ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP"]

Respond with ONLY valid JSON with this exact schema:
{
  "market_regime": "string describing market state",
  "confidence_score": number between 60 and 95,
  "analysis": "2-3 sentences explaining market conditions and risk assessment",
  "proposed_parameters": {
    "risk_per_trade_pct": number,
    "max_open_positions": number,
    "max_margin_fraction": number,
    "timeframe": "string",
    "max_leverage": number,
    "min_score": number,
    "atr_stop_multiple": number,
    "atr_target_multiple": number,
    "symbols": ["string"]
  },
  "rationale_per_field": {
    "risk_per_trade_pct": "explanation",
    "max_leverage": "explanation",
    "min_score": "explanation",
    "timeframe": "explanation",
    "atr_stop_multiple": "explanation",
    "atr_target_multiple": "explanation"
  },
  "risk_warnings": ["list of key risk considerations"],
  "disclaimer": "Advisory recommendation only for OKX EU Demo. Review and explicit user approval required before applying."
}`;

        // Call Gemini API (gemini-3.8-flash)
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const geminiReq = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          })
        });

        if (!geminiReq.ok) {
          const errText = await geminiReq.text();
          return new Response(JSON.stringify({
            error: `Gemini API returned status ${geminiReq.status}`,
            details: errText
          }), {
            status: geminiReq.status,
            headers: { "Content-Type": "application/json", ...cors }
          });
        }

        const geminiData = await geminiReq.json() as any;
        const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          return new Response(JSON.stringify({ error: "Empty advice returned from Gemini model" }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...cors }
          });
        }

        const adviceJson = JSON.parse(candidateText);

        // Sanitize proposed parameters within absolute safety caps
        const p = adviceJson.proposed_parameters;
        if (p) {
          p.risk_per_trade_pct = Math.min(3.0, Math.max(0.2, Number(p.risk_per_trade_pct) || 1.5));
          p.max_leverage = Math.min(5, Math.max(1, Math.round(Number(p.max_leverage) || 3)));
          p.max_open_positions = Math.min(5, Math.max(1, Math.round(Number(p.max_open_positions) || 3)));
          p.max_margin_fraction = Math.min(0.5, Math.max(0.1, Number(p.max_margin_fraction) || 0.4));
          p.min_score = Math.min(85, Math.max(55, Math.round(Number(p.min_score) || 65)));
          p.atr_stop_multiple = Math.min(3.5, Math.max(1.5, Number(p.atr_stop_multiple) || 2.0));
          p.atr_target_multiple = Math.min(6.0, Math.max(2.0, Number(p.atr_target_multiple) || 3.0));
        }

        return new Response(JSON.stringify({
          success: true,
          model: "gemini-3.8-flash",
          timestamp: new Date().toISOString(),
          advice: adviceJson
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Failed to generate advice" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...cors }
        });
      }
    }

    // Static Asset fallback: If ASSETS is bound (Wrangler Static Assets), serve frontend
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Default API response if accessed directly without static assets binding
    return new Response(JSON.stringify({
      service: "TradebottenAnna API",
      status: "online",
      adviceEndpoint: "/api/gemini-advice",
      tradingEnabled: false,
      environment: "okx_eu_demo",
      message: "Worker API online. Control panel assets served via Cloudflare Workers Static Assets."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
