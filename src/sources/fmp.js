import { fetchJson } from '../utils/http.js';
import { calculateTechnicalSnapshot } from '../indicators/technical.js';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable/historical-price-eod/full';
const FMP_QUOTE_URL = 'https://financialmodelingprep.com/stable/quote';

const FMP_SYMBOLS = {
  '^GSPC': '^GSPC',
  '^IXIC': '^IXIC',
  '^DJI': '^DJI',
  '^RUT': '^RUT',
  '^VIX': '^VIX',
  'DX-Y.NYB': 'DX',
  'GC=F': 'GCUSD',
  'CL=F': 'CLUSD',
  'BZ=F': 'BZUSD',
  'BTC-USD': 'BTCUSD',
  'ETH-USD': 'ETHUSD',
};

function offsetDate(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function normalizePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.historical)) return payload.historical;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getFmpSymbol(symbolMeta) {
  return FMP_SYMBOLS[symbolMeta.symbol] || symbolMeta.sourceSymbol || symbolMeta.symbol;
}

export async function fetchFmpQuote(symbolMeta, { timeoutMs, apiKey }) {
  if (!apiKey) {
    throw new Error('FMP_API_KEY is not configured');
  }

  const symbol = getFmpSymbol(symbolMeta);
  const url = new URL(FMP_BASE_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('from', offsetDate(110));
  url.searchParams.set('to', new Date().toISOString().slice(0, 10));
  url.searchParams.set('apikey', apiKey);

  let payload;
  try {
    payload = await fetchJson(url, { timeoutMs });
  } catch (error) {
    if (!String(error.message || '').includes('HTTP 402')) {
      throw error;
    }
    return fetchFmpQuoteSnapshot(symbolMeta, { timeoutMs, apiKey, cause: error.message });
  }

  if (payload?.['Error Message']) {
    throw new Error(payload['Error Message']);
  }

  const rows = normalizePayload(payload);
  const points = rows
    .map((row) => ({
      date: row.date,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close ?? row.adjClose),
      volume: Number(row.volume),
    }))
    .filter((point) => point.date && Number.isFinite(point.close))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    return fetchFmpQuoteSnapshot(symbolMeta, { timeoutMs, apiKey, cause: 'FMP returned no historical price data' });
  }

  return {
    ...symbolMeta,
    source: 'Financial Modeling Prep',
    sourceUrl: `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}`,
    points,
    technical: calculateTechnicalSnapshot(points),
    error: null,
  };
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function normalizeChangePct(rawValue) {
  const value = firstFinite(rawValue);
  if (value === null) return null;
  return Math.abs(value) > 1 ? value : value * 100;
}

async function fetchFmpQuoteSnapshot(symbolMeta, { timeoutMs, apiKey, cause }) {
  const symbol = getFmpSymbol(symbolMeta);
  const url = new URL(FMP_QUOTE_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);

  const payload = await fetchJson(url, { timeoutMs });
  if (payload?.['Error Message']) {
    throw new Error(payload['Error Message']);
  }

  const quote = Array.isArray(payload) ? payload[0] : payload?.[0] || payload;
  const close = firstFinite(quote?.price, quote?.close, quote?.previousClose);
  const changePct = normalizeChangePct(quote?.changesPercentage ?? quote?.changePercentage ?? quote?.changesPercentageToday);

  if (close === null || changePct === null) {
    throw new Error(`${cause}; FMP quote snapshot returned no price/change`);
  }

  return {
    ...symbolMeta,
    source: 'Financial Modeling Prep Quote',
    sourceUrl: `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}`,
    points: [],
    technical: {
      close,
      previousClose: firstFinite(quote?.previousClose),
      changePct,
      fiveDayPct: null,
      oneMonthPct: null,
      ma20: null,
      ma50: null,
      aboveMa20: null,
      aboveMa50: null,
      rsi14: null,
      latestDate: quote?.timestamp ? new Date(Number(quote.timestamp) * 1000).toISOString().slice(0, 10) : null,
    },
    quoteOnly: true,
    error: null,
  };
}
