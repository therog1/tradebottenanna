#!/usr/bin/env python3
"""
ApexFlash - AI Futures Trading Bot (Gemini Flash & CCXT)
--------------------------------------------------------
Automatiserad tradingbot för perpetual futures på Bybit / Binance.
Handlar BTC/USDT, ETH/USDT, SOL/USDT, AVAX/USDT, SUI/USDT.

Strikta regler implementerade:
1. Både LONG (Bounce) och SHORT (Dump) baserat på teknisk analys och Gemini Flash.
2. Fast Stop-Loss (SL) och Take-Profit (TP) beräknas FÖRE entry.
3. EXAKT 5:1 Payout-ratio (Reward-to-Risk).
4. INGA utfyllnadspositioner eller martingale (aldrig snitta ner sig).
5. Dynamisk positionsstorlek baserad på aktuellt kontosaldo (compounding).
6. Dynamisk hävstång anpassad efter SL-avstånd och plånbokssäkerhet.
7. Optimerad för GitHub Actions med hemliga miljövariabler och Step Summary.
"""

import os
import sys
import json
import math
import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

# Tredjepartsbibliotek
import ccxt
import requests
from dotenv import load_dotenv

# Google GenAI SDK (Officiell modern SDK)
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# Ladda .env vid lokal körning
load_dotenv()

# Loggkonfiguration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ApexFlash")

