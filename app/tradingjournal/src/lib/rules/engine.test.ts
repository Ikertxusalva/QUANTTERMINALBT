import { test } from "node:test";
import assert from "node:assert/strict";
import { fromNyLocal, sessionDateOf, toNyLocal } from "./session.ts";
import {
  computeConsistency,
  computeDailyLoss,
  computeDrawdown,
  computePayoutDays,
  computeProfitTarget,
} from "./engine.ts";
import type { AccountRules, RuleAccount, RuleTrade } from "./types.ts";

const D = (n: number) => Math.round(n * 100); // dollars → cents
const ny = (s: string) => fromNyLocal(s);
const tr = (when: string, dollars: number): RuleTrade => ({ closedAt: ny(when), net: D(dollars) });

function acct(rules: AccountRules, over: Partial<RuleAccount> = {}): RuleAccount {
  return {
    market: "futures",
    phase: "evaluation",
    startingBalance: D(50_000),
    priorPnl: 0,
    rules,
    ...over,
  };
}

// Week of Mon 2026-11-02 … Fri 2026-11-06 (EST).

test("New York local time round-trips, in winter and summer", () => {
  assert.equal(toNyLocal(ny("2026-11-03T18:30")), "2026-11-03T18:30");
  assert.equal(toNyLocal(ny("2026-07-07T09:31")), "2026-07-07T09:31");
  assert.equal(ny("2026-11-03T12:00").toISOString(), "2026-11-03T17:00:00.000Z");
  assert.equal(ny("2026-07-07T12:00").toISOString(), "2026-07-07T16:00:00.000Z");
});

test("a time maps to its trading session", () => {
  const cases: [string, string, string][] = [
    // ET time, futures session, CFD session
    ["2026-11-03T16:59", "2026-11-03", "2026-11-03"],
    ["2026-11-03T17:00", "2026-11-03", "2026-11-04"],
    ["2026-11-03T17:59", "2026-11-03", "2026-11-04"],
    ["2026-11-03T18:00", "2026-11-04", "2026-11-04"],
    ["2026-11-03T18:30", "2026-11-04", "2026-11-04"],
    ["2026-11-06T17:30", "2026-11-06", "2026-11-07"],
    ["2026-11-06T18:30", "2026-11-09", "2026-11-07"],
    ["2026-11-07T12:00", "2026-11-09", "2026-11-07"],
    ["2026-11-08T12:00", "2026-11-09", "2026-11-08"],
    ["2026-11-08T19:00", "2026-11-09", "2026-11-09"],
  ];
  for (const [t, fut, cfd] of cases) {
    assert.equal(sessionDateOf(ny(t), "futures"), fut, `futures ${t}`);
    assert.equal(sessionDateOf(ny(t), "cfd"), cfd, `cfd ${t}`);
  }
});

test("static drawdown: the floor never moves", () => {
  const a = acct({ maxLoss: D(2000), drawdownType: "static" });
  const d = computeDrawdown(a, [tr("2026-11-02T10:00", 1000), tr("2026-11-02T11:00", -500)], [], ny("2026-11-02T12:00"))!;
  assert.equal(d.floor, D(48_000));
  assert.equal(d.headroom, D(2500));
  assert.equal(d.estimate, false);
});

test("end of day: the session in progress does not move the floor", () => {
  const a = acct({ maxLoss: D(2000), drawdownType: "eod" });
  const trades = [tr("2026-11-02T10:00", 1200), tr("2026-11-03T10:00", -400), tr("2026-11-04T10:00", 600)];
  const during = computeDrawdown(a, trades, [], ny("2026-11-04T12:00"))!;
  assert.equal(during.peak, D(51_200));
  assert.equal(during.floor, D(49_200));
  assert.equal(during.headroom, D(2200));
  const after = computeDrawdown(a, trades, [], ny("2026-11-05T09:00"))!;
  assert.equal(after.floor, D(49_400));
});

test("intraday trailing follows the highest closed balance and is an estimate", () => {
  const a = acct({ maxLoss: D(2000), drawdownType: "intraday" });
  const trades = [tr("2026-11-02T10:00", 800), tr("2026-11-02T10:30", -300), tr("2026-11-02T11:00", 200)];
  const d = computeDrawdown(a, trades, [], ny("2026-11-02T12:00"))!;
  assert.equal(d.floor, D(48_800));
  assert.equal(d.headroom, D(1900));
  assert.equal(d.estimate, true);
});

test("lock level stops the floor", () => {
  const a = acct({ maxLoss: D(2000), drawdownType: "eod", lockLevel: D(100) });
  const trades = [tr("2026-11-02T10:00", 1500), tr("2026-11-03T10:00", 600), tr("2026-11-04T10:00", 900)];
  const d = computeDrawdown(a, trades, [], ny("2026-11-05T09:00"))!;
  assert.equal(d.floor, D(50_100));
  assert.equal(d.locked, true);
  assert.equal(d.headroom, D(2900));
});

test("a payout lowers the balance, not the floor — unless it locks the floor", () => {
  const trades = [tr("2026-11-02T10:00", 1500)];
  const payouts = [{ date: "2026-11-03", amount: D(1000) }];
  const now = ny("2026-11-04T09:00");
  const plain = computeDrawdown(acct({ maxLoss: D(2000), drawdownType: "eod", lockLevel: 0 }), trades, payouts, now)!;
  assert.equal(plain.floor, D(49_500));
  assert.equal(plain.headroom, D(1000));
  const locks = computeDrawdown(
    acct({ maxLoss: D(2000), drawdownType: "eod", lockLevel: 0, payoutLocksFloor: true }),
    trades, payouts, now,
  )!;
  assert.equal(locks.floor, D(50_000));
  assert.equal(locks.headroom, D(500));
});

