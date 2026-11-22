import {
  getScope, listAccounts, listStrategies, listTrades, toSTrade,
  type Account, type Strategy, type Trade,
} from "./data";
import { sessionDateOf } from "./rules/session.ts";
import type { STrade } from "./stats.ts";

export type Range = "today" | "week" | "month" | "all";
export const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "all", label: "Todo" },
];

export const asRange = (v: unknown, fallback: Range = "all"): Range =>
  RANGES.some((r) => r.key === v) ? (v as Range) : fallback;

/** Today's trading day: it rolls over at 17:00 New York. */
export const today = () => sessionDateOf(new Date(), "cfd");

/** First day of a range, as YYYY-MM-DD; null for everything. */
export function rangeStart(range: Range, now = today()): string | null {
  if (range === "all") return null;
  if (range === "today") return now;
  if (range === "month") return `${now.slice(0, 7)}-01`;
  const d = new Date(`${now}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface Scoped {
  accounts: Account[];
  /** The account picked in the dock; null = all of them. */
  scope: Account | null;
  strategies: Strategy[];
  /** Trades in scope, newest first. */
  trades: Trade[];
  strades: STrade[];
}

export async function loadScoped(): Promise<Scoped> {
  const [accounts, strategies] = await Promise.all([listAccounts(), listStrategies()]);
  const scope = await getScope(accounts);
  const trades = await listTrades(scope?.id ?? null);
  return { accounts, scope, strategies, trades, strades: trades.map((t) => toSTrade(t, strategies)) };
}

export function inRange<T extends { day: string }>(items: T[], range: Range): T[] {
  const from = rangeStart(range);
  return from ? items.filter((t) => t.day >= from) : items;
}
