# us-market-close-daily

中文《美股收盘日报》生成器。当前第一版已经实现 Node.js/Arcadia 可运行脚本：

- 从 Yahoo Finance 图表接口抓取主要指数、核心 ETF、板块 ETF、主题 watchlist 和宏观资产。
- 计算日涨跌、近 5 日、近 1 月、MA20、MA50、RSI14 等基础指标。
- 生成中文 Markdown 日报到 `reports/YYYYMMDD.md`。
- 通过 Bark 推送简短运行摘要；`BARK` 缺失或推送失败不会导致主流程失败。
- 从新闻雷达抓取最新事件卡片，保留事件链接、时间、类型、关联股票与概念。
- 数据缺失时明确输出“暂无可靠数据”，不使用 LLM 编造新闻或结论。

旧项目参考素材仍保留在 `resources/`，用于后续扩展数据源、新闻、SEC/IR 和报告模板。

## 目标

生成面向投资复盘和次日交易计划的中文美股收盘日报，覆盖：

- 主要指数、ETF、板块、主题和重点个股表现
- 美债收益率、FedWatch、美元、黄金、原油、加密资产
- 美国经济数据、财报、公司新闻、SEC/IR 信息
- 市场宽度、新高新低、均线参与度、波动率和信用指标
- 板块轮动、风险状态、明日观察清单
- 所有关键事实和数据附来源链接；无可靠数据时明确写“暂无可靠数据”

## 快速开始

环境要求：Node.js 18 或更高版本。

```bash
npm run check
npm run dry-run
npm start
```

说明：

- `npm run check`：语法检查。
- `npm run dry-run`：生成日报但跳过 Bark 推送，适合本地验证和 Arcadia 部署前测试。
- `npm start`：生成日报并尝试发送 Bark 摘要。

配置项见 `.env.example`：

- `BARK`：Bark bare key 或完整 endpoint，例如 `https://api.day.app/your_key`。
- `REPORT_DATE`：可选，覆盖报告日期，格式 `YYYY-MM-DD`。
- `HTTP_TIMEOUT_MS`：可选，行情请求超时时间。
- `REPORTS_DIR`：可选，日报输出目录，默认 `reports`。
- `NEWS_SOURCE_URL`：可选，新闻雷达事件源，默认 `https://stocks.matraceai.com/`；如只想看海外事件，可设为 `https://stocks.matraceai.com/?type=overseas`。
- `NEWS_LIMIT`：可选，日报中展示的新闻事件数量，默认 8。

`reports/*.md` 默认不提交到 Git，避免把每天生成的日报混入源码历史。

## 为什么独立出来

`daily_stock_analysis` 已经支持美股自选股分析和简版美股大盘复盘，但它不是为完整机构级美股收盘日报设计的。新项目应以日报的数据契约为核心重新设计采集、校验、缓存、报告模板和推送流程。

## 可复用资源

旧项目参考文件保存在：

```text
resources/daily_stock_analysis/
```

重点参考：

- `src/core/market_review.py`：大盘复盘入口和保存/推送流程
- `src/market_analyzer.py`：指数行情、新闻、LLM 复盘的组织方式
- `src/core/market_profile.py`：市场 profile 的轻量配置方式
- `src/search_service.py`：搜索服务、新闻时效过滤、来源链接处理
- `src/notification.py`：通知服务整体思路
- `data_provider/us_index_mapping.py`：美股指数代码映射
- `data_provider/yfinance_fetcher.py`：Yahoo Finance/yfinance 行情参考
- `data_provider/yfinance_fundamental_adapter.py`：美股/港股基本面参考
- `data_provider/longbridge_fetcher.py`：Longbridge 行情、量比、换手率参考
- `data_provider/finnhub_fetcher.py`：Finnhub 美股行情参考
- `data_provider/alphavantage_fetcher.py`：Alpha Vantage 美股行情参考
- `templates/report_markdown.j2`、`templates/report_brief.j2`：旧报告模板参考
- `docs/full-guide.md`、`docs/notifications.md`：旧项目配置与通知文档参考

Arcadia/Bark 通知参考：

```text
resources/arcadia-bark-notify.js
```

它来自旧目录里的 `concept-fund-allocator`，特点是从 `process.env.BARK` 读取 Bark 配置，缺失或推送失败时不让主流程崩溃。

## 第一版边界

当前已按一个稳定的 70 分版本实现，不追求第一天覆盖全部 15 章。

已覆盖：

1. 指数与核心 ETF：SPY、QQQ、DIA、IWM、SMH、SOXX、VIX 等。
2. 十一大板块 ETF：XLK、XLC、XLY、XLF、XLI、XLV、XLP、XLE、XLU、XLB、XLRE。
3. 主题 ETF 和重点股 watchlist：AI 硬件、软件、光通信、电力/数据中心相关标的。
4. 宏观资产：美债收益率、DXY、Gold、WTI、Brent、BTC、ETH。
5. 新闻雷达最新事件卡片：标题、时间、类型、预期差、关联股票、概念和原始链接。
6. 中文 Markdown 日报模板和 Bark 摘要推送。

暂未覆盖：

- 美股原生新闻来源和引用：Reuters/CNBC/MarketWatch/Yahoo Finance/Nasdaq/公司 IR/SEC。
- FedWatch 概率和年内降息次数。
- 均线参与度、NYSE/Nasdaq 涨跌家数、新高新低。
- Put/Call、VVIX、MOVE、信用利差、ETF flows、期权异动。
- 财报日历、SEC 文件和公司 IR 自动抽取。
- 多来源冲突检测和权威优先级裁决。

第二阶段再补：

- FedWatch 概率和年内降息次数
- 均线参与度、NYSE/Nasdaq 涨跌家数、新高新低
- Put/Call、VVIX、MOVE、信用利差、ETF flows、期权异动
- 财报日历、SEC 文件和公司 IR 自动抽取
- 多来源冲突检测和权威优先级裁决

## 建议目录结构

```text
src/
  index.js
  config.js
  notify.js
  sources/
    yahoo-finance.js
    news-radar.js
  indicators/
    technical.js
  report/
    build-report.js
  utils/
    http.js
    dates.js
reports/
data/
```

## Arcadia/Bark 约定

- 默认按 JavaScript/Node.js 脚本项目设计，方便部署到 Arcadia。
- Bark key 只从 `process.env.BARK` 读取。
- 不要在源码、README、日志或提交记录中写死 Bark key。
- Bark 推送只发摘要和关键结论，完整日报保存为 Markdown 文件。
- 即使没有信号或部分数据缺失，也应发送简短运行结果。
