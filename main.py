#!/usr/bin/env python3
"""ApexFlash OKX EU — demo-only trading with exchange-attached SL/TP."""
import json, logging, math, os, sys, time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import ccxt
from dotenv import load_dotenv
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

load_dotenv()
logging.basicConfig(level=os.getenv('LOG_LEVEL','INFO'), format='%(asctime)s [%(levelname)s] %(message)s', handlers=[logging.StreamHandler(sys.stdout)])
log=logging.getLogger('ApexFlash')
EXCHANGE_ID=os.getenv('EXCHANGE_ID','okx').lower()
GEMINI_API_KEY=os.getenv('GEMINI_API_KEY','')
OKX_API_KEY=os.getenv('OKX_API_KEY','')
OKX_API_SECRET=os.getenv('OKX_API_SECRET','')
OKX_API_PASSPHRASE=os.getenv('OKX_API_PASSPHRASE','')
DEMO_TRADING_ENABLED=os.getenv('DEMO_TRADING_ENABLED','false').lower()=='true'
MAX_OPEN_POSITIONS=max(1,min(int(os.getenv('MAX_OPEN_POSITIONS','2')),5))
MAX_MARGIN_FRACTION=max(0.01,min(float(os.getenv('MAX_MARGIN_FRACTION','0.10')),0.25))
GEMINI_MODEL=os.getenv('GEMINI_MODEL','gemini-3.8-flash')
GEMINI_TIMEOUT_MS=max(5000,min(int(os.getenv('GEMINI_TIMEOUT_MS','30000')),60000))
TIMEFRAME=os.getenv('TIMEFRAME','15m')
MIN_CONFIDENCE=float(os.getenv('MIN_CONFIDENCE','0.72'))
RISK_PER_TRADE_PCT=float(os.getenv('RISK_PER_TRADE_PCT','0.8'))
PAPER_BALANCE_USDT=float(os.getenv('PAPER_BALANCE_USDT','1000'))
MAX_LEVERAGE=max(1,min(int(os.getenv('MAX_LEVERAGE','10')),10))
# Ten-symbol watchlist. Each symbol is checked against OKX EU markets before use.
SYMBOLS=[
    'BTC/USDT:USDT',
    'ETH/USDT:USDT',
    'SOL/USDT:USDT',
    'AVAX/USDT:USDT',
    'SUI/USDT:USDT',
    'XRP/USDT:USDT',
    'DOGE/USDT:USDT',
    'LINK/USDT:USDT',
    'ADA/USDT:USDT',
    'LTC/USDT:USDT',
]
SUMMARY_PATH=os.getenv('GITHUB_STEP_SUMMARY','')


def make_exchange(private=False):
    if EXCHANGE_ID!='okx': raise RuntimeError('Endast EXCHANGE_ID=okx stöds.')
    if private and not DEMO_TRADING_ENABLED:
        raise RuntimeError('DEMO_TRADING_ENABLED måste vara true; avbryter innan order.')
    cfg={'enableRateLimit':True,'timeout':15000,'options':{'defaultType':'swap','fetchCurrencies':False}}
    if private:
        missing=[n for n,v in [('OKX_API_KEY',OKX_API_KEY),('OKX_API_SECRET',OKX_API_SECRET),('OKX_API_PASSPHRASE',OKX_API_PASSPHRASE)] if not v]
        if missing: raise RuntimeError('Saknade GitHub Secrets: '+', '.join(missing))
        cfg.update({'apiKey':OKX_API_KEY,'secret':OKX_API_SECRET,'password':OKX_API_PASSPHRASE,'headers':{'x-simulated-trading':'1'}})
    ex=ccxt.okx(cfg)
    ex.hostname='eea.okx.com'
    markets=ex.load_markets()
    if not markets: raise RuntimeError('OKX EU returnerade inga marknader.')
    log.info('OKX EU-marknader laddade: %d',len(markets))
    return ex


