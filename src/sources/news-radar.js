import { fetchText } from '../utils/http.js';
import { decodeHtml, extractAll, extractFirst } from '../utils/html.js';

const DEFAULT_SOURCE_NAME = '新闻雷达';

function absolutizeUrl(path, baseUrl) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function getAttr(block, name) {
  const match = block.match(new RegExp(`${name}="([^"]+)"`));
  return match ? decodeHtml(match[1]) : null;
}

function parseEventCard(block, baseUrl) {
  const id = getAttr(block, 'data-event-id') || getAttr(block, 'id')?.replace(/^evc-/, '') || null;
  const href = getAttr(block, 'href');
  const title = extractFirst(/<h3[^>]*class="[^"]*\bev-title\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/, block);
  if (!title || !href) return null;

  return {
    id,
    title,
    type: extractFirst(/<span[^>]*class="[^"]*\bev-type-tag\b[^"]*"[^>]*>([\s\S]*?)<\/span>/, block),
    time: extractFirst(/<span[^>]*class="[^"]*\bev-time\b[^"]*"[^>]*>([\s\S]*?)<\/span>/, block),
    expectationScore: extractFirst(/<span[^>]*class="[^"]*\bev-exp-score\b[^"]*"[^>]*[^>]*>([\s\S]*?)<\/span>/, block),
    stocks: extractAll(/<span[^>]*class="[^"]*\bev-stock-pill-name\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g, block).slice(0, 6),
    concepts: extractAll(/<span[^>]*class="[^"]*\bev-concept-chip\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g, block).slice(0, 6),
    url: absolutizeUrl(href, baseUrl),
    source: DEFAULT_SOURCE_NAME,
  };
}

export function parseNewsRadarEvents(html, baseUrl) {
  const cards = [...String(html || '').matchAll(/<a\b[^>]*class="[^"]*\bev-card\b[^"]*"[\s\S]*?<\/a>/g)];
  return cards
    .map((match) => parseEventCard(match[0], baseUrl))
    .filter(Boolean);
}

export async function fetchNewsRadarEvents({ sourceUrl, limit = 8, timeoutMs }) {
  try {
    const html = await fetchText(sourceUrl, { timeoutMs });
    const events = parseNewsRadarEvents(html, sourceUrl).slice(0, limit);
    return {
      ok: events.length > 0,
      source: DEFAULT_SOURCE_NAME,
      sourceUrl,
      events,
      error: events.length ? null : 'No event cards found',
    };
  } catch (error) {
    return {
      ok: false,
      source: DEFAULT_SOURCE_NAME,
      sourceUrl,
      events: [],
      error: error.message,
    };
  }
}
