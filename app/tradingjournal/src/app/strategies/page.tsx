import Link from "next/link";
import { addRule, deleteStrategy, saveStrategy, setRuleArchived, setStrategyArchived } from "@/app/journal-actions";
import { pct, rr } from "@/components/charts";
import { PageHead, Shell } from "@/components/Shell";
import { listRules } from "@/lib/data";
import { money } from "@/lib/format";
import { loadScoped } from "@/lib/scoped";
import { metrics } from "@/lib/stats.ts";

export const dynamic = "force-dynamic";

export default async function StrategiesPage(props: PageProps<"/strategies">) {
  const sp = await props.searchParams;
  const [{ strategies, trades, strades, scope }, rules] = await Promise.all([loadScoped(), listRules()]);
  const editing = strategies.find((s) => String(s.id) === sp.edit) ?? null;
  const creating = sp.new === "1";

  return (
    <Shell active="/strategies">
      <PageHead title="Estrategias" sub={`Tu modelo y su lista de criterios. Etiqueta cada trade para ver cómo rinde · ${scope ? scope.name : "todas las cuentas"}`}>
        <Link href="/strategies?new=1" className="btn btn-primary">Nueva estrategia</Link>
      </PageHead>

      {(creating || editing) && (
        <form action={saveStrategy} className="card mb-4 space-y-4 p-6">
          <h2 className="text-[19px] font-bold tracking-tight">{editing ? `Editar ${editing.name}` : "Nueva estrategia"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="label">Nombre</span><input name="name" className="input" required defaultValue={editing?.name ?? ""} placeholder="Barrida de Londres" /></label>
            <label><span className="label">Una línea sobre el setup</span><input name="description" className="input" defaultValue={editing?.description ?? ""} /></label>
          </div>
          <label className="block">
            <span className="label">Criterios · uno por línea</span>
            <textarea name="criteria" rows={5} className="input" defaultValue={editing?.criteria.map((c) => c.label).join("\n") ?? ""} placeholder={"Barrió liquidez\nA favor de tendencia\nSin noticias cerca"} />
            <span className="mt-1.5 block text-[12.5px] text-tx-3">Los marcarás en cada trade. Los trades pasados conservan lo que ya tenían marcado.</span>
          </label>
          <div className="flex justify-end gap-2">
            <Link href="/strategies" className="btn">Cancelar</Link>
            <button className="btn btn-primary">{editing ? "Guardar cambios" : "Crear estrategia"}</button>
          </div>
        </form>
      )}

      {strategies.length === 0 && !creating ? (
        <div className="card p-8 text-center text-tx-2">Aún no hay estrategias. Crea la primera y elígela al registrar o revisar un trade.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {strategies.map((s) => {
            const mine = strades.filter((t) => t.strategy === s.name);
            const m = metrics(mine);
            const raw = trades.filter((t) => t.strategy_id === s.id);
            return (
              <section key={s.id} className={`card p-6 ${s.archived ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[22px] font-bold tracking-tight">{s.name}</h2>
                    {s.description && <p className="mt-0.5 text-[13px] text-tx-3">{s.description}</p>}
                  </div>
                  {s.archived && <span className="chip">Archivada</span>}
                </div>
                <div className={`figure mt-4 !text-[38px] ${m.net < 0 ? "text-down" : ""}`}>{m.n ? money(m.net, { sign: true }) : "—"}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="pill pill-static !h-7">{m.n} trades</span>
                  <span className="pill pill-static !h-7">{pct(m.winRate)} aciertos</span>
                  <span className="pill pill-static !h-7">{rr(m.rPerTrade)} / trade</span>
                  <span className="pill pill-static !h-7">RR {m.avgRR == null ? "—" : `1:${m.avgRR.toFixed(1)}`}</span>
                </div>
                {s.criteria.length > 0 && (
                  <div className="mt-5">
                    <div className="eyebrow">Por criterio · trades que lo cumplieron</div>
                    <div className="mt-2 divide-y divide-line">
                      {s.criteria.map((c) => {
                        const answered = raw.filter((t) => t.criteria_met != null);
                        const metIds = new Set(answered.filter((t) => t.criteria_met!.includes(c.id)).map((t) => t.id));
                        const cm = metrics(mine.filter((t) => metIds.has(t.id)));
                        return (
                          <div key={c.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                            <span className="min-w-0 flex-1 truncate">{c.label}</span>
                            <span className="hidden font-mono text-[12px] text-tx-3 sm:inline">{answered.length ? `${Math.round((metIds.size / answered.length) * 100)}% seguido` : "sin datos"}</span>
                            <span className="num w-12 text-right text-tx-2">{pct(cm.winRate)}</span>
                            <span className={`num w-24 text-right font-semibold ${cm.net < 0 ? "text-down" : ""}`}>{cm.n ? money(cm.net, { sign: true }) : "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {m.n > 0 && <Link href={`/journal?ids=${mine.map((t) => t.id).join(",")}`} className="btn btn-sm">Ver {m.n} trades</Link>}
                  <Link href={`/strategies?edit=${s.id}`} className="btn btn-sm">Editar</Link>
                  <form action={setStrategyArchived}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="archived" value={s.archived ? "0" : "1"} />
                    <button className="btn btn-sm">{s.archived ? "Reactivar" : "Archivar"}</button>
                  </form>
                  {s.archived && (
                    <form action={deleteStrategy}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-sm btn-danger">Eliminar</button>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="card mt-4 p-6">
        <h2 className="text-[22px] font-bold tracking-tight">Reglas de trading</h2>
        <p className="mt-1 text-[13px] text-tx-3">Tu lista de disciplina, válida para cualquier estrategia. En cada trade marcas las que rompiste; Stats te dice lo que cuesta.</p>
        <div className="mt-3 divide-y divide-line">
          {rules.map((r) => (
            <div key={r.id} className={`flex items-center justify-between gap-3 py-3 ${r.archived ? "text-tx-3" : ""}`}>
              <span>{r.name}{r.archived && " · archivada"}</span>
              <form action={setRuleArchived}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="archived" value={r.archived ? "0" : "1"} />
                <button className="btn btn-sm">{r.archived ? "Restaurar" : "Archivar"}</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addRule} className="mt-4 flex flex-wrap gap-2">
          <input name="name" className="input min-w-0 !w-auto flex-1 basis-56" required placeholder="Sin trades de venganza…" aria-label="Nueva regla" />
          <button className="btn shrink-0">Añadir regla</button>
        </form>
      </section>
    </Shell>
  );
}
