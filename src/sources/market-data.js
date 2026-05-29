import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { fetchFinnhubQuote } from './finnhub.js';
import { fetchFmpQuote } from './fmp.js';
import { fetchFredQuote } from './fred.js';
import { fetchStockAnalysisQuote } from './stockanalysis.js';
import { fetchYahooQuote } from './yahoo-finance.js';

const INDEX_PROXY_SYMBOLS = {
  '^GSPC': { symbol: 'SPY', note: '用SPY代理标普500指数' },
  '^IXIC': { symbol: 'QQQ', note: '用QQQ代理纳斯达克指数' },
  '^DJI': { symbol: 'DIA', note: '用DIA代理道琼斯指数' },
  '^RUT': { symbol: 'IWM', note: '用IWM代理罗素2000指数' },
};

const FMP_DIRECT_PROXY_SYMBOLS = {
  QQQ: { symbol: '^IXIC', note: '用纳斯达克综合指数代理QQQ' },
  DIA: { symbol: '^DJI', note: '用道琼斯指数代理DIA' },
  IWM: { symbol: '^RUT', note: '用罗素2000指数代理IWM' },
  XLK: { symbol: 'AAPL', note: '用AAPL代理科技板块' },
  XLC: { symbol: 'GOOGL', note: '用GOOGL代理通信服务板块' },
  XLY: { symbol: 'AMZN', note: '用AMZN代理可选消费板块' },
  XLF: { symbol: 'JPM', note: '用JPM代理金融板块' },
  XLI: { symbol: 'GE', note: '用GE代理工业板块' },
  XLV: { symbol: '^GSPC', note: '用标普500指数代理医疗保健板块' },
  XLP: { symbol: 'WMT', note: '用WMT代理必需消费板块' },
  XLE: { symbol: 'XOM', note: '用XOM代理能源板块' },
  XLU: { symbol: '^GSPC', note: '用标普500指数代理公用事业板块' },
  XLB: { symbol: '^GSPC', note: '用标普500指数代理材料板块' },
  XLRE: { symbol: '^GSPC', note: '用标普500指数代理房地产板块' },
  AVGO: { symbol: 'NVDA', note: '用NVDA代理博通' },
  VRT: { symbol: 'NVDA', note: '用NVDA代理数据中心电力链' },
  CEG: { symbol: '^GSPC', note: '用标普500指数代理电力股' },
  'CL=F': { symbol: 'BZ=F', note: '用Brent原油代理WTI原油' },
  SMH: { symbol: 'NVDA', note: '用NVDA代理半导体主题' },
  SOXX: { symbol: 'NVDA', note: '用NVDA代理半导体主题' },
  TLT: { symbol: '^TYX', note: '用30年期美债收益率反向观察长债' },
  HYG: { symbol: 'SPY', note: '用SPY代理信用风险偏好' },
  LQD: { symbol: '^GSPC', note: '用标普500指数代理投资级信用风险偏好' },
};

function withProxy(symbolMeta) {
  const proxy = INDEX_PROXY_SYMBOLS[symbolMeta.symbol];
  if (!proxy) return null;
  return {
    ...symbolMeta,
    sourceSymbol: proxy.symbol,
    proxyNote: proxy.note,
  };
}

function withFmpDirectProxy(symbolMeta) {
  const proxy = FMP_DIRECT_PROXY_SYMBOLS[symbolMeta.symbol];
  if (!proxy) return null;
  return {
    ...symbolMeta,
    sourceSymbol: proxy.symbol,
    proxyNote: proxy.note,
  };
}

function addError(symbolMeta, errors) {
  return {
    ...symbolMeta,
    source: 'Yahoo Finance / Finnhub',
    sourceUrl: symbolMeta.sourceUrl || '',
    points: [],
    technical: null,
    error: errors.join(' | '),
  };
}

function cloneResultForSymbol(baseResult, symbolMeta, overrides = {}) {
  return {
    ...baseResult,
    ...symbolMeta,
    source: baseResult.source,
    sourceUrl: baseResult.sourceUrl,
    points: baseResult.points,
    technical: baseResult.technical,
    quoteOnly: baseResult.quoteOnly,
    proxyNote: overrides.proxyNote ?? baseResult.proxyNote,
    error: baseResult.error ?? null,
  };
}

function cacheableResult(result) {
  return result && !result.error && result.technical;
}

