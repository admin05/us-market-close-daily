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
      ].join(' / ');

      return `| ${item.name} | ${item.symbol} | ${fmtPlain(t.close)} | ${fmt(t.changePct, '%')} | ${fmt(t.fiveDayPct, '%')} | ${trend} / RSI ${fmtPlain(t.rsi14)} | [${item.source}](${item.sourceUrl}) |`;
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

function buildMissingData(results, news) {
  const failed = results.filter((item) => item.error);
  if (!failed.length && news?.events?.length) {
    return '## 数据质量\n\n所有第一版行情项均返回了可解析数据。';
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

  return lines.join('\n');
}

export function buildMarkdownReport({ reportDate, results, news }) {
  const sections = [
    `# 美股收盘日报 ${reportDate}`,
    '',
    `> 生成时间：${formatDateTime()}。本报告由公开行情源生成；缺失或异常数据统一标记为“暂无可靠数据”。`,
    '',
    buildOverview(results),
    '',
    ...MARKET_GROUPS.map((group) => buildGroupSection(group, results)),
    '',
    buildNewsSection(news),
    '',
    '## 明日观察',
    '',
    '- 观察主要指数是否与半导体、科技、通信服务方向一致。',
    '- 观察 VIX 与美债收益率是否继续影响成长股估值。',
    '- 对无可靠数据的项目保持空缺，不做推断。',
    '',
    buildMissingData(results, news),
    '',
  ];

  return sections.join('\n');
}

export function buildBarkSummary({ reportDate, results, reportPath, news }) {
  const reliable = sortedReliable(results);
  const failedCount = results.filter((item) => item.error).length;
  const newsCount = news?.events?.length || 0;
  const top = reliable.slice(0, 2).map((item) => `${item.name}${fmt(item.technical.changePct, '%')}`).join('，') || '暂无可靠数据';
  const bottom = reliable.slice(-2).reverse().map((item) => `${item.name}${fmt(item.technical.changePct, '%')}`).join('，') || '暂无可靠数据';

  return [
    `日期：${reportDate}`,
    `状态：完成`,
    `领涨：${top}`,
    `承压：${bottom}`,
    `新闻：${newsCount}条`,
    `缺失：${failedCount}项`,
    `报告：${reportPath}`,
  ].join('\n');
}
