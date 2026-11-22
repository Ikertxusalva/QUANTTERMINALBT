import Link from "next/link";
import { Calendar, EdgeRows, EquityChart, pct, rr } from "@/components/charts";
import { HEALTH_TONE } from "@/components/AccountCard";
import { Seg, Shell } from "@/components/Shell";
import { TradeRow } from "@/components/TradeRow";
import { loadViews } from "@/lib/data";
import { money } from "@/lib/format";
import { RANGES, asRange, inRange, loadScoped, today } from "@/lib/scoped";
import { daySummary, dayStats, equity, groupBy, metrics, monthGrid } from "@/lib/stats.ts";

export const dynamic = "force-dynamic";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="eyebrow">{label}</div>
      <div className="figure mt-2">{value}</div>
      {sub && <div className="mt-1 text-[13px] text-tx-3">{sub}</div>}
    </div>
  );
}

export default async function Dashboard(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const range = asRange(sp.range);
  const now = today();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : now.slice(0, 7);
  const [{ accounts, scope, strades, trades }, views] = await Promise.all([loadScoped(), loadViews()]);

  if (accounts.length === 0) {
    return (
      <Shell active="/">
        <div className="card mx-auto mt-16 max-w-lg p-10 text-center">
          <h1 className="h1">Añade tu primera cuenta</h1>
          <p className="mt-4 text-tx-2">
            Cada trade pertenece a una cuenta: una evaluación, una cuenta fondeada o tu cuenta personal.
            Créala y se seguirá contra sus reglas desde el primer trade.
          </p>
          <Link href="/accounts/new" className="btn btn-primary mt-7">Crear cuenta</Link>
        </div>
      </Shell>
    );
  }

  const inScope = inRange(strades, range);
  const m = metrics(inScope);
  const all = metrics(strades);
  const eq = equity(inScope);
  const days = dayStats(strades);
  const sum = daySummary(dayStats(inScope));
  const grid = monthGrid(month, days);
  const monthDays = days.filter((d) => d.date.startsWith(month));
  const monthNet = monthDays.reduce((s, d) => s + d.net, 0);
  const view = scope ? views.find((v) => v.account.id === scope.id) : null;
  const attention = views.filter((v) => v.account.status === "active" && v.status.attention && (!scope || v.account.id === scope.id));
  const bySetup = groupBy(strades, "strategy").filter((r) => r.label !== "Sin estrategia").slice(0, 4);
  const q = (over: Record<string, string>) => `/?${new URLSearchParams({ range, month, ...over })}`;
  const rangeLabel = { today: "hoy", week: "esta semana", month: "este mes", all: "todo el historial" }[range];

  return (
    <Shell active="/">
      <section className="card overflow-hidden">
        <div className="p-6 pb-2 sm:p-8 sm:pb-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow">P&L neto · {rangeLabel} · {scope ? scope.name : "todas las cuentas"}</div>
              <div className={`hero mt-3 ${m.net < 0 ? "text-down" : ""}`}>{money(m.net, { sign: true })}</div>
            </div>
            <Seg current={range} items={RANGES.map((r) => ({ key: r.key, label: r.label, href: q({ range: r.key }) }))} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="pill pill-static pill-on">{m.rPerTrade == null ? "Sin riesgo anotado" : `${rr(m.rPerTrade)} / trade`}</span>
            <span className="pill pill-static">{m.n} trades</span>
            <span className="pill pill-static">{m.wins}G · {m.losses}P{m.breakevens ? ` · ${m.breakevens}BE` : ""}</span>
            {sum.best && sum.best.net > 0 && <span className="pill pill-static">Mejor día {money(sum.best.net, { sign: true })}</span>}
            {eq.points.length > 0 && (
              <span className="pill pill-static">
                {eq.currentDrawdown === 0 ? "● En máximos" : `${money(-eq.currentDrawdown)} bajo el máximo`}
              </span>
            )}
          </div>
        </div>
        <EquityChart data={eq} height={220} />
      </section>

      {view && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Link href={`/accounts/${view.account.id}`} className="card block p-6 hover:border-line-2">
            <div className="eyebrow">Balance · {view.account.name}</div>
            <div className="figure mt-2 !text-[34px]">{money(view.status.balance.balance)}</div>
            {view.status.drawdown ? (
              <>
                <div className="mt-5 flex items-end justify-between">
                  <span className="eyebrow">Margen hasta pérdida máxima</span>
                  <span className={`num text-[20px] font-semibold ${view.status.drawdown.used >= 0.8 ? "text-bad" : ""}`}>
                    {view.status.drawdown.estimate ? "≤ " : ""}{money(Math.max(0, view.status.drawdown.headroom), { whole: true })}
                  </span>
                </div>
                <div className="bar mt-2">
                  <span style={{ width: `${Math.round((1 - view.status.drawdown.used) * 100)}%`, background: view.status.drawdown.used >= 0.8 ? "var(--bad)" : "#f4f4f4" }} />
                </div>
                <div className="mt-2 text-[13px] text-tx-3">
                  Suelo{view.status.drawdown.locked ? " (bloqueado)" : ""} {money(view.status.drawdown.floor)}
                </div>
              </>
            ) : (
              <div className="mt-3 text-[13px] text-tx-3">Sin regla de pérdida máxima.</div>
            )}
          </Link>
          <div className="card p-6">
            <div className="eyebrow">Stop diario</div>
            {view.status.dailyLoss ? (
              <>
                <div className={`figure mt-2 !text-[34px] ${view.status.dailyLoss.hit ? "text-bad" : ""}`}>
                  {money(view.status.dailyLoss.left, { whole: true })} <span className="text-[16px] font-normal text-tx-3">disponibles hoy</span>
                </div>
                <div className="bar mt-5">
                  <span style={{ width: `${Math.round((view.status.dailyLoss.left / view.status.dailyLoss.limit) * 100)}%`, background: view.status.dailyLoss.hit ? "var(--bad)" : "#f4f4f4" }} />
                </div>
                <div className="mt-2 text-[13px] text-tx-3">
                  {view.status.dailyLoss.tradesThisSession === 0
                    ? "Día nuevo. Cíñete al plan."
                    : `Sesión ${money(view.status.dailyLoss.sessionNet, { sign: true })} · ${view.status.dailyLoss.tradesThisSession} trades`}
                  {" · "}límite {money(view.status.dailyLoss.limit, { whole: true })}
                </div>
              </>
            ) : (
              <div className="mt-3 text-[13px] text-tx-3">Esta cuenta no tiene límite de pérdida diaria.</div>
            )}
          </div>
        </div>
      )}

      {attention.length > 0 && (
        <section className="card mt-4 p-6">
          <div className="eyebrow">Requieren tu atención</div>
          <ul className="mt-2 divide-y divide-line">
            {attention.map((v) => (
              <li key={v.account.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/accounts/${v.account.id}`} className="truncate font-medium hover:underline">{v.account.name}</Link>
                <span className={`text-right text-[13px] ${HEALTH_TONE[v.status.health]}`}>{v.status.attention}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Aciertos" value={pct(m.winRate)} sub={`${m.wins} de ${m.wins + m.losses} decididos`} />
        <Tile label="Profit factor" value={m.profitFactor == null ? "—" : m.profitFactor.toFixed(2)} sub={m.profitFactor == null ? "sin trades perdedores" : `por cada $1 perdido, $${m.profitFactor.toFixed(2)}`} />
        <Tile label="RR medio · ganadores" value={m.avgRR == null ? "—" : `1:${m.avgRR.toFixed(1)}`} sub={m.rCount ? `${m.rCount} trades con riesgo` : "anota el riesgo en tus trades"} />
        <Tile label="Drawdown máximo" value={eq.maxDrawdown ? money(-eq.maxDrawdown) : "—"} sub="mayor caída desde un máximo" />
      </div>

      <section className="card mt-4 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Calendario</h2>
            <div className="mt-0.5 text-tx-3">
              <span className="num font-semibold text-tx">{money(monthNet, { sign: true })}</span> · {monthDays.length} días ·{" "}
              {monthDays.filter((d) => d.net > 0).length} en verde
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={q({ month: shiftMonth(month, -1) })} scroll={false} className="btn btn-sm !w-9 !px-0" aria-label="Mes anterior">‹</Link>
            <span className="min-w-[150px] text-center text-[17px] font-semibold capitalize">
              {MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
            </span>
            <Link href={q({ month: shiftMonth(month, 1) })} scroll={false} className="btn btn-sm !w-9 !px-0" aria-label="Mes siguiente">›</Link>
          </div>
        </div>
        <Calendar weeks={grid} />
      </section>

      {bySetup.length > 0 && (
        <section className="card mt-4 p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[22px] font-bold tracking-tight">Qué funciona <span className="font-normal text-tx-3">por estrategia</span></h2>
            <Link href="/stats?g=strategy" className="text-[13px] text-tx-3 hover:text-tx">Ver todo →</Link>
          </div>
          <EdgeRows rows={bySetup} measure="net" />
        </section>
      )}

      <section className="card mt-4 p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[22px] font-bold tracking-tight">Trades recientes</h2>
          <Link href="/journal" className="text-[13px] text-tx-3 hover:text-tx">Journal →</Link>
        </div>
        {trades.length === 0 ? (
          <p className="py-4 text-tx-3">
            Aún no hay trades. <Link href="/import" className="text-tx underline">Importa un archivo</Link> o{" "}
            <Link href="/log" className="text-tx underline">registra uno a mano</Link>.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {trades.slice(0, 6).map((t) => <TradeRow key={t.id} t={t} showAccount={!scope} />)}
          </div>
        )}
        {all.n > 0 && range !== "all" && <p className="mt-3 text-[12.5px] text-tx-3">Historial completo: {money(all.net, { sign: true })} en {all.n} trades.</p>}
      </section>
    </Shell>
  );
}
