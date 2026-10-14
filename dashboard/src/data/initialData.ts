import { Trade, Position, BotConfig, MarketFlow } from '../types';

export const INITIAL_BOT_CONFIGS: BotConfig[] = [
  {
    name: 'Tradebotten Anna',
    slug: 'anna',
    type: '3x Hävstång Perpetual Swaps (Perps)',
    description: 'Kör uteslutande krypto-perps med 3x hävstång (Cross Margin). ATR-baserade swing- och trendmål på OKX.',
    environment: 'OKX Live',
    trading_enabled: true,
    kill_switch: false,
    symbols: ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'SUI-USDT-SWAP'],
    risk_per_trade_pct: 1.5,
    stop_loss_pct: 2.0,
    take_profit_pct: 4.5,
    trailing_stop_pct: 1.2,
    min_equity_threshold: 30.0,
    max_open_positions: 3,
    min_leverage: 3,
    max_leverage: 3,
    current_leverage: 3,
    leverage_mode: 'fixed',
    timeframe: '1h',
    min_score: 65,
    last_cycle_status: '3x Hävstång aktiv. Bevakar BTC, ETH, SOL, SUI Perps.',
    last_cycle_time: 'Körs varje hel timme via GitHub Actions'
  },
  {
    name: 'Aggressiva Lena',
    slug: 'lena',
    type: '3x–5x Futures Scalper (USD-M X-Perpetuals)',
    description: 'Högfrekvent scalper på OKX Futures. Handlar USD-Margined X-Perpetuals (BTC, ETH, SOL, SUI, DOGE, PEPE m.fl.) med USDC som säkerhet och 3x–5x hävstång.',
    environment: 'OKX Live',
    trading_enabled: true,
    kill_switch: false,
    symbols: [
      'BTC-USD_UM_XPERP-310404', 'ETH-USD_UM_XPERP-310404', 'SOL-USD_UM_XPERP-310404',
      'SUI-USD_UM_XPERP-310404', 'DOGE-USD_UM_XPERP-310404', 'XRP-USD_UM_XPERP-310404',
      'PEPE-USD_UM_XPERP-310404', 'AVAX-USD_UM_XPERP-310530', 'NEAR-USD_UM_XPERP-310613',
      'LINK-USD_UM_XPERP-310523'
    ],
    risk_per_trade_pct: 35.0,
    stop_loss_pct: 1.8,
    take_profit_pct: 4.0,
    trailing_stop_pct: 0.9,
    min_equity_threshold: 25.0,
    max_open_positions: 3,
    min_leverage: 3,
    max_leverage: 5,
    current_leverage: 3,
    leverage_mode: 'dynamic',
    imbalance_threshold: 0.45,
    last_cycle_status: '3x–5x Futures aktiv på OKX (USD-M X-Perpetuals). Säkerhet: USDC.',
    last_cycle_time: 'Körs var 15:e minut via GitHub Actions'
  }
];

// Riktiga faktiska ordrar från OKX
// Inga exempel-affärer/positioner: dashboarden publicerar ingen orderhistorik eller positioner.
export const INITIAL_CLOSED_TRADES: Trade[] = [];

// Inga exempel-affärer/positioner: dashboarden publicerar ingen orderhistorik eller positioner.
export const INITIAL_POSITIONS: Position[] = [];

