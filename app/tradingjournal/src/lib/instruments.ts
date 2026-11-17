import type { Market } from "./rules/types.ts";

export interface Instrument {
  symbol: string;
  name: string;
  market: Market;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: "MNQ", name: "Micro Nasdaq-100", market: "futures" },
  { symbol: "NQ", name: "E-mini Nasdaq-100", market: "futures" },
  { symbol: "MES", name: "Micro S&P 500", market: "futures" },
  { symbol: "ES", name: "E-mini S&P 500", market: "futures" },
  { symbol: "MYM", name: "Micro Dow", market: "futures" },
  { symbol: "YM", name: "E-mini Dow", market: "futures" },
  { symbol: "M2K", name: "Micro Russell 2000", market: "futures" },
  { symbol: "RTY", name: "E-mini Russell 2000", market: "futures" },
  { symbol: "MCL", name: "Micro Crude Oil", market: "futures" },
  { symbol: "CL", name: "Crude Oil", market: "futures" },
  { symbol: "MGC", name: "Micro Gold", market: "futures" },
  { symbol: "GC", name: "Gold", market: "futures" },
  { symbol: "NAS100", name: "Nasdaq 100", market: "cfd" },
  { symbol: "US30", name: "Dow Jones", market: "cfd" },
  { symbol: "US500", name: "S&P 500", market: "cfd" },
  { symbol: "XAUUSD", name: "Oro", market: "cfd" },
  { symbol: "EURUSD", name: "Euro / Dólar", market: "cfd" },
  { symbol: "GBPUSD", name: "Libra / Dólar", market: "cfd" },
  { symbol: "USDJPY", name: "Dólar / Yen", market: "cfd" },
  { symbol: "AUDUSD", name: "Dólar australiano / Dólar", market: "cfd" },
  { symbol: "USDCAD", name: "Dólar / Dólar canadiense", market: "cfd" },
  { symbol: "USDCHF", name: "Dólar / Franco suizo", market: "cfd" },
  { symbol: "NZDUSD", name: "Dólar neozelandés / Dólar", market: "cfd" },
];

export function instrumentsFor(market: Market): Instrument[] {
  return INSTRUMENTS.filter((i) => i.market === market);
}
