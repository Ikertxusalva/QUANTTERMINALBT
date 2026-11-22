import Link from "next/link";
import { PageHead, Shell } from "@/components/Shell";
import { money } from "@/lib/format";
import { listHighImpact, listNews } from "@/lib/news";
import { fromNyLocal, nyDateOf, nyWallClock } from "@/lib/rules/session.ts";
import { loadScoped } from "@/lib/scoped";
import { dayStats } from "@/lib/stats.ts";
import { Refresh } from "./Refresh";

export const dynamic = "force-dynamic";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
const dayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hhmm = (d: Date) => nyWallClock(d).toISOString().slice(11, 16);

export default async function NewsPage(props: PageProps<"/news">) {
  const sp = await props.searchParams;
  const cur = CURRENCIES.includes(String(sp.cur)) ? String(sp.cur) : "USD";
  const impact = sp.impact === "all" ? "all" : "main";
  const nowMs = new Date().getTime();
  // The calendar's week runs Sunday to Saturday: Sunday evening already belongs to the new week.
  const sunday = new Date(`${nyDateOf(new Date())}T00:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  const from = fromNyLocal(`${sunday.toISOString().slice(0, 10)}T00:00`);
  const [week, high, { strades, scope }] = await Promise.all([
    listNews(from, new Date(from.getTime() + 7 * 24 * 3600_000)),
    listHighImpact(cur),
    loadScoped(),
  ]);
  const shown = week.filter((e) => e.country === cur && (impact === "all" || e.impact === "High" || e.impact === "Medium"));
  const byDay = new Map<string, typeof shown>();
  for (const e of shown) {
    const d = nyDateOf(new Date(e.at));
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const next = shown.find((e) => new Date(e.at).getTime() > nowMs && e.impact === "High");

  // You on news days: trading days that had a high-impact release, against the rest.
  const days = dayStats(strades);
  const newsDates = new Map<string, string[]>();
  for (const e of high) {
    const d = nyDateOf(new Date(e.at));
    newsDates.set(d, [...(newsDates.get(d) ?? []), e.title]);
  }
  const on = days.filter((d) => newsDates.has(d.date));
  const off = days.filter((d) => !newsDates.has(d.date));
  const avg = (a: typeof days) => (a.length ? a.reduce((s, d) => s + d.net, 0) / a.length : null);
  const green = (a: typeof days) => (a.length ? `${a.filter((d) => d.net > 0).length} de ${a.length} en verde` : "sin días");
  const byTitle = new Map<string, typeof days>();
  for (const d of on) for (const title of new Set(newsDates.get(d.date))) byTitle.set(title, [...(byTitle.get(title) ?? []), d]);
  const titles = [...byTitle.entries()].map(([title, ds]) => ({ title, n: ds.length, avg: avg(ds)!, net: ds.reduce((s, d) => s + d.net, 0) })).sort((a, b) => a.avg - b.avg);
  const q = (over: Record<string, string>) => `/news?${new URLSearchParams({ cur, impact, ...over })}`;

  return (
    <Shell active="/news">
      <PageHead title="Noticias" sub={next ? `Lo siguiente · ${next.title} · ${dayFmt.format(new Date(`${nyDateOf(new Date(next.at))}T00:00:00Z`))} ${hhmm(new Date(next.at))} ET` : "El calendario de la semana, y lo que te hace a ti."}>
        <Refresh />
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-2">
        {CURRENCIES.map((c) => <Link key={c} href={q({ cur: c })} className={`pill ${c === cur ? "pill-on" : ""}`}>{c}</Link>)}
        <span className="mx-1 w-px bg-line-2" />
        <Link href={q({ impact: "main" })} className={`pill ${impact === "main" ? "pill-on" : ""}`}>Alto y medio</Link>
        <Link href={q({ impact: "all" })} className={`pill ${impact === "all" ? "pill-on" : ""}`}>Todo</Link>
      </div>

      <section className="card p-6">
        <h2 className="text-[22px] font-bold tracking-tight">Esta semana <span className="font-normal text-tx-3">· hora de Nueva York</span></h2>
        {week.length === 0 ? (
          <p className="mt-3 text-tx-3">Aún no hay calendario guardado. Pulsa «Actualizar calendario» para descargar la semana.</p>
        ) : shown.length === 0 ? (
          <p className="mt-3 text-tx-3">Ningún dato de {cur} con ese impacto esta semana.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {[...byDay.entries()].map(([d, events]) => (
              <div key={d}>
                <Link href={`/days/${d}`} className="eyebrow hover:text-tx">{dayFmt.format(new Date(`${d}T00:00:00Z`))}</Link>
                <div className="mt-1.5 divide-y divide-line">
                  {events.map((e) => (
                    <div key={e.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${new Date(e.at).getTime() < nowMs ? "text-tx-3" : ""}`}>
                      <span className="num w-14 font-mono text-[13px]">{hhmm(new Date(e.at))}</span>
                      <span className={`chip ${e.impact === "High" ? "chip-solid" : ""}`}>{e.impact === "High" ? "Alto" : e.impact === "Medium" ? "Medio" : e.impact === "Holiday" ? "Festivo" : "Bajo"}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                      <span className="font-mono text-[12px] text-tx-3">prev. {e.forecast || "—"} · ant. {e.previous || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-4 p-6">
        <h2 className="text-[22px] font-bold tracking-tight">Tú en días de noticia <span className="font-normal text-tx-3">· alto impacto {cur} · {scope ? scope.name : "todas las cuentas"}</span></h2>
        {high.length === 0 ? (
          <p className="mt-3 text-tx-3">Hace falta historial de calendario. Se acumula cada vez que lo actualizas.</p>
        ) : (
          <>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <div className="eyebrow">Días con noticia</div>
                <div className={`figure mt-1.5 !text-[34px] ${(avg(on) ?? 0) < 0 ? "text-down" : ""}`}>{avg(on) == null ? "—" : money(Math.round(avg(on)!), { sign: true })}</div>
                <div className="text-[13px] text-tx-3">día medio · {green(on)}</div>
              </div>
              <div>
                <div className="eyebrow">Días tranquilos</div>
                <div className={`figure mt-1.5 !text-[34px] ${(avg(off) ?? 0) < 0 ? "text-down" : ""}`}>{avg(off) == null ? "—" : money(Math.round(avg(off)!), { sign: true })}</div>
                <div className="text-[13px] text-tx-3">día medio · {green(off)}</div>
              </div>
            </div>
            {titles.length > 0 && (
              <div className="mt-6 divide-y divide-line">
                {titles.map((t) => (
                  <div key={t.title} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                    <span className="font-mono text-[12px] text-tx-3">{t.n} {t.n === 1 ? "día" : "días"}</span>
                    <span className={`num w-28 text-right font-semibold ${t.avg < 0 ? "text-down" : ""}`}>{money(Math.round(t.avg), { sign: true })} <span className="font-normal text-tx-3">/día</span></span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-[12.5px] text-tx-3">
              Cuenta solo las semanas que tienes guardadas ({high.length} datos de alto impacto de {cur}). Con pocos días, tómalo como una pista.
            </p>
          </>
        )}
      </section>
    </Shell>
  );
}
