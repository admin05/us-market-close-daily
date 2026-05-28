export const MARKET_GROUPS = [
  {
    id: 'indices',
    title: '主要指数与核心 ETF',
    symbols: [
      { symbol: '^GSPC', name: '标普500指数', type: 'index', sourceSymbol: '^GSPC' },
      { symbol: '^IXIC', name: '纳斯达克综合指数', type: 'index', sourceSymbol: '^IXIC' },
      { symbol: '^DJI', name: '道琼斯工业指数', type: 'index', sourceSymbol: '^DJI' },
      { symbol: '^RUT', name: '罗素2000指数', type: 'index', sourceSymbol: '^RUT' },
      { symbol: '^VIX', name: 'VIX波动率指数', type: 'volatility', sourceSymbol: '^VIX' },
      { symbol: 'SPY', name: 'SPDR标普500 ETF', type: 'etf' },
      { symbol: 'QQQ', name: 'Invesco纳指100 ETF', type: 'etf' },
      { symbol: 'DIA', name: 'SPDR道指 ETF', type: 'etf' },
      { symbol: 'IWM', name: 'iShares罗素2000 ETF', type: 'etf' },
      { symbol: 'SMH', name: 'VanEck半导体 ETF', type: 'etf' },
      { symbol: 'SOXX', name: 'iShares半导体 ETF', type: 'etf' },
    ],
  },
  {
    id: 'sectors',
    title: '十一大板块 ETF',
    symbols: [
      { symbol: 'XLK', name: '科技' },
      { symbol: 'XLC', name: '通信服务' },
      { symbol: 'XLY', name: '可选消费' },
      { symbol: 'XLF', name: '金融' },
      { symbol: 'XLI', name: '工业' },
      { symbol: 'XLV', name: '医疗保健' },
      { symbol: 'XLP', name: '必需消费' },
      { symbol: 'XLE', name: '能源' },
      { symbol: 'XLU', name: '公用事业' },
      { symbol: 'XLB', name: '材料' },
      { symbol: 'XLRE', name: '房地产' },
    ],
  },
  {
    id: 'themes',
    title: '主题与重点股 Watchlist',
    symbols: [
      { symbol: 'NVDA', name: '英伟达' },
      { symbol: 'AMD', name: 'AMD' },
      { symbol: 'AVGO', name: '博通' },
      { symbol: 'TSM', name: '台积电 ADR' },
      { symbol: 'MSFT', name: '微软' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'META', name: 'Meta' },
      { symbol: 'AMZN', name: '亚马逊' },
      { symbol: 'TSLA', name: '特斯拉' },
      { symbol: 'PLTR', name: 'Palantir' },
      { symbol: 'VRT', name: 'Vertiv' },
      { symbol: 'CEG', name: 'Constellation Energy' },
    ],
  },
  {
    id: 'macro',
    title: '宏观资产',
    symbols: [
      { symbol: '^IRX', name: '13周美债收益率', type: 'yield' },
      { symbol: '^FVX', name: '5年期美债收益率', type: 'yield' },
      { symbol: '^TNX', name: '10年期美债收益率', type: 'yield' },
      { symbol: '^TYX', name: '30年期美债收益率', type: 'yield' },
      { symbol: 'TLT', name: '20年期以上美债 ETF', type: 'bond' },
      { symbol: 'HYG', name: '高收益债 ETF', type: 'credit' },
      { symbol: 'LQD', name: '投资级债 ETF', type: 'credit' },
      { symbol: 'DX-Y.NYB', name: '美元指数' },
      { symbol: 'GC=F', name: 'COMEX黄金' },
      { symbol: 'CL=F', name: 'WTI原油' },
      { symbol: 'BZ=F', name: 'Brent原油' },
      { symbol: 'BTC-USD', name: '比特币' },
      { symbol: 'ETH-USD', name: '以太坊' },
    ],
  },
];

export function listAllSymbols() {
  return MARKET_GROUPS.flatMap((group) =>
    group.symbols.map((item) => ({
      ...item,
      groupId: group.id,
      groupTitle: group.title,
    })),
  );
}
