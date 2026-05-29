import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as tlsConnect } from 'node:tls';

const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
};

function getProxyForUrl(targetUrl) {
  const target = new URL(targetUrl);
  if (target.protocol === 'https:') return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
  return process.env.HTTP_PROXY || '';
}

function requestViaProxy(url, { timeoutMs, headers }) {
  const proxy = getProxyForUrl(url);
  if (!proxy) return null;

  return new Promise((resolve, reject) => {
    let settled = false;
    const sockets = new Set();
    const watchdog = setTimeout(() => {
      if (!settled) {
        for (const socket of sockets) socket.destroy();
        settled = true;
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    function settle(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      for (const socket of sockets) socket.destroy();
      fn(value);
    }

    const target = new URL(url);
    const proxyUrl = new URL(proxy);
    const isHttpsProxy = proxyUrl.protocol === 'https:';
    const requestImpl = isHttpsProxy ? httpsRequest : httpRequest;

    if (target.protocol === 'https:' && proxyUrl.protocol === 'http:') {
      const connectRequest = httpRequest({
        protocol: proxyUrl.protocol,
        hostname: proxyUrl.hostname,
        port: proxyUrl.port || 80,
        method: 'CONNECT',
        path: `${target.hostname}:${target.port || 443}`,
        headers: proxyUrl.username
          ? { 'Proxy-Authorization': `Basic ${Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString('base64')}` }
          : undefined,
        timeout: timeoutMs,
      });

      connectRequest.on('connect', (response, socket) => {
        sockets.add(socket);
        if (response.statusCode !== 200) {
          socket.destroy();
          settle(reject, new Error(`Proxy CONNECT failed: HTTP ${response.statusCode}`));
          return;
        }

        const tlsSocket = tlsConnect({
          socket,
          servername: target.hostname,
        }, () => {
          sockets.add(tlsSocket);
          const path = `${target.pathname}${target.search}`;
          const headerLines = [
            `GET ${path || '/'} HTTP/1.1`,
            `Host: ${target.host}`,
            ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),
            'Connection: close',
            '',
            '',
          ];
          tlsSocket.write(headerLines.join('\r\n'));
        });

        let raw = Buffer.alloc(0);
        tlsSocket.on('data', (chunk) => {
          raw = Buffer.concat([raw, chunk]);
        });
        tlsSocket.on('end', () => {
          const rawText = raw.toString('utf8');
          const separator = rawText.indexOf('\r\n\r\n');
          const headerText = separator >= 0 ? rawText.slice(0, separator) : '';
          const body = separator >= 0 ? rawText.slice(separator + 4) : rawText;
          const statusLine = headerText.split('\r\n')[0] || '';
          const statusMatch = statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/);
          const status = statusMatch ? Number(statusMatch[1]) : 0;
          settle(resolve, {
            ok: status >= 200 && status < 300,
            status,
            text: async () => body,
            json: async () => JSON.parse(body),
          });
        });
        tlsSocket.on('error', (error) => settle(reject, error));
      });

      connectRequest.on('timeout', () => {
        connectRequest.destroy(new Error(`Proxy CONNECT timed out after ${timeoutMs}ms`));
      });
      connectRequest.on('error', (error) => settle(reject, error));
      connectRequest.end();
      return;
    }

    const request = requestImpl({
      protocol: proxyUrl.protocol,
      hostname: proxyUrl.hostname,
      port: proxyUrl.port || (isHttpsProxy ? 443 : 80),
      method: 'GET',
      path: target.toString(),
      headers,
      timeout: timeoutMs,
    }, (response) => {
      sockets.add(response.socket);
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        settle(resolve, {
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          text: async () => body,
          json: async () => JSON.parse(body),
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    request.on('error', (error) => settle(reject, error));
    request.end();
  });
}

async function requestUrl(url, { timeoutMs, headers }) {
  const proxied = requestViaProxy(url, { timeoutMs, headers });
  if (proxied) return proxied;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson(url, { timeoutMs = 15000, headers = {} } = {}) {
  const requestHeaders = {
    ...DEFAULT_HEADERS,
    accept: 'application/json,text/plain,*/*',
    ...headers,
  };

  const response = await requestUrl(url, { timeoutMs, headers: requestHeaders });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  return await response.json();
}

export async function fetchText(url, { timeoutMs = 15000, headers = {} } = {}) {
  const requestHeaders = {
    ...DEFAULT_HEADERS,
    accept: 'text/html,application/xhtml+xml',
    ...headers,
  };

  const response = await requestUrl(url, { timeoutMs, headers: requestHeaders });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  return await response.text();
}
