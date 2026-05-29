import { fetchJson } from '../utils/http.js';
import { nextBusinessDate } from '../utils/dates.js';

const NASDAQ_EARNINGS_URL = 'https://api.nasdaq.com/api/calendar/earnings';
const DEFAULT_WATCH_SYMBOLS = new Set(['NVDA', 'AMD', 'AVGO', 'TSM', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'PLTR', 'VRT', 'CEG']);

function normalizeTime(rawValue) {
  const value = String(rawValue || '').toLowerCase();
  if (value.includes('pre')) return '盘前';
  if (value.includes('after')) return '盘后';
  if (value.includes('during')) return '盘中';
  if (value.includes('not-supplied')) return '未披露';
  return rawValue || '未披露';
}

function parseMarketCap(rawValue) {
  const value = String(rawValue || '').replace(/[$,\s]/g, '');
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRow(row, date) {
  return {
    date,
    symbol: String(row.symbol || '').trim().toUpperCase(),
    name: String(row.name || '').trim(),
    time: normalizeTime(row.time),
    marketCap: row.marketCap || '',
    marketCapValue: parseMarketCap(row.marketCap),
    fiscalQuarterEnding: row.fiscalQuarterEnding || '',
    epsForecast: row.epsForecast || '',
    estimates: row.noOfEsts || '',
    lastYearReportDate: row.lastYearRptDt || '',
    lastYearEps: row.lastYearEPS || '',
    sourceUrl: `${NASDAQ_EARNINGS_URL}?date=${encodeURIComponent(date)}`,
  };
}

async function fetchOneDay(date, { timeoutMs }) {
  const url = new URL(NASDAQ_EARNINGS_URL);
  url.searchParams.set('date', date);
  const payload = await fetchJson(url, {
    timeoutMs,
    headers: {
      origin: 'https://www.nasdaq.com',
      referer: 'https://www.nasdaq.com/',
    },
  });

  const rows = payload?.data?.rows || [];
  return rows
    .map((row) => normalizeRow(row, date))
    .filter((row) => row.symbol && row.name)
    .sort((a, b) => (b.marketCapValue || 0) - (a.marketCapValue || 0));
}

function chooseHighlights(events, watchedSymbols, limit) {
  const watched = events.filter((event) => watchedSymbols.has(event.symbol));
  const selected = [...watched];
  for (const event of events) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.symbol === event.symbol && item.date === event.date)) {
      selected.push(event);
    }
  }
  return selected.slice(0, limit);
}

export async function fetchEarningsCalendar({
  reportDate,
  watchSymbols = DEFAULT_WATCH_SYMBOLS,
  limit = 12,
  timeoutMs = 15000,
} = {}) {
  const nextDate = nextBusinessDate(reportDate);
  const watchedSymbols = new Set([...watchSymbols].map((symbol) => String(symbol).toUpperCase()));

  const dayResults = await Promise.allSettled([
    fetchOneDay(reportDate, { timeoutMs }),
    fetchOneDay(nextDate, { timeoutMs }),
  ]);

  const today = dayResults[0].status === 'fulfilled' ? dayResults[0].value : [];
  const next = dayResults[1].status === 'fulfilled' ? dayResults[1].value : [];
  const errors = dayResults
    .map((result, index) => (result.status === 'rejected' ? `${index === 0 ? reportDate : nextDate}: ${result.reason.message}` : null))
    .filter(Boolean);
  const events = [...today, ...next];

  return {
    ok: events.length > 0,
    source: 'Nasdaq Earnings Calendar',
    sourceUrl: `${NASDAQ_EARNINGS_URL}?date=${encodeURIComponent(reportDate)}`,
    reportDate,
    nextDate,
    today,
    next,
    highlights: chooseHighlights(events, watchedSymbols, limit),
    error: events.length ? null : errors.join(' | ') || 'no earnings events',
  };
}
