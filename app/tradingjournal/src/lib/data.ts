import { q } from "./db";
import { computeAccountStatus, type AccountStatus } from "./rules/engine.ts";
import type { AccountRules, Market, Phase, RuleAccount } from "./rules/types.ts";

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
  risk: number | null;
  opened_at: Date | null;
  closed_at: Date;
  source: string;
  grade: string | null;
  note: string | null;
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

export const LEDGER_LABEL: Record<LedgerType, string> = {
  eval_fee: "Evaluación",
  reset: "Reset",
  activation: "Activación",
  subscription: "Suscripción",
  payout: "Payout",
  other: "Otro",
};

const LEDGER_COLS = "id, account_id, type, amount, to_char(date, 'YYYY-MM-DD') as date, note";

export const net = (t: Pick<Trade, "gross" | "fees">) => t.gross - t.fees;

export function listAccounts(): Promise<Account[]> {
  return q<Account>("select * from accounts order by status, created_at, id");
}

export async function getAccount(id: number): Promise<Account | null> {
  const rows = await q<Account>("select * from accounts where id = $1", [id]);
  return rows[0] ?? null;
}

export function listTrades(accountId?: number): Promise<Trade[]> {
  return accountId == null
    ? q<Trade>("select * from trades order by closed_at desc, id desc")
    : q<Trade>("select * from trades where account_id = $1 order by closed_at desc, id desc", [
        accountId,
      ]);
}

export function listLedger(accountId?: number): Promise<LedgerEntry[]> {
  return accountId == null
    ? q<LedgerEntry>(`select ${LEDGER_COLS} from ledger order by date desc, id desc`)
    : q<LedgerEntry>(
        `select ${LEDGER_COLS} from ledger where account_id = $1 order by date desc, id desc`,
        [accountId],
      );
}

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
