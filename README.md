# us-market-close-daily

独立项目启动目录：用于从零开始构建一份中文《美股收盘日报》生成器。

本目录当前只保存从 `daily_stock_analysis` 拷贝来的参考资源和项目交接说明，尚未实现日报逻辑。

## 目标

生成面向投资复盘和次日交易计划的中文美股收盘日报，覆盖：

- 主要指数、ETF、板块、主题和重点个股表现
- 美债收益率、FedWatch、美元、黄金、原油、加密资产
- 美国经济数据、财报、公司新闻、SEC/IR 信息
- 市场宽度、新高新低、均线参与度、波动率和信用指标
- 板块轮动、风险状态、明日观察清单
- 所有关键事实和数据附来源链接；无可靠数据时明确写“暂无可靠数据”

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

## 建议第一版边界

先做一个稳定的 70 分版本，不追求第一天覆盖全部 15 章。

优先级建议：

1. 指数与核心 ETF：SPY、QQQ、DIA、IWM、SMH、SOXX、XLK、XLC、XLY、VIX。
2. 十一大板块 ETF：XLK、XLC、XLY、XLF、XLI、XLV、XLP、XLE、XLU、XLB、XLRE。
3. 主题 ETF 和重点股 watchlist：AI 硬件、软件、光通信、电力/数据中心。
4. 宏观资产：2Y/10Y/30Y 美债、DXY、Gold、WTI、Brent、BTC、ETH。
5. 新闻来源和引用：Reuters/CNBC/MarketWatch/Yahoo Finance/Nasdaq/公司 IR/SEC。
6. 中文 Markdown 日报模板和 Bark 摘要推送。

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
    market-data.js
    macro.js
    news.js
    earnings.js
    breadth.js
  indicators/
    technical.js
    relative-strength.js
  report/
    build-report.js
    templates.js
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

