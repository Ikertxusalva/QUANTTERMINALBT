import { test } from "node:test";
import assert from "node:assert/strict";
import { fromNyLocal } from "./rules/session.ts";
import {
  daySummary, dayStats, discipline, equity, groupBy, insights, metrics, monthGrid, rDistribution,
  type STrade,
} from "./stats.ts";

let seq = 0;
function tr(dollars: number, over: Partial<STrade> = {}): STrade {
  seq++;
  const day = over.day ?? "2026-11-02";
  return {
    id: seq, net: Math.round(dollars * 100), risk: null, openedAt: null,
    closedAt: new Date(fromNyLocal(`${day}T10:00`).getTime() + seq * 60_000),
    day, symbol: "EURUSD", side: "long", qty: 1, session: null, strategy: null,
    feelings: [], mistake: null, planFollowed: null, rulesBroken: null, ...over,
  };
}

test("win rate leaves breakevens out; profit factor, expectancy and averages", () => {
  const m = metrics([tr(200), tr(-100), tr(0), tr(300), tr(-50)]);
  assert.deepEqual([m.wins, m.losses, m.breakevens], [2, 2, 1]);
  assert.equal(m.winRate, 0.5);
  assert.equal(Math.round(m.profitFactor! * 100) / 100, 3.33);
  assert.equal(m.expectancy, 7000);
  assert.equal(m.avgWin, 25000);
  assert.equal(m.avgLoss, -7500);
});

test("max drawdown is the largest drop from a high in the running P&L", () => {
  const e = equity([tr(200), tr(-100), tr(0), tr(300), tr(-50)]);
  assert.deepEqual(e.points, [20000, 10000, 10000, 40000, 35000]);
  assert.equal(e.maxDrawdown, 10000);
  assert.equal(e.currentDrawdown, 5000);
});

test("R per trade and average RR of winners", () => {
  const r = { risk: 10000 };
  const m = metrics([tr(300, r), tr(300, r), tr(-100, r), tr(-100, r), tr(50)]);
  assert.equal(m.rPerTrade, 1);
  assert.equal(m.avgRR, 3);
  assert.equal(m.rCount, 4);
});

test("a breakeven band turns small results into breakevens and ends streaks", () => {
  const m = metrics([tr(200), tr(5), tr(-100)], 1000);
  assert.deepEqual([m.wins, m.losses, m.breakevens], [1, 1, 1]);
  assert.equal(m.winRate, 0.5);
  assert.equal(metrics([tr(10), tr(20), tr(0), tr(30)]).winStreak, 2);
  assert.equal(metrics([]).profitFactor, null);
});

test("days, the month grid and week totals", () => {
  const days = dayStats([
    tr(600, { day: "2026-11-02" }), tr(12.5, { day: "2026-11-02" }),
    tr(-318.75, { day: "2026-11-04" }), tr(455, { day: "2026-11-06" }), tr(100, { day: "2026-12-01" }),
  ]);
  assert.equal(days[0].net, 61250);
  assert.equal(days[0].trades, 2);
  const grid = monthGrid("2026-11", days);
  assert.equal(grid[0].days[0].date, "2026-10-26");
  assert.equal(grid[1].days[0].date, "2026-11-02");
  assert.deepEqual([grid[1].traded, grid[1].green, grid[1].net], [3, 2, 74875]);
  assert.equal(grid.at(-1)!.days[0].date, "2026-11-30");
  assert.equal(grid.at(-1)!.days[1].stat, null); // Dec 1 is outside the month
  const s = daySummary(days);
  assert.deepEqual([s.green, s.red, s.greenStreak], [3, 1, 2]);
});

test("grouping by weekday, side and hold time", () => {
  const trades = [
    tr(100, { day: "2026-11-02" }), tr(-40, { day: "2026-11-03", side: "short" }),
    tr(60, { day: "2026-11-03", openedAt: fromNyLocal("2026-11-03T09:58") }),
  ];
  const byDay = groupBy(trades, "day");
  assert.deepEqual(byDay.map((r) => [r.label, r.n, r.net]), [["Lun", 1, 10000], ["Mar", 2, 2000]]);
  assert.equal(byDay[0].small, true);
  assert.deepEqual(groupBy(trades, "side").map((r) => r.label), ["Largo", "Corto"]);
  assert.equal(groupBy(trades, "hold").reduce((s, r) => s + r.n, 0), 1); // only trades with an open time
});

test("R distribution buckets", () => {
  const r = { risk: 10000 };
  const d = rDistribution([tr(-100, r), tr(40, r), tr(250, r), tr(500, r), tr(10)]);
  const n = Object.fromEntries(d.map((b) => [b.label, b.n]));
  assert.equal(n["−1 a −0.5R"], 1);
  assert.equal(n["0 a 0.5R"], 1);
  assert.equal(n["2 a 3R"], 1);
  assert.equal(n["> 3R"], 1);
});

test("discipline compares rule-following trades with rule-breaking ones", () => {
  const followed = [...Array(15).fill(100), ...Array(9).fill(-50)].map((d) => tr(d, { rulesBroken: [] }));
  const broke = [...Array(4).fill(100), ...Array(8).fill(-100)].map((d) => tr(d, { rulesBroken: [1] }));
  const d = discipline([...followed, ...broke, tr(999)]);
  assert.equal(d.followed.n, 24);
  assert.equal(d.broke.n, 12);
  assert.equal(d.gapPp, 29.2);
  assert.equal(d.broke.net, -40000);
  assert.equal(discipline(followed.slice(0, 5)).gapPp, null);
});

test("an insight needs 10 trades each side and a clear gap", () => {
  const trades: STrade[] = [];
  for (let i = 0; i < 12; i++) {
    const day = `2026-11-${String(2 + i).padStart(2, "0")}`;
    trades.push(tr(-40, { day, side: "short" }), tr(35, { day }));
  }
  const found = insights(trades);
  const shorts = found.find((i) => i.title === "Trades en corto")!;
  assert.equal(shorts.n, 12);
  assert.equal(shorts.impact, (-4000 - 3500) * 12);
  assert.equal(shorts.early, true);
  assert.deepEqual(insights(trades.slice(0, 10)), []);
});
