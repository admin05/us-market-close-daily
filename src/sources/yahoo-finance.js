import { fetchJson } from '../utils/http.js';
import { calculateTechnicalSnapshot } from '../indicators/technical.js';

const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

function yahooQuoteUrl(symbol) {
  const encoded = encodeURIComponent(symbol);
  return `${YAHOO_CHART_BASE}/${encoded}?range=3mo&interval=1d&includePrePost=false&events=history`;
}

function toIsoDate(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

function normalizeChart(symbolMeta, payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) {
    const error = payload?.chart?.error?.description || 'Yahoo Finance returned no chart result';
    throw new Error(error);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const volumes = quote.volume || [];

  const points = timestamps
    .map((timestamp, index) => ({
      date: toIsoDate(timestamp),
      open: opens[index],
      high: highs[index],
      low: lows[index],
      close: closes[index],
      volume: volumes[index],
    }))
    .filter((point) => Number.isFinite(point.close));

  if (points.length < 2) {
    throw new Error('Not enough reliable price points');
  }

  const sourceSymbol = result.meta?.symbol || symbolMeta.sourceSymbol || symbolMeta.symbol;
  return {
    ...symbolMeta,
    source: 'Yahoo Finance',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(sourceSymbol)}`,
    currency: result.meta?.currency || null,
    exchangeName: result.meta?.exchangeName || null,
    timezone: result.meta?.exchangeTimezoneName || null,
    points,
    technical: calculateTechnicalSnapshot(points),
    error: null,
  };
}

export async function fetchYahooQuote(symbolMeta, { timeoutMs }) {
  const sourceSymbol = symbolMeta.sourceSymbol || symbolMeta.symbol;
  const url = yahooQuoteUrl(sourceSymbol);
  try {
    const payload = await fetchJson(url, { timeoutMs });
    return normalizeChart(symbolMeta, payload);
  } catch (error) {
    return {
      ...symbolMeta,
      source: 'Yahoo Finance',
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(sourceSymbol)}`,
      points: [],
      technical: null,
      error: error.message,
    };
  }
}

export async function fetchYahooQuotes(symbols, options) {
  const results = [];
  for (const symbol of symbols) {
    results.push(await fetchYahooQuote(symbol, options));
  }
  return results;
}
