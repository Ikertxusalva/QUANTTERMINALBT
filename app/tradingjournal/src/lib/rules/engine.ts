import { sessionDateOf } from "./session.ts";
import type { RuleAccount, RulePayout, RuleTrade } from "./types.ts";

export interface SessionSummary {
  date: string;
  net: number;
  trades: number;
}

/** Net P&L per trading session, oldest first. */
export function groupSessions(account: RuleAccount, trades: RuleTrade[]): SessionSummary[] {
  const map = new Map<string, SessionSummary>();
  for (const t of trades) {
    const date = sessionDateOf(t.closedAt, account.market);
    const s = map.get(date) ?? { date, net: 0, trades: 0 };
    s.net += t.net;
    s.trades += 1;
    map.set(date, s);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function lastPayoutDate(payouts: RulePayout[]): string | null {
  let last: string | null = null;
  for (const p of payouts) if (!last || p.date > last) last = p.date;
  return last;
}

// ---------------------------------------------------------------- balance

export interface BalanceStatus {
  /** Real balance: start + prior P&L + trades − payouts. */
  balance: number;
  tradesNet: number;
  payoutsTotal: number;
}

export function computeBalance(
  account: RuleAccount,
  trades: RuleTrade[],
  payouts: RulePayout[],
): BalanceStatus {
  const tradesNet = trades.reduce((s, t) => s + t.net, 0);
  const payoutsTotal = payouts.reduce((s, p) => s + p.amount, 0);
  return {
    balance: account.startingBalance + account.priorPnl + tradesNet - payoutsTotal,
    tradesNet,
    payoutsTotal,
  };
}

// --------------------------------------------------------------- drawdown

export interface DrawdownStatus {
  /** Balance the floor is checked against. */
  ruleBalance: number;
  floor: number;
  peak: number;
  /** ruleBalance − floor: how much can still be lost. */
  headroom: number;
  locked: boolean;
  breached: boolean;
  /** True when the real floor may be higher than shown. */
  estimate: boolean;
  /** Share of the max loss already used, 0..1. */
  used: number;
}

export function computeDrawdown(
  account: RuleAccount,
  trades: RuleTrade[],
  payouts: RulePayout[],
  now: Date = new Date(),
): DrawdownStatus | null {
  const r = account.rules;
  if (!r.maxLoss) return null;
  const type = r.drawdownType ?? "static";
  const lowers = r.payoutsLowerBalance !== false;
  const start = account.startingBalance;
  const opening = start + account.priorPnl;

  // Timeline: trades in close order; a payout applies after its session's trades.
  type Ev = { session: string; order: number; at: number; delta: number; isTrade: boolean };
  const events: Ev[] = [];
  for (const t of trades) {
    events.push({
      session: sessionDateOf(t.closedAt, account.market),
      order: 0,
      at: t.closedAt.getTime(),
      delta: t.net,
      isTrade: true,
    });
  }
  for (const p of payouts) {
    events.push({ session: p.date, order: 1, at: 0, delta: lowers ? -p.amount : 0, isTrade: false });
  }
  events.sort(
    (a, b) => a.session.localeCompare(b.session) || a.order - b.order || a.at - b.at,
  );

  const currentSession = sessionDateOf(now, account.market);
  let peak = account.initialFloor != null ? account.initialFloor + r.maxLoss : opening;
  let bal = opening;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    bal += e.delta;
    if (type === "intraday" && e.isTrade) {
      peak = Math.max(peak, bal);
    } else if (type === "eod") {
      const next = events[i + 1];
      const sessionEnds = !next || next.session !== e.session;
      // Only a completed session's close moves the floor.
      if (sessionEnds && e.session < currentSession) peak = Math.max(peak, bal);
    }
  }

  let floor = type === "static" ? start - r.maxLoss : peak - r.maxLoss;
  let locked = false;
  if (type !== "static" && r.lockLevel != null) {
    const lockFloor = start + r.lockLevel;
    if (floor >= lockFloor) {
      floor = lockFloor;
      locked = true;
    }
    if (r.payoutLocksFloor && payouts.length > 0) {
      floor = lockFloor;
      locked = true;
    }
  }

  const headroom = bal - floor;
  const estimate =
    type === "intraday" ||
    (type === "eod" && account.priorPnl !== 0 && account.initialFloor == null);

  return {
    ruleBalance: bal,
    floor,
    peak,
    headroom,
    locked,
    breached: headroom <= 0,
    estimate,
    used: Math.min(1, Math.max(0, 1 - headroom / r.maxLoss)),
  };
}

// ------------------------------------------------------------- daily loss

export interface DailyLossStatus {
  limit: number;
  mode: "soft" | "hard";
  session: string;
  sessionNet: number;
  tradesThisSession: number;
  left: number;
  hit: boolean;
}

export function computeDailyLoss(
  account: RuleAccount,
  trades: RuleTrade[],
  now: Date = new Date(),
): DailyLossStatus | null {
  const limit = account.rules.dailyLoss;
  if (!limit) return null;
  const session = sessionDateOf(now, account.market);
  let sessionNet = 0;
  let n = 0;
  for (const t of trades) {
    if (sessionDateOf(t.closedAt, account.market) === session) {
      sessionNet += t.net;
      n++;
    }
  }
  return {
    limit,
    mode: account.rules.dailyLossMode ?? "soft",
    session,
    sessionNet,
    tradesThisSession: n,
    left: Math.max(0, limit + Math.min(0, sessionNet)),
    hit: sessionNet <= -limit,
  };
}

// ------------------------------------------------------------ consistency

export interface ConsistencyStatus {
  limitPct: number;
  basis: "total" | "target";
  largest: number;
  /** Profit the largest session is measured against. */
  against: number;
  /** null when there is no profit yet to measure against. */
  ratioPct: number | null;
  within: boolean | null;
  /** Extra profit that brings the best day under the limit (basis "total"). */
  moreProfitNeeded: number;
  moreDaysNeeded: number;
  sinceDate: string | null;
}

export function computeConsistency(
  account: RuleAccount,
  trades: RuleTrade[],
  payouts: RulePayout[],
): ConsistencyStatus | null {
  const r = account.rules;
  if (!r.consistencyPct) return null;
  const basis = r.consistencyBasis ?? "total";
  let sessions = groupSessions(account, trades);
  let sinceDate: string | null = null;
  if (r.consistencySinceLastPayout && account.phase === "funded") {
    sinceDate = lastPayoutDate(payouts);
    if (sinceDate) sessions = sessions.filter((s) => s.date > sinceDate!);
  }
  const largest = sessions.reduce((m, s) => Math.max(m, s.net), 0);
  const total = sessions.reduce((s, x) => s + x.net, 0);
  const against = basis === "target" ? (r.profitTarget ?? 0) : total;

  const base: ConsistencyStatus = {
    limitPct: r.consistencyPct,
    basis,
    largest,
    against,
    ratioPct: null,
    within: null,
    moreProfitNeeded: 0,
    moreDaysNeeded: 0,
    sinceDate,
  };
  if (against <= 0) return base;

  const ratioPct = Math.round((largest / against) * 1000) / 10;
  const within = largest * 100 <= r.consistencyPct * against;
  let more = 0;
  let days = 0;
  if (!within && basis === "total") {
    more = Math.ceil((largest * 100) / r.consistencyPct - total);
    days = Math.ceil(more / largest);
  }
  return { ...base, ratioPct, within, moreProfitNeeded: more, moreDaysNeeded: days };
}

// ---------------------------------------------------------- profit target

export interface ProfitTargetStatus {
  target: number;
  profit: number;
  progress: number;
  toGo: number;
  reached: boolean;
  sessionsTraded: number;
  minDays: number | null;
  minDaysMet: boolean;
}

export function computeProfitTarget(
  account: RuleAccount,
  trades: RuleTrade[],
): ProfitTargetStatus | null {
  const target = account.rules.profitTarget;
  if (!target || account.phase !== "evaluation") return null;
  const profit = account.priorPnl + trades.reduce((s, t) => s + t.net, 0);
  const sessionsTraded = groupSessions(account, trades).length + (account.daysBefore ?? 0);
  const minDays = account.rules.minDays ?? null;
  return {
    target,
    profit,
    progress: Math.min(1, Math.max(0, profit / target)),
    toGo: Math.max(0, target - profit),
    reached: profit >= target,
    sessionsTraded,
    minDays,
    minDaysMet: minDays == null || sessionsTraded >= minDays,
  };
}

// ------------------------------------------------------------ payout days

export interface PayoutDaysStatus {
  required: number;
  counted: number;
  met: boolean;
  minProfitPerDay: number | null;
  sinceDate: string | null;
  /** Count is a floor: days before logging started can't be seen. */
  atLeast: boolean;
}

export function computePayoutDays(
  account: RuleAccount,
  trades: RuleTrade[],
  payouts: RulePayout[],
): PayoutDaysStatus | null {
  const required = account.rules.payoutDays;
  if (!required || account.phase !== "funded") return null;
  const min = account.rules.minProfitPerDay ?? null;
  const sinceDate = lastPayoutDate(payouts);
  const counted = groupSessions(account, trades).filter(
    (s) => (!sinceDate || s.date > sinceDate) && (min != null ? s.net >= min : s.net > 0),
  ).length;
  return {
    required,
    counted,
    met: counted >= required,
    minProfitPerDay: min,
    sinceDate,
    atLeast: account.priorPnl !== 0 && !sinceDate,
  };
}

// ----------------------------------------------------------------- status

export type AccountHealth = "ok" | "at_risk" | "breached" | "daily_hit" | "target_met" | "payout_ready";

export interface AccountStatus {
  balance: BalanceStatus;
  drawdown: DrawdownStatus | null;
  dailyLoss: DailyLossStatus | null;
  consistency: ConsistencyStatus | null;
  target: ProfitTargetStatus | null;
  payoutDays: PayoutDaysStatus | null;
  health: AccountHealth;
  /** Short note explaining the health flag. */
  attention: string | null;
}

export function computeAccountStatus(
  account: RuleAccount,
  trades: RuleTrade[],
  payouts: RulePayout[],
  now: Date = new Date(),
): AccountStatus {
  const balance = computeBalance(account, trades, payouts);
  const drawdown = computeDrawdown(account, trades, payouts, now);
  const dailyLoss = computeDailyLoss(account, trades, now);
  const consistency = computeConsistency(account, trades, payouts);
  const target = computeProfitTarget(account, trades);
  const payoutDays = computePayoutDays(account, trades, payouts);

  let health: AccountHealth = "ok";
  let attention: string | null = null;
  const consistencyBlocks = consistency?.within === false;

  if (drawdown?.breached) {
    health = "breached";
    attention = "Pérdida máxima alcanzada";
  } else if (dailyLoss?.hit) {
    health = "daily_hit";
    attention =
      dailyLoss.mode === "hard"
        ? "Límite diario superado · la cuenta falla"
        : "Límite diario alcanzado · pausa hasta la próxima sesión";
  } else if (drawdown && drawdown.used >= 0.8) {
    health = "at_risk";
    attention = "Has usado más del 80 % de la pérdida máxima";
  } else if (target?.reached && target.minDaysMet) {
    health = "target_met";
    attention = consistencyBlocks
      ? "Objetivo cumplido · la consistencia bloquea el pase"
      : "Objetivo cumplido";
  } else if (payoutDays?.met) {
    health = "payout_ready";
    attention = consistencyBlocks
      ? "Días cumplidos · la consistencia bloquea el payout"
      : "Lista para payout";
  }

  return { balance, drawdown, dailyLoss, consistency, target, payoutDays, health, attention };
}
