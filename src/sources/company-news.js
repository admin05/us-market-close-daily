import { fetchText } from '../utils/http.js';

const DEFAULT_COMPANY_SYMBOLS = ['NVDA', 'AMD', 'AVGO', 'TSM', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'PLTR', 'VRT', 'CEG'];

function stockPath(symbol) {
  return `/stocks/${String(symbol).toLowerCase().replace('.', '-')}/`;
}

function findArrayAfterMarker(text, marker) {
  const start = String(text || '').indexOf(marker);
  if (start < 0) return '';

  let depth = 1;
  let inString = false;
  let escaped = false;
  const dataStart = start + marker.length;
  for (let index = dataStart; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') inString = true;
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) return text.slice(dataStart, index);
  }
  return '';
}

function unescapeJsString(value) {
  return String(value || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function parseFields(objectText) {
  const fields = {};
  for (const match of objectText.matchAll(/([a-z]+):"((?:\\.|[^"\\])*)"/g)) {
    fields[match[1]] = unescapeJsString(match[2]);
  }
  return fields;
}

function parseNews(html, symbol, limit) {
  const data = findArrayAfterMarker(html, 'data:[');
  if (!data) return [];

  return [...data.matchAll(/\{([^{}]+)\}/g)]
    .map((match) => parseFields(match[1]))
    .filter((item) => (item.title || item.t) && (item.url || item.u))
    .slice(0, limit)
    .map((item) => ({
      symbol,
      title: item.title || item.t,
      url: item.url || item.u,
      publisher: item.source || item.n || 'StockAnalysis',
      age: item.ago || item.d || item.time || '',
    }));
}

export async function fetchCompanyNews({
  symbols = DEFAULT_COMPANY_SYMBOLS,
  perSymbolLimit = 2,
  totalLimit = 12,
  timeoutMs = 15000,
} = {}) {
  const events = [];
  const errors = [];

  for (const symbol of symbols) {
    const sourceUrl = `https://stockanalysis.com${stockPath(symbol)}`;
    try {
      const html = await fetchText(sourceUrl, { timeoutMs });
      events.push(...parseNews(html, symbol, perSymbolLimit));
    } catch (error) {
      errors.push(`${symbol}: ${error.message}`);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const event of events) {
    const key = event.url || `${event.symbol}:${event.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
    if (deduped.length >= totalLimit) break;
  }

  return {
    ok: deduped.length > 0,
    source: 'StockAnalysis Company News',
    sourceUrl: 'https://stockanalysis.com/stocks/',
    events: deduped,
    error: deduped.length ? null : errors.join(' | ') || 'no company news',
  };
}
