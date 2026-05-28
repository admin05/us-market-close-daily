const DEFAULT_BARK_GROUP = 'us-market-close-daily';

function normalizeBarkEndpoint(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\/+$/, '');
  }
  return `https://api.day.app/${encodeURIComponent(value)}`;
}

export async function sendBark({ title, body, group = DEFAULT_BARK_GROUP, bark }) {
  const endpoint = normalizeBarkEndpoint(bark ?? process.env.BARK);
  if (!endpoint) {
    console.warn('[notify] BARK is not configured; skip Bark push.');
    return { ok: false, skipped: true, reason: 'missing_bark' };
  }

  const url = new URL(`${endpoint}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`);
  url.searchParams.set('group', group);

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[notify] Bark push failed: HTTP ${response.status} ${text.slice(0, 200)}`);
      return { ok: false, skipped: false, reason: `http_${response.status}` };
    }
    return { ok: true, skipped: false };
  } catch (error) {
    console.warn(`[notify] Bark push failed: ${error.message}`);
    return { ok: false, skipped: false, reason: 'network_error' };
  }
}
