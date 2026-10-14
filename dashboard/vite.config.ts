import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiServerPlugin(): Plugin {
  return {
    name: 'trading-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) {
          return next();
        }

        const token = process.env.GITHUB_KEY || '';

        // 0. GET /api/bots/live-status (Real OKX balances and orders from environment secrets)
        if (url === '/api/bots/live-status' && req.method === 'GET') {
          try {
            const crypto = await import('crypto');

            const queryAccount = async (apiKey: string, secretKey: string, pass: string) => {
              if (!apiKey || !secretKey || !pass) return null;
              const timestamp = new Date().toISOString();
              const pathStr = '/api/v5/account/balance';
              const sign = crypto.createHmac('sha256', secretKey.trim())
                .update(timestamp + 'GET' + pathStr)
                .digest('base64');

              const headers = {
                'OK-ACCESS-KEY': apiKey.trim(),
                'OK-ACCESS-SIGN': sign,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': pass.trim(),
                'Content-Type': 'application/json',
                'User-Agent': 'Tradebot-CommandCenter/2.0'
              };

              // 1. Balance
              const bRes = await fetch(`https://eea.okx.com${pathStr}`, { headers });
              const bData = await bRes.json();

              // 2. Orders History
              const hPath = '/api/v5/trade/orders-history?instType=SPOT&limit=15';
              const hSign = crypto.createHmac('sha256', secretKey.trim())
                .update(timestamp + 'GET' + hPath)
                .digest('base64');
              const hRes = await fetch(`https://eea.okx.com${hPath}`, {
                headers: { ...headers, 'OK-ACCESS-SIGN': hSign }
              });
              const hData = await hRes.json();

              return { balance: bData, orders: hData };
            };

            // Ägarskap: Anna = OKX_ANNA_* enbart (ingen fallback till Lenas AGGR-passphrase). Endast läsande GET-anrop.
            const annaPass = (process.env.OKX_ANNA_PASS || '').trim();
            const [annaRes, lenaRes] = await Promise.all([
              queryAccount(process.env.OKX_ANNA_KEY || '', process.env.OKX_ANNA_SECRET || '', annaPass),
              queryAccount(process.env.OKX_AGGR_KEY || '', process.env.OKX_AGGR_SECRET || '', (process.env.OKX_AGGR_PASS || '').trim())
            ]);

            const parseAcc = (res: any, name: string) => {
              if (!res || res.balance?.code !== '0') {
                return { connected: false, name, error: res?.balance?.msg || 'Inte ansluten' };
              }
              const acc = res.balance.data?.[0] || {};
              const totalEq = parseFloat(acc.totalEq || '0');
              const details = (acc.details || []).map((d: any) => ({
                ccy: d.ccy,
                eq: parseFloat(d.eq || '0'),
                availBal: parseFloat(d.availBal || '0'),
                eqUsd: parseFloat(d.eqUsd || '0')
              })).filter((d: any) => d.eq > 0 || d.availBal > 0);

              const rawOrders = res.orders?.data || [];
              const parsedOrders = rawOrders.map((o: any) => ({
                id: `OKX-${o.ordId}`,
                bot: name,
                symbol: o.instId,
                side: (o.side || 'BUY').toUpperCase(),
                entry_price: parseFloat(o.fillPx || o.avgPx || '0'),
                exit_price: parseFloat(o.fillPx || o.avgPx || '0'),
                size_units: parseFloat(o.accFillSz || o.sz || '0'),
                notional_usd: parseFloat(o.fillPx || o.avgPx || '0') * parseFloat(o.accFillSz || o.sz || '0'),
                realized_pnl: parseFloat(o.pnl || '0'),
                pnl_pct: 0.0,
                exit_reason: o.state === 'filled' ? 'EXCHANGE_FILL' : 'MANUAL_CLOSE',
                entry_time: new Date(parseInt(o.cTime)).toISOString(),
                exit_time: new Date(parseInt(o.uTime || o.cTime)).toISOString(),
                status: 'CLOSED'
              }));

              return {
                connected: true,
                mode: 'SKARPT (Live)',
                totalEquityUSD: totalEq,
                details,
                orders: parsedOrders
              };
            };

            const annaParsed = parseAcc(annaRes, 'Tradebotten Anna');
            const lenaParsed = parseAcc(lenaRes, 'Aggressiva Lena');
            const combinedEquity = (annaParsed.totalEquityUSD || 0) + (lenaParsed.totalEquityUSD || 0);

            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              success: true,
              combinedEquityUSD: Math.round(combinedEquity * 100) / 100,
              anna: annaParsed,
              lena: lenaParsed
            }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        }

        // 1. GET /api/github/status
        if (url === '/api/github/status' && req.method === 'GET') {
          try {
            const headers: Record<string, string> = {
              'User-Agent': 'Tradebot-Command-Center',
              'Accept': 'application/vnd.github+json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const [annaRes, lenaRes, lenaCommits] = await Promise.all([
              fetch('https://api.github.com/repos/therog1/tradebottenanna', { headers }),
              fetch('https://api.github.com/repos/therog1/tradebottenaggresivalena', { headers }),
              fetch('https://api.github.com/repos/therog1/tradebottenaggresivalena/commits?per_page=3', { headers })
            ]);

            const annaData = await annaRes.json();
            const lenaData = await lenaRes.json();
            const lenaCommitsData = await lenaCommits.json();

            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              authenticated_user: 'therog1',
              has_token: Boolean(token),
              anna: {
                full_name: annaData.full_name || 'therog1/tradebottenanna',
                updated_at: annaData.updated_at,
                description: annaData.description
              },
              lena: {
                full_name: lenaData.full_name || 'therog1/tradebottenaggresivalena',
                updated_at: lenaData.updated_at,
                description: lenaData.description,
                latest_commits: Array.isArray(lenaCommitsData) ? lenaCommitsData.map((c: any) => ({
                  sha: c.sha?.substring(0, 7),
                  message: c.commit?.message,
                  date: c.commit?.author?.date
                })) : []
              }
            }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: e.message, has_token: Boolean(token) }));
          }
        }

        // 7. GET /api/market/flows (Top 30 Volume & Volatility pairs live from OKX)
        if (url === '/api/market/flows' && req.method === 'GET') {
          try {
            const okxRes = await fetch('https://eea.okx.com/api/v5/market/tickers?instType=SPOT');
            const data = await okxRes.json();
            const usdcPairs = (data.data || []).filter((t: any) =>
              t.instId.endsWith('-USDC') && !t.instId.startsWith('USDC-') && !t.instId.startsWith('EUR-')
            );
            // Sort by 24h volume
            usdcPairs.sort((a: any, b: any) => parseFloat(b.volCcy24h || '0') - parseFloat(a.volCcy24h || '0'));
            const top30 = usdcPairs.slice(0, 30).map((t: any) => {
              const bidSz = parseFloat(t.bidSz || '0');
              const askSz = parseFloat(t.askSz || '0');
              const total = bidSz + askSz;
              const imb = total > 0 ? (bidSz - askSz) / total : 0;
              const last = parseFloat(t.last || '0');
              const open = parseFloat(t.open24h || '0');
              const change = open > 0 ? ((last - open) / open) * 100 : 0;
              return {
                symbol: t.instId,
                last_price: last,
                bid_vol: Math.round(bidSz * 10) / 10,
                ask_vol: Math.round(askSz * 10) / 10,
                imbalance: Math.round(imb * 1000) / 1000,
                change24h: Math.round(change * 100) / 100,
                volUSD: Math.round(parseFloat(t.volCcy24h || '0')),
                trend: change >= 1 ? 'UP' : change <= -1 ? 'DOWN' : 'SIDEWAYS',
                signal: imb >= 0.5 ? 'STRONG BUY' : imb >= 0.2 ? 'BUY' : imb <= -0.2 ? 'SELL' : 'NEUTRAL'
              };
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, count: top30.length, flows: top30 }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        }

        // /api/okx/balance borttagen: dashboarden tar aldrig emot nycklar från webbläsaren.
        if (url === '/api/okx/balance') {
          res.statusCode = 410;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ connected: false, error: 'Borttagen: nycklar matas aldrig in i dashboarden. Saldon läses endast server-side (read-only).' }));
        }

        // 3. GET /api/diagnostics
        if (url === '/api/diagnostics' && req.method === 'GET') {
          try {
            const { runFullDiagnostic } = await import('./src/services/autoDiagnostic.ts');
            const report = await runFullDiagnostic();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(report));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: e.message, healthy: false }));
          }
        }

        // /api/github/trigger-workflow borttagen: dashboarden får inte starta handelsworkflows.

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: '/tradebottenanna/',
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
