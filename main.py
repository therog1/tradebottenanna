#!/usr/bin/env python3
"""ApexFlash OKX EU — paper trading only. No exchange order methods are used."""
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
GEMINI_MODEL=os.getenv('GEMINI_MODEL','gemini-3.8-flash')
GEMINI_TIMEOUT_MS=max(5000,min(int(os.getenv('GEMINI_TIMEOUT_MS','30000')),60000))
TIMEFRAME=os.getenv('TIMEFRAME','15m')
MIN_CONFIDENCE=float(os.getenv('MIN_CONFIDENCE','0.72'))
RISK_PER_TRADE_PCT=float(os.getenv('RISK_PER_TRADE_PCT','0.8'))
PAPER_BALANCE_USDT=float(os.getenv('PAPER_BALANCE_USDT','1000'))
MAX_LEVERAGE=max(1,min(int(os.getenv('MAX_LEVERAGE','10')),10))
SYMBOLS=['BTC/USDT:USDT','ETH/USDT:USDT','SOL/USDT:USDT','AVAX/USDT:USDT','SUI/USDT:USDT']
SUMMARY_PATH=os.getenv('GITHUB_STEP_SUMMARY','')


def make_exchange():
    if EXCHANGE_ID!='okx': raise RuntimeError('Endast EXCHANGE_ID=okx stöds i denna paper-build.')
    ex=ccxt.okx({'enableRateLimit':True,'timeout':10000,'options':{'defaultType':'swap','fetchCurrencies':False}})
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


def write_summary(rows):
    if not SUMMARY_PATH: return
    with open(SUMMARY_PATH,'a',encoding='utf-8') as f:
        f.write('## ApexFlash — OKX EU paper report\n\n')
        f.write(f'- UTC: `{datetime.now(timezone.utc).isoformat()}`\n- Mode: **PAPER ONLY — NO ORDERS**\n- Paper balance assumption: `{PAPER_BALANCE_USDT:.2f} USDT`\n\n')
        f.write('| Symbol | Action | Confidence | Price | R:R | Paper status |\n|---|---|---:|---:|---:|---|\n')
        for r in rows: f.write('| {symbol} | {action} | {confidence} | {price} | {rr} | {status} |\n'.format(**r))


def main():
    log.info('='*58); log.info('APEXFLASH — OKX EU PAPER MODE'); log.info('UTC %s',datetime.now(timezone.utc).isoformat()); log.info('MODE=SIMULATION ONLY; NO ORDER METHODS ARE CALLED'); log.info('Model: %s',GEMINI_MODEL)
    ex=make_exchange(); rows=[]
    for symbol in SYMBOLS:
        try:
            m=ex.market(symbol)
            if m.get('type')!='swap': raise RuntimeError('Instrumentet är inte ett swap-kontrakt')
            candles=ex.fetch_ohlcv(symbol,timeframe=TIMEFRAME,limit=100)
            tech=analyze(candles); price=tech['current_price']
            log.info('%s price=%.8f RSI=%.2f pattern=%s',symbol,price,tech['rsi'],tech['pattern'])
            decision=ask_gemini(symbol,tech)
            paper=validate_and_size(decision,price)
            reason=str(decision.get('reasoning',''))[:240]
            log.info('%s decision=%s confidence=%.1f%% status=%s %s',symbol,paper['action'],paper['confidence']*100,paper['paper_status'],reason)
            rows.append({'symbol':symbol,'action':paper['action'],'confidence':f"{paper['confidence']:.1%}",'price':f'{price:.8f}','rr':str(paper.get('risk_reward','—')),'status':paper['paper_status']})
        except Exception as e:
            log.exception('Säkert avbrott för %s: %s',symbol,e)
            rows.append({'symbol':symbol,'action':'ERROR/HOLD','confidence':'—','price':'—','rr':'—','status':str(e)[:120]})
        time.sleep(0.5)
    write_summary(rows); log.info('Klart: %d symboler. Inga order har skickats.',len(rows)); return 0

if __name__=='__main__':
    try: sys.exit(main())
    except Exception: log.exception('Kritiskt fel; avbryter utan order.'); sys.exit(1)
