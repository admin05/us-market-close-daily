const HTML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtml(text) {
  return String(text || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return HTML_ENTITIES[entity] || match;
  });
}

export function stripTags(html) {
  return decodeHtml(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function extractFirst(pattern, text) {
  const match = String(text || '').match(pattern);
  return match ? stripTags(match[1]) : null;
}

export function extractAll(pattern, text) {
  return [...String(text || '').matchAll(pattern)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}
