#!/usr/bin/env python3
"""
ApexFlash — OKX EU dry-run build.
This build is deliberately fail-closed: it reads public market data and asks Gemini
for a decision, but it NEVER submits orders. Live order execution must be implemented
and tested separately against OKX demo before being enabled.
"""
import json
import logging
import math
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import ccxt
import requests
from dotenv import load_dotenv

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ApexFlash")

# Safe defaults. Live execution is intentionally not implemented in this build.
EXCHANGE_ID = os.getenv("EXCHANGE_ID", "okx").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
TIMEFRAME = os.getenv("TIMEFRAME", "15m")
CANDLE_LIMIT = 100
GEMINI_TIMEOUT_MS = max(5000, min(int(os.getenv("GEMINI_TIMEOUT_MS", "30000")), 60000))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.72"))
RISK_PER_TRADE_PCT = float(os.getenv("RISK_PER_TRADE_PCT", "0.8"))
MAX_LEVERAGE = int(os.getenv("MAX_LEVERAGE", "10"))
MIN_LEVERAGE = int(os.getenv("MIN_LEVERAGE", "3"))
WATCHLIST = [
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
    "SOL/USDT:USDT",
    "AVAX/USDT:USDT",
    "SUI/USDT:USDT",
]
GITHUB_STEP_SUMMARY = os.getenv("GITHUB_STEP_SUMMARY")

def init_exchange() -> ccxt.Exchange:
    """Public OKX EU market-data connection; no API keys needed for dry run."""
    if EXCHANGE_ID != "okx":
        raise RuntimeError(f"Den här patchen är avsedd för OKX, inte {EXCHANGE_ID!r}.")
    exchange = ccxt.okx({
        "enableRateLimit": True,
        "timeout": 10000,
        "options": {
            "defaultType": "swap",
            "fetchCurrencies": False,
        },
    })
    # OKX EEA API hostname observed working from GitHub Actions public-market test.
    exchange.hostname = "eea.okx.com"
    logger.info("Laddar publika OKX EU-marknader (timeout 10 s)...")
    markets = exchange.load_markets()
    if not markets:
        raise RuntimeError("OKX returnerade inga marknader; avbryter.")
    logger.info("OKX-marknader laddade: %d", len(markets))
    return exchange

def ema(values: List[float], period: int) -> float:
    if not values:
        raise ValueError("EMA kräver prisdata.")
    if len(values) < period:
        return values[-1]
    k = 2.0 / (period + 1)
    result = sum(values[:period]) / period
    for value in values[period:]:
        result = value * k + result * (1.0 - k)
    return result

def rsi(values: List[float], period: int = 14) -> float:
    if len(values) <= period:
        return 50.0
    gains, losses = [], []
    for old, new in zip(values[-period-1:-1], values[-period:]):
        change = new - old
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)

def atr(candles: List[List[float]], period: int = 14) -> float:
    if len(candles) < 2:
        raise ValueError("För få candles för ATR.")
    ranges = []
    for i in range(1, len(candles)):
        _, _, high, low, _, _ = candles[i]
        prev_close = candles[i - 1][4]
        ranges.append(max(high - low, abs(high - prev_close), abs(low - prev_close)))
    selected = ranges[-period:]
    return sum(selected) / len(selected) if selected else 0.0

def analyze(candles: List[List[float]]) -> Dict[str, Any]:
    if len(candles) < 50:
        raise ValueError(f"Behöver minst 50 candles, fick {len(candles)}.")
    closes = [float(c[4]) for c in candles]
    highs = [float(c[2]) for c in candles]
    lows = [float(c[3]) for c in candles]
    volumes = [float(c[5]) for c in candles]
    current = closes[-1]
    rsi_value = rsi(closes)
    ema9, ema21, ema50 = ema(closes, 9), ema(closes, 21), ema(closes, 50)
    pattern = "NEUTRAL"
    if current < ema21 and current < ema50 and rsi_value < 46 and closes[-1] < closes[-2]:
        pattern = "DUMP"
    elif current > ema9 and (current > ema21 or rsi_value < 38 or closes[-1] > closes[-2]):
        pattern = "BOUNCE"
    avg_volume = sum(volumes[-20:]) / min(20, len(volumes))
    return {
        "current_price": current,
        "ema9": round(ema9, 6),
        "ema21": round(ema21, 6),
        "ema50": round(ema50, 6),
        "rsi": round(rsi_value, 2),
        "atr": round(atr(candles), 6),
        "support": round(min(lows[-30:]), 6),
        "resistance": round(max(highs[-30:]), 6),
        "pattern": pattern,
        "vol_surge": volumes[-1] > avg_volume * 1.3 if avg_volume > 0 else False,
    }

