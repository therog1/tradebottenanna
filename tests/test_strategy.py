import unittest, sys, types
# Unit tests target pure calculations; exchange SDK is not needed.
sys.modules.setdefault("ccxt", types.SimpleNamespace())
sys.modules.setdefault("dotenv", types.SimpleNamespace(load_dotenv=lambda: None))
from main import ema, rsi, analyze

def candles(closes):
    return [[i*900000, p-0.5, p+1, p-1, p, 100+i] for i,p in enumerate(closes)]

class StrategyTests(unittest.TestCase):
    def test_ema(self):
        self.assertAlmostEqual(ema([1,2,3,4,5],3),4.0)
    def test_rsi_rising(self):
        self.assertEqual(rsi(list(range(1,20))),100.0)
    def test_requires_enough_candles(self):
        with self.assertRaises(ValueError): analyze(candles(list(range(1,40))))
    def test_analysis_has_no_ai_dependency(self):
        result=analyze(candles([100+i*0.3 for i in range(100)]))
        self.assertIn(result['action'], ('LONG','SHORT','HOLD'))
        self.assertIn('score',result)
        self.assertLessEqual(result['score'],5)

if __name__=='__main__': unittest.main()