test("drawdown on gross profit keeps payouts in the rule balance", () => {
  const trades = [tr("2026-11-02T10:00", 3000), tr("2026-11-04T10:00", -600)];
  const payouts = [{ date: "2026-11-03", amount: D(2500) }];
  const now = ny("2026-11-04T12:00");
  const base: AccountRules = { maxLoss: D(2000), drawdownType: "intraday", lockLevel: 0 };
  const lowers = computeDrawdown(acct(base), trades, payouts, now)!;
  assert.equal(lowers.ruleBalance, D(49_900));
  assert.equal(lowers.breached, true);
  const gross = computeDrawdown(acct({ ...base, payoutsLowerBalance: false }), trades, payouts, now)!;
  assert.equal(gross.ruleBalance, D(52_400));
  assert.equal(gross.headroom, D(2400));
});

test("an account already in progress uses the firm's floor when given", () => {
  const rules: AccountRules = { maxLoss: D(2000), drawdownType: "eod" };
  const now = ny("2026-11-04T12:00");
  const exact = computeDrawdown(acct(rules, { priorPnl: D(2500), initialFloor: D(51_000) }), [], [], now)!;
  assert.equal(exact.peak, D(53_000));
  assert.equal(exact.headroom, D(1500));
  assert.equal(exact.estimate, false);
  const blank = computeDrawdown(acct(rules, { priorPnl: D(2500) }), [], [], now)!;
  assert.equal(blank.floor, D(50_500));
  assert.equal(blank.headroom, D(2000));
  assert.equal(blank.estimate, true);
  const locked = computeDrawdown(
    acct({ ...rules, lockLevel: D(100) }, { priorPnl: D(2500), initialFloor: D(51_000) }), [], [], now,
  )!;
  assert.equal(locked.floor, D(50_100));
  assert.equal(locked.headroom, D(2400));
});

test("daily loss is measured per session, and exactly the limit counts as hit", () => {
  const a = acct({ dailyLoss: D(1000) });
  const now = ny("2026-11-04T11:00");
  const hit = computeDailyLoss(a, [tr("2026-11-03T18:40", -700), tr("2026-11-04T10:15", -350)], now)!;
  assert.equal(hit.sessionNet, D(-1050));
  assert.equal(hit.hit, true);
  assert.equal(computeDailyLoss(a, [tr("2026-11-04T10:00", -1000)], now)!.hit, true);
  const close = computeDailyLoss(a, [tr("2026-11-04T10:00", -999.99)], now)!;
  assert.equal(close.hit, false);
  assert.equal(close.left, 1);
});

test("consistency: largest session against total profit", () => {
  const a = acct({ consistencyPct: 50 });
  const trades = [
    tr("2026-11-02T10:00", 1800), tr("2026-11-03T10:00", 400),
    tr("2026-11-04T10:00", -200), tr("2026-11-05T10:00", 600),
  ];
  const c = computeConsistency(a, trades, [])!;
  assert.equal(c.ratioPct, 69.2);
  assert.equal(c.within, false);
  assert.equal(c.moreProfitNeeded, D(1000));
  assert.equal(c.moreDaysNeeded, 1);
  assert.equal(computeConsistency(a, [tr("2026-11-02T10:00", -50)], [])!.ratioPct, null);
});

test("consistency since the last payout only counts later sessions", () => {
  const trades = [
    tr("2026-11-02T10:00", 500), tr("2026-11-03T10:00", 300),
    tr("2026-11-04T10:00", 200), tr("2026-11-05T10:00", 600),
  ];
  const funded = acct({ consistencyPct: 40, consistencySinceLastPayout: true }, { phase: "funded" });
  const withPayout = computeConsistency(funded, trades, [{ date: "2026-11-03", amount: D(100) }])!;
  assert.equal(withPayout.ratioPct, 75);
  assert.equal(withPayout.within, false);
  const none = computeConsistency(funded, trades, [])!;
  assert.equal(none.ratioPct, 37.5);
  assert.equal(none.within, true);
});

test("profit target counts prior P&L", () => {
  const a = acct({ profitTarget: D(3000), minDays: 5 }, { priorPnl: D(500) });
  const t = computeProfitTarget(a, [tr("2026-11-02T10:00", 1900)])!;
  assert.equal(t.progress, 0.8);
  assert.equal(t.toGo, D(600));
  assert.equal(t.sessionsTraded, 1);
  assert.equal(t.minDaysMet, false);
});

test("payout days need the least profit per day, and exactly the amount counts", () => {
  const a = acct({ payoutDays: 5, minProfitPerDay: D(100) }, { phase: "funded" });
  const trades = [
    tr("2026-11-02T10:00", 150), tr("2026-11-03T10:00", 99.99), tr("2026-11-04T10:00", 100),
    tr("2026-11-05T10:00", -50), tr("2026-11-06T10:00", 300),
  ];
  const p = computePayoutDays(a, trades, [])!;
  assert.equal(p.counted, 3);
  assert.equal(p.met, false);
});
