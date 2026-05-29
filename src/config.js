import { resolve } from 'node:path';

function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeDate(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`Invalid REPORT_DATE: ${value}. Expected YYYY-MM-DD.`);
}

export function loadConfig() {
  return {
    scriptName: '美股收盘日报',
    reportDate: normalizeDate(process.env.REPORT_DATE),
    reportsDir: resolve(process.env.REPORTS_DIR || 'reports'),
    dataDir: resolve(process.env.DATA_DIR || 'data'),
    httpTimeoutMs: readNumberEnv('HTTP_TIMEOUT_MS', 15000),
    barkTimeoutMs: readNumberEnv('BARK_TIMEOUT_MS', 8000),
    marketDataConcurrency: Math.max(1, Math.floor(readNumberEnv('MARKET_DATA_CONCURRENCY', 6))),
    finnhubApiKey: process.env.FINNHUB_API_KEY || '',
    fmpApiKey: process.env.FMP_API_KEY || '',
    newsSourceUrl: process.env.NEWS_SOURCE_URL || 'https://stocks.matraceai.com/',
    newsLimit: readNumberEnv('NEWS_LIMIT', 8),
    skipNews: process.env.SKIP_NEWS === '1',
    bark: process.env.BARK || '',
  };
}
