import Link from "next/link";
import { EdgeRows, EquityChart, Heatmap, pct, rr, type Measure } from "@/components/charts";
import { PageHead, Seg, Shell } from "@/components/Shell";
import { listRules } from "@/lib/data";
import { money } from "@/lib/format";
import { RANGES, asRange, inRange, loadScoped } from "@/lib/scoped";
import {
  GROUP_LABEL, daySummary, dayStats, discipline, equity, groupBy, heatmap, insights, metrics, rDistribution,
  type GroupKey,
} from "@/lib/stats.ts";

export const dynamic = "force-dynamic";

const MAIN: GroupKey[] = ["day", "session", "time", "symbol", "strategy", "frequency"];
const MORE: GroupKey[] = ["hold", "size", "month", "side", "feeling", "mistake"];
const MEASURES: { key: Measure; label: string }[] = [{ key: "net", label: "Neto" }, { key: "win", label: "Aciertos" }, { key: "r", label: "R / trade" }];

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="figure mt-1.5">{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-tx-3">{sub}</div>}
    </div>
  );
}

export default async function StatsPage(props: PageProps<"/stats">) {
  const sp = await props.searchParams;
  const tab = sp.tab === "insights" ? "insights" : "overview";
  const range = asRange(sp.range);
  const g = ([...MAIN, ...MORE] as string[]).includes(String(sp.g)) ? (sp.g as GroupKey) : "day";
  const measure = MEASURES.some((x) => x.key === sp.m) ? (sp.m as Measure) : "net";
  const src = sp.src === "imported" || sp.src === "manual" ? sp.src : "all";

  const [{ strades, trades, scope }, rules] = await Promise.all([loadScoped(), listRules()]);
  const manualIds = new Set(trades.filter((t) => t.source === "manual").map((t) => t.id));
  const list = inRange(strades, range).filter((t) => src === "all" || (src === "manual") === manualIds.has(t.id));
  const m = metrics(list);
  const eq = equity(list);
  const days = daySummary(dayStats(list));
  const rows = groupBy(list, g);
  const disc = discipline(list);
  const mistakes = groupBy(list, "mistake").filter((r) => r.label !== "Sin etiquetar" && r.label !== "Ninguno").sort((a, b) => a.net - b.net);
  const rd = rDistribution(list);
  const rdMax = Math.max(...rd.map((b) => b.n), 1);
  const found = tab === "insights" ? insights(list) : [];
  const q = (over: Record<string, string>) => `/stats?${new URLSearchParams({ tab, range, g, m: measure, src, ...over })}`;
  const best = rows.length > 1 ? rows.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  const hold = (min: number | null) => (min == null ? "—" : min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`);

  return (
    <Shell active="/stats">
      <PageHead title="Stats" sub={`${rangeLabel} · ${m.n} trades · ${scope ? scope.name : "todas las cuentas"}`}>
        <Seg current={tab} items={[{ key: "overview", label: "Resumen", href: q({ tab: "overview" }) }, { key: "insights", label: "Insights", href: q({ tab: "insights" }) }]} />
        <Seg current={range} items={RANGES.map((r) => ({ key: r.key, label: r.label, href: q({ range: r.key }) }))} />
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-2">
        {[["all", "Todos los trades"], ["imported", "Importados"], ["manual", "A mano"]].map(([k, label]) => (
          <Link key={k} href={q({ src: k })} className={`pill ${src === k ? "pill-on" : ""}`}>{label}</Link>
        ))}
      </div>

      {tab === "insights" ? (
        <section className="space-y-3">
          {found.length === 0 ? (
            <div className="card p-8 text-center text-tx-2">
              Todavía no hay patrones claros. Un insight aparece cuando dos grupos de trades tienen al menos 10 cada uno y la
              diferencia es nítida.
            </div>
          ) : (
            found.map((i) => (
              <div key={i.title} className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-6">
                <div className="min-w-[240px] flex-1">
                  <div className="eyebrow">{i.impact < 0 ? "Te está costando" : "Te está funcionando"} · {i.early ? "señal temprana" : "consolidado"}</div>
                  <div className="mt-2 text-[22px] font-bold tracking-tight">{i.title}</div>
                  <div className="mt-1 text-[13px] text-tx-3">
                    {i.n} trades a {money(i.avg, { sign: true })} de media ({pct(i.winRate)}) · el resto, {i.otherN} a {money(i.otherAvg, { sign: true })} ({pct(i.otherWinRate)})
                  </div>
                </div>
                <div className="text-right">
                  <div className={`figure !text-[32px] ${i.impact < 0 ? "text-down" : ""}`}>{money(i.impact, { sign: true })}</div>
                  <Link href={`/journal?ids=${i.ids.join(",")}`} className="text-[13px] text-tx-3 hover:text-tx">Ver {i.n} trades →</Link>
                </div>
              </div>
            ))
          )}
          <p className="text-[12.5px] text-tx-3">Un patrón está «ligado a» un resultado, no es su causa: no hay test estadístico detrás.</p>
        </section>
      ) : (
        <>
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-6 p-6 pb-2 sm:p-8 sm:pb-2">
              <div>
                <div className="text-tx-2">P&L neto</div>
                <div className={`hero mt-2 ${m.net < 0 ? "text-down" : ""}`}>{money(m.net, { sign: true })}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="pill pill-static pill-on">{m.rPerTrade == null ? "Sin riesgo anotado" : `${rr(m.rPerTrade)} / trade`}</span>
                  <span className="pill pill-static">{m.n} trades</span>
                  {eq.points.length > 0 && <span className="pill pill-static">{eq.currentDrawdown === 0 ? "● En máximos" : `${money(-eq.currentDrawdown)} bajo el máximo`}</span>}
                </div>
              </div>
              <div className="flex gap-8">
                <Fact label="Drawdown máximo" value={eq.maxDrawdown ? money(-eq.maxDrawdown) : "—"} sub="la caída más honda" />
                <Fact label="Expectativa" value={m.expectancy == null ? "—" : money(Math.round(m.expectancy), { sign: true })} sub="por trade" />
              </div>
            </div>
            <EquityChart data={eq} />
            <div className="eyebrow px-8 pb-4">Bajo el agua · tiempo por debajo de tu último máximo</div>
          </section>

          <section className="card mt-4 grid grid-cols-2 gap-x-6 gap-y-7 p-6 sm:p-8 md:grid-cols-4">
            <Fact label="Aciertos" value={pct(m.winRate)} sub={`${m.wins}G · ${m.losses}P · ${m.breakevens}BE`} />
            <Fact label="Profit factor" value={m.profitFactor == null ? "—" : m.profitFactor.toFixed(2)} sub={m.profitFactor == null ? "sin perdedores" : "ganado ÷ perdido"} />
            <Fact label="RR medio · ganadores" value={m.avgRR == null ? "—" : `1:${m.avgRR.toFixed(1)}`} sub={`${m.rCount} trades con riesgo`} />
            <Fact label="Duración media" value={hold(m.avgHold)} sub="trades con hora de apertura" />
            <Fact label="Ganancia media" value={m.avgWin == null ? "—" : money(Math.round(m.avgWin), { sign: true })} />
            <Fact label="Pérdida media" value={m.avgLoss == null ? "—" : money(Math.round(m.avgLoss))} />
            <Fact label="Mayor ganancia" value={m.largestWin == null ? "—" : money(m.largestWin, { sign: true })} />
            <Fact label="Mayor pérdida" value={m.largestLoss == null ? "—" : money(m.largestLoss)} />
            <Fact label="Racha ganadora" value={`${m.winStreak} trades`} sub={`${days.greenStreak} días verdes seguidos`} />
            <Fact label="Racha perdedora" value={`${m.lossStreak} trades`} sub={`${days.redStreak} días rojos seguidos`} />
            <Fact label="Día verde medio" value={days.avgGreen == null ? "—" : money(Math.round(days.avgGreen), { sign: true })} sub={`${days.green} días`} />
            <Fact label="Día rojo medio" value={days.avgRed == null ? "—" : money(Math.round(days.avgRed))} sub={`${days.red} días`} />
          </section>

          <section className="card mt-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[22px] font-bold tracking-tight">Dónde está tu ventaja <span className="ml-2 text-[14px] font-normal text-tx-3">toca una fila para ver sus trades</span></h2>
              <Seg current={measure} items={MEASURES.map((x) => ({ key: x.key, label: x.label, href: q({ m: x.key }) }))} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...MAIN, ...MORE].map((k) => (
                <Link key={k} href={q({ g: k })} scroll={false} className={`pill !h-8 ${g === k ? "pill-on" : ""}`}>{GROUP_LABEL[k]}</Link>
              ))}
            </div>
            {best && best.net > 0 && m.net > 0 && (
              <p className="mt-5 text-[17px]">
                <b>{best.label}</b> hizo {money(best.net)}, el {Math.round((best.net / Math.max(m.won, 1)) * 100)}% de todo lo ganado, en {best.n} trades.
                {best.small && " Aún es una muestra pequeña."}
              </p>
            )}
            <div className="mt-4"><EdgeRows rows={rows} measure={measure} hrefFor={(r) => `/journal?ids=${r.ids.join(",")}`} /></div>
            {g === "hold" && list.some((t) => !t.openedAt) && (
              <p className="mt-2 text-[12.5px] text-tx-3">{list.filter((t) => !t.openedAt).length} trades sin hora de apertura quedan fuera.</p>
            )}
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="card p-6 sm:p-8">
              <h2 className="mb-4 text-[22px] font-bold tracking-tight">Cuándo operas</h2>
              <Heatmap cells={heatmap(list)} />
            </section>
            <section className="card p-6 sm:p-8">
              <h2 className="mb-4 text-[22px] font-bold tracking-tight">R por trade</h2>
              {m.rCount === 0 ? (
                <p className="text-tx-3">Anota el riesgo (1R) en tus trades para ver cómo se reparten.</p>
              ) : (
                <div className="flex h-[190px] items-end gap-2">
                  {rd.map((b) => (
                    <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="num text-[12px] text-tx-2">{b.n || ""}</span>
                      <span className="w-full rounded-[7px]" style={{ height: `${(b.n / rdMax) * 78}%`, minHeight: b.n ? 4 : 0, background: b.positive ? "#f4f4f4" : "#3a3a3a" }} />
                      <span className="h-8 text-center font-mono text-[9.5px] leading-tight text-tx-3">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="card mt-4 p-6 sm:p-8">
            <h2 className="text-[22px] font-bold tracking-tight">Disciplina</h2>
            {rules.length === 0 ? (
              <p className="mt-2 text-tx-3">Escribe tus reglas en <Link href="/strategies" className="text-tx underline">Estrategias</Link> y marca en cada trade las que rompes.</p>
            ) : disc.followed.n + disc.broke.n === 0 ? (
              <p className="mt-2 text-tx-3">Aún no hay trades revisados con reglas marcadas.</p>
            ) : (
              <div className="mt-5 grid gap-6 md:grid-cols-3">
                <Fact label="Seguiste todas" value={pct(disc.followed.winRate)} sub={`${disc.followed.n} trades · ${money(disc.followed.net, { sign: true })}`} />
                <Fact label="Rompiste alguna" value={pct(disc.broke.winRate)} sub={`${disc.broke.n} trades · ${money(disc.broke.net, { sign: true })}`} />
                <Fact
                  label="Lo que te costó romperlas"
                  value={disc.cost == null ? "—" : money(Math.round(disc.cost), { sign: true })}
                  sub={disc.gapPp == null ? "Lectura temprana · hacen falta 10 trades por lado" : `${disc.gapPp > 0 ? "+" : ""}${disc.gapPp} pp de aciertos cuando las sigues`}
                />
              </div>
            )}
            {mistakes.length > 0 && (
              <>
                <div className="eyebrow mt-8">Lo que te cuesta cada error</div>
                <div className="mt-2 divide-y divide-line">
                  {mistakes.map((r) => (
                    <Link key={r.label} href={`/journal?ids=${r.ids.join(",")}`} className="flex items-center justify-between py-3 hover:bg-raised/50">
                      <span><b>{r.label}</b> <span className="ml-2 font-mono text-[12px] text-tx-3">n={r.n}</span></span>
                      <span className={`num font-semibold ${r.net < 0 ? "text-down" : ""}`}>{money(r.net, { sign: true })}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