# ==============================================================================
# KONFIGURATION & MILJÖVARIABLER
# ==============================================================================
EXCHANGE_ID = os.getenv("EXCHANGE_ID", "bybit").lower()
API_KEY = os.getenv("BYBIT_API_KEY") or os.getenv("EXCHANGE_API_KEY", "")
API_SECRET = os.getenv("BYBIT_API_SECRET") or os.getenv("EXCHANGE_API_SECRET", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
USE_TESTNET = os.getenv("USE_TESTNET", "false").lower() in ("true", "1", "yes")
DRY_RUN = os.getenv("DRY_RUN", "false").lower() in ("true", "1", "yes") or not API_KEY

# Risk- och strategiparametrar
# "The average win was about 4% of the balance, the average loss about 0.8%. Five to one."
RISK_PER_TRADE_PCT = float(os.getenv("RISK_PER_TRADE_PCT", "0.8"))  # 0.8% genomsnittlig förlust per SL
REWARD_RISK_RATIO = 5.0                                             # Strikt 5:1 Payout Ratio (0.8% risk -> 4.0% win)
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.72"))        # 72% AI-konfidens för entry
MAX_LEVERAGE = int(os.getenv("MAX_LEVERAGE", "10"))                # Max 10x hävstång
MIN_LEVERAGE = int(os.getenv("MIN_LEVERAGE", "3"))                 # Min 3x hävstång
TIMEFRAME = os.getenv("TIMEFRAME", "15m")                          # 15m candles

# Telegram (Valfritt)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Tillgångar som övervakas
WATCHLIST = [
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
    "SOL/USDT:USDT",
    "AVAX/USDT:USDT",
    "SUI/USDT:USDT",
]

# GitHub Step Summary fil
GITHUB_STEP_SUMMARY = os.getenv("GITHUB_STEP_SUMMARY")


# ==============================================================================
# TELEGRAM NOTIS
# ==============================================================================
def send_telegram_alert(message: str) -> None:
    """Skickar status eller orderlarm till Telegram."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "Markdown"}
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        logger.warning(f"Kunde inte skicka Telegram-notis: {e}")


# ==============================================================================
# BÖRSINITIERING (CCXT)
# ==============================================================================
def init_exchange() -> ccxt.Exchange:
    """Initierar CCXT-börsinstans (Bybit som default)."""
    exchange_class = getattr(ccxt, EXCHANGE_ID, None)
    if not exchange_class:
        raise ValueError(f"Ogiltig börs: {EXCHANGE_ID}")

    config = {
        "apiKey": API_KEY,
        "secret": API_SECRET,
        "enableRateLimit": True,
        "urls": {
            "api": {
                "public": "https://api.bybit.nl",
                "private": "https://api.bybit.nl",
            }
        },
        "options": {
            "defaultType": "swap",  # Perpetual futures
            "adjustForTimeDifference": True,
        },
    }

    exchange = exchange_class(config)
    if USE_TESTNET:
        exchange.set_sandbox_mode(True)
        logger.info(f"Kör mot {EXCHANGE_ID.upper()} TESTNET")
    else:
        logger.info(f"Kör mot {EXCHANGE_ID.upper()} MAINNET (Dry Run: {DRY_RUN})")

    try:
        exchange.load_markets()
    except Exception as e:
        logger.warning(f"Kunde inte ladda marknader online: {e}. Fortsätter med standardvärden.")
    return exchange


# ==============================================================================
# TEKNISK ANALYS & INDIKATORER
# ==============================================================================
def calculate_ema(prices: List[float], period: int) -> List[float]:
    """Beräknar Exponential Moving Average (EMA)."""
    if len(prices) < period:
        return prices
    k = 2 / (period + 1)
    ema_list = []
    ema = sum(prices[:period]) / period
    ema_list.append(ema)
    for price in prices[period:]:
        ema = (price * k) + (ema * (1 - k))
        ema_list.append(ema)
    return ema_list


def calculate_rsi(closes: List[float], period: int = 14) -> float:
    """Beräknar Relative Strength Index (RSI)."""
    if len(closes) <= period:
        return 50.0
    gains = []
    losses = []
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains.append(diff)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(diff))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = diff if diff > 0 else 0.0
        loss = abs(diff) if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def calculate_atr(candles: List[List[float]], period: int = 14) -> float:
    """Beräknar Average True Range (ATR)."""
    if len(candles) < period + 1:
        return candles[-1][4] * 0.015  # Fallback 1.5%
    trs = []
    for i in range(1, len(candles)):
        high = candles[i][2]
        low = candles[i][3]
        prev_close = candles[i - 1][4]
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        trs.append(tr)
    recent_trs = trs[-period:]
    return sum(recent_trs) / len(recent_trs)


def analyze_market_snapshot(candles: List[List[float]]) -> Dict[str, Any]:
    """
    Analyserar 50 senaste candles och detekterar Bounce/Dump mönster samt nyckelnivåer.
    Candle-format: [timestamp, open, high, low, close, volume]
    """
    closes = [c[4] for c in candles]
    highs = [c[2] for c in candles]
    lows = [c[3] for c in candles]
    volumes = [c[5] for c in candles]

    current_price = closes[-1]
    ema9 = calculate_ema(closes, 9)[-1]
    ema21 = calculate_ema(closes, 21)[-1]
    ema50 = calculate_ema(closes, 50)[-1]
    rsi = calculate_rsi(closes, 14)
    atr = calculate_atr(candles, 14)

    # 50-period Swing Support och Resistance
    support = min(lows[-30:])
    resistance = max(highs[-30:])

    # Volymökning?
    avg_vol = sum(volumes[-20:]) / 20.0
    vol_surge = volumes[-1] > (avg_vol * 1.3)

    # Dump-mönster: pris faller under EMA21 och EMA50 med röd momentum och volym
    is_dump = (current_price < ema21 and current_price < ema50 and rsi < 46 and closes[-1] < closes[-2])
    # Bounce-mönster: pris studsar vid support eller över EMA9 med vändande RSI
    is_bounce = (current_price > ema9 and (current_price > ema21 or rsi < 38 or closes[-1] > closes[-2]))

    pattern = "NEUTRAL"
    if is_dump and not is_bounce:
        pattern = "DUMP"
    elif is_bounce and not is_dump:
        pattern = "BOUNCE"

    return {
        "current_price": current_price,
        "ema9": round(ema9, 4),
        "ema21": round(ema21, 4),
        "ema50": round(ema50, 4),
        "rsi": round(rsi, 2),
        "atr": round(atr, 4),
        "support": round(support, 4),
        "resistance": round(resistance, 4),
        "pattern": pattern,
        "vol_surge": vol_surge,
    }


# ==============================================================================
# GEMINI FLASH AI BESLUTSFATTANDE
# ==============================================================================
def get_ai_decision(symbol: str, tech: Dict[str, Any], balance: float) -> Optional[Dict[str, Any]]:
    """
    Anropar Google Gemini Flash via nya google-genai SDK för att få en strukturerad
    handelsrekommendation med strikt 5:1 R:R.
    """
    if not GEMINI_API_KEY:
        logger.warning("Ingen GEMINI_API_KEY angiven. Använder regelbaserad fallback-motor.")
        return fallback_decision_engine(symbol, tech, balance)

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""Du är en professionell kvantitativ kryptotradingbot för perpetual futures.
HUVUDKONCEPT OCH PERSONLIGHET:
- "A red hour and a green hour are both just setups."
- Dump = Short, Bounce = Long. Ingen riktningsbias.
- Varje entry har sin Take-Profit och Stop-Loss beräknad FÖRE den öppnas (ingen "let's see where it goes").
- Payout-ratio ska vara EXAKT 5:1 (Reward-to-Risk). Snittförlust vid SL: 0.8% av saldot. Snittvinst vid TP: 4.0% av saldot.
- Klipper förluster snabbt ("Cuts a loser fast and never averages down").
- Inga utfyllnadspositioner eller martingale.
- Endast signaler med hög övertygelse (confidence >= {MIN_CONFIDENCE}) godkänns. Om chop eller osäkerhet: välj "HOLD".

MARKNADSDATA FÖR {symbol}:
- Aktuellt pris: {tech['current_price']}
- EMA 9: {tech['ema9']}
- EMA 21: {tech['ema21']}
- EMA 50: {tech['ema50']}
- RSI (14): {tech['rsi']}
- ATR (14): {tech['atr']}
- Senaste Support: {tech['support']}
- Senaste Resistans: {tech['resistance']}
- Detekterat mönster: {tech['pattern']}
- Volymökning: {tech['vol_surge']}
- Tillgängligt kapital: {balance} USDT

Svara EXKLUSIVT med ett JSON-objekt:
{{
  "symbol": "{symbol}",
  "action": "LONG" eller "SHORT" eller "HOLD",
  "pattern": "BOUNCE" eller "DUMP" eller "NONE",
  "confidence": 0.0 till 1.0,
  "entry_price": tal,
  "stop_loss": tal,
  "take_profit": tal,
  "reward_risk_ratio": 5.0,
  "suggested_leverage": heltal mellan {MIN_LEVERAGE} och {MAX_LEVERAGE},
  "reasoning": "Kort motivering på svenska (max 2 meningar)"
}}"""

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        decision = json.loads(response.text)
        return decision

    except Exception as e:
        logger.error(f"Fel vid Gemini Flash anrop för {symbol}: {e}")
        return fallback_decision_engine(symbol, tech, balance)


def fallback_decision_engine(symbol: str, tech: Dict[str, Any], balance: float) -> Dict[str, Any]:
    """Deterministisk fallback-motor om Gemini API är otillgängligt."""
    price = tech["current_price"]
    atr = tech["atr"]
    pattern = tech["pattern"]
    sl_dist = atr * 1.5

    if pattern == "BOUNCE":
        entry = price
        sl = entry - sl_dist
        tp = entry + (5.0 * sl_dist)
        return {
            "symbol": symbol,
            "action": "LONG",
            "pattern": "BOUNCE",
            "confidence": 0.78,
            "entry_price": entry,
            "stop_loss": sl,
            "take_profit": tp,
            "reward_risk_ratio": 5.0,
            "suggested_leverage": 5,
            "reasoning": "Fallback: Teknisk studs över EMA9 med stöd och positiv RSI.",
        }
    elif pattern == "DUMP":
        entry = price
        sl = entry + sl_dist
        tp = entry - (5.0 * sl_dist)
        return {
            "symbol": symbol,
            "action": "SHORT",
            "pattern": "DUMP",
            "confidence": 0.78,
            "entry_price": entry,
            "stop_loss": sl,
            "take_profit": tp,
            "reward_risk_ratio": 5.0,
            "suggested_leverage": 5,
            "reasoning": "Fallback: Teknisk dump under EMA21/EMA50 med säljstyrka.",
        }

    return {
        "symbol": symbol,
        "action": "HOLD",
        "pattern": "NONE",
        "confidence": 0.50,
        "entry_price": price,
        "stop_loss": price,
        "take_profit": price,
        "reward_risk_ratio": 5.0,
        "suggested_leverage": 3,
        "reasoning": "Konsolidering utan tydlig trendbrytning. Avvaktar.",
    }


# ==============================================================================
# RISK- & POSITIONSBERÄKNING (COMPOUNDING & 5:1 R:R)
# ==============================================================================
def calculate_order_sizing(
    balance: float,
    entry_price: float,
    stop_loss: float,
    action: str,
) -> Optional[Dict[str, Any]]:
    """
    Dynamisk positionsstorlek baserad på fast % risk av kontosaldo.
    Garanterar strikt 5:1 R:R och beräknar säker hävstång.
    """
    sl_distance = abs(entry_price - stop_loss)
    if sl_distance <= 0:
        logger.warning("Ogiltigt Stop-Loss avstånd (0).")
        return None

    # Procentuellt avstånd till SL
    sl_pct = sl_distance / entry_price

    # Säkerhetskontroll: SL får inte vara orealistiskt tight (<0.3%) eller för vid (>6%)
    if sl_pct < 0.003 or sl_pct > 0.06:
        logger.warning(f"SL avstånd ({sl_pct*100:.2f}%) utanför säkerhetsintervall (0.3% - 6.0%). Avbryter.")
        return None

    # Beräkna exakt Take Profit med 5:1 R:R
    if action == "LONG":
        take_profit = entry_price + (REWARD_RISK_RATIO * sl_distance)
    else:  # SHORT
        take_profit = entry_price - (REWARD_RISK_RATIO * sl_distance)

    # Dollarbelopp vi riskerar vid SL-träff (Compounding baserat på aktuellt saldo)
    risk_usd = balance * (RISK_PER_TRADE_PCT / 100.0)

    # Total positionens värde i USDT så att förlusten vid SL = exakt risk_usd
    position_value_usdt = risk_usd / sl_pct

    # Beräkna adaptiv hävstång:
    # Marginalen som krävs = position_value_usdt / leverage
    # Vi vill att marginalen inte överstiger max 30% av kontosaldot
    target_leverage = math.ceil(position_value_usdt / (balance * 0.30))
    leverage = max(MIN_LEVERAGE, min(MAX_LEVERAGE, int(target_leverage)))

    # Antal coins att köpa/sälja
    coin_quantity = position_value_usdt / entry_price

    # Potentiell vinst vid TP (5 x risk_usd)
    target_profit_usd = risk_usd * REWARD_RISK_RATIO

    return {
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "sl_distance": sl_distance,
        "sl_pct": sl_pct,
        "risk_usd": risk_usd,
        "target_profit_usd": target_profit_usd,
        "position_value_usdt": position_value_usdt,
        "coin_quantity": coin_quantity,
        "leverage": leverage,
        "balance": balance,
    }


# ==============================================================================
# KONTROLL AV BEFINTLIGA POSITIONER (ANTI-AVERAGING / ANTI-MARTINGALE)
# ==============================================================================
def has_open_position(exchange: ccxt.Exchange, symbol: str) -> bool:
    """
    STRIKT REGEL: Kontrollerar om det redan finns en öppen position för symbolen.
    Om en position redan existerar, öppnas INGEN ny (ingen snittning / martingale).
    """
    if DRY_RUN:
        return False

    try:
        positions = exchange.fetch_positions([symbol])
        for pos in positions:
            size = float(pos.get("contracts", 0) or pos.get("size", 0) or 0)
            if size > 0:
                logger.info(f"🚫 [SPÄRR] Öppen position existerar redan för {symbol} ({size} kontrakt). Hoppar över.")
                return True
    except Exception as e:
        logger.warning(f"Kunde inte hämta befintliga positioner för {symbol}: {e}")

    return False


# ==============================================================================
# ORDEREKSEKVERING (BRACKET ORDER MED TP/SL)
# ==============================================================================
def execute_trade(
    exchange: ccxt.Exchange,
    symbol: str,
    action: str,
    plan: Dict[str, Any],
) -> bool:
    """
    Placerar entry-order och tillhörande TP/SL order på börsen.
    """
    entry_side = "buy" if action == "LONG" else "sell"
    exit_side = "sell" if action == "LONG" else "buy"
    qty = plan["coin_quantity"]
    leverage = plan["leverage"]
    tp = plan["take_profit"]
    sl = plan["stop_loss"]

    logger.info("=" * 60)
    logger.info(f"🚀 EXEKVERING: {action} {symbol}")
    logger.info(f"   Entry: {plan['entry_price']:.4f} | SL: {sl:.4f} | TP (5:1): {tp:.4f}")
    logger.info(f"   Volym: {qty:.4f} | Värde: ${plan['position_value_usdt']:.2f} USDT")
    logger.info(f"   Hävstång: {leverage}x | Risk: ${plan['risk_usd']:.2f} | Målvinst: ${plan['target_profit_usd']:.2f}")
    logger.info("=" * 60)

    if DRY_RUN:
        logger.info("🧪 [DRY RUN LÄGE] Ingen verklig order skickad till börsen.")
        return True

    try:
        # 1. Ställ in hävstång på börsen
        try:
            exchange.set_leverage(leverage, symbol)
            logger.info(f"Hävstång satt till {leverage}x för {symbol}")
        except Exception as e:
            logger.warning(f"Kunde inte sätta hävstång: {e}")

        # 2. Avrunda antal till börsens tillåtna precision och hantera minimum-gränser
        market = exchange.market(symbol)
        min_qty = float(market.get("limits", {}).get("amount", {}).get("min") or 0.0)
        float_qty = float(qty)

        if min_qty > 0 and float_qty < min_qty:
            required_margin = (min_qty * plan["entry_price"]) / leverage
            # Tillåt uppjustering till minimum endast om marginalen är säker (<40% av saldot)
            if required_margin <= (plan.get("balance", 1000.0) * 0.45):
                logger.info(f"Justerar volym från {float_qty:.4f} till börsens minimum {min_qty} för {symbol}")
                float_qty = min_qty
            else:
                logger.warning(f"Beräknad volym {float_qty} under börsens minimum {min_qty}. Hoppar över för att skydda riskgränsen.")
                return False

        formatted_qty = exchange.amount_to_precision(symbol, float_qty)
        formatted_tp = exchange.price_to_precision(symbol, tp)
        formatted_sl = exchange.price_to_precision(symbol, sl)

        # 3. Skicka order med fäst Stop-Loss och Take-Profit (Bybit / Binance perpetual)
        params = {
            "stopLoss": {
                "triggerPrice": float(formatted_sl),
                "type": "market",
            },
            "takeProfit": {
                "triggerPrice": float(formatted_tp),
                "type": "limit",
            },
        }

        order = exchange.create_order(
            symbol=symbol,
            type="market",
            side=entry_side,
            amount=float(formatted_qty),
            params=params,
        )

        logger.info(f"✅ Order exekverad framgångsrikt! Order ID: {order.get('id')}")

        alert_msg = (
            f"🎯 *ApexFlash Trade Öppnad: {action} {symbol}*\n"
            f"• Entry: `{plan['entry_price']:.4f}`\n"
            f"• Stop Loss: `{sl:.4f}` (-${plan['risk_usd']:.2f})\n"
            f"• Take Profit (5:1): `{tp:.4f}` (+${plan['target_profit_usd']:.2f})\n"
            f"• Hävstång: `{leverage}x`\n"
            f"• Risk/Reward: `5:1`\n"
            f"• Order ID: `{order.get('id')}`"
        )
        send_telegram_alert(alert_msg)
        return True

    except Exception as e:
        logger.error(f"❌ Fel vid orderexekvering för {symbol}: {e}")
        send_telegram_alert(f"⚠️ *Orderfel för {symbol}:* {e}")
        return False


# ==============================================================================
# HUVUDLOOP & GITHUB STEP SUMMARY
# ==============================================================================
def run_bot():
    logger.info("=" * 60)
    logger.info("⚡ APEXFLASH TRADING BOT STARTAR ⚡")
    logger.info(f"Tidpunkt: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    logger.info(f"Börs: {EXCHANGE_ID.upper()} | Testnet: {USE_TESTNET} | Dry Run: {DRY_RUN}")
    logger.info(f"Risk per trade: {RISK_PER_TRADE_PCT}% | Payout-ratio: {REWARD_RISK_RATIO}:1")
    logger.info("=" * 60)

    exchange = init_exchange()

    # Hämta kontosaldo
    balance = 1000.0  # Fallback
    if not DRY_RUN:
        try:
            bal_data = exchange.fetch_balance()
            usdt_bal = bal_data.get("USDT", {}).get("free", 0.0)
            if usdt_bal and usdt_bal > 0:
                balance = float(usdt_bal)
                logger.info(f"Hämtade aktuellt USDT-saldo: ${balance:.2f} USDT")
        except Exception as e:
            logger.warning(f"Kunde inte hämta saldo: {e}. Använder default ${balance}.")
    else:
        logger.info(f"Dry Run simulerat saldo: ${balance:.2f} USDT")

    summary_rows = []

    # Iterera igenom samtliga övervakade par
    for symbol in WATCHLIST:
        logger.info(f"\n--- Analyserar {symbol} ---")

        # Kontroll 1: Har vi redan en position i paret? (Anti-Martingale)
        if has_open_position(exchange, symbol):
            summary_rows.append({
                "symbol": symbol,
                "action": "SKIPPED",
                "reason": "Redan öppen position (No averaging down)",
                "price": "-",
                "confidence": "-",
            })
            continue

        # Hämta candles med robust fallback för Bybit format
        candles = None
        symbol_candidates = [
            symbol,
            symbol.replace(":USDT", ""),
            symbol.replace("/", "").replace(":USDT", ""),
        ]

        for s_candidate in symbol_candidates:
            try:
                candles = exchange.fetch_ohlcv(s_candidate, timeframe=TIMEFRAME, limit=50)
                if candles and len(candles) >= 30:
                    break
            except Exception:
                continue

        # Direkt Bybit REST API fallback (api.bybit.nl)
        if not candles or len(candles) < 30:
            try:
                clean_sym = symbol.replace("/", "").replace(":USDT", "")
                url = f"https://api.bybit.nl/v5/market/kline?category=linear&symbol={clean_sym}&interval=15&limit=50"
                resp = requests.get(url, timeout=5).json()
                if resp.get("retCode") == 0 and resp.get("result", {}).get("list"):
                    raw_list = resp["result"]["list"]
                    raw_list.reverse()
                    candles = [
                        [
                            int(item[0]),
                            float(item[1]),
                            float(item[2]),
                            float(item[3]),
                            float(item[4]),
                            float(item[5]),
                        ]
                        for item in raw_list
                    ]
            except Exception as e:
                logger.warning(f"Bybit NL kline misslyckades för {symbol}: {e}")

        # Ultimat Binance backup för 100% driftsäkerhet vid CloudFront störning
        if not candles or len(candles) < 30:
            try:
                clean_sym = symbol.replace("/", "").replace(":USDT", "")
                binance_url = f"https://api.binance.com/api/v3/klines?symbol={clean_sym}&interval=15m&limit=50"
                b_resp = requests.get(binance_url, timeout=5).json()
                if isinstance(b_resp, list) and len(b_resp) >= 30:
                    candles = [
                        [
                            int(item[0]),
                            float(item[1]),
                            float(item[2]),
                            float(item[3]),
                            float(item[4]),
                            float(item[5]),
                        ]
                        for item in b_resp
                    ]
                    logger.info(f"Hämtade 15m ljus för {symbol} via Binance backup feed")
            except Exception as e:
                logger.error(f"Kunde inte hämta Binance backup för {symbol}: {e}")

        if not candles or len(candles) < 30:
            logger.warning(f"Otillräcklig candle-data för {symbol}. Hoppar över.")
            continue

        # 1. Teknisk analys
        tech = analyze_market_snapshot(candles)
        logger.info(
            f"Pris: {tech['current_price']} | RSI: {tech['rsi']} | ATR: {tech['atr']} | Mönster: {tech['pattern']}"
        )

        # 2. Gemini Flash AI-beslut
        decision = get_ai_decision(symbol, tech, balance)
        if not decision:
            continue

        action = decision.get("action", "HOLD")
        confidence = float(decision.get("confidence", 0.0))
        reasoning = decision.get("reasoning", "")

        logger.info(f"AI-beslut: {action} (Konfidens: {confidence*100:.1f}%) | Motivering: {reasoning}")

        if action in ("LONG", "SHORT") and confidence >= MIN_CONFIDENCE:
            # 3. Strikt 5:1 R:R & Dynamisk positionsstorlek
            entry_price = float(decision.get("entry_price") or tech["current_price"])
            stop_loss = float(decision.get("stop_loss"))

            plan = calculate_order_sizing(balance, entry_price, stop_loss, action)
            if plan:
                success = execute_trade(exchange, symbol, action, plan)
                summary_rows.append({
                    "symbol": symbol,
                    "action": f"**{action}**" if success else f"{action} (Misslyckades)",
                    "reason": reasoning,
                    "price": f"${entry_price:.4f}",
                    "confidence": f"{confidence*100:.1f}%",
                    "sl": f"${plan['stop_loss']:.4f}",
                    "tp": f"${plan['take_profit']:.4f}",
                    "rr": "5:1",
                })
            else:
                summary_rows.append({
                    "symbol": symbol,
                    "action": "AVBRÖTS",
                    "reason": "SL eller riskparametrar utanför säkerhetsgräns",
                    "price": f"${entry_price:.4f}",
                    "confidence": f"{confidence*100:.1f}%",
                })
        else:
            summary_rows.append({
                "symbol": symbol,
                "action": "HOLD",
                "reason": reasoning or "Ingen tydlig högkonfidenssignal",
                "price": f"${tech['current_price']:.4f}",
                "confidence": f"{confidence*100:.1f}%",
            })

        # Undvik att träffa börsens rate limits
        time.sleep(1)

    # ==========================================================================
    # GITHUB STEP SUMMARY RAPPORT
    # ==========================================================================
    if GITHUB_STEP_SUMMARY:
        try:
            with open(GITHUB_STEP_SUMMARY, "a") as f:
                f.write("## ⚡ ApexFlash Trading Bot - Körningsrapport\n\n")
                f.write(f"- **Tidpunkt (UTC):** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"- **Börs:** `{EXCHANGE_ID.upper()}` | **Läge:** `{'DRY RUN' if DRY_RUN else 'LIVE'}`\n")
                f.write(f"- **Aktuellt Saldo:** `${balance:.2f} USDT` | **Risk/Trade:** `{RISK_PER_TRADE_PCT}%`\n")
                f.write(f"- **Mål-Payout:** `5:1 R:R` | **AI-Modell:** `Google Gemini Flash`\n\n")

                f.write("| Symbol | Åtgärd | Pris | Stop Loss | Take Profit (5:1) | Konfidens | Analys |\n")
                f.write("|---|---|---|---|---|---|---|\n")
                for r in summary_rows:
                    sl_val = r.get("sl", "-")
                    tp_val = r.get("tp", "-")
                    f.write(
                        f"| `{r['symbol']}` | {r['action']} | {r['price']} | {sl_val} | {tp_val} | {r['confidence']} | {r['reason']} |\n"
                    )
                f.write("\n> *Regler: Inga utfyllnadspositioner/martingale. Exakt 5:1 R:R. Dynamisk positionsstorlek.*")
        except Exception as e:
            logger.warning(f"Kunde inte skriva GitHub Step Summary: {e}")

    logger.info("ApexFlash körning avslutad framgångsrikt.")


if __name__ == "__main__":
    run_bot()
