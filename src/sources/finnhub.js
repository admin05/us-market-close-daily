import { fetchJson } from '../utils/http.js';
import { calculateTechnicalSnapshot } from '../indicators/technical.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function toUnix(dateText) {
  return Math.floor(new Date(`${dateText}T00:00:00Z`).getTime() / 1000);
}

function offsetDate(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function isFinnhubSupported(symbolMeta) {
  const symbol = symbolMeta.symbol;
  if (symbol.startsWith('^')) return false;
  if (symbol.includes('=')) return false;
  if (symbol.endsWith('-USD')) return false;
  if (symbol.includes('.')) return false;
  return true;
}

export async function fetchFinnhubQuote(symbolMeta, { timeoutMs, apiKey }) {
  const symbol = symbolMeta.sourceSymbol || symbolMeta.symbol;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY is not configured');
  }
  if (!isFinnhubSupported(symbolMeta)) {
    throw new Error('Symbol is not supported by Finnhub fallback');
  }

  const from = toUnix(offsetDate(110));
  const to = Math.floor(Date.now() / 1000);
  const url = new URL(`${FINNHUB_BASE_URL}/stock/candle`);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('resolution', 'D');
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  url.searchParams.set('token', apiKey);

  const payload = await fetchJson(url, { timeoutMs });
  if (payload.s !== 'ok' || !Array.isArray(payload.c) || payload.c.length < 2) {
    throw new Error(payload.s && payload.s !== 'ok' ? `Finnhub status: ${payload.s}` : 'Finnhub returned no candle data');
  }

  const points = payload.t.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: payload.o[index],
    high: payload.h[index],
    low: payload.l[index],
    close: payload.c[index],
    volume: payload.v[index],
  })).filter((point) => Number.isFinite(point.close));

  if (points.length < 2) {
    throw new Error('Not enough reliable Finnhub price points');
  }

  return {
    ...symbolMeta,
    source: 'Finnhub',
    sourceUrl: `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}`,
    points,
    technical: calculateTechnicalSnapshot(points),
    error: null,
  };
}

