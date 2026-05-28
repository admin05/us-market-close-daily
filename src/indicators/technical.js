function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function movingAverage(closes, window) {
  if (closes.length < window) return null;
  return average(closes.slice(-window));
}

function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function rsi(closes, period = 14) {
  if (closes.length <= period) return null;

  const changes = [];
  for (let i = closes.length - period; i < closes.length; i += 1) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.max(-change, 0));
  const avgGain = average(gains);
  const avgLoss = average(losses);

  if (!avgGain && !avgLoss) return 50;
  if (!avgLoss) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateTechnicalSnapshot(points) {
  const closes = points.map((point) => point.close).filter(Number.isFinite);
  const latest = points.at(-1);
  const previous = points.at(-2);
  const fiveSessionsAgo = points.at(-6);
  const monthAgo = points.at(-22);
  const ma20 = movingAverage(closes, 20);
  const ma50 = movingAverage(closes, 50);

  return {
    close: round(latest?.close),
    previousClose: round(previous?.close),
    changePct: round(pctChange(latest?.close, previous?.close)),
    fiveDayPct: round(pctChange(latest?.close, fiveSessionsAgo?.close)),
    oneMonthPct: round(pctChange(latest?.close, monthAgo?.close)),
    ma20: round(ma20),
    ma50: round(ma50),
    aboveMa20: Number.isFinite(latest?.close) && Number.isFinite(ma20) ? latest.close >= ma20 : null,
    aboveMa50: Number.isFinite(latest?.close) && Number.isFinite(ma50) ? latest.close >= ma50 : null,
    rsi14: round(rsi(closes, 14)),
    latestDate: latest?.date || null,
  };
}
