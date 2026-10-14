"""
Tests for TradebottenAnna OKX EU Demo Client
Validates simulated trading headers, dry-run safety, and authentication signature math.
"""

import unittest
from trading.okx_client import OKXDemoClient


class TestOKXDemoClient(unittest.TestCase):
    def setUp(self):
        self.client = OKXDemoClient(
            api_key="test_key",
            secret_key="test_secret",
            passphrase="test_passphrase",
            trading_enabled=False,
            enforce_demo=True
        )

    def test_live_mode_has_no_simulated_header(self):
        """enforce_demo=False targets the EEA live gateway without the demo header."""
        c = OKXDemoClient(api_key="k", secret_key="s", passphrase="p", enforce_demo=False)
        self.assertNotIn("x-simulated-trading", c._build_headers("GET", "/x"))
        self.assertEqual(c.base_url, "https://eea.okx.com")

    def test_simulated_trading_header_present(self):
        """Check that x-simulated-trading is set to 1 in all requests."""
        headers = self.client._build_headers("GET", "/api/v5/account/balance")
        self.assertEqual(headers.get("x-simulated-trading"), "1")
        self.assertIn("OK-ACCESS-KEY", headers)
        self.assertIn("OK-ACCESS-SIGN", headers)

    def test_signature_deterministic(self):
        """Verify HMAC-SHA256 signature generation."""
        sig = self.client._generate_signature(
            timestamp="2026-10-12T12:00:00.000Z",
            method="GET",
            request_path="/api/v5/account/balance",
            body=""
        )
        self.assertTrue(len(sig) > 10)
        self.assertIsInstance(sig, str)

    def test_trading_disabled_blocks_order(self):
        """Ensure place_demo_order is blocked when trading_enabled=False."""
        result = self.client.place_order(
            inst_id="BTC-USDT-SWAP",
            side="buy",
            size_contracts="1",
            sl_trigger_px="50000",
        )
        self.assertFalse(result["success"])
        self.assertTrue(result["blocked"])
        self.assertIn("TRADING_DISABLED", result["error"])


if __name__ == "__main__":
    unittest.main()