export const INITIAL_MARKET_FLOWS: MarketFlow[] = [
  {
    symbol: 'BTC-USDC',
    last_price: 83239.6,
    bid_vol: 0,
    ask_vol: 1.9,
    imbalance: -0.971,
    trend: 'SIDEWAYS',
    signal: 'SELL',
    volUSD: 49112000,
    change24h: 0.2
  },
  {
    symbol: 'ETH-USDC',
    last_price: 2501.65,
    bid_vol: 0,
    ask_vol: 1.0,
    imbalance: -0.910,
    trend: 'SIDEWAYS',
    signal: 'SELL',
    volUSD: 29159000,
    change24h: -0.4
  },
  {
    symbol: 'SOL-USDC',
    last_price: 106.52,
    bid_vol: 5.9,
    ask_vol: 5.7,
    imbalance: 0.013,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 11779000,
    change24h: -2.1
  },
  {
    symbol: 'NEAR-USDC',
    last_price: 5.067,
    bid_vol: 4.3,
    ask_vol: 109.2,
    imbalance: -0.924,
    trend: 'DOWN',
    signal: 'SELL',
    volUSD: 6682000,
    change24h: -3.4
  },
  {
    symbol: 'ZEC-USDC',
    last_price: 1190.38,
    bid_vol: 0,
    ask_vol: 0,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 6285000,
    change24h: -1.2
  },
  {
    symbol: 'HYPE-USDC',
    last_price: 81.20,
    bid_vol: 0.2,
    ask_vol: 5.9,
    imbalance: -0.936,
    trend: 'DOWN',
    signal: 'SELL',
    volUSD: 6055000,
    change24h: -4.5
  },
  {
    symbol: 'CT-USDC',
    last_price: 0.3585,
    bid_vol: 2443.7,
    ask_vol: 2363.4,
    imbalance: 0.017,
    trend: 'UP',
    signal: 'NEUTRAL',
    volUSD: 6014000,
    change24h: 3.8
  },
  {
    symbol: 'TAO-USDC',
    last_price: 275.8,
    bid_vol: 0.5,
    ask_vol: 3.2,
    imbalance: -0.744,
    trend: 'DOWN',
    signal: 'SELL',
    volUSD: 2850000,
    change24h: -2.9
  },
  {
    symbol: 'ONDO-USDC',
    last_price: 0.4678,
    bid_vol: 570.7,
    ask_vol: 233.1,
    imbalance: 0.420,
    trend: 'DOWN',
    signal: 'BUY',
    volUSD: 2698000,
    change24h: 1.1
  },
  {
    symbol: 'SUI-USDC',
    last_price: 1.0431,
    bid_vol: 115.0,
    ask_vol: 154.7,
    imbalance: -0.147,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 2540000,
    change24h: -1.8
  },
  {
    symbol: 'LINK-USDC',
    last_price: 12.918,
    bid_vol: 1.3,
    ask_vol: 1.3,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 2310000,
    change24h: -0.8
  },
  {
    symbol: 'LIT-USDC',
    last_price: 3.3178,
    bid_vol: 57.9,
    ask_vol: 57.9,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 2190000,
    change24h: 2.4
  },
  {
    symbol: 'ENA-USDC',
    last_price: 0.2112,
    bid_vol: 464.8,
    ask_vol: 228.1,
    imbalance: 0.342,
    trend: 'DOWN',
    signal: 'BUY',
    volUSD: 1980000,
    change24h: 1.7
  },
  {
    symbol: 'PUMP-USDC',
    last_price: 0.004997,
    bid_vol: 19933,
    ask_vol: 8192,
    imbalance: 0.417,
    trend: 'DOWN',
    signal: 'BUY',
    volUSD: 1820000,
    change24h: 5.6
  },
  {
    symbol: 'DOS-USDC',
    last_price: 0.2225,
    bid_vol: 58.7,
    ask_vol: 1857.2,
    imbalance: -0.939,
    trend: 'DOWN',
    signal: 'SELL',
    volUSD: 1740000,
    change24h: -6.2
  },
  {
    symbol: 'DOGE-USDC',
    last_price: 0.08398,
    bid_vol: 6186.3,
    ask_vol: 139.1,
    imbalance: 0.956,
    trend: 'DOWN',
    signal: 'STRONG BUY',
    volUSD: 1690000,
    change24h: 3.2
  },
  {
    symbol: 'FET-USDC',
    last_price: 0.2121,
    bid_vol: 277.6,
    ask_vol: 238.0,
    imbalance: 0.077,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 1550000,
    change24h: -1.5
  },
  {
    symbol: 'AVAX-USDC',
    last_price: 10.25,
    bid_vol: 0.4,
    ask_vol: 0.5,
    imbalance: -0.145,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 1480000,
    change24h: -2.3
  },
  {
    symbol: 'UNI-USDC',
    last_price: 7.333,
    bid_vol: 2.2,
    ask_vol: 2.2,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 1390000,
    change24h: -0.9
  },
  {
    symbol: 'AAVE-USDC',
    last_price: 158.09,
    bid_vol: 0,
    ask_vol: 0,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 1310000,
    change24h: -1.1
  },
  {
    symbol: 'STRK-USDC',
    last_price: 0.08896,
    bid_vol: 1326.9,
    ask_vol: 995.9,
    imbalance: 0.142,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 1250000,
    change24h: -2.7
  },
  {
    symbol: 'RENDER-USDC',
    last_price: 2.055,
    bid_vol: 17.2,
    ask_vol: 17.2,
    imbalance: 0,
    trend: 'SIDEWAYS',
    signal: 'NEUTRAL',
    volUSD: 1190000,
    change24h: 0.5
  },
  {
    symbol: 'ARB-USDC',
    last_price: 0.18515,
    bid_vol: 101.5,
    ask_vol: 601.2,
    imbalance: -0.711,
    trend: 'DOWN',
    signal: 'SELL',
    volUSD: 1120000,
    change24h: -3.8
  },
  {
    symbol: 'ADA-USDC',
    last_price: 0.2346,
    bid_vol: 2119.8,
    ask_vol: 365.9,
    imbalance: 0.706,
    trend: 'DOWN',
    signal: 'STRONG BUY',
    volUSD: 1080000,
    change24h: 4.1
  },
  {
    symbol: 'DOT-USDC',
    last_price: 1.1775,
    bid_vol: 13.5,
    ask_vol: 13.5,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 990000,
    change24h: -1.6
  },
  {
    symbol: 'WLD-USDC',
    last_price: 0.5037,
    bid_vol: 362.0,
    ask_vol: 174.7,
    imbalance: 0.349,
    trend: 'DOWN',
    signal: 'BUY',
    volUSD: 940000,
    change24h: 2.8
  },
  {
    symbol: 'GRASS-USDC',
    last_price: 0.7106,
    bid_vol: 1127.5,
    ask_vol: 1127.5,
    imbalance: 0,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 880000,
    change24h: 6.2
  },
  {
    symbol: 'MAGIC-USDC',
    last_price: 0.1211,
    bid_vol: 1947.0,
    ask_vol: 1943.0,
    imbalance: 0.001,
    trend: 'SIDEWAYS',
    signal: 'NEUTRAL',
    volUSD: 820000,
    change24h: -0.3
  },
  {
    symbol: 'LTC-USDC',
    last_price: 61.10,
    bid_vol: 0.6,
    ask_vol: 0.9,
    imbalance: -0.177,
    trend: 'DOWN',
    signal: 'NEUTRAL',
    volUSD: 790000,
    change24h: -1.0
  },
  {
    symbol: 'W-USDC',
    last_price: 0.01842,
    bid_vol: 1071.1,
    ask_vol: 78866.4,
    imbalance: -0.973,
    trend: 'DOWN',
    signal: 'SELL',
    volUSD: 750000,
    change24h: -7.5
  }
];
