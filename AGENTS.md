# AGENTS.md

## 项目定位

本项目用于构建中文《美股收盘日报》生成器。目标是数据驱动、来源可追溯、可在 Arcadia 定时运行，并通过 Bark 推送摘要。

## 工作规则

- 这是独立项目，不要直接修改 `../daily_stock_analysis` 的源码。
- `resources/` 下的文件只作为参考素材，默认不要改动。
- 新实现优先放在 `src/`、配置放在 `.env.example`、日报输出放在 `reports/`。
- 如果新增配置项，同步更新 `.env.example` 和 README。
- 不要硬编码密钥、账号、模型名、绝对路径或 Bark key。
- 所有关键市场数据和公司新闻必须保留来源字段或链接。
- 无可靠数据时输出“暂无可靠数据”，不要让 LLM 编造。

## JavaScript / Arcadia / Bark

- 默认使用 Node.js 脚本，适配 Arcadia 定时任务。
- Bark 配置从 `process.env.BARK` 读取，允许 bare key 或完整 Bark endpoint。
- Bark 缺失或推送失败不能导致主流程失败。
- Bark 文案保持简短：脚本名称、运行状态、关键结论、失败摘要。

## 建议实现顺序

1. 建立最小 Node.js 项目和配置读取。
2. 实现 watchlist、ETF 列表、交易日/日期工具。
3. 接入行情数据，先覆盖指数、板块 ETF、主题 ETF、重点股。
4. 计算涨跌幅、近 5 日、近 1 月、均线、RSI 等基础指标。
5. 接入新闻搜索并保存来源链接。
6. 生成中文 Markdown 日报。
7. 保存 `reports/YYYY-MM-DD.md` 并通过 Bark 推送摘要。
8. 再逐步补宏观、宽度、财报、SEC/IR、资金流和冲突校验。

## 验证要求

- 修改代码后至少运行语法检查或脚本 dry-run。
- 涉及数据源时，要验证失败降级路径。
- 涉及报告模板时，要查看生成的 Markdown 是否包含缺失数据提示和来源。

