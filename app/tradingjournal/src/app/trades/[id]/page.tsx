import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTrade } from "@/app/actions";
import { saveReview } from "@/app/journal-actions";
import { Shell } from "@/components/Shell";
import { SOURCE_LABEL } from "@/components/TradeRow";
import {
  FEELINGS, GRADES, MISTAKES, SESSIONS, getTrade, isReviewed, listRules, listStrategies, listTrades, net,
} from "@/lib/data";
import { money } from "@/lib/format";
import { instrumentsFor } from "@/lib/instruments";
import { nyWallClock } from "@/lib/rules/session.ts";

export const dynamic = "force-dynamic";

/** A radio or checkbox drawn as a pill. */
function Choice({ name, value, label, checked, type = "radio" }: { name: string; value: string; label: string; checked: boolean; type?: "radio" | "checkbox" }) {
  return (
    <label className="relative">
      <input type={type} name={name} value={value} defaultChecked={checked} className="pill-check" />
      <span className="pill">{label}</span>
    </label>
  );
}

const hhmm = (d: Date) => nyWallClock(d).toISOString().slice(11, 16);

export default async function TradePage(props: PageProps<"/trades/[id]">) {
  const { id } = await props.params;
  const t = await getTrade(Number(id));
  if (!t) notFound();
  const [strategies, rules, all] = await Promise.all([listStrategies(), listRules(), listTrades()]);
  const n = net(t);
  const closed = new Date(t.closed_at);
  const opened = t.opened_at ? new Date(t.opened_at) : null;
  const holdMin = opened ? Math.round((closed.getTime() - opened.getTime()) / 60000) : null;
  const instrument = instrumentsFor(t.market).find((i) => i.symbol === t.symbol);
  const pending = all.filter((x) => !isReviewed(x)).reverse();
  const pos = pending.findIndex((x) => x.id === t.id);
  const nextPending = pending.find((x) => x.id !== t.id && (pos === -1 || pending.indexOf(x) > pos)) ?? pending.find((x) => x.id !== t.id);
  const prevPending = pos > 0 ? pending[pos - 1] : null;
  const strategy = strategies.find((s) => s.id === t.strategy_id);
  const activeRules = rules.filter((r) => !r.archived || t.rules_broken?.includes(r.id));
  const answered = [t.grade, t.plan_followed, t.feelings?.length || t.mistake].filter(Boolean).length;
  const dateLabel = new Intl.DateTimeFormat("es-ES", { timeZone: "America/New_York", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(closed);

  return (
    <Shell active="/journal">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/journal" className="btn btn-sm">← Trades</Link>
          {pending.length > 0 && (
            <span className="pill pill-static gap-3">
              {prevPending ? <Link href={`/trades/${prevPending.id}`} aria-label="Anterior por revisar">‹</Link> : <span className="text-tx-4">‹</span>}
              {pos === -1 ? `${pending.length} por revisar` : `Trade ${pos + 1} de ${pending.length} por revisar`}
              {nextPending ? <Link href={`/trades/${nextPending.id}`} aria-label="Siguiente por revisar">›</Link> : <span className="text-tx-4">›</span>}
            </span>
          )}
        </div>
        <form action={deleteTrade}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="back" value="1" />
          <button className="btn btn-sm btn-danger">Borrar trade</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">{t.symbol}</h1>
        <span className="chip chip-solid">{t.side === "long" ? "Largo" : "Corto"}</span>
        <span className="chip border-dashed">{isReviewed(t) ? "Revisado" : "Por revisar"}</span>
        <span className="chip border-dashed">{SOURCE_LABEL[t.source] ?? t.source}</span>
      </div>
      <p className="mt-2 text-tx-2">
        {instrument ? `${instrument.name} · ` : ""}
        <span className="capitalize">{dateLabel}</span> · {opened ? `${hhmm(opened)} → ` : ""}{hhmm(closed)} ET
        {holdMin != null && ` · ${holdMin >= 60 ? `${Math.floor(holdMin / 60)}h ${holdMin % 60}m` : `${holdMin}m`}`} ·{" "}
        <Link href={`/accounts/${t.account_id}`} className="hover:underline">{t.account_name}</Link>
      </p>

      <form action={saveReview} className="mt-6">
        <input type="hidden" name="id" value={t.id} />
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className={`hero ${n < 0 ? "text-down" : ""}`}>{money(n, { sign: true })}</div>
            <p className="mt-3 font-mono text-[12.5px] text-tx-3">
              P&L neto · bruto {money(t.gross, { sign: true })} · comisiones {money(t.fees)}
              {t.swap !== 0 && ` · swap ${money(t.swap, { sign: true })}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.risk ? <span className="pill pill-static pill-on font-mono">{n >= 0 ? "+" : "−"}{Math.abs(n / t.risk).toFixed(2)}R</span> : <span className="pill pill-static font-mono text-tx-3">Sin riesgo anotado</span>}
              <span className="pill pill-static font-mono">{t.qty} {t.market === "cfd" ? "lotes" : "contratos"}</span>
              {t.entry_price != null && t.exit_price != null && <span className="pill pill-static font-mono">{t.entry_price} → {t.exit_price}</span>}
              {t.risk ? <span className="pill pill-static font-mono">Riesgo {money(t.risk)}</span> : null}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-[13px] text-tx-2">Nota de ejecución</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <label key={g} className="relative">
                  <input type="radio" name="grade" value={g} defaultChecked={t.grade === g} className="pill-check" />
                  <span className="pill !h-11 !w-11 justify-center !rounded-full !px-0">{g}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-tx-3">Cómo de bien seguiste tu proceso, no si ganó dinero.</p>
          </div>
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="card space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[19px] font-bold tracking-tight">Revisión</h2>
              <span className="font-mono text-[13px] text-tx-3">{answered} / 3</span>
            </div>
            <div>
              <div className="label">¿Seguiste tu plan?</div>
              <div className="flex flex-wrap gap-2">
                <Choice name="plan_followed" value="yes" label="Sí" checked={t.plan_followed === "yes"} />
                <Choice name="plan_followed" value="partly" label="En parte" checked={t.plan_followed === "partly"} />
                <Choice name="plan_followed" value="no" label="No" checked={t.plan_followed === "no"} />
              </div>
            </div>
            <div>
              <div className="label">¿Cómo te sentiste?</div>
              <div className="flex flex-wrap gap-2">
                {FEELINGS.map((f) => <Choice key={f} type="checkbox" name="feelings" value={f} label={f} checked={!!t.feelings?.includes(f)} />)}
              </div>
            </div>
            <div>
              <div className="label">Error principal</div>
              <div className="flex flex-wrap gap-2">
                {MISTAKES.map((m) => <Choice key={m} name="mistake" value={m} label={m} checked={t.mistake === m} />)}
              </div>
            </div>
            <textarea name="note" rows={3} className="input" placeholder="¿Qué viste? Con una línea basta." defaultValue={t.note ?? ""} />
          </section>

          <section className="card space-y-5 p-6">
            <h2 className="text-[19px] font-bold tracking-tight">Contexto</h2>
            <div>
              <div className="label">Sesión</div>
              <div className="flex flex-wrap gap-2">
                {SESSIONS.map((s) => <Choice key={s} name="session" value={s} label={s} checked={t.session === s} />)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Estrategia</span>
                <select name="strategy_id" className="input" defaultValue={t.strategy_id ?? ""}>
                  <option value="">Sin estrategia</option>
                  {strategies.filter((s) => !s.archived || s.id === t.strategy_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label">Riesgo · 1R ($)</span>
                <input name="risk" className="input num" inputMode="decimal" defaultValue={t.risk ? t.risk / 100 : ""} placeholder="p. ej. 250" />
              </label>
            </div>
            {strategy && strategy.criteria.length > 0 && (
              <div>
                <input type="hidden" name="criteria_shown" value="1" />
                <div className="label">Criterios de {strategy.name} que cumplió</div>
                <div className="flex flex-wrap gap-2">
                  {strategy.criteria.map((c) => <Choice key={c.id} type="checkbox" name="criteria" value={c.id} label={c.label} checked={!!t.criteria_met?.includes(c.id)} />)}
                </div>
              </div>
            )}
            {activeRules.length > 0 ? (
              <div>
                <input type="hidden" name="rules_shown" value="1" />
                <div className="label">Reglas que rompiste <span className="text-tx-3">· sin marcar = seguida</span></div>
                <div className="flex flex-wrap gap-2">
                  {activeRules.map((r) => <Choice key={r.id} type="checkbox" name="broken" value={String(r.id)} label={r.name} checked={!!t.rules_broken?.includes(r.id)} />)}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-tx-3">
                Escribe tus reglas en <Link href="/strategies" className="text-tx underline">Estrategias</Link> para marcar aquí las que rompes.
              </p>
            )}
            <label className="block">
              <span className="label">Enlace al gráfico · TradingView u otro</span>
              <input name="chart_url" type="url" className="input" defaultValue={t.chart_url ?? ""} placeholder="https://www.tradingview.com/x/…" />
            </label>
            {t.chart_url && /^https?:\/\//.test(t.chart_url) && (
              <a href={t.chart_url} target="_blank" rel="noreferrer" className="btn btn-sm">Abrir gráfico ↗</a>
            )}
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button className="btn">Guardar revisión</button>
          {nextPending && (
            <button name="next" value={nextPending.id} className="btn btn-primary">Guardar y siguiente →</button>
          )}
        </div>
      </form>
    </Shell>
  );
}
