#!/usr/bin/env python3
"""TradebottenAnna — rule-based OKX EU demo trader. No AI/API model calls."""
import logging, math, os, sys, time, json
from datetime import datetime, timezone
import ccxt
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=os.getenv('LOG_LEVEL','INFO'), format='%(asctime)s [%(levelname)s] %(message)s', handlers=[logging.StreamHandler(sys.stdout)])
log=logging.getLogger('TradebottenAnna')
EXCHANGE_ID=os.getenv('EXCHANGE_ID','okx').lower()
OKX_API_KEY=os.getenv('OKX_API_KEY','')
OKX_API_SECRET=os.getenv('OKX_API_SECRET','')
OKX_API_PASSPHRASE=os.getenv('OKX_API_PASSPHRASE','')
DEMO_TRADING_ENABLED=os.getenv('DEMO_TRADING_ENABLED','false').lower()=='true'
DEFAULTS={'max_open_positions':2,'max_margin_fraction':0.10,'timeframe':'15m','risk_per_trade_pct':0.25,'max_leverage':2,'min_score':4,'atr_stop_multiple':1.5,'atr_target_multiple':3.0}
try:
    with open(os.path.join(os.path.dirname(__file__),'strategy.json'),encoding='utf-8') as _f: STRATEGY={**DEFAULTS,**json.load(_f)}
except (OSError, ValueError): STRATEGY=DEFAULTS.copy()
MAX_OPEN_POSITIONS=max(1,min(int(STRATEGY['max_open_positions']),5))
MAX_MARGIN_FRACTION=max(0.01,min(float(STRATEGY['max_margin_fraction']),0.25))
TIMEFRAME=str(STRATEGY['timeframe'])
RISK_PER_TRADE_PCT=max(0.05,min(float(STRATEGY['risk_per_trade_pct']),0.5))
MAX_LEVERAGE=max(1,min(int(STRATEGY['max_leverage']),3))
MIN_SCORE=max(3,min(int(STRATEGY['min_score']),5))
SYMBOLS=['BTC/USDT:USDT','ETH/USDT:USDT','SOL/USDT:USDT','AVAX/USDT:USDT','SUI/USDT:USDT','XRP/USDT:USDT','DOGE/USDT:USDT','LINK/USDT:USDT','ADA/USDT:USDT','LTC/USDT:USDT']
SUMMARY_PATH=os.getenv('GITHUB_STEP_SUMMARY','')

def make_exchange(private=False):
    if EXCHANGE_ID!='okx': raise RuntimeError('Endast EXCHANGE_ID=okx stöds.')
    if private and not DEMO_TRADING_ENABLED: raise RuntimeError('Demo-order kräver DEMO_TRADING_ENABLED=true.')
    cfg={'enableRateLimit':True,'timeout':20000,'options':{'defaultType':'swap','fetchCurrencies':False}}
    if private:
        missing=[n for n,v in [('OKX_API_KEY',OKX_API_KEY),('OKX_API_SECRET',OKX_API_SECRET),('OKX_API_PASSPHRASE',OKX_API_PASSPHRASE)] if not v]
        if missing: raise RuntimeError('Saknade GitHub Secrets: '+', '.join(missing))
        cfg.update({'apiKey':OKX_API_KEY,'secret':OKX_API_SECRET,'password':OKX_API_PASSPHRASE,'headers':{'x-simulated-trading':'1'}})
    ex=ccxt.okx(cfg); ex.hostname='eea.okx.com'
    markets=ex.load_markets()
    if not markets: raise RuntimeError('OKX EU returnerade inga marknader.')
    log.info('OKX EU-marknader laddade: %d',len(markets))
    return ex

def ema(values, period):
    if len(values)<period: raise ValueError(f'För få datapunkter för EMA{period}')
    k=2/(period+1); out=sum(values[:period])/period
    for v in values[period:]: out=v*k+out*(1-k)
    return out

def rsi(values, period=14):
    if len(values)<=period: return 50.0
    diffs=[b-a for a,b in zip(values[-period-1:-1],values[-period:])]
    gains=sum(max(x,0) for x in diffs)/period; losses=sum(max(-x,0) for x in diffs)/period
    if losses==0: return 100.0 if gains>0 else 50.0
    return 100-(100/(1+gains/losses))

