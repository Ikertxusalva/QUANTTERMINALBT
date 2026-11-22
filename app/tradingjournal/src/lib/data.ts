import { cookies } from "next/headers";
import { q } from "./db";
import { computeAccountStatus, type AccountStatus } from "./rules/engine.ts";
import { sessionDateOf } from "./rules/session.ts";
import type { AccountRules, Market, Phase, RuleAccount } from "./rules/types.ts";
import type { STrade } from "./stats.ts";

export interface Account {
  id: number;
  name: string;
  kind: "prop" | "personal";
  firm: string | null;
  plan: string | null;
  phase: Phase;
  market: Market;
  account_number: string | null;
  starting_balance: number;
  prior_pnl: number;
  initial_floor: number | null;
  days_before: number;
  rules: AccountRules;
  status: "active" | "archived";
  created_at: Date;
}

export interface Trade {
  id: number;
  account_id: number;
  symbol: string;
  side: "long" | "short";
  qty: number;
  gross: number;
  fees: number;
  swap: number;
  risk: number | null;
  opened_at: Date | null;
  closed_at: Date;
  source: string;
  grade: string | null;
  note: string | null;
  external_id: string | null;
  import_id: number | null;
  session: string | null;
  strategy_id: number | null;
  plan_followed: "yes" | "partly" | "no" | null;
  feelings: string[] | null;
  mistake: string | null;
  criteria_met: string[] | null;
  rules_broken: number[] | null;
  chart_url: string | null;
  entry_price: number | null;
  exit_price: number | null;
  /** Joined from the account. */
  account_name: string;
  market: Market;
}

export type LedgerType = "eval_fee" | "reset" | "activation" | "subscription" | "payout" | "other";

export interface LedgerEntry {
  id: number;
  account_id: number | null;
  type: LedgerType;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note: string | null;
}

export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  criteria: { id: string; label: string }[];
  archived: boolean;
}

export interface Rule {
  id: number;
  name: string;
  archived: boolean;
}

