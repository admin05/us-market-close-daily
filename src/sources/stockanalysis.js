import { calculateTechnicalSnapshot } from '../indicators/technical.js';
import { fetchText } from '../utils/http.js';

const STOCKANALYSIS_SYMBOLS = {
  '^GSPC': { path: '/etf/spy/history/', note: '用SPY代理标普500指数' },
  '^IXIC': { path: '/etf/qqq/history/', note: '用QQQ代理纳斯达克指数' },
  '^DJI': { path: '/etf/dia/history/', note: '用DIA代理道琼斯指数' },
  '^RUT': { path: '/etf/iwm/history/', note: '用IWM代理罗素2000指数' },
  '^VIX': { path: '/etf/vixy/history/', note: '用VIXY代理VIX波动率' },
  '^IRX': { path: '/etf/sgov/history/', note: '用SGOV代理短端美债' },
  '^FVX': { path: '/etf/ief/history/', note: '用IEF代理5年期美债' },
  '^TNX': { path: '/etf/ief/history/', note: '用IEF代理10年期美债' },
  '^TYX': { path: '/etf/tlt/history/', note: '用TLT代理30年期美债' },
  'DX-Y.NYB': { path: '/etf/uup/history/', note: '用UUP代理美元指数' },
  'GC=F': { path: '/etf/gld/history/', note: '用GLD代理黄金' },
  'CL=F': { path: '/etf/uso/history/', note: '用USO代理WTI原油' },
  'BZ=F': { path: '/etf/bno/history/', note: '用BNO代理Brent原油' },
  'BTC-USD': { path: '/etf/ibit/history/', note: '用IBIT代理比特币' },
  'ETH-USD': { path: '/etf/etha/history/', note: '用ETHA代理以太坊' },
};

const ETF_SYMBOLS = new Set([
  'SPY',
  'QQQ',
  'DIA',
  'IWM',
  'SMH',
  'SOXX',
  'XLK',
  'XLC',
  'XLY',
  'XLF',
  'XLI',
  'XLV',
  'XLP',
  'XLE',
  'XLU',
  'XLB',
  'XLRE',
  'TLT',
  'HYG',
  'LQD',
]);

function stockAnalysisPath(symbolMeta) {
  const configured = STOCKANALYSIS_SYMBOLS[symbolMeta.symbol];
  if (configured) return configured;

  const symbol = symbolMeta.sourceSymbol || symbolMeta.symbol;
  if (!/^[A-Z.]+$/.test(symbol)) {
    throw new Error('Symbol is not supported by StockAnalysis fallback');
  }

  const slug = symbol.toLowerCase().replace('.', '-');
  if (ETF_SYMBOLS.has(symbol)) return { path: `/etf/${slug}/history/`, note: null };
  return { path: `/stocks/${slug}/history/`, note: null };
}

function findHistoryData(html) {
  const text = String(html || '');
  const marker = 'data:[';
  const start = text.indexOf(marker);
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

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseHistoryRows(html) {
  const data = findHistoryData(html);
  if (!data) return [];

  const rows = [];
  const rowPattern = /\{([^{}]+)\}/g;
  for (const match of data.matchAll(rowPattern)) {
    const rowText = match[1];
    const row = {};
    for (const field of rowText.matchAll(/([a-z]+):(?:"([^"]*)"|([^,}]+))/g)) {
      row[field[1]] = field[2] ?? field[3];
    }

    const point = {
      date: row.t,
      open: parseNumber(row.o),
      high: parseNumber(row.h),
      low: parseNumber(row.l),
      close: parseNumber(row.c),
      volume: parseNumber(row.v),
    };
    if (point.date && Number.isFinite(point.close)) rows.push(point);
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
}

export async function fetchStockAnalysisQuote(symbolMeta, { timeoutMs }) {
  const route = stockAnalysisPath(symbolMeta);
  const url = `https://stockanalysis.com${route.path}`;
  const html = await fetchText(url, { timeoutMs });
  const points = parseHistoryRows(html);
  if (points.length < 2) {
    throw new Error('StockAnalysis returned no usable history data');
  }

  return {
    ...symbolMeta,
    source: 'StockAnalysis',
    sourceUrl: url,
    points,
    technical: calculateTechnicalSnapshot(points),
    proxyNote: route.note || symbolMeta.proxyNote,
    error: null,
  };
}