def ema(values, period):
    if not values: raise ValueError('EMA saknar data')
    if len(values)<period: return float(values[-1])
    k=2/(period+1); out=sum(values[:period])/period
    for v in values[period:]: out=v*k+out*(1-k)
    return out


def rsi(values, period=14):
    if len(values)<=period: return 50.0
    changes=[b-a for a,b in zip(values[-period-1:-1],values[-period:])]
    gain=sum(max(x,0) for x in changes)/period; loss=sum(max(-x,0) for x in changes)/period
    if loss==0: return 100.0 if gain>0 else 50.0
    return 100-(100/(1+gain/loss))


def analyze(candles):
    if len(candles)<50: raise ValueError(f'Behöver minst 50 candles, fick {len(candles)}')
    closes=[float(c[4]) for c in candles]; highs=[float(c[2]) for c in candles]; lows=[float(c[3]) for c in candles]; vols=[float(c[5]) for c in candles]
    ranges=[]
    for i in range(1,len(candles)):
        prev=closes[i-1]; ranges.append(max(highs[i]-lows[i],abs(highs[i]-prev),abs(lows[i]-prev)))
    avgvol=sum(vols[-20:])/min(20,len(vols))
    e9,e21,e50=ema(closes,9),ema(closes,21),ema(closes,50); rv=rsi(closes)
    pattern='NEUTRAL'
    if closes[-1]<e21 and closes[-1]<e50 and rv<46 and closes[-1]<closes[-2]: pattern='DUMP'
    elif closes[-1]>e9 and (closes[-1]>e21 or rv<38 or closes[-1]>closes[-2]): pattern='BOUNCE'
    return {'current_price':closes[-1],'ema9':e9,'ema21':e21,'ema50':e50,'rsi':rv,'atr':sum(ranges[-14:])/len(ranges[-14:]),'support':min(lows[-30:]),'resistance':max(highs[-30:]),'pattern':pattern,'vol_surge':bool(avgvol>0 and vols[-1]>avgvol*1.3)}


def validate_and_size(decision: Dict[str,Any], price: float, balance: float=PAPER_BALANCE_USDT) -> Dict[str,Any]:
    """Validate a hypothetical idea and calculate size. This never submits orders."""
    action=str(decision.get('action','HOLD')).upper()
    conf=float(decision.get('confidence',0))
    out={'action':action,'confidence':conf,'paper_status':'NO TRADE'}
    if action not in {'LONG','SHORT','HOLD'}: raise ValueError('Ogiltig action')
    if not math.isfinite(conf) or not 0<=conf<=1: raise ValueError('Ogiltig confidence')
    if action=='HOLD' or conf<MIN_CONFIDENCE: out['action']='HOLD'; out['reason']='HOLD eller konfidens under gränsen'; return out
    entry=float(decision.get('entry_price') or price); sl=float(decision.get('stop_loss') or 0); tp=float(decision.get('take_profit') or 0)
    if not all(math.isfinite(x) and x>0 for x in (entry,sl,tp,balance)): raise ValueError('Entry/SL/TP/saldo måste vara positiva ändliga tal')
    if action=='LONG' and not sl<entry<tp: raise ValueError('LONG kräver SL < entry < TP')
    if action=='SHORT' and not tp<entry<sl: raise ValueError('SHORT kräver TP < entry < SL')
    risk=abs(entry-sl); reward=abs(tp-entry); rr=reward/risk
    if rr<4.99: raise ValueError(f'Risk/reward {rr:.2f}:1 understiger 5:1')
    risk_amount=balance*RISK_PER_TRADE_PCT/100
    qty=risk_amount/risk
    notional=qty*entry
    leverage=math.ceil(notional/balance) if balance>0 else MAX_LEVERAGE
    if leverage>MAX_LEVERAGE: 
        # Size is reduced so nominal exposure cannot exceed the configured leverage cap.
        qty=(balance*MAX_LEVERAGE)/entry
        risk_amount=qty*risk
        notional=qty*entry
        leverage=MAX_LEVERAGE
    out.update({'entry':entry,'stop_loss':sl,'take_profit':tp,'risk_reward':round(rr,2),'paper_risk_usdt':round(risk_amount,4),'quantity':qty,'notional_usdt':round(notional,4),'estimated_leverage':leverage,'paper_status':'PAPER IDEA ONLY — NO ORDER'})
    return out


