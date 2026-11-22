import Link from "next/link";
import { undoImport } from "@/app/journal-actions";
import { PageHead, Shell } from "@/components/Shell";
import { getScope, listAccounts } from "@/lib/data";
import { q } from "@/lib/db";
import { nyDateTime } from "@/lib/format";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = { mt5: "MetaTrader 5", ctrader: "cTrader", csv: "CSV" };

export default async function ImportPage() {
  const accounts = await listAccounts();
  const active = accounts.filter((a) => a.status === "active");
  const scope = await getScope(accounts);
  const recent = await q<{ id: number; source: string; filename: string | null; trades: number; created_at: Date; name: string }>(
    "select i.*, a.name from imports i join accounts a on a.id = i.account_id order by i.id desc limit 10",
  );

  return (
    <Shell active="/journal">
      <PageHead title="Importar" sub="Trae tus trades cerrados desde MetaTrader 5, cTrader o un CSV.">
        <Link href="/journal" className="btn">← Journal</Link>
      </PageHead>

      {active.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-tx-2">Antes de importar necesitas una cuenta activa.</p>
          <Link href="/accounts/new" className="btn btn-primary mt-4">Crear cuenta</Link>
        </div>
      ) : (
        <ImportForm
          accounts={active.map((a) => ({ id: a.id, name: a.name }))}
          defaultAccount={scope && scope.status === "active" ? scope.id : null}
        />
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-6">
          <div className="eyebrow">MetaTrader 5</div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-tx-2">
            <li>Abre la pestaña <b className="text-tx">Historial</b>.</li>
            <li>Clic derecho → <b className="text-tx">Informe</b> → <b className="text-tx">HTML</b>.</li>
            <li>Sube aquí el archivo guardado.</li>
          </ol>
          <p className="mt-3 text-[12.5px] text-tx-3">
            Cada posición cerrada es un trade, con el beneficio, la comisión y el swap de MT5. Las horas son las del servidor
            del broker: «Nueva York +7» encaja con la mayoría.
          </p>
        </section>
        <section className="card p-6">
          <div className="eyebrow">cTrader</div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-tx-2">
            <li>Abre <b className="text-tx">Historial</b> en el panel inferior.</li>
            <li>Elige el rango de fechas y pulsa <b className="text-tx">Exportar</b> (Excel o HTML).</li>
            <li>Sube aquí el archivo.</li>
          </ol>
          <p className="mt-3 text-[12.5px] text-tx-3">
            La zona horaria se lee de la propia cabecera («Closing Time (UTC+1)»). Reimportar el mismo archivo no duplica nada.
          </p>
        </section>
      </div>

      {recent.length > 0 && (
        <section className="card mt-4 p-6">
          <h2 className="text-[19px] font-bold tracking-tight">Importaciones recientes</h2>
          <div className="mt-2 divide-y divide-line">
            {recent.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium">{SOURCE[r.source] ?? r.source}</span>
                <span className="text-tx-2">{r.trades} trades → {r.name}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-tx-3">{r.filename} · {nyDateTime(new Date(r.created_at))}</span>
                <form action={undoImport}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-sm btn-danger">Deshacer</button>
                </form>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-tx-3">Deshacer borra los trades de esa importación junto con sus revisiones.</p>
        </section>
      )}
    </Shell>
  );
}
