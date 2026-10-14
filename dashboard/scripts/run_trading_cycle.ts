/**
 * Tradebot Dashboard Telemetry – READ-ONLY.
 * Lägger aldrig ordrar. Läser inga OKX-nycklar. Hittar aldrig på saldon eller status.
 * Ägarskap: Lena = OKX_AGGR_* (Lena-repot), Anna = OKX_ANNA_* (Annas Python-motor). Dashboarden läser bara.
 */
import fs from 'fs';
import path from 'path';

const UNKNOWN = 'okänt';

function main() {
  const payload = {
    updated_at: new Date().toISOString(),
    source: 'DASHBOARD_TELEMETRY_READ_ONLY',
    connected: false,
    isDemo: null,
    combinedEquityUSD: UNKNOWN,
    anna: { subaccount: 'OKX Anna (OKX_ANNA_*)', equityUSD: UNKNOWN, status: UNKNOWN, details: [], orders: [] },
    lena: { subaccount: 'OKX Lena (OKX_AGGR_*)', equityUSD: UNKNOWN, status: UNKNOWN, details: [], orders: [] },
    risk_engine: {
      kill_switch_active: UNKNOWN,
      reconciliation_status: 'NOT_PERFORMED',
      keys_location: 'NONE_IN_DASHBOARD',
      execution_mode: 'READ_ONLY_NO_ORDERS'
    },
    note: 'Saldon och status visas som okänt tills en verifierad, läsande källa finns.'
  };
  const statusPath = path.resolve(process.cwd(), 'public/data/status.json');
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Status skriven (read-only, okänt):', statusPath);
}

main();
