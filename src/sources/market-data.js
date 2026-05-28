import { fetchFinnhubQuote } from './finnhub.js';
import { fetchFmpQuote } from './fmp.js';
import { fetchYahooQuote } from './yahoo-finance.js';

const INDEX_PROXY_SYMBOLS = {
  '^GSPC': { symbol: 'SPY', note: '用SPY代理标普500指数' },
  '^IXIC': { symbol: 'QQQ', note: '用QQQ代理纳斯达克指数' },
  '^DJI': { symbol: 'DIA', note: '用DIA代理道琼斯指数' },
  '^RUT': { symbol: 'IWM', note: '用IWM代理罗素2000指数' },
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

async function fetchWithFallback(symbolMeta, options) {
  const errors = [];

  if (options.fmpApiKey) {
    try {
      return await fetchFmpQuote(symbolMeta, {
        timeoutMs: options.timeoutMs,
        apiKey: options.fmpApiKey,
      });
    } catch (error) {
      errors.push(`FMP: ${error.message}`);
    }
  } else {
    errors.push('FMP: FMP_API_KEY is not configured');
  }

  if (options.finnhubApiKey) {
    try {
      return await fetchFinnhubQuote(symbolMeta, {
        timeoutMs: options.timeoutMs,
        apiKey: options.finnhubApiKey,
      });
    } catch (error) {
      errors.push(`Finnhub: ${error.message}`);
    }

    const proxyMeta = withProxy(symbolMeta);
    if (proxyMeta) {
      try {
        const proxyResult = await fetchFinnhubQuote(proxyMeta, {
          timeoutMs: options.timeoutMs,
          apiKey: options.finnhubApiKey,
        });
        return {
          ...proxyResult,
          symbol: symbolMeta.symbol,
          name: symbolMeta.name,
          type: symbolMeta.type,
          source: 'Finnhub',
          sourceUrl: `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(proxyMeta.sourceSymbol)}`,
          proxyNote: proxyMeta.proxyNote,
        };
      } catch (error) {
        errors.push(`Finnhub proxy: ${error.message}`);
      }
    }
  } else {
    errors.push('Finnhub: FINNHUB_API_KEY is not configured');
  }

  const yahooResult = await fetchYahooQuote(symbolMeta, options);
  if (!yahooResult.error) return yahooResult;
  errors.push(`Yahoo: ${yahooResult.error}`);

  return addError(symbolMeta, errors);
}

export async function fetchMarketQuotes(symbols, options = {}) {
  const concurrency = Math.max(1, Math.floor(options.concurrency || 6));
  const results = new Array(symbols.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < symbols.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const symbol = symbols[currentIndex];
      results[currentIndex] = await fetchWithFallback(symbol, options);
      completed += 1;

      if (options.onProgress) {
        options.onProgress({
          completed,
          total: symbols.length,
          symbol: symbol.symbol,
          ok: !results[currentIndex].error,
          source: results[currentIndex].source,
          proxyNote: results[currentIndex].proxyNote,
          error: results[currentIndex].error,
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
