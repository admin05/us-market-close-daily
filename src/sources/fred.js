import { calculateTechnicalSnapshot } from '../indicators/technical.js';
import { fetchText } from '../utils/http.js';

const FRED_SERIES = {
  '^IRX': { id: 'DTB3', note: '用FRED 3个月国库券利率代理13周美债收益率' },
  '^FVX': { id: 'DGS5', note: '用FRED 5年期国债收益率' },
  '^TNX': { id: 'DGS10', note: '用FRED 10年期国债收益率' },
  '^TYX': { id: 'DGS30', note: '用FRED 30年期国债收益率' },
  'DX-Y.NYB': { id: 'DTWEXBGS', note: '用FRED广义美元指数代理DXY' },
  TLT: { id: 'DGS30', note: '用FRED 30年期国债收益率反向代理TLT' },
};

function offsetDate(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function parseFredCsv(csv, seriesId) {
  return String(csv || '')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, rawValue] = line.split(',');
      const value = Number(rawValue);
      if (!date || !Number.isFinite(value)) return null;
      return { date, close: value };
    })
    .filter(Boolean);
}

function invertTechnical(technical) {
  if (!technical) return technical;
  return {
    ...technical,
    changePct: Number.isFinite(technical.changePct) ? -technical.changePct : null,
    fiveDayPct: Number.isFinite(technical.fiveDayPct) ? -technical.fiveDayPct : null,
    oneMonthPct: Number.isFinite(technical.oneMonthPct) ? -technical.oneMonthPct : null,
    aboveMa20: null,
    aboveMa50: null,
    rsi14: null,
  };
}

export async function fetchFredQuote(symbolMeta, { timeoutMs }) {
  const series = FRED_SERIES[symbolMeta.symbol];
  if (!series) {
    throw new Error('Symbol is not supported by FRED fallback');
  }

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series.id)}&cosd=${offsetDate(370)}`;
  const csv = await fetchText(url, { timeoutMs });
  const points = parseFredCsv(csv, series.id).slice(-90);
  if (points.length < 2) {
    throw new Error(`FRED returned no usable data for ${series.id}`);
  }

  const technical = calculateTechnicalSnapshot(points);
  return {
    ...symbolMeta,
    source: 'FRED',
    sourceUrl: `https://fred.stlouisfed.org/series/${encodeURIComponent(series.id)}`,
    points,
    technical: symbolMeta.symbol === 'TLT' ? invertTechnical(technical) : technical,
    proxyNote: series.note,
    error: null,
  };
}