def analyze(candles):
    if len(candles)<60: raise ValueError(f'Behöver minst 60 candles, fick {len(candles)}')
    closes=[float(c[4]) for c in candles]; highs=[float(c[2]) for c in candles]; lows=[float(c[3]) for c in candles]; vols=[float(c[5]) for c in candles]
    ranges=[]
    for i in range(1,len(candles)):
        prev=closes[i-1]; ranges.append(max(highs[i]-lows[i],abs(highs[i]-prev),abs(lows[i]-prev)))
    atr=sum(ranges[-14:])/14; e9,e21,e50=ema(closes,9),ema(closes,21),ema(closes,50); rv=rsi(closes)
    avgvol=sum(vols[-20:])/20; vol_ok=avgvol>0 and vols[-1]>=avgvol*0.8
    # Transparent 5-point score. No AI, paid model, news feed or external signal service.
    long_checks=[e9>e21,e21>e50,closes[-1]>e9,50<=rv<=68,vol_ok]
    short_checks=[e9<e21,e21<e50,closes[-1]<e9,32<=rv<=50,vol_ok]
    long_score=sum(long_checks); short_score=sum(short_checks)
    action='HOLD'; score=max(long_score,short_score)
    if long_score>=MIN_SCORE and long_score>short_score: action='LONG'; score=long_score
    elif short_score>=MIN_SCORE and short_score>long_score: action='SHORT'; score=short_score
    price=closes[-1]
    if action=='LONG': sl=price-float(STRATEGY['atr_stop_multiple'])*atr; tp=price+float(STRATEGY['atr_target_multiple'])*atr
    elif action=='SHORT': sl=price+float(STRATEGY['atr_stop_multiple'])*atr; tp=price-float(STRATEGY['atr_target_multiple'])*atr
    else: sl=tp=None
    return {'price':price,'ema9':e9,'ema21':e21,'ema50':e50,'rsi':rv,'atr':atr,'volume_ok':vol_ok,'long_score':long_score,'short_score':short_score,'action':action,'score':score,'stop_loss':sl,'take_profit':tp,'reason':f'long={long_score}/5 short={short_score}/5 RSI={rv:.1f} volume_ok={vol_ok}'}

def count_open_positions(ex):
    positions=ex.fetch_positions()
    return sum(1 for p in positions if abs(float(p.get('contracts') or 0))>0)

def submit_demo_order(ex,symbol,signal,equity):
    if not DEMO_TRADING_ENABLED: raise RuntimeError('Demo trading is disabled; refusing order.')
    action=signal['action']; entry=float(ex.fetch_ticker(symbol)['last']); sl=float(signal['stop_loss']); tp=float(signal['take_profit'])
    if action=='LONG' and not sl<entry<tp: raise ValueError('Pris hann röra sig: ogiltig LONG SL/TP, ingen order')
    if action=='SHORT' and not tp<entry<sl: raise ValueError('Pris hann röra sig: ogiltig SHORT SL/TP, ingen order')
    risk_distance=abs(entry-sl); risk_usdt=equity*RISK_PER_TRADE_PCT/100
    qty=min(risk_usdt/risk_distance,(equity*MAX_MARGIN_FRACTION*MAX_LEVERAGE)/entry)
    market=ex.market(symbol); contract_size=float(market.get('contractSize') or 1)
    contracts=float(ex.amount_to_precision(symbol,qty/contract_size))
    min_amount=(market.get('limits',{}).get('amount',{}) or {}).get('min')
    if contracts<=0 or (min_amount is not None and contracts<float(min_amount)):
        raise ValueError(f'Orderstorlek {contracts} understiger minsta kontrakt {min_amount}; ingen order')
    slp=float(ex.price_to_precision(symbol,sl)); tpp=float(ex.price_to_precision(symbol,tp))
    params={'tdMode':'isolated','posSide':'net','attachAlgoOrds':[{'tpTriggerPx':str(tpp),'tpOrdPx':'-1','tpTriggerPxType':'last','slTriggerPx':str(slp),'slOrdPx':'-1','slTriggerPxType':'last'}]}
    side='buy' if action=='LONG' else 'sell'
    log.info('DEMO ORDER %s %s contracts=%s entry≈%s SL=%s TP=%s score=%s/5',symbol,action,contracts,entry,slp,tpp,signal['score'])
    order=ex.create_order(symbol,'market',side,contracts,None,params)
    if not order.get('id'): raise RuntimeError('OKX gav inget order-ID. Kontrollera demo-kontot innan ny körning.')
    return {'status':'DEMO ORDER SENT','id':order['id'],'contracts':contracts,'entry':entry,'sl':slp,'tp':tpp}

