"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/guard";
import { parseMoney } from "@/lib/format";
import { FEELINGS, GRADES, MISTAKES, SCOPE_COOKIE, SESSIONS, getAccount } from "@/lib/data";
import { parseFile, type ParsedTrade, type TimeBase } from "@/lib/import/parse.ts";
import { refreshNews } from "@/lib/news";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const done = () => revalidatePath("/", "layout");

// ------------------------------------------------------------------- scope

export async function selectScope(formData: FormData) {
  await requireAuth();
  const v = String(formData.get("account") ?? "all");
  (await cookies()).set(SCOPE_COOKIE, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  done();
}

// ------------------------------------------------------------------ review

export async function saveReview(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  const grade = String(formData.get("grade") ?? "");
  const plan = String(formData.get("plan_followed") ?? "");
  const mistake = String(formData.get("mistake") ?? "");
  const session = String(formData.get("session") ?? "");
  const feelings = formData.getAll("feelings").map(String).filter((f) => FEELINGS.includes(f));
  const strategyId = Number(formData.get("strategy_id")) || null;
  const risk = parseMoney(formData.get("risk"));
  await q(
    `update trades set grade=$2, plan_followed=$3, feelings=$4::jsonb, mistake=$5, note=$6, session=$7,
       strategy_id=$8, criteria_met=$9::jsonb, rules_broken=$10::jsonb, risk=$11, chart_url=$12
     where id=$1`,
    [
      id,
      GRADES.includes(grade) ? grade : null,
      ["yes", "partly", "no"].includes(plan) ? plan : null,
      JSON.stringify(feelings),
      MISTAKES.includes(mistake) ? mistake : null,
      text(formData.get("note")),
      SESSIONS.includes(session) ? session : null,
      strategyId,
      // Criteria and rules are only recorded when the form showed them.
      strategyId && formData.get("criteria_shown") ? JSON.stringify(formData.getAll("criteria").map(String)) : null,
      formData.get("rules_shown") ? JSON.stringify(formData.getAll("broken").map(Number)) : null,
      risk && risk > 0 ? risk : null,
      text(formData.get("chart_url")),
    ],
  );
  done();
  const next = Number(formData.get("next"));
  if (next) redirect(`/trades/${next}`);
}

// ------------------------------------------------------------------ import

export interface ImportState {
  error?: string;
  preview?: {
    source: string;
    total: number;
    fresh: number;
    duplicates: number;
    skipped: string[];
    net: number;
    first: string | null;
    last: string | null;
    detectedOffsetMin: number | null;
    sample: { symbol: string; side: string; qty: number; closedAt: string; net: number; dup: boolean }[];
  };
  imported?: { count: number; accountId: number };
}

function timeBase(v: string): TimeBase {
  const ny = /^ny:(\d+)$/.exec(v);
  if (ny) return { kind: "ny", plusHours: Number(ny[1]) };
  const utc = /^utc:(-?\d+)$/.exec(v);
  return { kind: "utc", offsetMin: utc ? Number(utc[1]) : 0 };
}

const SOURCE_LABEL: Record<string, string> = { mt5: "MetaTrader 5", ctrader: "cTrader", csv: "CSV" };

export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAuth();
  const account = await getAccount(Number(formData.get("account_id")));
  if (!account) return { error: "Elige la cuenta a la que pertenecen los trades." };
  if (account.status !== "active") return { error: "La cuenta está archivada: no admite trades nuevos." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige un archivo." };
  if (file.size > 12 * 1024 * 1024) return { error: "El archivo supera los 12 MB. Exporta un rango de fechas más corto." };

  let parsed;
  try {
    parsed = parseFile(new Uint8Array(await file.arrayBuffer()), timeBase(String(formData.get("tz") ?? "ny:7")));
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es un informe HTML, un Excel o un CSV?" };
  }
  if (parsed.trades.length === 0) {
    return { error: parsed.skipped[0] ?? "No se encontró ningún trade cerrado en el archivo." };
  }
  const future = parsed.trades.find((t) => t.closedAt.getTime() > Date.now() + 5 * 60_000);
  if (future) {
    return { error: `El trade de ${future.symbol} cierra en el futuro: la zona horaria elegida no parece la del archivo.` };
  }

  const existing = new Set(
    (await q<{ external_id: string }>("select external_id from trades where account_id = $1 and external_id is not null", [account.id]))
      .map((r) => r.external_id),
  );
  const seen = new Set<string>();
  const fresh: ParsedTrade[] = [];
  for (const t of parsed.trades) {
    if (existing.has(t.externalId) || seen.has(t.externalId)) continue;
    seen.add(t.externalId);
    fresh.push(t);
  }
  const netOf = (t: ParsedTrade) => t.gross - t.fees + t.swap;

  if (formData.get("intent") !== "commit") {
    const sorted = [...parsed.trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());
    return {
      preview: {
        source: SOURCE_LABEL[parsed.source],
        total: parsed.trades.length,
        fresh: fresh.length,
        duplicates: parsed.trades.length - fresh.length,
        skipped: parsed.skipped.slice(0, 10),
        net: fresh.reduce((s, t) => s + netOf(t), 0),
        first: sorted[0]?.closedAt.toISOString() ?? null,
        last: sorted.at(-1)?.closedAt.toISOString() ?? null,
        detectedOffsetMin: parsed.detectedOffsetMin,
        sample: sorted.slice(0, 8).map((t) => ({
          symbol: t.symbol, side: t.side, qty: t.qty, closedAt: t.closedAt.toISOString(),
          net: netOf(t), dup: existing.has(t.externalId),
        })),
      },
    };
  }

  if (fresh.length === 0) return { error: "Todos los trades de este archivo ya estaban importados." };
  const [{ id: importId }] = await q<{ id: number }>(
    "insert into imports (account_id, source, filename, trades) values ($1,$2,$3,$4) returning id",
    [account.id, parsed.source, file.name.slice(0, 200), fresh.length],
  );
  try {
    for (const t of fresh) {
      await q(
        `insert into trades (account_id, symbol, side, qty, gross, fees, swap, opened_at, closed_at,
                             source, external_id, import_id, entry_price, exit_price)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [account.id, t.symbol, t.side, t.qty, t.gross, t.fees, t.swap, t.openedAt?.toISOString() ?? null,
         t.closedAt.toISOString(), parsed.source, t.externalId, importId, t.entryPrice, t.exitPrice],
      );
    }
  } catch {
    // All or nothing: a half import is worse than none.
    await q("delete from trades where import_id = $1", [importId]);
    await q("delete from imports where id = $1", [importId]);
    return { error: "La importación falló a medias y se ha deshecho. No se guardó ningún trade." };
  }
  done();
  return { imported: { count: fresh.length, accountId: account.id } };
}

export async function undoImport(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  await q("delete from trades where import_id = $1", [id]);
  await q("delete from imports where id = $1", [id]);
  done();
}

// -------------------------------------------------------------- strategies

export async function saveStrategy(formData: FormData) {
  await requireAuth();
  const name = text(formData.get("name"));
  if (!name) return;
  const id = Number(formData.get("id")) || null;
  const prev = id
    ? ((await q<{ criteria: { id: string; label: string }[] }>("select criteria from strategies where id = $1", [id]))[0]?.criteria ?? [])
    : [];
  const labels = String(formData.get("criteria") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const stamp = Date.now().toString(36);
  // A criterion keeps its id while its text is unchanged, so past trades keep their ticks.
  const criteria = [...new Set(labels)].slice(0, 20).map((label, i) => ({
    id: prev.find((c) => c.label === label)?.id ?? `c${stamp}${i}`,
    label,
  }));
  const args = [name, text(formData.get("description")), JSON.stringify(criteria)];
  if (id) await q("update strategies set name=$1, description=$2, criteria=$3::jsonb where id=$4", [...args, id]);
  else await q("insert into strategies (name, description, criteria) values ($1,$2,$3::jsonb)", args);
  done();
  redirect("/strategies");
}

export async function setStrategyArchived(formData: FormData) {
  await requireAuth();
  await q("update strategies set archived = $2 where id = $1", [Number(formData.get("id")), formData.get("archived") === "1"]);
  done();
}

export async function deleteStrategy(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  await q("update trades set strategy_id = null where strategy_id = $1", [id]);
  await q("delete from strategies where id = $1", [id]);
  done();
  redirect("/strategies");
}

export async function addRule(formData: FormData) {
  await requireAuth();
  const name = text(formData.get("name"));
  if (name) await q("insert into rules (name) values ($1)", [name.slice(0, 120)]);
  done();
}

export async function setRuleArchived(formData: FormData) {
  await requireAuth();
  await q("update rules set archived = $2 where id = $1", [Number(formData.get("id")), formData.get("archived") === "1"]);
  done();
}

// -------------------------------------------------------------------- days

export async function saveDay(formData: FormData) {
  await requireAuth();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const verdict = String(formData.get("verdict") ?? "");
  const bias = String(formData.get("bias") ?? "");
  const f = (k: string) => text(formData.get(k));
  await q(
    `insert into days (date, bias, instrument, levels, scenarios, plan, verdict, said, market_did, next_time, review, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (date) do update set bias=excluded.bias, instrument=excluded.instrument, levels=excluded.levels,
       scenarios=excluded.scenarios, plan=excluded.plan, verdict=excluded.verdict, said=excluded.said,
       market_did=excluded.market_did, next_time=excluded.next_time, review=excluded.review, updated_at=now()`,
    [
      date,
      ["long", "short", "neutral"].includes(bias) ? bias : null,
      f("instrument"), f("levels"), f("scenarios"), f("plan"),
      ["correct", "partly", "wrong", "no_trade"].includes(verdict) ? verdict : null,
      f("said"), f("market_did"), f("next_time"), f("review"),
    ],
  );
  done();
}

export async function setPlanMark(formData: FormData) {
  await requireAuth();
  const v = String(formData.get("plan_followed") ?? "");
  await q("update trades set plan_followed = $2 where id = $1", [
    Number(formData.get("id")),
    ["yes", "partly", "no"].includes(v) ? v : null,
  ]);
  done();
}

// ------------------------------------------------------------------- notes

export async function saveNote(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id")) || null;
  const args = [
    text(formData.get("title")) ?? "Sin título",
    String(formData.get("body") ?? ""),
    text(formData.get("folder")),
    text(formData.get("tags")),
    formData.get("pinned") === "on",
  ];
  if (id) {
    await q("update notes set title=$1, body=$2, folder=$3, tags=$4, pinned=$5, updated_at=now() where id=$6", [...args, id]);
    done();
    return;
  }
  const [row] = await q<{ id: number }>(
    "insert into notes (title, body, folder, tags, pinned) values ($1,$2,$3,$4,$5) returning id",
    args,
  );
  done();
  redirect(`/notes/${row.id}`);
}

export async function deleteNote(formData: FormData) {
  await requireAuth();
  await q("delete from notes where id = $1", [Number(formData.get("id"))]);
  done();
  redirect("/notes");
}

// -------------------------------------------------------------------- news

export async function refreshNewsAction(): Promise<string | null> {
  await requireAuth();
  const res = await refreshNews();
  done();
  return res.ok ? `Calendario actualizado: ${res.count} eventos.` : res.error;
}
