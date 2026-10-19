import { Trade, Position, BotConfig, MarketFlow } from '../types';
import { INITIAL_BOT_CONFIGS, INITIAL_CLOSED_TRADES, INITIAL_POSITIONS, INITIAL_MARKET_FLOWS } from '../data/initialData';

const STORAGE_KEYS = {
  BOTS: 'tb_bot_configs_v1',
  TRADES: 'tb_closed_trades_v1',
  POSITIONS: 'tb_active_positions_v1',
  FLOWS: 'tb_market_flows_v1',
};

export class TradingStore {
  static getBots(): BotConfig[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOTS);
      return data ? JSON.parse(data) : INITIAL_BOT_CONFIGS;
    } catch {
      return INITIAL_BOT_CONFIGS;
    }
  }

  static saveBots(bots: BotConfig[]) {
    localStorage.setItem(STORAGE_KEYS.BOTS, JSON.stringify(bots));
  }

  static getTrades(): Trade[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRADES);
      const trades: Trade[] = data ? JSON.parse(data) : INITIAL_CLOSED_TRADES;
      // Filter out any obsolete mock trades from previous demo runs
      const cleaned = trades.filter(t => !t.id.startsWith('TRD-OKX-10') && !t.id.startsWith('TRD-LENA-20'));
      return cleaned.length > 0 ? cleaned : INITIAL_CLOSED_TRADES;
    } catch {
      return INITIAL_CLOSED_TRADES;
    }
  }

  static saveTrades(trades: Trade[]) {
    const cleaned = trades.filter(t => !t.id.startsWith('TRD-OKX-10') && !t.id.startsWith('TRD-LENA-20'));
    localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(cleaned));
  }

  static getPositions(): Position[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.POSITIONS);
      const positions: Position[] = data ? JSON.parse(data) : INITIAL_POSITIONS;
      // Filter out mock test positions like POS-LENA-01 and POS-ANNA-01
      const cleaned = positions.filter(p => p.id !== 'POS-LENA-01' && p.id !== 'POS-ANNA-01');
      return cleaned.length > 0 ? cleaned : INITIAL_POSITIONS;
    } catch {
      return INITIAL_POSITIONS;
    }
  }

  static savePositions(positions: Position[]) {
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions));
  }

  static getFlows(): MarketFlow[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FLOWS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length >= 25) {
          return parsed;
        }
      }
      return INITIAL_MARKET_FLOWS;
    } catch {
      return INITIAL_MARKET_FLOWS;
    }
  }

  static saveFlows(flows: MarketFlow[]) {
    localStorage.setItem(STORAGE_KEYS.FLOWS, JSON.stringify(flows));
  }

  static resetToDefault(): { bots: BotConfig[]; trades: Trade[]; positions: Position[] } {
    localStorage.setItem(STORAGE_KEYS.BOTS, JSON.stringify(INITIAL_BOT_CONFIGS));
    localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(INITIAL_CLOSED_TRADES));
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(INITIAL_POSITIONS));
    return {
      bots: INITIAL_BOT_CONFIGS,
      trades: INITIAL_CLOSED_TRADES,
      positions: INITIAL_POSITIONS,
    };
  }

  static closePosition(
    positionId: string,
    exitPrice?: number,
    reason: Trade['exit_reason'] = 'MANUAL_CLOSE'
  ): { closedTrade: Trade; updatedPositions: Position[]; updatedTrades: Trade[] } {
    const positions = this.getPositions();
    const trades = this.getTrades();
    const posIndex = positions.findIndex(p => p.id === positionId);

    if (posIndex === -1) {
      throw new Error(`Position ${positionId} not found`);
    }

    const pos = positions[posIndex];
    const finalPrice = exitPrice ?? pos.current_price;
    const notionalValue = pos.size_units * finalPrice;
    const realizedPnl = pos.side === 'BUY'
      ? notionalValue - pos.allocated_usd
      : pos.allocated_usd - notionalValue;
    const pnlPct = ((finalPrice - pos.entry_price) / pos.entry_price) * 100 * (pos.side === 'BUY' ? 1 : -1);

    const closedTrade: Trade = {
      id: `TRD-EXIT-${Date.now().toString().slice(-6)}`,
      bot: pos.bot,
      symbol: pos.symbol,
      side: pos.side === 'BUY' ? 'SELL' : 'BUY',
      entry_price: pos.entry_price,
      exit_price: finalPrice,
      size_units: pos.size_units,
      notional_usd: Math.round(notionalValue * 100) / 100,
      leverage: pos.bot === 'Tradebotten Anna' ? 3 : 1,
      realized_pnl: Math.round(realizedPnl * 100) / 100,
      pnl_pct: Math.round(pnlPct * 100) / 100,
      exit_reason: reason,
      entry_time: pos.opened_at,
      exit_time: new Date().toISOString(),
      status: 'CLOSED'
    };

    const updatedPositions = positions.filter((_, idx) => idx !== posIndex);
    const updatedTrades = [closedTrade, ...trades];

    this.savePositions(updatedPositions);
    this.saveTrades(updatedTrades);

    return { closedTrade, updatedPositions, updatedTrades };
  }

  static panicCloseAll(): { closedCount: number; updatedTrades: Trade[] } {
    const positions = this.getPositions();
    let currentTrades = this.getTrades();

    positions.forEach(pos => {
      const notional = pos.size_units * pos.current_price;
      const realized = notional - pos.allocated_usd;
      const pct = ((pos.current_price - pos.entry_price) / pos.entry_price) * 100;
      const trade: Trade = {
        id: `PANIC-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        bot: pos.bot,
        symbol: pos.symbol,
        side: 'SELL',
        entry_price: pos.entry_price,
        exit_price: pos.current_price,
        size_units: pos.size_units,
        notional_usd: Math.round(notional * 100) / 100,
        realized_pnl: Math.round(realized * 100) / 100,
        pnl_pct: Math.round(pct * 100) / 100,
        exit_reason: 'MANUAL_CLOSE',
        entry_time: pos.opened_at,
        exit_time: new Date().toISOString(),
        status: 'CLOSED'
      };
      currentTrades.unshift(trade);
    });

    this.savePositions([]);
    this.saveTrades(currentTrades);

    return { closedCount: positions.length, updatedTrades: currentTrades };
  }
}