export interface Day {
  date: string;
  bias: string | null;
  instrument: string | null;
  levels: string | null;
  scenarios: string | null;
  plan: string | null;
  verdict: "correct" | "partly" | "wrong" | "no_trade" | null;
  said: string | null;
  market_did: string | null;
  next_time: string | null;
  review: string | null;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  folder: string | null;
  tags: string | null;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

export const LEDGER_LABEL: Record<LedgerType, string> = {
  eval_fee: "Evaluación",
  reset: "Reset",
  activation: "Activación",
  subscription: "Suscripción",
  payout: "Payout",
  other: "Otro",
};

export const SESSIONS = ["Asia", "Londres", "Nueva York", "Solape Londres–NY", "Mediodía NY"];
export const FEELINGS = ["Calma", "Prisa", "FOMO", "Venganza", "Tilt"];
export const MISTAKES = ["Salida temprana", "Entrada tardía", "Sobredimensionado", "Ninguno"];
export const GRADES = ["A+", "A", "B", "C", "D"];

const LEDGER_COLS = "id, account_id, type, amount, to_char(date, 'YYYY-MM-DD') as date, note";
const TRADE_SQL =
  "select t.*, a.name as account_name, a.market from trades t join accounts a on a.id = t.account_id";

/** Net P&L: result − commissions + swap. */
export const net = (t: Pick<Trade, "gross" | "fees"> & { swap?: number | null }) =>
  t.gross - t.fees + (t.swap ?? 0);

export const isReviewed = (t: Trade) => t.plan_followed != null && t.grade != null;

export function listAccounts(): Promise<Account[]> {
  return q<Account>("select * from accounts order by status, created_at, id");
}

export async function getAccount(id: number): Promise<Account | null> {
  const rows = await q<Account>("select * from accounts where id = $1", [id]);
  return rows[0] ?? null;
}

export function listTrades(accountId?: number | null): Promise<Trade[]> {
  return accountId == null
    ? q<Trade>(`${TRADE_SQL} order by t.closed_at desc, t.id desc`)
    : q<Trade>(`${TRADE_SQL} where t.account_id = $1 order by t.closed_at desc, t.id desc`, [
        accountId,
      ]);
}

export async function getTrade(id: number): Promise<Trade | null> {
  return (await q<Trade>(`${TRADE_SQL} where t.id = $1`, [id]))[0] ?? null;
}

export function listLedger(accountId?: number): Promise<LedgerEntry[]> {
  return accountId == null
    ? q<LedgerEntry>(`select ${LEDGER_COLS} from ledger order by date desc, id desc`)
    : q<LedgerEntry>(
        `select ${LEDGER_COLS} from ledger where account_id = $1 order by date desc, id desc`,
        [accountId],
      );
}

export const listStrategies = () => q<Strategy>("select * from strategies order by archived, name");
export const listRules = () => q<Rule>("select * from rules order by archived, id");
export const listDays = () => q<Day>("select * from days order by date desc");
export const getDay = async (date: string) =>
  (await q<Day>("select * from days where date = $1", [date]))[0] ?? null;
export const listNotes = () => q<Note>("select * from notes order by pinned desc, updated_at desc");
export const getNote = async (id: number) =>
  (await q<Note>("select * from notes where id = $1", [id]))[0] ?? null;

// ------------------------------------------------------------------ scope

export const SCOPE_COOKIE = "tj_account";

/** The account picked in the top bar; null means every account. */
export async function getScope(accounts: Account[]): Promise<Account | null> {
  const v = (await cookies()).get(SCOPE_COOKIE)?.value;
  return accounts.find((a) => String(a.id) === v) ?? null;
}

/** Session day a trade counts on, by its own account's clock. */
export const tradeDay = (t: Trade) => sessionDateOf(new Date(t.closed_at), t.market);

export function toSTrade(t: Trade, strategies: Strategy[] = []): STrade {
  return {
    id: t.id,
    net: net(t),
    risk: t.risk,
    openedAt: t.opened_at ? new Date(t.opened_at) : null,
    closedAt: new Date(t.closed_at),
    day: tradeDay(t),
    symbol: t.symbol,
    side: t.side,
    qty: t.qty,
    session: t.session,
    strategy: strategies.find((s) => s.id === t.strategy_id)?.name ?? null,
    feelings: t.feelings ?? [],
    mistake: t.mistake,
    planFollowed: t.plan_followed,
    rulesBroken: t.rules_broken,
  };
}

// ------------------------------------------------------------------ views

export function toRuleAccount(a: Account): RuleAccount {
  return {
    market: a.market,
    phase: a.phase,
    startingBalance: a.starting_balance,
    priorPnl: a.prior_pnl,
    initialFloor: a.initial_floor,
    daysBefore: a.days_before,
    rules: a.rules ?? {},
  };
}

export interface AccountView {
  account: Account;
  status: AccountStatus;
  trades: Trade[];
  ledger: LedgerEntry[];
  /** Payouts − everything else, in cents. */
  propNet: number;
  paidOut: number;
  spent: number;
}

export function buildView(account: Account, trades: Trade[], ledger: LedgerEntry[]): AccountView {
  const payouts = ledger.filter((l) => l.type === "payout");
  const status = computeAccountStatus(
    toRuleAccount(account),
    trades.map((t) => ({ closedAt: new Date(t.closed_at), net: net(t) })),
    payouts.map((p) => ({ date: p.date, amount: p.amount })),
  );
  const paidOut = payouts.reduce((s, p) => s + p.amount, 0);
  const spent = ledger.filter((l) => l.type !== "payout").reduce((s, l) => s + l.amount, 0);
  return { account, status, trades, ledger, paidOut, spent, propNet: paidOut - spent };
}

/** Every account with its trades, ledger and rule status. */
export async function loadViews(): Promise<AccountView[]> {
  const [accounts, trades, ledger] = await Promise.all([listAccounts(), listTrades(), listLedger()]);
  return accounts.map((a) =>
    buildView(
      a,
      trades.filter((t) => t.account_id === a.id),
      ledger.filter((l) => l.account_id === a.id),
    ),
  );
}
