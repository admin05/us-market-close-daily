export async function fetchJson(url, { timeoutMs = 15000, headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': 'us-market-close-daily/0.1',
        accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