async function cachedRequest(cache, key, fetcher) {
  if (cache.has(key)) return cache.get(key);
  const promise = fetcher();
  cache.set(key, promise);
  try {
    const result = await promise;
    cache.set(key, Promise.resolve(result));
    return result;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

async function loadPersistentCache(cachePath) {
  if (!cachePath) return new Map();
  try {
    const raw = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

async function savePersistentCache(cachePath, persistentCache) {
  if (!cachePath) return;
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(Object.fromEntries(persistentCache), null, 2), 'utf8');
}

function finalCacheKey(symbolMeta) {
  return `final:${symbolMeta.symbol}`;
}

function isRateLimitError(error) {
  return /HTTP 429|Too Many Requests|Limit Reach/i.test(String(error?.message || error || ''));
}

function markUnavailable(options, source, error) {
  if (isRateLimitError(error)) {
    options.unavailableSources?.add(source);
  }
}

async function fetchWithFallback(symbolMeta, options) {
  const errors = [];
  const persistentCache = options.persistentCache;
  const cachedFinal = persistentCache?.get(finalCacheKey(symbolMeta));
  if (cachedFinal) {
    return { ...cachedFinal, cacheHit: true };
  }

  try {
    const fredResult = await cachedRequest(
      options.requestCache,
      `fred:${symbolMeta.symbol}`,
      () => fetchFredQuote(symbolMeta, { timeoutMs: options.timeoutMs }),
    );
    return cloneResultForSymbol(fredResult, symbolMeta, { proxyNote: fredResult.proxyNote });
  } catch (error) {
    if (!String(error.message || '').includes('not supported')) {
      errors.push(`FRED: ${error.message}`);
    }
  }

  if (options.fmpApiKey && !options.unavailableSources?.has('fmp')) {
    const proxyMeta = withFmpDirectProxy(symbolMeta);
    if (proxyMeta) {
      try {
        const proxyResult = await cachedRequest(
          options.requestCache,
          `fmp:${proxyMeta.sourceSymbol || proxyMeta.symbol}`,
          () => fetchFmpQuote(proxyMeta, {
            timeoutMs: options.timeoutMs,
            apiKey: options.fmpApiKey,
          }),
        );
        return cloneResultForSymbol(proxyResult, symbolMeta, { proxyNote: proxyMeta.proxyNote });
      } catch (error) {
        markUnavailable(options, 'fmp', error);
        errors.push(`FMP proxy: ${error.message}`);
      }
    }

    if (!proxyMeta || !options.unavailableSources?.has('fmp')) {
      try {
        const fmpResult = await cachedRequest(
          options.requestCache,
          `fmp:${symbolMeta.sourceSymbol || symbolMeta.symbol}`,
          () => fetchFmpQuote(symbolMeta, {
            timeoutMs: options.timeoutMs,
            apiKey: options.fmpApiKey,
          }),
        );
        return cloneResultForSymbol(fmpResult, symbolMeta);
      } catch (error) {
        markUnavailable(options, 'fmp', error);
        errors.push(`FMP: ${error.message}`);
      }
    }
  } else {
    errors.push(options.unavailableSources?.has('fmp') ? 'FMP: skipped after rate limit' : 'FMP: FMP_API_KEY is not configured');
  }

  if (options.finnhubApiKey) {
    try {
      const finnhubResult = await cachedRequest(
        options.requestCache,
        `finnhub:${symbolMeta.sourceSymbol || symbolMeta.symbol}`,
        () => fetchFinnhubQuote(symbolMeta, {
          timeoutMs: options.timeoutMs,
          apiKey: options.finnhubApiKey,
        }),
      );
      return cloneResultForSymbol(finnhubResult, symbolMeta);
    } catch (error) {
      errors.push(`Finnhub: ${error.message}`);
    }

    const proxyMeta = withProxy(symbolMeta);
    if (proxyMeta) {
      try {
        const proxyResult = await cachedRequest(
          options.requestCache,
          `finnhub:${proxyMeta.sourceSymbol || proxyMeta.symbol}`,
          () => fetchFinnhubQuote(proxyMeta, {
            timeoutMs: options.timeoutMs,
            apiKey: options.finnhubApiKey,
          }),
        );
        return cloneResultForSymbol(proxyResult, symbolMeta, {
          proxyNote: proxyMeta.proxyNote,
        });
      } catch (error) {
        errors.push(`Finnhub proxy: ${error.message}`);
      }
    }
  } else {
    errors.push('Finnhub: FINNHUB_API_KEY is not configured');
  }

  try {
    const stockAnalysisResult = await cachedRequest(
      options.requestCache,
      `stockanalysis:${symbolMeta.sourceSymbol || symbolMeta.symbol}`,
      () => fetchStockAnalysisQuote(symbolMeta, options),
    );
    return cloneResultForSymbol(stockAnalysisResult, symbolMeta, {
      proxyNote: stockAnalysisResult.proxyNote,
    });
  } catch (error) {
    errors.push(`StockAnalysis: ${error.message}`);
  }

  if (!options.unavailableSources?.has('yahoo')) {
    const yahooResult = await cachedRequest(
      options.requestCache,
      `yahoo:${symbolMeta.sourceSymbol || symbolMeta.symbol}`,
      () => fetchYahooQuote(symbolMeta, options),
    );
    if (!yahooResult.error) return yahooResult;
    markUnavailable(options, 'yahoo', yahooResult.error);
    errors.push(`Yahoo: ${yahooResult.error}`);
  } else {
    errors.push('Yahoo: skipped after rate limit');
  }

  return addError(symbolMeta, errors);
}

export async function fetchMarketQuotes(symbols, options = {}) {
  const concurrency = Math.max(1, Math.floor(options.concurrency || 6));
  const results = new Array(symbols.length);
  const requestCache = new Map();
  const persistentCache = await loadPersistentCache(options.cachePath);
  const unavailableSources = new Set();
  let cacheDirty = false;
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < symbols.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const symbol = symbols[currentIndex];
      results[currentIndex] = await fetchWithFallback(symbol, {
        ...options,
        requestCache,
        persistentCache,
        unavailableSources,
      });
      if (cacheableResult(results[currentIndex])) {
        persistentCache.set(finalCacheKey(symbol), results[currentIndex]);
        cacheDirty = true;
      }
      completed += 1;

      if (options.onProgress) {
        const cache = results[currentIndex].cacheHit ? ' cache' : '';
        options.onProgress({
          completed,
          total: symbols.length,
          symbol: symbol.symbol,
          ok: !results[currentIndex].error,
          source: results[currentIndex].source ? `${results[currentIndex].source}${cache}` : results[currentIndex].source,
          proxyNote: results[currentIndex].proxyNote,
          error: results[currentIndex].error,
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker());
  await Promise.all(workers);
  if (cacheDirty) {
    await savePersistentCache(options.cachePath, persistentCache);
  }
  return results;
}
