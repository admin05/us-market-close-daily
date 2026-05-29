import { fetchText } from './utils/http.js';

const DEFAULT_BARK_GROUP = 'us-market-close-daily';

function normalizeBarkEndpoint(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\/+$/, '');
  }
  return `https://api.day.app/${encodeURIComponent(value)}`;
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Bark push timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendBark({ title, body, group = DEFAULT_BARK_GROUP, bark, timeoutMs = 15000 }) {
  const endpoint = normalizeBarkEndpoint(bark ?? process.env.BARK);
  if (!endpoint) {
    console.warn('[notify] BARK is not configured; skip Bark push.');
    return { ok: false, skipped: true, reason: 'missing_bark' };
  }

  const url = new URL(`${endpoint}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`);
  url.searchParams.set('group', group);

  try {
    await withTimeout(fetchText(url, { timeoutMs }), timeoutMs + 1000);
    return { ok: true, skipped: false };
  } catch (error) {
    console.warn(`[notify] Bark push failed: ${error.message}`);
    return { ok: false, skipped: false, reason: 'network_error' };
  }
}