def ask_gemini(symbol, tech):
    if not GEMINI_API_KEY: raise RuntimeError('GEMINI_API_KEY saknas')
    if genai is None or types is None: raise RuntimeError('google-genai SDK saknas')
    prompt=(f'Analysera {symbol} för paper trading. Data: {json.dumps(tech)}. Returnera endast JSON med action (LONG/SHORT/HOLD), confidence (0..1), reasoning, entry_price, stop_loss, take_profit. '
            'Använd LONG bara vid tydlig studs/stöd, SHORT bara vid tydlig svaghet. För LONG måste stop_loss < entry_price < take_profit; för SHORT take_profit < entry_price < stop_loss. '
            'Reward/risk måste vara minst 5:1. Om data inte motiverar en giltig setup, svara HOLD. Ingen order ska läggas.')
    client=genai.Client(api_key=GEMINI_API_KEY,http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS))
    log.info('Gemini START %s | model=%s | timeout=%ss',symbol,GEMINI_MODEL,GEMINI_TIMEOUT_MS/1000)
    response=client.models.generate_content(model=GEMINI_MODEL,contents=prompt,config=types.GenerateContentConfig(response_mime_type='application/json',temperature=0.1))
    if not getattr(response,'text',None): raise RuntimeError('Gemini returnerade tomt svar')
    parsed=json.loads(response.text)
    if not isinstance(parsed,dict): raise ValueError('Gemini-svaret är inte ett JSON-objekt')
    log.info('Gemini KLART %s',symbol)
    return parsed


def submit_demo_order(ex, symbol, decision, tech, equity):
    """Submit one OKX EEA simulated swap order with exchange-attached SL/TP."""
    if not DEMO_TRADING_ENABLED:
        raise RuntimeError('Demo trading is not enabled; refusing to submit an order.')
    action=str(decision.get('action','HOLD')).upper()
    confidence=float(decision.get('confidence',0))
    if action not in ('LONG','SHORT') or confidence < MIN_CONFIDENCE:
        return {'status':'NO ORDER: HOLD/low confidence'}
    ticker=ex.fetch_ticker(symbol); entry=float(ticker['last'])
    sl=float(decision.get('stop_loss') or 0); tp=float(decision.get('take_profit') or 0)
    if not all(math.isfinite(x) and x>0 for x in (entry,sl,tp,equity)):
        raise ValueError('Ogiltiga entry/SL/TP/saldovärden; ingen order.')
    if action=='LONG' and not sl < entry < tp: raise ValueError('LONG kräver SL < aktuell entry < TP')
    if action=='SHORT' and not tp < entry < sl: raise ValueError('SHORT kräver TP < aktuell entry < SL')
    risk_distance=abs(entry-sl); rr=abs(tp-entry)/risk_distance
    if rr < 4.99: raise ValueError(f'Risk/reward {rr:.2f}:1 understiger 5:1')
    market=ex.market(symbol)
    contract_size=float(market.get('contractSize') or 1.0)
    # Limit exposure to 10% of equity at 2x max notional; risk cap is 0.25% equity.
    risk_usdt=equity*0.0025
    base_qty=min(risk_usdt/risk_distance, (equity*MAX_MARGIN_FRACTION*2)/entry)
    contracts=float(ex.amount_to_precision(symbol, base_qty/contract_size))
    min_amount=(market.get('limits',{}).get('amount',{}) or {}).get('min')
    if contracts<=0 or (min_amount is not None and contracts<float(min_amount)):
        raise ValueError(f'Beräknad orderstorlek {contracts} understiger kontraktets minsta storlek {min_amount}')
    side='buy' if action=='LONG' else 'sell'
    slp=float(ex.price_to_precision(symbol,sl)); tpp=float(ex.price_to_precision(symbol,tp))
    params={
        'tdMode':'isolated',
        'posSide':'net',
        'attachAlgoOrds':[{'tpTriggerPx':str(tpp),'tpOrdPx':'-1','tpTriggerPxType':'last','slTriggerPx':str(slp),'slOrdPx':'-1','slTriggerPxType':'last'}],
    }
    log.info('DEMO ORDER PREPARED %s %s contracts=%s entry≈%s SL=%s TP=%s RR=%.2f',symbol,action,contracts,entry,slp,tpp,rr)
    order=ex.create_order(symbol,'market',side,contracts,None,params)
    oid=order.get('id')
    if not oid: raise RuntimeError('OKX svarade utan order-ID; kontrollera demo-kontot innan ny körning.')
    # Confirm status from exchange; do not submit a duplicate if fetch fails.
    time.sleep(1.0)
    try: confirmed=ex.fetch_order(oid,symbol)
    except Exception as exc: confirmed={'status':'UNKNOWN','confirmation_error':type(exc).__name__}
    log.info('DEMO ORDER ACK %s id=%s status=%s',symbol,oid,confirmed.get('status','unknown'))
    return {'status':'DEMO ORDER SENT','id':oid,'order_status':confirmed.get('status','unknown'),'contracts':contracts,'entry':entry,'sl':slp,'tp':tpp,'rr':round(rr,2)}


