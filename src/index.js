import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadConfig } from './config.js';
import { listAllSymbols } from './watchlists.js';
import { fetchMarketQuotes } from './sources/market-data.js';
import { fetchCompanyNews } from './sources/company-news.js';
import { fetchEarningsCalendar } from './sources/earnings-calendar.js';
import { fetchNewsRadarEvents } from './sources/news-radar.js';
import { buildBarkSummary, buildMarkdownReport } from './report/build-report.js';
import { sendBark } from './notify.js';
import { compactDate, todayInTimezone } from './utils/dates.js';

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has('--dry-run'),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadConfig();
  const reportDate = config.reportDate || todayInTimezone();
  const symbols = listAllSymbols();

  console.log(`[market-close] Fetching ${symbols.length} symbols for ${reportDate}...`);
  await mkdir(config.dataDir, { recursive: true });
  const newsPromise = config.skipNews
    ? Promise.resolve({
      ok: false,
      source: '新闻雷达',
      sourceUrl: config.newsSourceUrl,
      events: [],
      error: 'SKIP_NEWS=1',
    })
    : fetchNewsRadarEvents({
      sourceUrl: config.newsSourceUrl,
      limit: config.newsLimit,
      timeoutMs: config.httpTimeoutMs,
    });
  const companyNewsPromise = config.skipNews
    ? Promise.resolve({
      ok: false,
      source: 'StockAnalysis Company News',
      sourceUrl: 'https://stockanalysis.com/stocks/',
      events: [],
      error: 'SKIP_NEWS=1',
    })
    : fetchCompanyNews({
      totalLimit: config.companyNewsLimit,
      perSymbolLimit: config.companyNewsPerSymbol,
      timeoutMs: config.httpTimeoutMs,
    });
  const earningsPromise = fetchEarningsCalendar({
    reportDate,
    limit: config.earningsLimit,
    timeoutMs: config.httpTimeoutMs,
  });

  const [results, news, companyNews, earnings] = await Promise.all([
    fetchMarketQuotes(symbols, {
      timeoutMs: config.httpTimeoutMs,
      concurrency: config.marketDataConcurrency,
      finnhubApiKey: config.finnhubApiKey,
      fmpApiKey: config.fmpApiKey,
      cachePath: join(config.dataDir, `market-cache-${compactDate(reportDate)}.json`),
      onProgress: ({ completed, total, symbol, ok, source, proxyNote, error }) => {
        const via = source ? ` via ${source}` : '';
        const proxy = proxyNote ? ` (${proxyNote})` : '';
        const status = ok ? `ok${via}${proxy}` : `missing: ${error}`;
        console.log(`[market-close] Market data ${completed}/${total}: ${symbol} ${status}`);
      },
    }),
    newsPromise,
    companyNewsPromise,
    earningsPromise,
  ]);

  if (news.events?.length) {
    console.log(`[market-close] News events ${news.events.length}/${config.newsLimit}: ${news.source}`);
  } else {
    console.log(`[market-close] News events missing: ${news.error || 'no events'}`);
  }
  if (companyNews.events?.length) {
    console.log(`[market-close] Company news ${companyNews.events.length}/${config.companyNewsLimit}: ${companyNews.source}`);
  } else {
    console.log(`[market-close] Company news missing: ${companyNews.error || 'no events'}`);
  }
  if (earnings.highlights?.length) {
    console.log(`[market-close] Earnings events ${earnings.highlights.length}/${config.earningsLimit}: ${earnings.source}`);
  } else {
    console.log(`[market-close] Earnings events missing: ${earnings.error || 'no events'}`);
  }

  await mkdir(config.reportsDir, { recursive: true });
  const markdown = buildMarkdownReport({ reportDate, results, news, companyNews, earnings });
  const reportPath = join(config.reportsDir, `${compactDate(reportDate)}.md`);
  await writeFile(reportPath, markdown, 'utf8');

  const summary = buildBarkSummary({ reportDate, results, reportPath, news, companyNews, earnings });
  console.log(`[market-close] Report saved: ${reportPath}`);
  console.log(summary);

  if (args.dryRun) {
    console.log('[market-close] Dry run enabled; skip Bark push.');
    return;
  }

  console.log('[market-close] Sending Bark notification...');
  const barkResult = await sendBark({
    title: config.scriptName,
    body: summary,
    bark: config.bark,
    timeoutMs: config.barkTimeoutMs,
  });
  console.log(`[market-close] Bark notification ${barkResult.ok ? 'sent' : `skipped/failed: ${barkResult.reason || 'unknown'}`}`);
}

main()
  .then(() => {
    console.log('[market-close] Process exiting with code 0.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`[market-close] Failed: ${error.stack || error.message}`);
    const config = loadConfig();
    await sendBark({
      title: config.scriptName,
      body: `状态：失败\n错误：${error.message}`,
      bark: config.bark,
      timeoutMs: config.barkTimeoutMs,
    });
    console.log('[market-close] Process exiting with code 1.');
    process.exit(1);
  });