def write_summary(rows,equity):
    if not SUMMARY_PATH: return
    with open(SUMMARY_PATH,'a',encoding='utf-8') as f:
        f.write('## TradebottenAnna — regelbaserad OKX EU DEMO-rapport\n\n')
        f.write(f'- UTC: `{datetime.now(timezone.utc).isoformat()}`\n- AI-anrop: **0**\n- Handel: **OKX EU DEMO ONLY**; order enabled: `{DEMO_TRADING_ENABLED}`\n- Equity (USDT): `{equity:.4f}`\n\n')
        f.write('| Symbol | Signal | Score | Pris | RSI | Resultat |\n|---|---|---:|---:|---:|---|\n')
        for r in rows: f.write(f"| {r['symbol']} | {r['action']} | {r['score']}/5 | {r['price']:.8f} | {r['rsi']:.1f} | {r['status']} |\n")

def main():
    log.info('='*58); log.info('TRADEBOTTENANNA — RULE-BASED OKX EU DEMO TRADER'); log.info('UTC %s',datetime.now(timezone.utc).isoformat())
    log.info('AI calls=0 | endpoint=eea.okx.com | simulated-trading header required | demo enabled=%s',DEMO_TRADING_ENABLED)
    ex=make_exchange(private=DEMO_TRADING_ENABLED); equity=1000.0
    if DEMO_TRADING_ENABLED:
        bal=ex.fetch_balance(); equity=float((bal.get('USDT') or {}).get('total') or 0)
        if equity<=0: raise RuntimeError('Inget positivt USDT-saldo på OKX EU demo; avbryter.')
        log.info('OKX EU DEMO USDT total=%.4f',equity)
    prepared=[]
    # Fetch and analyze all symbols before the order phase. Market-data failure means no orders.
    for symbol in SYMBOLS:
        market=ex.market(symbol)
        if market.get('type')!='swap' or not market.get('active',True):
            log.warning('%s hoppad över: ej aktivt swap-instrument',symbol); continue
        candles=ex.fetch_ohlcv(symbol,timeframe=TIMEFRAME,limit=100)
        sig=analyze(candles)
        log.info('%s action=%s score=%d/5 long=%d short=%d price=%.8f RSI=%.1f ATR=%.8f | %s',symbol,sig['action'],sig['score'],sig['long_score'],sig['short_score'],sig['price'],sig['rsi'],sig['atr'],sig['reason'])
        prepared.append({'symbol':symbol,'signal':sig})
    if not prepared: raise RuntimeError('Inga marknader analyserades; inga order skickas.')
    rows=[]
    for item in prepared:
        symbol=item['symbol']; sig=item['signal']; status='HOLD / no qualifying signal'
        if sig['action'] in ('LONG','SHORT'):
            if not DEMO_TRADING_ENABLED: status='SIGNAL ONLY; demo execution disabled'
            else:
                try:
                    existing=ex.fetch_positions([symbol])
                    if any(abs(float(p.get('contracts') or 0))>0 for p in existing): status='SKIP: position already open'
                    elif count_open_positions(ex)>=MAX_OPEN_POSITIONS: status='SKIP: max open positions reached'
                    else: status=submit_demo_order(ex,symbol,sig,equity)['status']
                except Exception as exc:
                    log.exception('Orderfas stoppad efter fel på %s; inga fler order skickas.',symbol)
                    rows.append({'symbol':symbol,'action':sig['action'],'score':sig['score'],'price':sig['price'],'rsi':sig['rsi'],'status':'ERROR — STOPPED'})
                    write_summary(rows,equity)
                    raise RuntimeError(f'Orderfas stoppad vid {symbol}. Kontrollera OKX EU demo-positioner innan ny körning.') from exc
        rows.append({'symbol':symbol,'action':sig['action'],'score':sig['score'],'price':sig['price'],'rsi':sig['rsi'],'status':status})
        time.sleep(0.25)
    write_summary(rows,equity)
    log.info('Klart. Analyserade %d marknader med 0 AI-anrop. Orderfasen kördes i demo=%s.',len(rows),DEMO_TRADING_ENABLED)
    return 0

if __name__=='__main__':
    try: sys.exit(main())
    except Exception: log.exception('Kritiskt fel; avbryter.'); sys.exit(1)
