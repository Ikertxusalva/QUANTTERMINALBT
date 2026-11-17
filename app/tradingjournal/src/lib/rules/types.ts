// All money values are integer cents.

export type Market = "futures" | "cfd";
export type Phase = "evaluation" | "funded" | "personal";
export type DrawdownType = "static" | "eod" | "intraday";

export interface AccountRules {
  /** Max loss (drawdown amount). Absent = no max loss rule. */
  maxLoss?: number | null;
  drawdownType?: DrawdownType;
  /** Cents above the starting balance where the floor stops rising. null = never locks. */
  lockLevel?: number | null;
  /** First payout moves the floor straight to the lock level. */
  payoutLocksFloor?: boolean;
  /** false for firms that measure drawdown on gross profit. Default true. */
  payoutsLowerBalance?: boolean;

  dailyLoss?: number | null;
  dailyLossMode?: "soft" | "hard";

  profitTarget?: number | null;
  /** Evaluation: sessions needed to pass. */
  minDays?: number | null;

  /** Largest session as % of profit. */
  consistencyPct?: number | null;
  consistencyBasis?: "total" | "target";
  consistencySinceLastPayout?: boolean;

  /** Funded: qualifying sessions needed per payout. */
  payoutDays?: number | null;
  /** Funded: least profit for a session to count. null = any winning day. */
  minProfitPerDay?: number | null;

  maxContracts?: number | null;
}

export interface RuleAccount {
  market: Market;
  phase: Phase;
  startingBalance: number;
  /** P&L made before logging started. */
  priorPnl: number;
  /** Floor shown by the firm when joining an account already in progress. */
  initialFloor?: number | null;
  /** Trading days done before logging started (evaluation min days). */
  daysBefore?: number;
  rules: AccountRules;
}

export interface RuleTrade {
  closedAt: Date;
  /** Net P&L after fees. */
  net: number;
}

export interface RulePayout {
  /** Session date YYYY-MM-DD the payout is recorded under. */
  date: string;
  amount: number;
}
