"""
TradebottenAnna — Python Service Runner & Health API
Provides health status, strategy inspection, and controlled single-cycle trigger.
"""

import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from trading.config import load_strategy_config
from main import run_bot_cycle


class TradebottenAnnaHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))

    def do_GET(self):
        if self.path in ["/", "/health", "/status"]:
            try:
                config = load_strategy_config()
                self._send_json(200, {
                    "service": "TradebottenAnna Python Engine",
                    "status": "online",
                    "product": config.product,
                    "version": config.version,
                    "environment": config.environment,
                    "trading_enabled": config.trading_enabled,
                    "kill_switch_active": config.risk_limits.kill_switch_active,
                    "configured_symbols": config.strategy.symbols
                })
            except Exception as e:
                self._send_json(500, {"status": "error", "message": str(e)})
        elif self.path == "/api/strategy":
            try:
                config = load_strategy_config()
                with open("strategy.json", "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._send_json(200, data)
            except Exception as e:
                self._send_json(500, {"status": "error", "message": str(e)})
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        if self.path == "/api/run-cycle":
            try:
                config = load_strategy_config()
                result = run_bot_cycle(config)
                self._send_json(200, result)
            except Exception as e:
                self._send_json(500, {"status": "error", "message": str(e)})
        else:
            self._send_json(404, {"error": "Not Found"})


def run_server(port: int = 8080):
    server = HTTPServer(("0.0.0.0", port), TradebottenAnnaHandler)
    print(f"TradebottenAnna Python Service running on port {port}...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    if len(sys.argv) > 1 and sys.argv[1] == "--run-cycle":
        cfg = load_strategy_config()
        run_bot_cycle(cfg)
    else:
        run_server(port)
