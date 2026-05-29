import { formatDateTime } from '../utils/dates.js';
import { MARKET_GROUPS } from '../watchlists.js';

function fmt(value, suffix = '') {
  if (!Number.isFinite(value)) return '暂无可靠数据';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

function fmtPlain(value, suffix = '') {
  if (!Number.isFinite(value)) return '暂无可靠数据';
  return `${value.toFixed(2)}${suffix}`;
}

function directionLabel(changePct) {
  if (!Number.isFinite(changePct)) return '暂无可靠数据';
  if (changePct > 0.5) return '上涨';
  if (changePct < -0.5) return '下跌';
  return '震荡';
}

function sortedReliable(items) {
  return items
    .filter((item) => Number.isFinite(item.technical?.changePct))
    .sort((a, b) => b.technical.changePct - a.technical.changePct);
}

function findBySymbol(results, symbol) {
  return results.find((item) => item.symbol === symbol);
}

function countAbove(items, field) {
  const valid = items.filter((item) => item.technical?.[field] !== null && item.technical?.[field] !== undefined);
  if (!valid.length) return null;
  return {
    count: valid.filter((item) => item.technical[field]).length,
    total: valid.length,
  };
}

function ratioText(ratio) {
  if (!ratio) return '暂无可靠数据';
  return `${ratio.count}/${ratio.total}`;
}

function classifyRisk(results) {
  const spy = findBySymbol(results, 'SPY');
  const qqq = findBySymbol(results, 'QQQ');
  const iwm = findBySymbol(results, 'IWM');
  const vix = findBySymbol(results, '^VIX');
  const tnx = findBySymbol(results, '^TNX');
  const hyg = findBySymbol(results, 'HYG');
  const lqd = findBySymbol(results, 'LQD');

  let score = 0;
  const signals = [];

  if (spy?.technical?.aboveMa20) {
    score += 1;
    signals.push('SPY站上MA20');
  } else if (spy?.technical) {
    score -= 1;
    signals.push('SPY跌破MA20');
  }

  if (qqq?.technical?.aboveMa20) {
    score += 1;
    signals.push('QQQ站上MA20');
  } else if (qqq?.technical) {
    score -= 1;
    signals.push('QQQ跌破MA20');
  }

  if (iwm?.technical?.changePct > spy?.technical?.changePct) {
    score += 1;
    signals.push('小盘相对强于SPY');
  } else if (iwm?.technical && spy?.technical) {
    score -= 1;
    signals.push('小盘相对弱于SPY');
  }

  if (vix?.technical?.changePct > 3) {
    score -= 1;
    signals.push('VIX明显上行');
  } else if (vix?.technical?.changePct < -3) {
    score += 1;
    signals.push('VIX明显回落');
  } else if (vix?.technical) {
    signals.push('VIX变化温和');
  }

  if (tnx?.technical?.changePct > 1) {
    score -= 1;
    signals.push('10年美债收益率上行');
  } else if (tnx?.technical?.changePct < -1) {
    score += 1;
    signals.push('10年美债收益率回落');
  } else if (tnx?.technical) {
    signals.push('10年美债收益率变化温和');
  }

  if (hyg?.technical && lqd?.technical) {
    const creditRiskAppetite = hyg.technical.changePct - lqd.technical.changePct;
    if (creditRiskAppetite > 0.2) {
      score += 1;
      signals.push('高收益债相对投资级债走强');
    } else if (creditRiskAppetite < -0.2) {
      score -= 1;
      signals.push('高收益债相对投资级债走弱');
    } else {
      signals.push('信用代理变化温和');
    }
  } else {
    signals.push('信用代理暂无可靠数据');
  }

  if (score >= 2) return { label: '偏风险偏好', score, signals };
  if (score <= -2) return { label: '偏防御', score, signals };
  return { label: '中性震荡', score, signals };
}

function buildMarketInternals(results) {
  const all = results.filter((item) => item.technical);
  const gainers = all.filter((item) => item.technical.changePct > 0).length;
  const losers = all.filter((item) => item.technical.changePct < 0).length;
  const aboveMa20 = countAbove(all, 'aboveMa20');
  const aboveMa50 = countAbove(all, 'aboveMa50');
  const risk = classifyRisk(results);

  return [
    '## 风险状态与市场宽度',
    '',
    `- 风险状态：${risk.label}（代理评分 ${risk.score}）。`,
    `- 信号依据：${risk.signals.join('；')}。`,
    `- Watchlist 涨跌家数：上涨 ${gainers}，下跌 ${losers}。`,
    `- MA20 参与度：${ratioText(aboveMa20)}；MA50 参与度：${ratioText(aboveMa50)}。`,
    '- NYSE/Nasdaq 全市场涨跌家数、新高新低、信用利差仍待接入权威数据源。',
  ].join('\n');
}

function buildSectorRotation(results) {
  const sectors = sortedReliable(results.filter((item) => item.groupId === 'sectors'));
  if (!sectors.length) {
    return '## 板块轮动\n\n暂无可靠数据。';
  }

  const top = sectors.slice(0, 3);
  const bottom = sectors.slice(-3).reverse();
  const defensive = new Set(['XLP', 'XLU', 'XLV']);
  const cyclical = new Set(['XLY', 'XLF', 'XLI', 'XLE', 'XLB']);
  const growth = new Set(['XLK', 'XLC']);

  const leaderTypes = top.map((item) => {
    if (defensive.has(item.symbol)) return '防御';
    if (cyclical.has(item.symbol)) return '周期';
    if (growth.has(item.symbol)) return '成长';
    return '其他';
  });
  const styleVotes = leaderTypes.reduce((acc, type) => {
    acc.set(type, (acc.get(type) || 0) + 1);
    return acc;
  }, new Map());
  const [styleLeader, styleCount] = [...styleVotes.entries()].sort((a, b) => b[1] - a[1])[0] || ['其他', 0];
  const style = styleCount >= 2 ? `${styleLeader}主导` : `${leaderTypes[0]}领涨、风格分散`;

  return [
    '## 板块轮动',
    '',
    `- 轮动风格：${style}。`,
    `- 领涨板块：${top.map((item) => `${item.name} ${fmt(item.technical.changePct, '%')}`).join('；')}。`,
    `- 承压板块：${bottom.map((item) => `${item.name} ${fmt(item.technical.changePct, '%')}`).join('；')}。`,
    `- 近5日强势：${sectors.slice().sort((a, b) => b.technical.fiveDayPct - a.technical.fiveDayPct).slice(0, 3).map((item) => `${item.name} ${fmt(item.technical.fiveDayPct, '%')}`).join('；')}。`,
  ].join('\n');
}

function buildEventThemes(news) {
  const events = news?.events || [];
  if (!events.length) return '## 事件主题\n\n暂无可靠数据。';

  const conceptCounts = new Map();
  const stockCounts = new Map();
  for (const event of events) {
    for (const concept of event.concepts || []) {
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
    }
    for (const stock of event.stocks || []) {
      stockCounts.set(stock, (stockCounts.get(stock) || 0) + 1);
    }
  }

  const topConcepts = [...conceptCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topStocks = [...stockCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return [
    '## 事件主题',
    '',
    `- 高频概念：${topConcepts.length ? topConcepts.map(([name, count]) => `${name}(${count})`).join('、') : '暂无可靠数据'}。`,
    `- 高频关联股票：${topStocks.length ? topStocks.map(([name, count]) => `${name}(${count})`).join('、') : '暂无可靠数据'}。`,
    '- 当前新闻源偏 A 股事件驱动；美股原生新闻、SEC/IR、财报日历仍需补充数据源。',
  ].join('\n');
}

function buildWatchPlan(results, news) {
  const risk = classifyRisk(results);
  const semis = findBySymbol(results, 'SMH');
  const qqq = findBySymbol(results, 'QQQ');
  const tnx = findBySymbol(results, '^TNX');
  const vix = findBySymbol(results, '^VIX');
  const newsHeadlines = (news?.events || []).slice(0, 3).map((event) => event.title);

  return [
    '## 明日观察',
    '',
    `- 风险状态延续性：当前为${risk.label}，重点观察 SPY/QQQ 是否继续守住 MA20。`,
    `- 成长主线：QQQ ${fmt(qqq?.technical?.changePct, '%')}，半导体 SMH ${fmt(semis?.technical?.changePct, '%')}，观察两者是否重新同向。`,
    `- 宏观约束：10年美债收益率 ${fmt(tnx?.technical?.changePct, '%')}，VIX ${fmt(vix?.technical?.changePct, '%')}，若同步上行需降低追涨权重。`,
    `- 事件线索：${newsHeadlines.length ? newsHeadlines.join('；') : '暂无可靠数据'}。`,
    '- 对无可靠数据的项目保持空缺，不做推断。',
  ].join('\n');
}

function tableRows(items) {
  return items
    .map((item) => {
      if (!item.technical) {
        return `| ${item.name} | ${item.symbol} | 暂无可靠数据 | 暂无可靠数据 | 暂无可靠数据 | 暂无可靠数据 | [${item.source}](${item.sourceUrl}) |`;
      }

      const t = item.technical;
      const trend = [
        t.aboveMa20 === null ? 'MA20暂无可靠数据' : t.aboveMa20 ? '站上MA20' : '跌破MA20',
        t.aboveMa50 === null ? 'MA50暂无可靠数据' : t.aboveMa50 ? '站上MA50' : '跌破MA50',
        Number.isFinite(t.rsi14) ? `RSI ${fmtPlain(t.rsi14)}` : null,
      ].filter(Boolean).join(' / ');

      const sourceNotes = [
        item.proxyNote,
        item.quoteOnly ? '仅快照，无均线/RSI' : null,
      ].filter(Boolean);
      const sourceLabel = sourceNotes.length ? `${item.source}（${sourceNotes.join('；')}）` : item.source;
      return `| ${item.name} | ${item.symbol} | ${fmtPlain(t.close)} | ${fmt(t.changePct, '%')} | ${fmt(t.fiveDayPct, '%')} | ${trend} | [${sourceLabel}](${item.sourceUrl}) |`;
    })
    .join('\n');
}

function buildOverview(results) {
  const indices = results.filter((item) => item.groupId === 'indices');
  const reliable = sortedReliable(indices);
  const gspc = indices.find((item) => item.symbol === '^GSPC');
  const qqq = indices.find((item) => item.symbol === 'QQQ');
  const vix = indices.find((item) => item.symbol === '^VIX');

  if (!reliable.length) {
    return [
      '## 盘面总览',
      '',
      '暂无可靠数据。当前行情源未返回足够数据，日报不生成推断性结论。',
    ].join('\n');
  }

  return [
    '## 盘面总览',
    '',
    `- 标普500：${fmt(gspc?.technical?.changePct, '%')}，盘面状态：${directionLabel(gspc?.technical?.changePct)}。`,
    `- 纳指100 ETF QQQ：${fmt(qqq?.technical?.changePct, '%')}，成长风格状态：${directionLabel(qqq?.technical?.changePct)}。`,
    `- VIX：${fmt(vix?.technical?.changePct, '%')}，波动率变化仅作风险温度参考。`,
    `- 领涨观察：${reliable.slice(0, 3).map((item) => `${item.name} ${fmt(item.technical.changePct, '%')}`).join('；') || '暂无可靠数据'}。`,
    `- 承压观察：${reliable.slice(-3).reverse().map((item) => `${item.name} ${fmt(item.technical.changePct, '%')}`).join('；') || '暂无可靠数据'}。`,
  ].join('\n');
}

function buildGroupSection(group, results) {
  const items = results.filter((item) => item.groupId === group.id);
  const reliable = sortedReliable(items);

  const lines = [
    `## ${group.title}`,
    '',
    '| 名称 | 代码 | 收盘/最新 | 日涨跌 | 近5日 | 技术状态 | 来源 |',
    '|---|---:|---:|---:|---:|---|---|',
    tableRows(items),
    '',
  ];

  if (reliable.length) {
    lines.push(`强势项：${reliable.slice(0, 3).map((item) => `${item.name} ${fmt(item.technical.changePct, '%')}`).join('；')}。`);
    lines.push(`弱势项：${reliable.slice(-3).reverse().map((item) => `${item.name} ${fmt(item.technical.changePct, '%')}`).join('；')}。`);
  } else {
    lines.push('暂无可靠数据。');
  }

  return lines.join('\n');
}

function buildNewsSection(news) {
  const sourceName = news?.source || '新闻源';
  const sourceUrl = news?.sourceUrl || '#';

  if (!news?.events?.length) {
    const reason = news?.error ? `抓取失败：${news.error}` : '暂无可解析事件';
    return [
      '## 新闻与事件',
      '',
      `暂无可靠数据。${reason}。来源：[${sourceName}](${sourceUrl})`,
    ].join('\n');
  }

  const lines = [
    '## 新闻与事件',
    '',
    `来源：[${sourceName}](${sourceUrl})。以下为该源最新事件卡片，保留原始事件链接；仅作线索，不构成投资建议。`,
    '',
  ];

  for (const event of news.events) {
    const meta = [event.time, event.type, event.expectationScore ? `预期差 ${event.expectationScore}` : null]
      .filter(Boolean)
      .join(' | ');
    const stocks = event.stocks?.length ? `关联股票：${event.stocks.join('、')}` : '关联股票：暂无可靠数据';
    const concepts = event.concepts?.length ? `概念：${event.concepts.join('、')}` : '概念：暂无可靠数据';

    lines.push(`- [${event.title}](${event.url})`);
    if (meta) lines.push(`  ${meta}`);
    lines.push(`  ${stocks}`);
    lines.push(`  ${concepts}`);
  }

  return lines.join('\n');
}

function buildCompanyNewsSection(companyNews) {
  const sourceName = companyNews?.source || '公司新闻源';
  const sourceUrl = companyNews?.sourceUrl || '#';

  if (!companyNews?.events?.length) {
    const reason = companyNews?.error ? `抓取失败：${companyNews.error}` : '暂无可解析公司新闻';
    return [
      '## 重点公司新闻',
      '',
      `暂无可靠数据。${reason}。来源：[${sourceName}](${sourceUrl})`,
    ].join('\n');
  }

  const lines = [
    '## 重点公司新闻',
    '',
    `来源：[${sourceName}](${sourceUrl})。覆盖重点股 Watchlist 的公司新闻标题，保留原始媒体链接；仅作事件线索。`,
    '',
  ];

  for (const event of companyNews.events) {
    const meta = [event.symbol, event.publisher, event.age].filter(Boolean).join(' | ');
    lines.push(`- [${event.title}](${event.url})`);
    if (meta) lines.push(`  ${meta}`);
  }

  return lines.join('\n');
}

function buildEarningsSection(earnings) {
  const sourceName = earnings?.source || '财报日历源';
  const sourceUrl = earnings?.sourceUrl || '#';

  if (!earnings?.highlights?.length) {
    const reason = earnings?.error ? `抓取失败：${earnings.error}` : '暂无可解析财报事件';
    return [
      '## 财报与重点事件',
      '',
      `暂无可靠数据。${reason}。来源：[${sourceName}](${sourceUrl})`,
    ].join('\n');
  }

  const watched = earnings.highlights.filter((event) =>
    ['NVDA', 'AMD', 'AVGO', 'TSM', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'PLTR', 'VRT', 'CEG'].includes(event.symbol),
  );
  const nextDate = earnings.nextDate || '下一交易日';

  const lines = [
    '## 财报与重点事件',
    '',
    `来源：[${sourceName}](${sourceUrl})。覆盖 ${earnings.reportDate} 与 ${nextDate} 的 Nasdaq 财报日历；优先展示 Watchlist 相关公司，其余按市值筛选。`,
    '',
    `- 今日财报数量：${earnings.today?.length ?? 0}；下一交易日财报数量：${earnings.next?.length ?? 0}。`,
    `- Watchlist 命中：${watched.length ? watched.map((event) => `${event.symbol}(${event.date} ${event.time})`).join('、') : '暂无可靠数据'}。`,
    '',
    '| 日期 | 代码 | 公司 | 时间 | EPS预期 | 财季 | 市值 |',
    '|---|---:|---|---|---:|---|---:|',
  ];

  for (const event of earnings.highlights) {
    lines.push(`| ${event.date} | ${event.symbol} | ${event.name} | ${event.time} | ${event.epsForecast || '暂无可靠数据'} | ${event.fiscalQuarterEnding || '暂无可靠数据'} | ${event.marketCap || '暂无可靠数据'} |`);
  }

  return lines.join('\n');
}

function buildMissingData(results, news, companyNews, earnings) {
  const failed = results.filter((item) => item.error);
  const proxied = results.filter((item) => item.proxyNote && !item.error);
  const quoteOnly = results.filter((item) => item.quoteOnly && !item.error);
  if (!failed.length && news?.events?.length && companyNews?.events?.length && earnings?.highlights?.length) {
    const proxyLine = proxied.length
      ? `\n\n代理数据：${proxied.map((item) => `${item.name}(${item.proxyNote})`).join('；')}。`
      : '';
    const quoteLine = quoteOnly.length
      ? `\n\n快照数据：${quoteOnly.map((item) => `${item.name}(${item.symbol})`).join('；')}，仅用于当日涨跌，不计算均线/RSI。`
      : '';
    return `## 数据质量\n\n所有第一版行情项均返回了可解析数据。${proxyLine}${quoteLine}`;
  }

  const lines = [
    '## 数据质量',
    '',
  ];

  if (failed.length) {
    lines.push('以下行情项目暂无可靠数据，报告不对其做推断：');
    lines.push('');
    lines.push(...failed.map((item) => `- ${item.name} (${item.symbol})：${item.error}。来源：[${item.source}](${item.sourceUrl})`));
  }

  if (!news?.events?.length) {
    if (failed.length) lines.push('');
    lines.push(`- 新闻事件：${news?.error || '暂无可解析事件'}。来源：[${news?.source || '新闻源'}](${news?.sourceUrl || '#'})`);
  }

  if (!companyNews?.events?.length) {
    if (failed.length || !news?.events?.length) lines.push('');
    lines.push(`- 重点公司新闻：${companyNews?.error || '暂无可解析公司新闻'}。来源：[${companyNews?.source || '公司新闻源'}](${companyNews?.sourceUrl || '#'})`);
  }

  if (!earnings?.highlights?.length) {
    if (failed.length || !news?.events?.length || !companyNews?.events?.length) lines.push('');
    lines.push(`- 财报日历：${earnings?.error || '暂无可解析财报事件'}。来源：[${earnings?.source || '财报日历源'}](${earnings?.sourceUrl || '#'})`);
  }

  if (proxied.length) {
    if (failed.length || !news?.events?.length) lines.push('');
    lines.push(`代理数据：${proxied.map((item) => `${item.name}(${item.proxyNote})`).join('；')}。`);
  }

  if (quoteOnly.length) {
    if (failed.length || !news?.events?.length || proxied.length) lines.push('');
    lines.push(`快照数据：${quoteOnly.map((item) => `${item.name}(${item.symbol})`).join('；')}，仅用于当日涨跌，不计算均线/RSI。`);
  }

  return lines.join('\n');
}

export function buildMarkdownReport({ reportDate, results, news, companyNews, earnings }) {
  const sections = [
    `# 美股收盘日报 ${reportDate}`,
    '',
    `> 生成时间：${formatDateTime()}。本报告由公开行情源生成；缺失或异常数据统一标记为“暂无可靠数据”。`,
    '',
    buildOverview(results),
    '',
    buildMarketInternals(results),
    '',
    buildSectorRotation(results),
    '',
    ...MARKET_GROUPS.map((group) => buildGroupSection(group, results)),
    '',
    buildEventThemes(news),
    '',
    buildNewsSection(news),
    '',
    buildCompanyNewsSection(companyNews),
    '',
    buildEarningsSection(earnings),
    '',
    buildWatchPlan(results, news),
    '',
    buildMissingData(results, news, companyNews, earnings),
    '',
  ];

  return sections.join('\n');
}

export function buildBarkSummary({ reportDate, results, reportPath, news, companyNews, earnings }) {
  const reliable = sortedReliable(results);
  const failedCount = results.filter((item) => item.error).length;
  const newsCount = news?.events?.length || 0;
  const companyNewsCount = companyNews?.events?.length || 0;
  const earningsCount = earnings?.highlights?.length || 0;
  const top = reliable.slice(0, 2).map((item) => `${item.name}${fmt(item.technical.changePct, '%')}`).join('，') || '暂无可靠数据';
  const bottom = reliable.slice(-2).reverse().map((item) => `${item.name}${fmt(item.technical.changePct, '%')}`).join('，') || '暂无可靠数据';

  return [
    `日期：${reportDate}`,
    `状态：完成`,
    `领涨：${top}`,
    `承压：${bottom}`,
    `新闻：${newsCount}条`,
    `公司新闻：${companyNewsCount}条`,
    `财报：${earningsCount}项`,
    `缺失：${failedCount}项`,
    `报告：${reportPath}`,
  ].join('\n');
}
