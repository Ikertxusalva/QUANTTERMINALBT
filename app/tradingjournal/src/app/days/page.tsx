import Link from "next/link";
import { PageHead, Shell } from "@/components/Shell";
import { listDays } from "@/lib/data";
import { money } from "@/lib/format";
import { loadScoped, today } from "@/lib/scoped";
import { dayStats } from "@/lib/stats.ts";

export const dynamic = "force-dynamic";

const VERDICT: Record<string, string> = { correct: "Plan correcto", partly: "En parte", wrong: "Plan equivocado", no_trade: "Sin operar" };
const fmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const longDate = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));

export default async function DaysPage(props: PageProps<"/days">) {
  const f = (await props.searchParams).f;
  const [{ strades, scope }, plans] = await Promise.all([loadScoped(), listDays()]);
  const stats = new Map(dayStats(strades).map((d) => [d.date, d]));
  const planned = new Map(plans.map((p) => [p.date, p]));
  const hasPlan = (d: string) => { const p = planned.get(d); return !!(p && (p.plan || p.levels || p.scenarios || p.bias)); };
  const isReviewed = (d: string) => { const p = planned.get(d); return !!(p && (p.verdict || p.review)); };
  const dates = [...new Set([...stats.keys(), ...planned.keys()])].sort().reverse();
  const filters = [
    { key: "all", label: "Todos", test: () => true },
    { key: "planned", label: "Planificados", test: hasPlan },
    { key: "reviewed", label: "Revisados", test: isReviewed },
    { key: "pending", label: "Por revisar", test: (d: string) => stats.has(d) && !isReviewed(d) },
  ];
  const active = filters.find((x) => x.key === f) ?? filters[0];
  const shown = dates.filter(active.test);

  // Planning streak: trading days in a row, newest first, that were reviewed.
  let streak = 0;
  for (const d of [...stats.keys()].sort().reverse()) {
    if (isReviewed(d)) streak++;
    else break;
  }

  return (
    <Shell active="/days">
      <PageHead title="Días" sub={`Una página por día: plan antes de abrir, revisión al cerrar · racha de ${streak} ${streak === 1 ? "día revisado" : "días revisados"}`}>
        <Link href={`/days/${today()}`} className="btn btn-primary">Planificar hoy</Link>
      </PageHead>
      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((x) => (
          <Link key={x.key} href={`/days?f=${x.key}`} className={`pill ${x.key === active.key ? "pill-on" : ""}`}>
            {x.label} <span className="opacity-60">{dates.filter(x.test).length}</span>
          </Link>
        ))}
      </div>
      <section className="card px-6 py-2">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-tx-3">Los días con trades aparecen solos. Empieza por planificar hoy.</p>
        ) : (
          <div className="divide-y divide-line">
            {shown.map((d) => {
              const s = stats.get(d);
              const p = planned.get(d);
              return (
                <Link key={d} href={`/days/${d}`} className="flex flex-wrap items-center gap-3 py-3.5 hover:bg-raised/50">
                  <span className="w-[230px] text-[15px] font-semibold capitalize">{longDate(d)}</span>
                  <span className={`chip ${hasPlan(d) ? "chip-solid" : "border-dashed"}`}>{hasPlan(d) ? "Planificado" : "Sin plan"}</span>
                  <span className={`chip ${isReviewed(d) ? "" : "border-dashed"}`}>{p?.verdict ? VERDICT[p.verdict] : isReviewed(d) ? "Revisado" : "Sin revisar"}</span>
                  <span className="flex-1 text-right text-[13px] text-tx-3">{s ? `${s.trades} ${s.trades === 1 ? "trade" : "trades"}` : "Sin trades"}{scope ? "" : " · todas las cuentas"}</span>
                  <span className={`num w-[110px] text-right text-[15px] font-semibold ${!s ? "text-tx-4" : s.net < 0 ? "text-down" : ""}`}>
                    {s ? money(s.net, { sign: true }) : "—"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </Shell>
  );
}
