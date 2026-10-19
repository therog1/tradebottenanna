export interface Trade {
  id: string;
  bot: 'Tradebotten Anna' | 'Aggressiva Lena';
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  size_units: number;
  notional_usd: number;
  leverage?: number;
  realized_pnl: number;
  pnl_pct: number;
  exit_reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'MANUAL_CLOSE' | 'EXCHANGE_FILL' | 'LIQUIDATION';
  entry_time: string;
  exit_time: string;
  status: 'CLOSED';
}

export interface Position {
  id: string;
  bot: 'Tradebotten Anna' | 'Aggressiva Lena';
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  current_price: number;
  high_price: number;
  size_units: number;
  allocated_usd: number;
  notional_usd?: number;
  unrealized_pnl: number;
  pnl_pct: number;
  trailing_stop_dist_pct?: number;
  leverage?: number;
  margin_mode?: string;
  opened_at: string;
}

export interface BotConfig {
  name: string;
  slug: 'anna' | 'lena';
  type: string;
  description: string;
  environment: 'OKX Demo' | 'OKX Live';
  trading_enabled: boolean;
  kill_switch: boolean;
  symbols: string[];
  risk_per_trade_pct: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  trailing_stop_pct: number;
  min_equity_threshold: number;
  max_open_positions: number;
  min_leverage?: number;
  max_leverage?: number;
  current_leverage?: number;
  leverage_mode?: 'dynamic' | 'fixed';
  timeframe?: string;
  min_score?: number;
  imbalance_threshold?: number;
  last_cycle_status?: string;
  last_cycle_time?: string;
}

export interface MarketFlow {
  symbol: string;
  last_price: number;
  bid_vol: number;
  ask_vol: number;
  imbalance: number; // -1 to 1
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  signal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL';
  volUSD?: number;
  change24h?: number;
}

export interface GitHubRepoInfo {
  name: string;
  full_name: string;
  branch: string;
  updated_at: string;
  last_commit_msg?: string;
  last_commit_date?: string;
  status: 'synced' | 'pending' | 'error';
}
