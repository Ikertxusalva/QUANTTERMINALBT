import Link from "next/link";
import { PageHead, Shell } from "@/components/Shell";
import { TradeRow } from "@/components/TradeRow";
import { isReviewed, net, tradeDay } from "@/lib/data";
import { money } from "@/lib/format";
import { loadScoped } from "@/lib/scoped";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

export default async function Journal(props: PageProps<"/journal">) {
  const sp = await props.searchParams;
  const { trades, scope } = await loadScoped();
  const f = typeof sp.f === "string" ? sp.f : "all";
  const ids = typeof sp.ids === "string" ? new Set(sp.ids.split(",").map(Number)) : null;
  const day = typeof sp.day === "string" ? sp.day : null;

  const filters: { key: string; label: string; test: (t: (typeof trades)[number]) => boolean }[] = [
    { key: "all", label: "Todos", test: () => true },
    { key: "wins", label: "Ganadores", test: (t) => net(t) > 0 },
    { key: "losses", label: "Perdedores", test: (t) => net(t) < 0 },
    { key: "review", label: "Por revisar", test: (t) => !isReviewed(t) },
    { key: "imported", label: "Importados", test: (t) => t.source !== "manual" },
    { key: "manual", label: "A mano", test: (t) => t.source === "manual" },
  ];
  const base = trades.filter((t) => (!ids || ids.has(t.id)) && (!day || tradeDay(t) === day));
  const active = filters.find((x) => x.key === f) ?? filters[0];
  const shown = base.filter(active.test);
  const page = Math.max(1, Number(sp.page) || 1);
  const pageItems = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pages = Math.ceil(shown.length / PER_PAGE);
  const toReview = trades.filter((t) => !isReviewed(t));
  const keep = { ...(ids ? { ids: String(sp.ids) } : {}), ...(day ? { day } : {}) };
  const href = (over: Record<string, string>) => `/journal?${new URLSearchParams({ ...keep, f, ...over })}`;

  return (
    <Shell active="/journal">
      <PageHead
        title="Journal"
        sub={`${trades.length} trades · ${trades.length - toReview.length} revisados · ${scope ? scope.name : "todas las cuentas"}`}
      >
        <Link href="/import" className="btn">Importar</Link>
        <Link href="/log" className="btn btn-primary">Registrar trade</Link>
      </PageHead>

      {toReview.length > 0 && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <span className="text-[17px] font-semibold">{toReview.length} {toReview.length === 1 ? "trade espera" : "trades esperan"} una revisión rápida</span>
            <div className="mt-0.5 text-[13px] text-tx-3">Nota, plan, sensación y una línea. Un minuto por trade.</div>
          </div>
          <Link href={`/trades/${toReview.at(-1)!.id}`} className="btn btn-primary">Empezar revisión</Link>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filters.map((x) => (
          <Link key={x.key} href={href({ f: x.key })} className={`pill ${x.key === active.key ? "pill-on" : ""}`}>
            {x.label} <span className="opacity-60">{base.filter(x.test).length}</span>
          </Link>
        ))}
        {(ids || day) && <Link href="/journal" className="pill">✕ Quitar filtro{day ? ` · ${day}` : ""}</Link>}
      </div>

      <section className="card px-6 py-2">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-tx-3">
            {trades.length === 0 ? "Aún no hay trades. Importa un archivo o registra uno a mano." : "Ningún trade con este filtro."}
          </p>
        ) : (
          <div className="divide-y divide-line">
            {pageItems.map((t) => <TradeRow key={t.id} t={t} showAccount={!scope} />)}
          </div>
        )}
      </section>

      <div className="mt-3 flex items-center justify-between text-[13px] text-tx-3">
        <span>
          {shown.length} trades · neto <span className="num text-tx">{money(shown.reduce((s, t) => s + net(t), 0), { sign: true })}</span>
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-sm">Anterior</Link>}
            Página {page} de {pages}
            {page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-sm">Siguiente</Link>}
          </span>
        )}
      </div>
    </Shell>
  );
}