def count_open_positions(ex):
    positions=ex.fetch_positions()
    return sum(1 for p in positions if abs(float(p.get('contracts') or 0))>0)


def write_summary(rows):
    if not SUMMARY_PATH: return
    with open(SUMMARY_PATH,'a',encoding='utf-8') as f:
        f.write('## ApexFlash — OKX EU paper report\n\n')
        f.write(f'- UTC: `{datetime.now(timezone.utc).isoformat()}`\n- Mode: **OKX EU DEMO ONLY**; order execution enabled: `{DEMO_TRADING_ENABLED}`\n- Sizing reference: `{PAPER_BALANCE_USDT:.2f} USDT`\n\n')
        f.write('| Symbol | Action | Confidence | Price | R:R | Paper status |\n|---|---|---:|---:|---:|---|\n')
        for r in rows: f.write('| {symbol} | {action} | {confidence} | {price} | {rr} | {status} |\n'.format(**r))


def main():
    log.info('='*58); log.info('APEXFLASH — OKX EU DEMO TRADING'); log.info('UTC %s',datetime.now(timezone.utc).isoformat())
    log.info('Demo order execution enabled=%s; endpoint=eea.okx.com; simulated header required',DEMO_TRADING_ENABLED)
    ex=make_exchange(private=DEMO_TRADING_ENABLED)
    equity=PAPER_BALANCE_USDT
    if DEMO_TRADING_ENABLED:
        balance=ex.fetch_balance()
        equity=float((balance.get('USDT') or {}).get('total') or 0)
        if equity<=0: raise RuntimeError('Inget positivt USDT-saldo hittades på demo-kontot; avbryter.')
        log.info('OKX EU DEMO USDT total=%s',equity)

    # PHASE 1: collect valid market data and obtain a valid Gemini response for EVERY
    # symbol before allowing any order. A single error aborts the entire run.
    prepared=[]
    log.info('FAS 1/2: Gemini måste svara giltigt på samtliga %d symboler innan order tillåts.',len(SYMBOLS))
    for index, symbol in enumerate(SYMBOLS):
        try:
            m=ex.market(symbol)
            if m.get('type')!='swap' or not m.get('active',True):
                raise RuntimeError(f'{symbol}: inte ett aktivt swap-instrument')
            candles=ex.fetch_ohlcv(symbol,timeframe=TIMEFRAME,limit=100)
            tech=analyze(candles)
            log.info('%s price=%.8f RSI=%.2f pattern=%s',symbol,tech['current_price'],tech['rsi'],tech['pattern'])
            decision=ask_gemini(symbol,tech)
            # Validate the complete response now; malformed output also aborts all trading.
            paper=validate_and_size(decision,tech['current_price'],equity)
            prepared.append({'symbol':symbol,'tech':tech,'decision':decision,'paper':paper})
            log.info('GEMINI PREFLIGHT OK %d/%d: %s action=%s confidence=%.1f%%',index+1,len(SYMBOLS),symbol,paper['action'],paper['confidence']*100)
        except Exception as e:
            log.exception('GEMINI/MARKNADS-PREFLIGHT MISSLYCKADES för %s. STOPPAR HELA KÖRNINGEN; INGA ORDER KOMMER ATT SKICKAS: %s',symbol,e)
            raise RuntimeError(f'Preflight avbruten vid {symbol}; alla {len(SYMBOLS)} symboler måste ha giltig Gemini-analys. Inga order skickades.') from e
        # Gemini free-tier is commonly rate-limited; pace requests instead of bursting.
        if index < len(SYMBOLS)-1:
            time.sleep(max(0.0,float(os.getenv('GEMINI_CALL_INTERVAL_SECONDS','12'))))

    if len(prepared)!=len(SYMBOLS):
        raise RuntimeError(f'Preflight ofullständig ({len(prepared)}/{len(SYMBOLS)}); inga order skickas.')
    log.info('GEMINI PREFLIGHT GODKÄND: %d/%d svar giltiga. Först nu får orderfasen starta.',len(prepared),len(SYMBOLS))

    # PHASE 2: only after all ten valid AI responses have been received.
    rows=[]
    for item in prepared:
        symbol=item['symbol']; tech=item['tech']; decision=item['decision']; paper=item['paper']
        action=paper['action']; status='NO TRADE'
        try:
            if DEMO_TRADING_ENABLED and action in ('LONG','SHORT'):
                current=ex.fetch_positions([symbol])
                if any(abs(float(p.get('contracts') or 0))>0 for p in current):
                    status='SKIP: position already open'
                elif count_open_positions(ex)>=MAX_OPEN_POSITIONS:
                    status='SKIP: max open positions reached'
                else:
                    result=submit_demo_order(ex,symbol,decision,tech,equity)
                    status=result['status'] + (' '+str(result.get('id','')))
            elif action in ('LONG','SHORT'):
                status='SIGNAL ONLY; DEMO_TRADING_ENABLED=false'
            reason=str(decision.get('reasoning',''))[:180]
            log.info('%s decision=%s conf=%.1f%% result=%s %s',symbol,action,paper['confidence']*100,status,reason)
            rows.append({'symbol':symbol,'action':action,'confidence':f"{paper['confidence']:.1%}",'price':f'{tech["current_price"]:.8f}','rr':str(paper.get('risk_reward','—')),'status':status})
        except Exception as e:
            # Order-phase errors stop immediately; never proceed to later symbols after uncertainty.
            log.exception('ORDERFEL för %s; stoppar orderfasen för att undvika fler order: %s',symbol,e)
            rows.append({'symbol':symbol,'action':action,'confidence':f"{paper['confidence']:.1%}",'price':f'{tech["current_price"]:.8f}','rr':str(paper.get('risk_reward','—')),'status':'ORDER ERROR — STOPPED'})
            write_summary(rows)
            raise RuntimeError(f'Orderfas stoppad efter fel på {symbol}. Kontrollera OKX demo-positioner och order innan ny körning.') from e
        time.sleep(1.0)
    write_summary(rows); log.info('Klart: %d symboler; alla %d Gemini-svar godkändes före orderfasen.',len(rows),len(SYMBOLS)); return 0

if __name__=='__main__':
    try: sys.exit(main())
    except Exception: log.exception('Kritiskt fel; avbryter utan order.'); sys.exit(1)
