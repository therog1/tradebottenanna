/**
 * TradebottenAnna — Full-Stack Server & Dev Gateway
 * Mounts Express API alongside Vite middleware for instant preview.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import util from 'util';

dotenv.config();

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

const STRATEGY_FILE = path.join(__dirname, 'strategy.json');

function readStrategyFromDisk() {
  if (fs.existsSync(STRATEGY_FILE)) {
    const raw = fs.readFileSync(STRATEGY_FILE, 'utf-8');
    return JSON.parse(raw);
  }
  return {
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
      updated_by: "system",
      notes: "Default configuration."
    }
  };
}

// 1. API: Health & Status
app.get(['/api/status', '/health'], (req, res) => {
  const currentStrategy = readStrategyFromDisk();
  const cfUserEmail = (req.headers['cf-access-authenticated-user-email'] as string) || 'rogedv@icloud.com';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);

  res.json({
    service: "TradebottenAnna API",
    status: "online",
    adviceEndpoint: "/api/gemini-advice",
    tradingEnabled: currentStrategy.trading_enabled ?? false,
    environment: currentStrategy.environment || "okx_eu_demo",
    killSwitchActive: currentStrategy.risk_limits?.kill_switch_active ?? false,
    authenticatedUser: cfUserEmail,
    geminiConfigured: hasGeminiKey,
    version: currentStrategy.version || "1.2.0",
    timestamp: new Date().toISOString()
  });
});

// 2. API: Strategy Read & Persist
app.get('/api/strategy', (_req, res) => {
  try {
    const strategy = readStrategyFromDisk();
    res.json(strategy);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read strategy.json", message: err.message });
  }
});

app.post('/api/strategy', (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.strategy) {
      return res.status(400).json({ error: "Invalid payload: missing strategy object" });
    }

    const s = body.strategy;
    if (s.risk_per_trade_pct < 0.1 || s.risk_per_trade_pct > 5.0) {
      return res.status(400).json({ error: "risk_per_trade_pct must be between 0.1% and 5.0%" });
    }
    if (s.max_leverage < 1 || s.max_leverage > 10) {
      return res.status(400).json({ error: "max_leverage must be between 1x and 10x" });
    }

    const updated = {
      product: "TradebottenAnna",
      version: "1.2.0",
      environment: "okx_eu_demo",
      trading_enabled: Boolean(body.trading_enabled),
      strategy: {
        risk_per_trade_pct: Number(s.risk_per_trade_pct),
        max_open_positions: Number(s.max_open_positions),
        max_margin_fraction: Number(s.max_margin_fraction),
        timeframe: String(s.timeframe),
        max_leverage: Number(s.max_leverage),
        min_score: Number(s.min_score),
        atr_stop_multiple: Number(s.atr_stop_multiple),
        atr_target_multiple: Number(s.atr_target_multiple),
        symbols: Array.isArray(s.symbols) ? s.symbols : ["BTC-USDT-SWAP", "ETH-USDT-SWAP"]
      },
      risk_limits: {
        max_drawdown_stop_pct: Number(body.risk_limits?.max_drawdown_stop_pct ?? 5.0),
        kill_switch_active: Boolean(body.risk_limits?.kill_switch_active),
        enforce_demo_headers: true
      },
      metadata: {
        last_updated: new Date().toISOString(),
        updated_by: (req.headers['cf-access-authenticated-user-email'] as string) || "rogedv@icloud.com",
        notes: body.metadata?.notes || "Saved via TradebottenAnna Control Panel"
      }
    };

    fs.writeFileSync(STRATEGY_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return res.json({
      success: true,
      message: "Strategy successfully persisted to strategy.json",
      strategy: updated
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to persist strategy.json", message: err.message });
  }
});

// 3. API: Gemini Adviser
app.post('/api/gemini-advice', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY is not configured in environment.",
      hint: "Set GEMINI_API_KEY in Cloudflare Worker secrets or local .env"
    });
  }

  try {
    const { strategy, market_context, risk_goal } = req.body;
    const current = strategy || readStrategyFromDisk().strategy;

    const prompt = `You are the conservative quantitative risk adviser for TradebottenAnna, a trading system operating exclusively in the OKX EU Demo paper environment.
Your mission is to advise on strategy parameter adjustments based on current market dynamics.
YOU CANNOT EXECUTE OR AUTHORIZE TRADES. You only propose bounded parameter adjustments for user review.

Current Parameters:
${JSON.stringify(current, null, 2)}

Context:
- Market Condition: ${market_context || "Normal volatility, rangebound with breakout potential"}
- Risk Posture: ${risk_goal || "Capital preservation with controlled risk"}

Strict Parameter Rules:
- risk_per_trade_pct: between 0.2% and 2.5% (strictly capped)
- max_open_positions: 1 to 5
- max_margin_fraction: 0.1 to 0.5
- timeframe: one of ["15m", "30m", "1h", "4h", "1d"]
- max_leverage: 1x to 5x (strictly conservative)
- min_score: 55 to 85 (signal quality threshold)
- atr_stop_multiple: 1.5 to 3.5
- atr_target_multiple: 2.0 to 6.0
- symbols: array of approved perpetual swap instruments

Return ONLY valid JSON matching this structure:
{
  "market_regime": "string describing market regime",
  "confidence_score": 82,
  "analysis": "2-3 sentences explaining market conditions and risk assessment",
  "proposed_parameters": {
    "risk_per_trade_pct": 1.2,
    "max_open_positions": 3,
    "max_margin_fraction": 0.35,
    "timeframe": "1h",
    "max_leverage": 3,
    "min_score": 70,
    "atr_stop_multiple": 2.2,
    "atr_target_multiple": 3.5,
    "symbols": ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP"]
  },
  "rationale_per_field": {
    "risk_per_trade_pct": "explanation",
    "max_leverage": "explanation",
    "min_score": "explanation",
    "timeframe": "explanation",
    "atr_stop_multiple": "explanation",
    "atr_target_multiple": "explanation"
  },
  "risk_warnings": [
    "Warning on potential false breakouts during low-liquidity weekends",
    "Maintain strict stop losses on higher timeframes"
  ],
  "disclaimer": "Advisory recommendation only for OKX EU Demo. Explicit user confirmation required before applying."
}`;

    const ai = new GoogleGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);

    // Sanitize boundaries
    if (parsed.proposed_parameters) {
      const p = parsed.proposed_parameters;
      p.risk_per_trade_pct = Math.min(2.5, Math.max(0.2, Number(p.risk_per_trade_pct) || 1.5));
      p.max_leverage = Math.min(5, Math.max(1, Math.round(Number(p.max_leverage) || 3)));
      p.max_open_positions = Math.min(5, Math.max(1, Math.round(Number(p.max_open_positions) || 3)));
      p.max_margin_fraction = Math.min(0.5, Math.max(0.1, Number(p.max_margin_fraction) || 0.4));
      p.min_score = Math.min(85, Math.max(55, Math.round(Number(p.min_score) || 65)));
      p.atr_stop_multiple = Math.min(3.5, Math.max(1.5, Number(p.atr_stop_multiple) || 2.0));
      p.atr_target_multiple = Math.min(6.0, Math.max(2.0, Number(p.atr_target_multiple) || 3.0));
    }

    return res.json({
      success: true,
      model: "gemini-3.8-flash",
      timestamp: new Date().toISOString(),
      advice: parsed
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Gemini Adviser Error", message: err.message });
  }
});

// 4. API: Run Python Bot Cycle (Dry-run audit)
app.post('/api/run-simulation', async (_req, res) => {
  try {
    const { stdout, stderr } = await execPromise('python3 main.py');
    const jsonMatch = stdout.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.json(parsed);
    }
    return res.json({ output: stdout, error: stderr });
  } catch (err: any) {
    return res.status(500).json({ error: "Simulation failed", message: err.message });
  }
});

// 5. API: Download Complete Project ZIP
app.get('/api/download-zip', async (_req, res) => {
  try {
    const zipPath = path.join(__dirname, 'tradebottenanna_delivery.zip');
    await execPromise('python3 scripts/package_zip.py');

    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="tradebottenanna_complete_project.zip"');
      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);
    } else {
      res.status(500).json({ error: "Failed to generate ZIP archive" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "ZIP generation error", message: err.message });
  }
});

// 6. Vite middleware for React Frontend
async function setupVite() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TradebottenAnna] Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch(console.error);
