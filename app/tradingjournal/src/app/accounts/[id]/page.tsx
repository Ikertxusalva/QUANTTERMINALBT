import { notFound } from "next/navigation";
import { deleteAccount, deleteLedgerEntry, deleteTrade, setAccountStatus } from "@/app/actions";
import { HEALTH_TONE } from "@/components/AccountCard";
import { Shell } from "@/components/Shell";
import { LEDGER_LABEL, buildView, getAccount, listLedger, listTrades, net } from "@/lib/data";
import { money, nyDateTime, pnlClass, shortDate } from "@/lib/format";
import { instrumentsFor } from "@/lib/instruments";
import { DRAWDOWN_LABEL, PHASE_LABEL } from "@/lib/presets";
import { sessionDateOf, toNyLocal } from "@/lib/rules/session.ts";
import { LedgerForm, LogTradeForm } from "./Forms";

export const dynamic = "force-dynamic";

function Tile({
  title,
  value,
  tone = "",
  children,
}: {
  title: string;
  value: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="text-[12px] text-tx-3">{title}</div>
      <div className={`num mt-1 text-xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-2 space-y-1 text-[13px] text-tx-2">{children}</div>
    </div>
  );
}

function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: color }} />
    </div>
  );
}

export default async function AccountPage(props: PageProps<"/accounts/[id]">) {
  const { id } = await props.params;
  const account = await getAccount(Number(id));
  if (!account) notFound();
  const [trades, ledger] = await Promise.all([listTrades(account.id), listLedger(account.id)]);
  const view = buildView(account, trades, ledger);
  const { status: s } = view;
  const r = account.rules;
  const now = new Date();
  const sessionLabel = account.market === "futures" ? "sesión 18:00–17:00 ET" : "sesión 17:00–17:00 ET";
  const profit = s.balance.tradesNet + account.prior_pnl;
  const archived = account.status === "archived";

  return (
    <Shell active="/accounts">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{account.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-tx-3">
            <span>
              {account.kind === "personal"
                ? "Cuenta personal"
                : [account.firm, account.plan].filter(Boolean).join(" · ")}
            </span>
            <span className="chip">{archived ? "Archivada" : PHASE_LABEL[account.phase]}</span>
            <span className="chip">{account.market === "futures" ? "Futuros" : "CFD y Forex"}</span>
            {account.account_number && <span className="chip num">{account.account_number}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <form action={setAccountStatus}>
            <input type="hidden" name="id" value={account.id} />
            <input type="hidden" name="status" value={archived ? "active" : "archived"} />
            <button className="btn btn-sm">{archived ? "Reactivar" : "Archivar"}</button>
          </form>
          {archived && (
            <form action={deleteAccount}>
              <input type="hidden" name="id" value={account.id} />
              <button className="btn btn-sm btn-danger">Eliminar definitivamente</button>
            </form>
          )}
        </div>
      </div>

      {s.attention && (
        <div className={`card mt-4 px-4 py-3 ${HEALTH_TONE[s.health]}`}>{s.attention}</div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile title="Balance" value={money(s.balance.balance)}>
          <div>
            Resultado <span className={`num ${pnlClass(profit)}`}>{money(profit, { sign: true })}</span>
            {account.prior_pnl !== 0 && (
              <span className="text-tx-3"> · {money(account.prior_pnl, { sign: true })} antes de registrar</span>
            )}
          </div>
          <div className="text-tx-3">Inicial {money(account.starting_balance, { whole: true })}</div>
        </Tile>

        {s.drawdown && (
          <Tile
            title={`Margen hasta pérdida máxima · ${DRAWDOWN_LABEL[r.drawdownType ?? "static"]}`}
            value={`${s.drawdown.estimate ? "≤ " : ""}${money(Math.max(0, s.drawdown.headroom))}`}
            tone={s.drawdown.breached ? "text-down" : s.drawdown.used >= 0.8 ? "text-warn" : ""}
          >
            <Progress
              value={1 - s.drawdown.used}
              color={s.drawdown.used >= 0.8 ? "var(--down)" : s.drawdown.used >= 0.5 ? "var(--warn)" : "var(--up)"}
            />
            <div>
              Suelo{s.drawdown.locked ? " (bloqueado)" : ""}{" "}
              <span className="num">{money(s.drawdown.floor)}</span>
            </div>
            {s.drawdown.estimate && (
              <div className="text-tx-3">Estimación: el suelo real puede estar más alto.</div>
            )}
          </Tile>
        )}

        {s.dailyLoss && (
          <Tile
            title={`Pérdida diaria · ${sessionLabel}`}
            value={`${money(s.dailyLoss.left)} disponibles`}
            tone={s.dailyLoss.hit ? "text-down" : ""}
          >
            <Progress value={s.dailyLoss.left / s.dailyLoss.limit} color={s.dailyLoss.hit ? "var(--down)" : "var(--up)"} />
            <div>
              {s.dailyLoss.tradesThisSession === 0 ? (
                "Sin trades en esta sesión"
              ) : (
                <>
                  Sesión <span className={`num ${pnlClass(s.dailyLoss.sessionNet)}`}>{money(s.dailyLoss.sessionNet, { sign: true })}</span>
                </>
              )}{" "}
              · límite <span className="num">{money(s.dailyLoss.limit, { whole: true })}</span>
            </div>
            <div className="text-tx-3">
              {s.dailyLoss.mode === "hard" ? "Superarlo hace fallar la cuenta" : "Superarlo pausa la sesión"} · solo
              cuenta trades cerrados
            </div>
          </Tile>
        )}

        {s.target && (
          <Tile
            title="Objetivo de beneficio"
            value={s.target.reached ? "Cumplido" : `${money(s.target.toGo)} restantes`}
            tone={s.target.reached ? "text-up" : ""}
          >
            <Progress value={s.target.progress} color="var(--up)" />
            <div>
              <span className="num">{money(s.target.profit)}</span> de{" "}
              <span className="num">{money(s.target.target, { whole: true })}</span>
              {s.target.minDays != null && (
                <span>
                  {" "}· {s.target.sessionsTraded} de {s.target.minDays} sesiones
                </span>
              )}
            </div>
            {s.target.reached && s.consistency?.within === false && (
              <div className="text-warn">La consistencia bloquea el pase.</div>
            )}
          </Tile>
        )}

        {s.consistency && (
          <Tile
            title={`Consistencia · máximo ${s.consistency.limitPct}%`}
            value={s.consistency.ratioPct == null ? "—" : `${s.consistency.ratioPct}%`}
            tone={s.consistency.within === false ? "text-warn" : ""}
          >
            {s.consistency.ratioPct == null ? (
              <div>Aún no hay beneficio contra el que medir.</div>
            ) : (
              <>
                <div>
                  Mejor día <span className="num">{money(s.consistency.largest)}</span> de{" "}
                  <span className="num">{money(s.consistency.against)}</span>{" "}
                  {s.consistency.basis === "target" ? "de objetivo" : "de beneficio"}
                </div>
                <div>
                  {s.consistency.within
                    ? "Dentro del límite"
                    : s.consistency.moreProfitNeeded > 0
                      ? `Faltan unos ${money(s.consistency.moreProfitNeeded)} en ${s.consistency.moreDaysNeeded}+ días`
                      : "Por encima del límite"}
                </div>
              </>
            )}
            <div className="text-tx-3">
              {s.consistency.sinceDate
                ? `Desde tu payout del ${shortDate(s.consistency.sinceDate)}`
                : "Según los días registrados aquí"}
            </div>
          </Tile>
        )}

        {s.payoutDays && (
          <Tile
            title="Días para payout"
            value={`${s.payoutDays.atLeast ? "≥ " : ""}${s.payoutDays.counted} de ${s.payoutDays.required}`}
            tone={s.payoutDays.met ? "text-up" : ""}
          >
            <Progress value={s.payoutDays.counted / s.payoutDays.required} color="var(--up)" />
            <div>
              {s.payoutDays.minProfitPerDay != null
                ? `Cuentan los días de ${money(s.payoutDays.minProfitPerDay, { whole: true })} o más`
                : "Cuenta cualquier día en positivo"}
            </div>
            <div className="text-tx-3">
              {s.payoutDays.sinceDate
                ? `Desde tu payout del ${shortDate(s.payoutDays.sinceDate)}`
                : "Sin payouts registrados: desde el primer día"}
            </div>
          </Tile>
        )}

        {account.kind === "prop" && (
          <Tile title="Neto con la firma" value={money(view.propNet, { sign: true })} tone={pnlClass(view.propNet)}>
            <div>
              Cobrado <span className="num">{money(view.paidOut)}</span> · gastado{" "}
              <span className="num">{money(view.spent)}</span>
            </div>
          </Tile>
        )}
      </div>

      {!archived && (
        <section className="card mt-6 p-4">
          <h2 className="mb-3 font-medium">Registrar trade</h2>
          <LogTradeForm
            accountId={account.id}
            symbols={instrumentsFor(account.market).map((i) => i.symbol)}
            defaultTime={toNyLocal(now)}
            cfd={account.market === "cfd"}
          />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 font-medium">
          Trades <span className="text-tx-3">· {trades.length}</span>
        </h2>
        {trades.length === 0 ? (
          <p className="text-tx-2">Esta cuenta aún no tiene trades.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-[12px] text-tx-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-normal">Instrumento</th>
                  <th className="px-2 py-2 font-normal">Lado</th>
                  <th className="px-2 py-2 text-right font-normal">Tamaño</th>
                  <th className="px-2 py-2 font-normal">Cierre</th>
                  <th className="px-2 py-2 font-normal">Sesión</th>
                  <th className="px-2 py-2 text-right font-normal">R</th>
                  <th className="px-2 py-2 text-right font-normal">Neto</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {trades.map((t) => {
                  const n = net(t);
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-2 font-medium">
                        {t.symbol}
                        {t.grade && <span className="chip ml-2">{t.grade}</span>}
                        {t.note && <div className="max-w-[220px] truncate text-[12px] font-normal text-tx-3">{t.note}</div>}
                      </td>
                      <td className="px-2 py-2 text-tx-2">{t.side === "long" ? "Largo" : "Corto"}</td>
                      <td className="num px-2 py-2 text-right text-tx-2">{t.qty}</td>
                      <td className="px-2 py-2 text-[13px] text-tx-2">{nyDateTime(new Date(t.closed_at))}</td>
                      <td className="px-2 py-2 text-[13px] text-tx-3">
                        {shortDate(sessionDateOf(new Date(t.closed_at), account.market))}
                      </td>
                      <td className="num px-2 py-2 text-right text-tx-2">
                        {t.risk ? `${n >= 0 ? "+" : "−"}${Math.abs(n / t.risk).toFixed(2)}R` : "—"}
                      </td>
                      <td className={`num px-2 py-2 text-right ${pnlClass(n)}`}>
                        {money(n, { sign: true })}
                        {t.fees > 0 && <div className="text-[11px] text-tx-3">com. {money(t.fees)}</div>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <form action={deleteTrade}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="text-[12px] text-tx-3 hover:text-down" aria-label={`Borrar trade de ${t.symbol}`}>
                            Borrar
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {account.kind === "prop" && (
        <section className="mt-6">
          <h2 className="mb-3 font-medium">Costes y payouts</h2>
          <div className="card p-4">
            <LedgerForm
              accountId={account.id}
              today={sessionDateOf(now, account.market)}
              funded={account.phase === "funded"}
            />
            {account.phase === "funded" && (
              <p className="mt-3 text-[12px] text-tx-3">
                Un payout baja el balance desde su fecha y reinicia el recuento de días. Regístralo con la fecha que
                use tu firma (la de solicitud o la de aprobación).
              </p>
            )}
          </div>
          {ledger.length > 0 && (
            <div className="card mt-3 divide-y divide-line">
              {ledger.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-24 text-tx-2">{LEDGER_LABEL[l.type]}</span>
                  <span className="text-[13px] text-tx-3">{shortDate(l.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-tx-3">{l.note}</span>
                  <span className={`num ${l.type === "payout" ? "text-up" : "text-down"}`}>
                    {l.type === "payout" ? "+" : "−"}
                    {money(l.amount)}
                  </span>
                  <form action={deleteLedgerEntry}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-[12px] text-tx-3 hover:text-down" aria-label="Borrar entrada">
                      Borrar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}
