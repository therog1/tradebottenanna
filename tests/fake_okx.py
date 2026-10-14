"""In-memory fake OKX client. No network, no keys."""
import copy

from trading.okx_client import OKXError


def make_candles(n=60, start=60000.0, step=60.0):
    # OKX order: newest first; all confirmed
    rows = []
    for i in range(n):
        c = start + i * step
        rows.append([str(1_700_000_000_000 + i * 3600_000), str(c - 10), str(c + 80), str(c - 80), str(c), "1", "1", "1", "1"])
    return list(reversed(rows))


BTC = {"instId": "BTC-USDT-SWAP", "ctVal": "0.01", "lotSz": "0.01", "minSz": "0.01", "tickSz": "0.1",
       "ctValCcy": "BTC", "settleCcy": "USDT", "ctType": "linear", "state": "live"}


class FakeOKX:
    def __init__(self, equity="1000", positions=None, pending=None, algos=None, pos_mode="net_mode",
                 fail=(), instruments=None, candles=None, last="63600"):
        self.trading_enabled = False
        self.equity = equity
        self.positions = positions or []
        self.pending = pending or []
        self.algos = algos or []
        self.pos_mode = pos_mode
        self.fail = set(fail)
        self.instruments = instruments or {"BTC-USDT-SWAP": BTC}
        self.candles = candles if candles is not None else make_candles()
        self.last = last
        self.orders = []
        self.calls = []

    def _chk(self, name):
        self.calls.append(name)
        if name in self.fail:
            raise OKXError(f"{name} failed (mock)")

    def get_balance(self):
        self._chk("balance")
        return {"totalEq": self.equity}

    def get_account_config(self):
        self._chk("config"); return {"posMode": self.pos_mode}

    def get_positions(self, inst_type="SWAP"):
        self._chk("positions"); return copy.deepcopy(self.positions)

    def get_pending_orders(self, inst_type="SWAP"):
        self._chk("pending"); return copy.deepcopy(self.pending)

    def get_pending_algo_orders(self, ord_type="conditional", inst_type="SWAP"):
        self._chk("algos"); return [a for a in self.algos if a.get("ordType", "conditional") == ord_type]

    def get_instrument(self, inst_id, inst_type="SWAP"):
        self._chk("instrument")
        if inst_id not in self.instruments:
            raise OKXError("not found")
        return self.instruments[inst_id]

    def get_candles(self, inst_id, bar="1H", limit=100):
        self._chk("candles"); return self.candles

    def get_ticker(self, inst_id):
        self._chk("ticker"); return {"last": self.last}

    def place_order(self, **kw):
        self._chk("place_order")
        assert self.trading_enabled, "engine tried to send while trading disabled"
        self.orders.append(kw)
        return {"success": True, "response": {"code": "0", "data": [{"sCode": "0"}]}}
