import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest


@pytest.fixture(autouse=True)
def _no_cross_bot_network(monkeypatch):
    """Håll testerna hermetiska: ingen hämtning av den riktiga status-feeden."""
    from trading import crossbot
    monkeypatch.setattr(crossbot, "load_peer", lambda peer, timeout=5.0: [])
