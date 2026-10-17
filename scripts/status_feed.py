#!/usr/bin/env python3
"""Read-only OKX status feed för dashboarden.

- Gör ENDAST GET-anrop: account/balance, account/positions, account/positions-history
  (realiserad PnL), trade/orders-pending, trade/orders-algo-pending (SL/TP-kontroll)
  och trade/fills (senaste 20).
- Inga order-/trade-skrivande endpoints, inga AI-anrop.
- Utdata byggs ENBART från en allowlist av fält. Aldrig headers, signaturer, nycklar,
  passphrases eller råa svar. Felmeddelanden kortas och rensas.
- Nycklar läses från env (FEED_KEY/FEED_SECRET/FEED_PASS) och skrivs aldrig ut.
"""
import argparse, time, base64, datetime as dt, hashlib, hmac, json, os, re, sys, urllib.error, urllib.request

BASE = "https://eea.okx.com"
ALLOWED_GET = {
    "/api/v5/account/balance",
    "/api/v5/account/positions",
    "/api/v5/trade/orders-pending",
    "/api/v5/trade/orders-algo-pending?ordType=conditional",
    "/api/v5/trade/orders-algo-pending?ordType=oco",
    "/api/v5/trade/orders-algo-pending?ordType=move_order_stop",
    "/api/v5/trade/fills?limit=20",
    "/api/v5/trade/orders-history?instType=SPOT&limit=20",
    "/api/v5/trade/orders-history?instType=FUTURES&limit=20",
    "/api/v5/trade/orders-history?instType=SWAP&limit=20",
}
# positions-history med valfri after-paginering (uTime ms)
POS_HIST_PATH = re.compile(
    r"^/api/v5/account/positions-history\?instType=FUTURES&limit=100(&after=\d{1,20})?$"
)
HIST_FIELDS = ["instType", "instId", "ordType", "side", "sz", "accFillSz", "avgPx", "state", "cTime", "uTime"]
BAL_FIELDS = ["ccy", "eq", "eqUsd", "availBal", "availEq", "upl"]
POS_FIELDS = ["instId", "instType", "mgnMode", "posSide", "pos", "avgPx", "markPx", "upl", "uplRatio",
              "lever", "liqPx", "margin", "cTime", "uTime", "product", "is_perp", "ctVal", "ctValCcy"]


def classify(inst_id, inst_type):
    """X-Perp = OKX USD-M 'perpetual-style' future (instFamily *_XPERP, alias this_five_years,
    futureSettlement=false). Verifierat mot /public/instruments 2026-10-14."""
    iid = str(inst_id or "")
    if "_XPERP" in iid:
        return "X-Perp", True
    if inst_type == "SWAP":
        return "Perp", True
    if inst_type == "FUTURES":
        return "Future", False
    return str(inst_type or "okänt"), False


def with_product(p):
    prod, perp = classify(p.get("instId"), p.get("instType"))
    return {**p, "product": prod, "is_perp": perp}
ORD_FIELDS = ["instType", "instId", "ordType", "side", "sz", "px", "state", "accFillSz", "cTime"]
ALGO_FIELDS = ["instId", "ordType", "side", "sz", "slTriggerPx", "tpTriggerPx", "state", "cTime"]
FILL_FIELDS = ["instId", "side", "fillPx", "fillSz", "fee", "feeCcy", "execType", "ts"]
# Stängda positioner (positions-history) för dashboardens historikflik
CLOSED_FIELDS = ["instId", "instType", "mgnMode", "type", "posSide", "direction", "lever", "openAvgPx",
                 "closeAvgPx", "openMaxPos", "closeTotalPos", "realizedPnl", "pnl", "pnlRatio", "fee",
                 "fundingFee", "cTime", "uTime"]
CLOSED_MAX = 50
NUMERIC = set("eq eqUsd availBal availEq upl pos avgPx markPx uplRatio lever liqPx margin sz px accFillSz "
              "ctVal slTriggerPx tpTriggerPx fillPx fillSz fee totalEq cTime uTime ts "
              "realized_pnl realized_pnl_today realizedPnl openAvgPx closeAvgPx openMaxPos closeTotalPos pnl pnlRatio "
              "fundingFee".split())
STRINGY = re.compile(r"^[A-Za-z0-9_\-\.]{0,40}$")


def _val(k, v):
    if isinstance(v, bool):
        return v
    if v in (None, ""):
        return None
    if k in NUMERIC:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None
    v = str(v)
    return v if STRINGY.match(v) else None  # bara korta, enkla tokens (instId, side, state, ccy ...)


