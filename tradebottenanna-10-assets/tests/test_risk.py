import os, sys, types, unittest
# Stub optional runtime dependencies so pure risk tests do not need network packages.
ccxt = types.ModuleType('ccxt'); ccxt.okx = lambda *a, **k: None; sys.modules.setdefault('ccxt', ccxt)
dotenv = types.ModuleType('dotenv'); dotenv.load_dotenv = lambda: None; sys.modules.setdefault('dotenv', dotenv)
# google-genai is optional for pure sizing tests.
sys.modules.setdefault('google', types.ModuleType('google'))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from main import validate_and_size, analyze

class RiskTests(unittest.TestCase):
    def test_long_valid_five_to_one(self):
        d=validate_and_size({'action':'LONG','confidence':0.9,'entry_price':100,'stop_loss':99,'take_profit':105},100,1000)
        self.assertEqual(d['action'],'LONG'); self.assertGreaterEqual(d['risk_reward'],4.99)
        self.assertEqual(d['paper_status'],'PAPER IDEA ONLY — NO ORDER')
    def test_short_valid_five_to_one(self):
        d=validate_and_size({'action':'SHORT','confidence':0.9,'entry_price':100,'stop_loss':101,'take_profit':95},100,1000)
        self.assertEqual(d['action'],'SHORT')
    def test_low_confidence_hold(self):
        d=validate_and_size({'action':'LONG','confidence':0.5},100,1000)
        self.assertEqual(d['action'],'HOLD')
    def test_invalid_long_levels_rejected(self):
        with self.assertRaises(ValueError): validate_and_size({'action':'LONG','confidence':0.9,'entry_price':100,'stop_loss':101,'take_profit':110},100,1000)
    def test_below_five_to_one_rejected(self):
        with self.assertRaises(ValueError): validate_and_size({'action':'LONG','confidence':0.9,'entry_price':100,'stop_loss':99,'take_profit':104},100,1000)

if __name__=='__main__': unittest.main()
