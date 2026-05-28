import { fetchJson } from '../utils/http.js';
import { calculateTechnicalSnapshot } from '../indicators/technical.js';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable/historical-price-eod/full';

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

  const payload = await fetchJson(url, { timeoutMs });
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
    throw new Error('FMP returned no historical price data');
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
