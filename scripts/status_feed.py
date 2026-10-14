#!/usr/bin/env python3
"""Read-only OKX status feed för dashboarden.

- Gör ENDAST GET-anrop: account/balance, account/positions, trade/orders-pending,
  trade/orders-algo-pending (SL/TP-kontroll) och trade/fills (senaste 20).
- Inga order-/trade-skrivande endpoints, inga AI-anrop.
- Utdata byggs ENBART från en allowlist av fält. Aldrig headers, signaturer, nycklar,
  passphrases eller råa svar. Felmeddelanden kortas och rensas.
- Nycklar läses från env (FEED_KEY/FEED_SECRET/FEED_PASS) och skrivs aldrig ut.
"""
import argparse, base64, datetime as dt, hashlib, hmac, json, os, re, sys, urllib.error, urllib.request

BASE = "https://eea.okx.com"
ALLOWED_GET = {
    "/api/v5/account/balance",
    "/api/v5/account/positions",
    "/api/v5/trade/orders-pending",
    "/api/v5/trade/orders-algo-pending?ordType=conditional",
    "/api/v5/trade/orders-algo-pending?ordType=oco",
    "/api/v5/trade/fills?limit=20",
}
BAL_FIELDS = ["ccy", "eq", "eqUsd", "availBal", "availEq", "upl"]
POS_FIELDS = ["instId", "instType", "mgnMode", "posSide", "pos", "avgPx", "markPx", "upl", "uplRatio",
              "lever", "liqPx", "margin", "cTime", "uTime"]
ORD_FIELDS = ["instId", "ordType", "side", "sz", "px", "state", "accFillSz", "cTime"]
ALGO_FIELDS = ["instId", "ordType", "side", "sz", "slTriggerPx", "tpTriggerPx", "state", "cTime"]
FILL_FIELDS = ["instId", "side", "fillPx", "fillSz", "fee", "feeCcy", "execType", "ts"]
NUMERIC = set("eq eqUsd availBal availEq upl pos avgPx markPx uplRatio lever liqPx margin sz px accFillSz "
              "slTriggerPx tpTriggerPx fillPx fillSz fee totalEq cTime uTime ts".split())
STRINGY = re.compile(r"^[A-Za-z0-9_\-\.]{0,40}$")


def _val(k, v):
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


def okx_get(path, key, secret, passphrase):
    assert path in ALLOWED_GET, "endast tillåtna GET-anrop"
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


def fetch_account(name):
    key, secret, pw = (os.environ.get(v, "") for v in ("FEED_KEY", "FEED_SECRET", "FEED_PASS"))
    acc = {"account": name, "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "ok": False, "errors": {}, "totalEqUsd": None, "balances": [], "positions": [],
           "open_orders": [], "algo_orders": [], "recent_fills": []}
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
    acc["positions"] = [pick(p, POS_FIELDS) for p in call("positions", "/api/v5/account/positions")
                        if _val("pos", p.get("pos")) not in (None, 0.0)]
    acc["open_orders"] = [pick(o, ORD_FIELDS) for o in call("orders_pending", "/api/v5/trade/orders-pending")]
    algos = call("algo_conditional", "/api/v5/trade/orders-algo-pending?ordType=conditional") + \
        call("algo_oco", "/api/v5/trade/orders-algo-pending?ordType=oco")
    acc["algo_orders"] = [pick(a, ALGO_FIELDS) for a in algos]
    acc["recent_fills"] = [pick(f, FILL_FIELDS) for f in call("fills", "/api/v5/trade/fills?limit=20")][:20]
    acc["ok"] = "balance" not in acc["errors"]
    return acc


def resanitize(acc, name):
    """Filtrera ett konto (t.ex. hämtat från Lena-repots publika feed) genom samma allowlist igen."""
    if not isinstance(acc, dict) or not acc:
        return {"account": name, "ok": False, "errors": {"feed": {"code": "MISSING", "msg": "ingen feed"}},
                "totalEqUsd": None, "balances": [], "positions": [], "open_orders": [], "algo_orders": [],
                "recent_fills": [], "fetched_at": None}
    lst = lambda k, f: [pick(x, f) for x in (acc.get(k) or [])[:50] if isinstance(x, dict)]
    errs = {}
    for k, v in (acc.get("errors") or {}).items():
        if isinstance(v, dict) and re.match(r"^[a-z_]{1,24}$", str(k)):
            errs[k] = clean_err(v.get("code"), v.get("msg"))
    fa = acc.get("fetched_at")
    fa = fa if isinstance(fa, str) and re.match(r"^\d{4}-\d\d-\d\dT[\d:]+(\+00:00|Z)$", fa) else None
    return {"account": name, "fetched_at": fa, "ok": bool(acc.get("ok")), "errors": errs,
            "totalEqUsd": _val("totalEq", acc.get("totalEqUsd")),
            "balances": lst("balances", BAL_FIELDS), "positions": lst("positions", POS_FIELDS),
            "open_orders": lst("open_orders", ORD_FIELDS), "algo_orders": lst("algo_orders", ALGO_FIELDS),
            "recent_fills": lst("recent_fills", FILL_FIELDS)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["fetch", "merge"])
    ap.add_argument("--account")
    ap.add_argument("--anna"); ap.add_argument("--lena")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.mode == "fetch":
        out = fetch_account(a.account)
    else:
        load = lambda p: json.load(open(p)) if p and os.path.exists(p) and os.path.getsize(p) > 0 else {}
        try: anna = load(a.anna)
        except Exception: anna = {}
        try: lena = load(a.lena)
        except Exception: lena = {}
        out = {"schema": "tradebot-status/1", "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
               "source": "github-actions-readonly-feed",
               "anna": resanitize(anna, "anna"), "lena": resanitize(lena, "lena")}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), indent=2)
    print(f"wrote {a.out}: mode={a.mode}")  # aldrig env eller svar


if __name__ == "__main__":
    sys.exit(main())
