"""
TradebottenAnna OKX client.

Thin, side-effect-explicit wrapper around the OKX v5 REST API.

Safety properties:
- Public market data (candles, instruments, ticker) uses unauthenticated GETs.
- Private reads (balance, positions, pending orders, pending algo orders,
  account config) return a normalised result and NEVER fabricate data.
  There is no offline fixture / 10,000 USD fallback any more: a missing
  credential or a failed request is reported as ``ok=False``.
- ``place_order`` refuses to send anything without an attached stop loss
  (``attachAlgoOrds`` with ``slTriggerPx``) and refuses when trading is disabled.
"""

import base64
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class OKXError(Exception):
    """Raised when an OKX read fails or returns a non-zero code."""


class OKXClient:
    LIVE_BASE_URL = "https://eea.okx.com"
    DEMO_BASE_URL = "https://www.okx.com"
    SIMULATED_HEADER_KEY = "x-simulated-trading"
    SIMULATED_HEADER_VALUE = "1"

    def __init__(
        self,
        api_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        passphrase: Optional[str] = None,
        trading_enabled: bool = False,
        enforce_demo: bool = True,
        timeout: float = 10.0,
    ):
        self.api_key = api_key or os.getenv("OKX_API_KEY", os.getenv("OKX_DEMO_API_KEY", ""))
        self.secret_key = secret_key or os.getenv("OKX_SECRET_KEY", os.getenv("OKX_DEMO_SECRET_KEY", ""))
        self.passphrase = passphrase or os.getenv("OKX_PASSPHRASE", os.getenv("OKX_DEMO_PASSPHRASE", ""))
        self.trading_enabled = trading_enabled
        self.enforce_demo = enforce_demo
        self.timeout = timeout
        self.base_url = self.DEMO_BASE_URL if self.enforce_demo else self.LIVE_BASE_URL

    # ------------------------------------------------------------------ auth
    @property
    def has_credentials(self) -> bool:
        return bool(self.api_key and self.secret_key and self.passphrase)

    @staticmethod
    def _get_timestamp() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def _generate_signature(self, timestamp: str, method: str, request_path: str, body: str = "") -> str:
        message = f"{timestamp}{method.upper()}{request_path}{body}"
        mac = hmac.new(self.secret_key.encode("utf-8"), message.encode("utf-8"), digestmod=hashlib.sha256)
        return base64.b64encode(mac.digest()).decode("utf-8")

    def _build_headers(self, method: str, request_path: str, body: str = "", private: bool = True) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "TradebottenAnna/2.0",
        }
        if self.enforce_demo:
            headers[self.SIMULATED_HEADER_KEY] = self.SIMULATED_HEADER_VALUE
        if private and self.has_credentials:
            ts = self._get_timestamp()
            headers.update({
                "OK-ACCESS-KEY": self.api_key,
                "OK-ACCESS-SIGN": self._generate_signature(ts, method, request_path, body),
                "OK-ACCESS-TIMESTAMP": ts,
                "OK-ACCESS-PASSPHRASE": self.passphrase,
            })
        return headers

    # ------------------------------------------------------------- transport
    def _http(self, method: str, path: str, body: str = "", private: bool = True) -> Dict[str, Any]:
        """Low-level HTTP call. Tests replace this method; never fabricates data."""
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(
            url,
            data=body.encode("utf-8") if body else None,
            headers=self._build_headers(method, path, body, private=private),
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read().decode("utf-8"))
            except Exception:
                err = {}
            # keep OKX's own error code/msg (e.g. 50113, 51000); never contains credentials
            return {"code": str(err.get("code") or e.code), "msg": f"HTTP {e.code}: {err.get('msg') or e.reason}",
                    "data": err.get("data") or []}
        except Exception as e:  # network, JSON, timeout
            return {"code": "-1", "msg": f"Network/parse error: {e}", "data": []}

    def _get(self, path: str, params: Optional[Dict[str, str]] = None, private: bool = True) -> List[Dict[str, Any]]:
        if private and not self.has_credentials:
            raise OKXError(f"Missing OKX credentials for private endpoint {path}")
        if params:
            path = f"{path}?{urllib.parse.urlencode(params)}"
        resp = self._http("GET", path, private=private)
        if not isinstance(resp, dict) or str(resp.get("code")) != "0":
            msg = resp.get("msg") if isinstance(resp, dict) else repr(resp)
            code = resp.get("code") if isinstance(resp, dict) else "?"
            raise OKXError(f"GET {path} failed: code={code} msg={msg}")
        data = resp.get("data")
        if not isinstance(data, list):
            raise OKXError(f"GET {path} returned no data list")
        return data

    # ------------------------------------------------------- public market data
    def get_candles(self, inst_id: str, bar: str = "1H", limit: int = 100) -> List[list]:
        return self._get("/api/v5/market/candles", {"instId": inst_id, "bar": bar, "limit": str(limit)}, private=False)

    def get_ticker(self, inst_id: str) -> Dict[str, Any]:
        data = self._get("/api/v5/market/ticker", {"instId": inst_id}, private=False)
        if not data:
            raise OKXError(f"Ticker {inst_id} empty")
        return data[0]

    def get_instrument(self, inst_id: str, inst_type: str = "SWAP") -> Dict[str, Any]:
        data = self._get("/api/v5/public/instruments", {"instType": inst_type, "instId": inst_id}, private=False)
        if not data:
            raise OKXError(f"Instrument {inst_id} not found")
        return data[0]

    # ------------------------------------------------------------ private reads
    def get_balance(self) -> Dict[str, Any]:
        data = self._get("/api/v5/account/balance")
        if not data:
            raise OKXError("Balance response empty")
        return data[0]

    def get_account_config(self) -> Dict[str, Any]:
        data = self._get("/api/v5/account/config")
        if not data:
            raise OKXError("Account config response empty")
        return data[0]

    def get_positions(self, inst_type: str = "SWAP") -> List[Dict[str, Any]]:
        return self._get("/api/v5/account/positions", {"instType": inst_type})

    def get_pending_orders(self, inst_type: str = "SWAP") -> List[Dict[str, Any]]:
        return self._get("/api/v5/trade/orders-pending", {"instType": inst_type})

    def get_pending_algo_orders(self, ord_type: str = "conditional", inst_type: str = "SWAP") -> List[Dict[str, Any]]:
        return self._get("/api/v5/trade/orders-algo-pending", {"ordType": ord_type, "instType": inst_type})

    # ------------------------------------------------------------------ write
    def place_order(
        self,
        inst_id: str,
        side: str,
        size_contracts: str,
        sl_trigger_px: str,
        td_mode: str = "cross",
        tp_trigger_px: Optional[str] = None,
        client_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Place a market order WITH an attached stop loss. Refuses otherwise."""
        if not self.trading_enabled:
            return {"success": False, "blocked": True, "error": "TRADING_DISABLED: no order submitted."}
        if side not in ("buy", "sell"):
            raise ValueError(f"Invalid side: {side}")
        if not size_contracts or float(size_contracts) <= 0:
            raise ValueError(f"Invalid size: {size_contracts}")
        if not sl_trigger_px or float(sl_trigger_px) <= 0:
            return {"success": False, "blocked": True, "error": "NO_STOP_LOSS: refusing order without attached SL."}
        if not self.has_credentials:
            return {"success": False, "blocked": True, "error": "MISSING_CREDENTIALS: no order submitted."}

        algo: Dict[str, str] = {"slTriggerPx": str(sl_trigger_px), "slOrdPx": "-1", "slTriggerPxType": "last"}
        if tp_trigger_px:
            algo.update({"tpTriggerPx": str(tp_trigger_px), "tpOrdPx": "-1", "tpTriggerPxType": "last"})
        payload: Dict[str, Any] = {
            "instId": inst_id,
            "tdMode": td_mode,
            "side": side,
            "ordType": "market",
            "sz": str(size_contracts),
            "attachAlgoOrds": [algo],
        }
        if client_order_id:
            payload["clOrdId"] = client_order_id
        body = json.dumps(payload)
        resp = self._http("POST", "/api/v5/trade/order", body)
        ok = isinstance(resp, dict) and str(resp.get("code")) == "0"
        if ok:
            for d in resp.get("data") or []:
                if str(d.get("sCode", "0")) != "0":
                    ok = False
        return {"success": ok, "request": payload, "response": resp}


# Backwards-compatible name used by older code/tests.
OKXDemoClient = OKXClient
