import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadConfig } from './config.js';
import { listAllSymbols } from './watchlists.js';
import { fetchYahooQuotes } from './sources/yahoo-finance.js';
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
  const [results, news] = await Promise.all([
    fetchYahooQuotes(symbols, { timeoutMs: config.httpTimeoutMs }),
    fetchNewsRadarEvents({
      sourceUrl: config.newsSourceUrl,
      limit: config.newsLimit,
      timeoutMs: config.httpTimeoutMs,
    }),
  ]);

  await mkdir(config.reportsDir, { recursive: true });
  const markdown = buildMarkdownReport({ reportDate, results, news });
  const reportPath = join(config.reportsDir, `${compactDate(reportDate)}.md`);
  await writeFile(reportPath, markdown, 'utf8');

  const summary = buildBarkSummary({ reportDate, results, reportPath, news });
  console.log(`[market-close] Report saved: ${reportPath}`);
  console.log(summary);

  if (args.dryRun) {
    console.log('[market-close] Dry run enabled; skip Bark push.');
    return;
  }

  await sendBark({
    title: config.scriptName,
    body: summary,
    bark: config.bark,
  });
}

main().catch(async (error) => {
  console.error(`[market-close] Failed: ${error.stack || error.message}`);
  const config = loadConfig();
  await sendBark({
    title: config.scriptName,
    body: `状态：失败\n错误：${error.message}`,
    bark: config.bark,
  });
  process.exitCode = 1;
});