def get_ai_decision(symbol: str, tech: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Gemini request with bounded HTTP timeout; any failure means no signal."""
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY saknas. Hoppar över %s utan signal.", symbol)
        return None
    if genai is None or types is None:
        logger.error("google-genai SDK saknas. Hoppar över %s utan signal.", symbol)
        return None

    prompt = f"""Du analyserar kryptomarknadsdata. Returnera ENDAST giltig JSON.
Ingen order ska läggas; detta är en analys för paper trading.
Data för {symbol}: {json.dumps(tech, ensure_ascii=False)}
Ge objekt med fälten action (LONG, SHORT eller HOLD), confidence (0..1),
reasoning (kort svensk text), entry_price (tal), stop_loss (tal), take_profit (tal),
suggested_leverage (heltal 1..{MAX_LEVERAGE}), pattern (BOUNCE, DUMP eller NONE).
Om osäker: HOLD. Risk/Reward ska vara minst 5:1 om action är LONG eller SHORT.
"""
    started = time.monotonic()
    logger.info("Gemini-anrop START: %s; timeout %.1f s; modell %s",
                symbol, GEMINI_TIMEOUT_MS / 1000, GEMINI_MODEL)
    try:
        client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
        )
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        elapsed = time.monotonic() - started
        logger.info("Gemini-anrop KLART: %s efter %.1f s", symbol, elapsed)
        text = getattr(response, "text", None)
        if not text:
            logger.error("Gemini gav tomt svar för %s; ingen signal.", symbol)
            return None
        decision = json.loads(text)
        if not isinstance(decision, dict):
            logger.error("Gemini-svar är inte ett JSON-objekt för %s; ingen signal.", symbol)
            return None
        action = str(decision.get("action", "HOLD")).upper()
        if action not in {"LONG", "SHORT", "HOLD"}:
            logger.error("Ogiltig action %r för %s; ingen signal.", action, symbol)
            return None
        confidence = float(decision.get("confidence", 0.0))
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            logger.error("Ogiltig confidence för %s; ingen signal.", symbol)
            return None
        decision["action"] = action
        decision["confidence"] = confidence
        return decision
    except Exception:
        logger.exception("Gemini-anrop FEL för %s efter %.1f s; ingen signal.",
                         symbol, time.monotonic() - started)
        return None

def write_summary(rows: List[Dict[str, Any]]) -> None:
    if not GITHUB_STEP_SUMMARY:
        return
    try:
        with open(GITHUB_STEP_SUMMARY, "a", encoding="utf-8") as f:
            f.write("## ApexFlash — OKX EU diagnostic dry run\n\n")
            f.write(f"- Timestamp UTC: `{datetime.now(timezone.utc).isoformat()}`\n")
            f.write("- Mode: `PUBLIC DATA + GEMINI ANALYSIS ONLY; NO ORDERS`\n\n")
            f.write("| Symbol | Action | Confidence | Price | Result |\n|---|---|---:|---:|---|\n")
            for row in rows:
                f.write("| {symbol} | {action} | {confidence} | {price} | {result} |\n".format(**row))
    except Exception:
        logger.exception("Kunde inte skriva GitHub Step Summary.")

def run_bot() -> int:
    logger.info("=" * 60)
    logger.info("APEXFLASH OKX EU — SAFE DIAGNOSTIC RUN")
    logger.info("UTC: %s", datetime.now(timezone.utc).isoformat())
    logger.info("Live trading: DISABLED IN THIS BUILD; no order methods called")
    logger.info("Gemini timeout: %.1f s", GEMINI_TIMEOUT_MS / 1000)
    exchange = init_exchange()
    rows = []
    for symbol in WATCHLIST:
        logger.info("--- Analyserar %s ---", symbol)
        try:
            market = exchange.market(symbol)
            if market.get("type") != "swap":
                logger.warning("%s finns inte som swap i CCXT-marknaderna; hoppar över.", symbol)
                rows.append({"symbol": symbol, "action": "SKIP", "confidence": "-", "price": "-", "result": "Not a swap market"})
                continue
            candles = exchange.fetch_ohlcv(symbol, timeframe=TIMEFRAME, limit=CANDLE_LIMIT)
            if not candles or len(candles) < 50:
                raise RuntimeError(f"För få candles: {len(candles) if candles else 0}")
            tech = analyze(candles)
            logger.info("Pris %.6f | RSI %.2f | ATR %.6f | Mönster %s",
                        tech["current_price"], tech["rsi"], tech["atr"], tech["pattern"])
            decision = get_ai_decision(symbol, tech)
            if decision is None:
                rows.append({"symbol": symbol, "action": "SKIP", "confidence": "-", "price": f"{tech['current_price']:.6f}", "result": "Gemini failed/no signal"})
                continue
            action = decision["action"]
            confidence = decision["confidence"]
            reasoning = str(decision.get("reasoning", ""))[:300]
            logger.info("AI-beslut: %s | konfidens %.1f%% | %s",
                        action, confidence * 100, reasoning)
            result = "PAPER ONLY — no order submitted"
            if action in {"LONG", "SHORT"} and confidence < MIN_CONFIDENCE:
                result = "Below confidence threshold; no signal"
                action = "HOLD"
            rows.append({
                "symbol": symbol,
                "action": action,
                "confidence": f"{confidence:.1%}",
                "price": f"{tech['current_price']:.6f}",
                "result": result,
            })
        except Exception as exc:
            logger.exception("Fel vid analys av %s; går vidare säkert: %s", symbol, exc)
            rows.append({"symbol": symbol, "action": "ERROR", "confidence": "-", "price": "-", "result": str(exc)[:160]})
        time.sleep(0.5)
    write_summary(rows)
    logger.info("Körning klar. Analyserade %d symboler. Inga order har skickats.", len(rows))
    return 0

if __name__ == "__main__":
    try:
        sys.exit(run_bot())
    except Exception:
        logger.exception("ApexFlash avbröts på grund av kritiskt fel.")
        sys.exit(1)