def pick(obj, fields):
    return {k: _val(k, obj.get(k)) for k in fields if isinstance(obj, dict)}


def clean_err(code, msg):
    msg = re.sub(r"[^A-Za-z0-9 .,:;()\-_/%]", "", str(msg or ""))[:120]
    return {"code": re.sub(r"[^0-9A-Za-z\-]", "", str(code))[:12], "msg": msg}


RETRYABLE = {"-1", "429", "500", "502", "503", "504", "50001", "50004", "50011", "50013"}


def okx_get(path, key, secret, passphrase, tries=3):
    """GET med retry + exponentiell backoff (1s, 2s) vid nätverksfel/rate limit/5xx."""
    r = {}
    for i in range(tries):
        r = _okx_get_once(path, key, secret, passphrase)
        if str(r.get("code")) == "0" or str(r.get("code")) not in RETRYABLE:
            return r
        if i < tries - 1:
            time.sleep(2 ** i)
    return r


def _okx_get_once(path, key, secret, passphrase):
    assert path in ALLOWED_GET or POS_HIST_PATH.match(path), "endast tillåtna GET-anrop"
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    sign = base64.b64encode(hmac.new(secret.encode(), (ts + "GET" + path).encode(), hashlib.sha256).digest()).decode()
    req = urllib.request.Request(BASE + path, method="GET", headers={
        "OK-ACCESS-KEY": key, "OK-ACCESS-SIGN": sign, "OK-ACCESS-TIMESTAMP": ts,
        "OK-ACCESS-PASSPHRASE": passphrase, "User-Agent": "tradebot-status-feed/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:  # OKX felkod/meddelande ur svaret (bara code+msg används, saneras i clean_err)
            body = json.loads(e.read().decode() or "{}")
            return {"code": str(body.get("code") or e.code), "msg": f"HTTP {e.code} {body.get('msg', '')}", "data": []}
        except Exception:
            return {"code": str(e.code), "msg": f"HTTP {e.code}", "data": []}
    except Exception as e:  # nätverk/timeout
        return {"code": "-1", "msg": type(e).__name__, "data": []}


PUBLIC_INST = re.compile(r"^/api/v5/public/instruments\?instType=(FUTURES|SWAP)&instId=[A-Z0-9_\-]{3,40}$")


def public_ct_val(inst_id, inst_type):
    """Publik, osignerad GET av kontraktsstorlek (ctVal). Inga nycklar skickas."""
    if inst_type not in ("FUTURES", "SWAP"):
        return None, None
    path = f"/api/v5/public/instruments?instType={inst_type}&instId={inst_id}"
    if not PUBLIC_INST.match(path):
        return None, None
    try:
        req = urllib.request.Request(BASE + path, method="GET", headers={"User-Agent": "tradebot-status-feed/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            d = (json.loads(r.read().decode()).get("data") or [{}])[0]
        return _val("ctVal", d.get("ctVal")), _val("ctValCcy", d.get("ctValCcy"))
    except Exception:
        return None, None


def with_ct_val(positions):
    cache = {}
    for p in positions:
        k = (p.get("instId"), p.get("instType"))
        if k not in cache:
            cache[k] = public_ct_val(*k)
        p["ctVal"], p["ctValCcy"] = cache[k]
    return positions



STOCKHOLM = dt.timezone(dt.timedelta(hours=2), name="Europe/Stockholm")  # fallback; se ZoneInfo nedan
try:
    from zoneinfo import ZoneInfo
    STOCKHOLM = ZoneInfo("Europe/Stockholm")
except Exception:  # pragma: no cover
    pass


def sum_realized_pnl(rows, now=None):
    """Summerar realizedPnl. Returnerar (today, total) där today = Europe/Stockholm-dagen.

    rows: listor med OKX positions-history-rader (realizedPnl, uTime i ms).
    Saknad/ogiltig realizedPnl räknas som 0. now: datetime (aware) för tester.
    """
    now = now or dt.datetime.now(STOCKHOLM)
    if now.tzinfo is None:
        now = now.replace(tzinfo=STOCKHOLM)
    else:
        now = now.astimezone(STOCKHOLM)
    day0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day0_ms = int(day0.timestamp() * 1000)
    total = 0.0
    today = 0.0
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        try:
            pnl = float(r.get("realizedPnl") if r.get("realizedPnl") not in (None, "") else 0)
        except (TypeError, ValueError):
            pnl = 0.0
        total += pnl
        try:
            ut = float(r.get("uTime") or 0)
        except (TypeError, ValueError):
            ut = 0.0
        if ut >= day0_ms:
            today += pnl
    return round(today, 2), round(total, 2)


def closed_positions(rows, limit=CLOSED_MAX):
    """Senaste stängda positionerna (nyast först), via samma allowlist som övriga fält."""
    out = [pick(with_product(r), CLOSED_FIELDS + ["product"]) for r in rows or [] if isinstance(r, dict)]
    out.sort(key=lambda r: r.get("uTime") or 0, reverse=True)
    return out[:limit]


def fetch_positions_history(call, pages=3, limit=100):
    """GET positions-history FUTURES, upp till `pages` sidor à `limit` (max 100)."""
    rows, after = [], None
    for _ in range(max(1, pages)):
        q = f"/api/v5/account/positions-history?instType=FUTURES&limit={limit}"
        if after is not None:
            q += f"&after={after}"
        batch = call("positions_history", q)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < limit:
            break
        # older page: after = oldest uTime in this batch
        utimes = []
        for b in batch:
            try:
                utimes.append(int(float(b.get("uTime"))))
            except (TypeError, ValueError):
                pass
        if not utimes:
            break
        after = min(utimes)
    return rows


def fetch_account(name):
    key, secret, pw = (os.environ.get(v, "") for v in ("FEED_KEY", "FEED_SECRET", "FEED_PASS"))
    acc = {"account": name, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "ok": False, "errors": {}, "totalEqUsd": None, "balances": [], "positions": [],
           "open_orders": [], "algo_orders": [], "recent_fills": [], "recent_orders": [], "last_order_at": None,
           "realized_pnl": None, "realized_pnl_today": None, "closed_positions": []}
    if not (key and secret and pw):
        acc["errors"]["credentials"] = {"code": "MISSING", "msg": "secrets saknas i workflowet"}
        return acc

    def call(label, path):
        r = okx_get(path, key, secret, pw)
        if str(r.get("code")) != "0":
            acc["errors"][label] = clean_err(r.get("code"), r.get("msg"))
            return []
        return r.get("data") or []

    bal = call("balance", "/api/v5/account/balance")
    if bal:
        acc["totalEqUsd"] = _val("totalEq", bal[0].get("totalEq"))
        acc["balances"] = [pick(d, BAL_FIELDS) for d in bal[0].get("details", [])
                           if _val("eq", d.get("eq")) not in (None, 0.0)]
    acc["positions"] = [pick(with_product(p), POS_FIELDS) for p in call("positions", "/api/v5/account/positions")
                        if _val("pos", p.get("pos")) not in (None, 0.0)]
    with_ct_val(acc["positions"])
    acc["open_orders"] = [pick(o, ORD_FIELDS) for o in call("orders_pending", "/api/v5/trade/orders-pending")]
    algos = call("algo_conditional", "/api/v5/trade/orders-algo-pending?ordType=conditional") + \
        call("algo_oco", "/api/v5/trade/orders-algo-pending?ordType=oco") + \
        call("algo_trail", "/api/v5/trade/orders-algo-pending?ordType=move_order_stop")
    acc["algo_orders"] = [pick(a, ALGO_FIELDS) for a in algos]
    acc["recent_fills"] = [pick(f, FILL_FIELDS) for f in call("fills", "/api/v5/trade/fills?limit=20")][:20]
    hist = []
    for it in ("SPOT", "FUTURES", "SWAP"):
        hist += call(f"orders_history_{it.lower()}", f"/api/v5/trade/orders-history?instType={it}&limit=20")
    hist = [pick(o, HIST_FIELDS) for o in hist]
    hist.sort(key=lambda o: o.get("cTime") or 0, reverse=True)
    acc["recent_orders"] = hist[:20]
    times = [o.get("cTime") for o in hist + acc["open_orders"] if o.get("cTime")]
    acc["last_order_at"] = dt.datetime.fromtimestamp(max(times) / 1000, dt.timezone.utc).isoformat(timespec="seconds") if times else None
    # Realiserad PnL (frontend-fält: realized_pnl) — idag (Europe/Stockholm) + totalt ur history
    hist_rows = fetch_positions_history(call, pages=3, limit=100)
    if hist_rows or "positions_history" not in acc["errors"]:
        today, total = sum_realized_pnl(hist_rows)
        acc["realized_pnl_today"] = today
        acc["realized_pnl"] = total
    acc["closed_positions"] = closed_positions(hist_rows)
    acc["ok"] = "balance" not in acc["errors"]
    return acc


def _iso(v):
    return v if isinstance(v, str) and re.match(r"^\d{4}-\d\d-\d\dT[\d:]+(\+00:00|Z)$", v) else None


def resanitize(acc, name):
    """Filtrera ett konto (t.ex. hämtat från Lena-repots publika feed) genom samma allowlist igen."""
    if not isinstance(acc, dict) or not acc:
        return {"account": name, "ok": False, "errors": {"feed": {"code": "MISSING", "msg": "ingen feed"}},
                "totalEqUsd": None, "balances": [], "positions": [], "open_orders": [], "algo_orders": [],
                "recent_fills": [], "recent_orders": [], "last_order_at": None, "fetched_at": None,
                "realized_pnl": None, "realized_pnl_today": None, "closed_positions": []}
    lst = lambda k, f: [pick(x, f) for x in (acc.get(k) or [])[:50] if isinstance(x, dict)]
    errs = {}
    for k, v in (acc.get("errors") or {}).items():
        if isinstance(v, dict) and re.match(r"^[a-z_]{1,24}$", str(k)):
            errs[k] = clean_err(v.get("code"), v.get("msg"))
    fa = _iso(acc.get("fetched_at"))
    return {"account": name, "fetched_at": fa, "ok": bool(acc.get("ok")), "errors": errs,
            "totalEqUsd": _val("totalEq", acc.get("totalEqUsd")),
            "balances": lst("balances", BAL_FIELDS),
            "positions": [pick(with_product(p), POS_FIELDS) for p in lst("positions", POS_FIELDS)],
            "open_orders": lst("open_orders", ORD_FIELDS), "algo_orders": lst("algo_orders", ALGO_FIELDS),
            "recent_fills": lst("recent_fills", FILL_FIELDS), "recent_orders": lst("recent_orders", HIST_FIELDS),
            "last_order_at": _iso(acc.get("last_order_at")),
            "realized_pnl": _val("realized_pnl", acc.get("realized_pnl")),
            "realized_pnl_today": _val("realized_pnl_today", acc.get("realized_pnl_today")),
            "closed_positions": closed_positions([x for x in (acc.get("closed_positions") or [])
                                                  if isinstance(x, dict)][:CLOSED_MAX])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["fetch", "merge"])
    ap.add_argument("--account")
    ap.add_argument("--anna"); ap.add_argument("--lena"); ap.add_argument("--prev")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.mode == "fetch":
        out = fetch_account(a.account)
    else:
        def load(p):
            try:
                return json.load(open(p)) if p and os.path.exists(p) and os.path.getsize(p) > 0 else {}
            except Exception:
                return {}
        now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        prev = load(a.prev) if a.prev else {}
        prev_health = prev.get("health") if isinstance(prev.get("health"), dict) else {}
        out = {"schema": "tradebot-status/2", "generated_at": now, "source": "github-actions-readonly-feed"}
        health = {"last_attempt": now, "accounts": {}}
        all_ok = True
        for name, path in (("anna", a.anna), ("lena", a.lena)):
            fresh = resanitize(load(path), name)
            ph = (prev_health.get("accounts") or {}).get(name) or {}
            if fresh["ok"]:
                out[name] = fresh
                health["accounts"][name] = {"ok": True, "last_success": now, "error": None}
            else:
                all_ok = False
                old = prev.get(name)
                # behåll senaste goda data, markerad som inaktuell
                kept = resanitize(old, name) if isinstance(old, dict) and old.get("ok") else fresh
                kept["stale"] = kept is not fresh
                out[name] = kept
                last_ok = _iso(ph.get("last_success")) or (_iso(old.get("fetched_at")) if isinstance(old, dict) and old.get("ok") else None)
                health["accounts"][name] = {"ok": False, "last_success": last_ok,
                                            "error": fresh["errors"] or {"feed": {"code": "UNKNOWN", "msg": ""}}}
        succ = [h.get("last_success") for h in health["accounts"].values() if h.get("last_success")]
        health["feed_ok"] = all_ok
        health["last_success"] = max(succ) if succ else _iso(prev_health.get("last_success"))
        out["health"] = health
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), indent=2)
    print(f"wrote {a.out}: mode={a.mode}")  # aldrig env eller svar


if __name__ == "__main__":
    sys.exit(main())
