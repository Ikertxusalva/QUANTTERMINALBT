"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, authMode, isValidSession, sessionToken } from "@/lib/auth";
import { q } from "@/lib/db";
import { parseMoney } from "@/lib/format";
import { fromNyLocal, sessionDateOf } from "@/lib/rules/session.ts";
import type { AccountRules, Market, Phase } from "@/lib/rules/types.ts";
import { getAccount, type LedgerType } from "@/lib/data";

async function requireAuth() {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) redirect("/login");
}

// ------------------------------------------------------------------ access

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  if (authMode() !== "locked") return "Falta configurar APP_PASSWORD en el servidor.";
  const password = String(formData.get("password") ?? "");
  if (password !== process.env.APP_PASSWORD) return "Contraseña incorrecta.";
  const store = await cookies();
  store.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------- accounts

export interface NewAccountInput {
  kind: "prop" | "personal";
  firm: string | null;
  plan: string | null;
  phase: Phase;
  market: Market;
  /** Starting balance, cents. */
  startingBalance: number;
  rules: AccountRules;
  name: string;
  accountNumber: string;
  /** Already trading: where the account stands today. */
  currentBalance: number | null;
  currentFloor: number | null;
  daysBefore: number;
  howMany: number;
  /** Fee paid per account, cents. */
  feePaid: number | null;
}

function todayNy(market: Market): string {
  return sessionDateOf(new Date(), market);
}

export async function createAccount(input: NewAccountInput): Promise<{ error: string } | never> {
  await requireAuth();
  const name = input.name.trim();
  if (!name) return { error: "Ponle un nombre a la cuenta." };
  if (!Number.isFinite(input.startingBalance) || input.startingBalance <= 0)
    return { error: "El balance inicial tiene que ser mayor que cero." };
  const howMany = Math.min(20, Math.max(1, Math.floor(input.howMany || 1)));
  const prior =
    input.currentBalance != null ? input.currentBalance - input.startingBalance : 0;

  let firstId: number | null = null;
  for (let i = 1; i <= howMany; i++) {
    const rows = await q<{ id: number }>(
      `insert into accounts
        (name, kind, firm, plan, phase, market, account_number, starting_balance,
         prior_pnl, initial_floor, days_before, rules)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) returning id`,
      [
        howMany > 1 ? `${name} #${i}` : name,
        input.kind,
        input.firm?.trim() || null,
        input.plan?.trim() || null,
        input.kind === "personal" ? "personal" : input.phase,
        input.market,
        howMany === 1 ? input.accountNumber.trim() || null : null,
        input.startingBalance,
        prior,
        input.currentBalance != null ? input.currentFloor : null,
        input.currentBalance != null ? Math.max(0, Math.floor(input.daysBefore || 0)) : 0,
        JSON.stringify(input.rules ?? {}),
      ],
    );
    firstId ??= rows[0].id;
    if (input.kind === "prop" && input.feePaid && input.feePaid > 0) {
      await q("insert into ledger (account_id, type, amount, date, note) values ($1,$2,$3,$4,$5)", [
        rows[0].id,
        input.phase === "funded" ? "activation" : "eval_fee",
        input.feePaid,
        todayNy(input.market),
        "Al crear la cuenta",
      ]);
    }
  }
  revalidatePath("/", "layout");
  redirect(howMany === 1 ? `/accounts/${firstId}` : "/accounts");
}

export async function setAccountStatus(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  const status = formData.get("status") === "archived" ? "archived" : "active";
  await q("update accounts set status = $1 where id = $2", [status, id]);
  revalidatePath("/", "layout");
}

export async function deleteAccount(formData: FormData) {
  await requireAuth();
  await q("delete from accounts where id = $1", [Number(formData.get("id"))]);
  revalidatePath("/", "layout");
  redirect("/accounts");
}

// ------------------------------------------------------------------ trades

export async function logTrade(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireAuth();
  const accountId = Number(formData.get("account_id"));
  const account = await getAccount(accountId);
  if (!account) return "La cuenta no existe.";
  if (account.status !== "active") return "La cuenta está archivada: no admite trades nuevos.";

  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return "Elige el instrumento.";
  const gross = parseMoney(formData.get("result"));
  if (gross == null) return "Escribe el resultado del trade en dólares.";
  const fees = parseMoney(formData.get("fees")) ?? 0;
  if (fees < 0) return "Las comisiones no pueden ser negativas.";
  const qty = Number(formData.get("qty"));
  if (!Number.isFinite(qty) || qty <= 0) return "El tamaño tiene que ser mayor que cero.";
  const risk = parseMoney(formData.get("risk"));
  const closed = String(formData.get("closed_at") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(closed)) return "Indica la hora de cierre.";
  const closedAt = fromNyLocal(closed);
  if (closedAt.getTime() > Date.now() + 60_000) return "La hora de cierre está en el futuro.";

  await q(
    `insert into trades (account_id, symbol, side, qty, gross, fees, risk, closed_at, grade, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      accountId,
      symbol,
      formData.get("side") === "short" ? "short" : "long",
      qty,
      gross,
      fees,
      risk && risk > 0 ? risk : null,
      closedAt.toISOString(),
      String(formData.get("grade") ?? "") || null,
      String(formData.get("note") ?? "").trim() || null,
    ],
  );
  revalidatePath("/", "layout");
  return null;
}

export async function deleteTrade(formData: FormData) {
  await requireAuth();
  await q("delete from trades where id = $1", [Number(formData.get("id"))]);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ ledger

const LEDGER_TYPES: LedgerType[] = ["eval_fee", "reset", "activation", "subscription", "payout", "other"];

export async function addLedgerEntry(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  await requireAuth();
  const accountId = Number(formData.get("account_id"));
  const type = String(formData.get("type")) as LedgerType;
  if (!LEDGER_TYPES.includes(type)) return "Tipo no válido.";
  const amount = parseMoney(formData.get("amount"));
  if (amount == null || amount <= 0) return "Escribe un importe mayor que cero.";
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Indica la fecha.";
  await q("insert into ledger (account_id, type, amount, date, note) values ($1,$2,$3,$4,$5)", [
    accountId,
    type,
    amount,
    date,
    String(formData.get("note") ?? "").trim() || null,
  ]);
  revalidatePath("/", "layout");
  return null;
}

export async function deleteLedgerEntry(formData: FormData) {
  await requireAuth();
  await q("delete from ledger where id = $1", [Number(formData.get("id"))]);
  revalidatePath("/", "layout");
}
