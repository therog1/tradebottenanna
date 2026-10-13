"""
TradebottenAnna OKX Execution Client
Supports both controlled Live Trading (EEA Gateway) and Demo Simulation Mode.
"""

import base64
import hmac
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import urllib.request
import urllib.error

class OKXDemoClient:
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
        enforce_demo: bool = False
    ):
        self.api_key = api_key or os.getenv("OKX_API_KEY", os.getenv("OKX_DEMO_API_KEY", ""))
        self.secret_key = secret_key or os.getenv("OKX_SECRET_KEY", os.getenv("OKX_DEMO_SECRET_KEY", ""))
        self.passphrase = passphrase or os.getenv("OKX_PASSPHRASE", os.getenv("OKX_DEMO_PASSPHRASE", ""))
        self.trading_enabled = trading_enabled
        self.enforce_demo = enforce_demo
        self.base_url = self.DEMO_BASE_URL if self.enforce_demo else self.LIVE_BASE_URL

    def _get_timestamp(self) -> str:
        """Returns ISO 8601 UTC timestamp format required by OKX: 2020-12-08T09:08:57.715Z"""
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def _generate_signature(self, timestamp: str, method: str, request_path: str, body: str = "") -> str:
        """Computes HMAC-SHA256 signature encoded in base64."""
        message = f"{timestamp}{method.upper()}{request_path}{body}"
        mac = hmac.new(
            self.secret_key.encode("utf-8"),
            message.encode("utf-8"),
            digestmod=hashlib.sha256
        )
        return base64.b64encode(mac.digest()).decode("utf-8")

    def _build_headers(self, method: str, request_path: str, body: str = "") -> Dict[str, str]:
        """Build headers with simulated trading flag only if enforce_demo is active."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "TradebottenAnna/1.3"
        }
        if self.enforce_demo:
            headers[self.SIMULATED_HEADER_KEY] = self.SIMULATED_HEADER_VALUE

        if self.api_key and self.secret_key and self.passphrase:
            timestamp = self._get_timestamp()
            signature = self._generate_signature(timestamp, method, request_path, body)
            headers.update({
                "OK-ACCESS-KEY": self.api_key,
                "OK-ACCESS-SIGN": signature,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": self.passphrase,
            })
        return headers

    def get_account_balance(self) -> Dict[str, Any]:
        """Fetch account balance or return safe test fixture if offline."""
        if not (self.api_key and self.secret_key and self.passphrase):
            return {
                "code": "0",
                "msg": "",
                "data": [{
                    "totalEq": "10000.00",
                    "adjEq": "10000.00",
                    "details": [
                        {"ccy": "USDT", "availBal": "10000.00", "frozenBal": "0.00", "eq": "10000.00"}
                    ]
                }],
                "simulated": True,
                "note": "Local test fixture (credentials not configured)"
            }
        request_path = "/api/v5/account/balance"
        return self._request("GET", request_path)

    def place_demo_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        size: float,
        price: Optional[float] = None,
        client_order_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Place an order in OKX environment."""
        if not self.trading_enabled:
            return {
                "success": False,
                "blocked": True,
                "error": "TRADING_DISABLED: trading_enabled is false in configuration. No order submitted.",
                "audit": {
                    "symbol": symbol,
                    "side": side,
                    "size": size,
                    "price": price,
                    "env": "live" if not self.enforce_demo else "demo"
                }
            }

        if side not in ["buy", "sell"]:
            raise ValueError(f"Invalid order side: {side}")
        if order_type not in ["market", "limit"]:
            raise ValueError(f"Invalid order type: {order_type}")
        if size <= 0:
            raise ValueError(f"Invalid order size: {size}")

        payload: Dict[str, Any] = {
            "instId": symbol,
            "tdMode": "cross",
            "side": side,
            "ordType": order_type,
            "sz": str(size),
        }
        if price is not None and order_type == "limit":
            payload["px"] = str(price)
        if client_order_id:
            payload["clOrdId"] = client_order_id

        body = json.dumps(payload)
        request_path = "/api/v5/trade/order"

        if not (self.api_key and self.secret_key and self.passphrase):
            return {
                "success": True,
                "order_id": f"MOCK_{int(time.time()*1000)}",
                "simulated": True,
                "detail": payload,
                "message": "Order simulated (no OKX credentials configured)."
            }

        return self._request("POST", request_path, body)

    def _request(self, method: str, path: str, body: str = "") -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = self._build_headers(method, path, body)

        req = urllib.request.Request(url, data=body.encode("utf-8") if body else None, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            return {
                "code": str(e.code),
                "msg": f"HTTP Error {e.code}: {e.reason}",
                "detail": error_body
            }
        except Exception as e:
            return {
                "code": "500",
                "msg": f"Network/Connection error: {str(e)}"
            }
