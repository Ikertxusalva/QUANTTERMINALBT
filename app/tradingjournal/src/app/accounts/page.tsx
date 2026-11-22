import Link from "next/link";
import { AccountCard } from "@/components/AccountCard";
import { PageHead, Shell } from "@/components/Shell";
import { loadViews } from "@/lib/data";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const views = await loadViews();
  const active = views.filter((v) => v.account.status === "active");
  const archived = views.filter((v) => v.account.status === "archived");
  const paidOut = views.reduce((s, v) => s + v.paidOut, 0);
  const spent = views.reduce((s, v) => s + v.spent, 0);

  return (
    <Shell active="/accounts">
      <PageHead title="Cuentas" sub={`${active.length} activas · ${archived.length} archivadas`}>
        <Link href="/accounts/new" className="btn btn-primary">Crear cuenta</Link>
      </PageHead>

      {views.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-tx-2">Todavía no hay ninguna cuenta.</p>
          <Link href="/accounts/new" className="btn btn-primary mt-4">Crear cuenta</Link>
        </div>
      ) : (
        <>
          {(paidOut > 0 || spent > 0) && (
            <section className="card mb-4 flex flex-wrap items-end gap-x-12 gap-y-4 p-6">
              <div>
                <div className="eyebrow">Neto con las firmas</div>
                <div className={`figure mt-1.5 !text-[40px] ${paidOut - spent < 0 ? "text-down" : ""}`}>{money(paidOut - spent, { sign: true })}</div>
              </div>
              <div><div className="eyebrow">Cobrado</div><div className="figure mt-1.5">{money(paidOut)}</div></div>
              <div><div className="eyebrow">Gastado</div><div className="figure mt-1.5">{money(spent)}</div></div>
              {paidOut > 0 && spent > 0 && (
                <div className="text-tx-2">{(paidOut / spent).toFixed(2)}× de vuelta por cada $1 en comisiones</div>
              )}
            </section>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((v) => <AccountCard key={v.account.id} view={v} />)}
          </div>
          {archived.length > 0 && (
            <>
              <h2 className="mt-10 mb-3 text-[19px] font-bold tracking-tight text-tx-2">Archivadas</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {archived.map((v) => <AccountCard key={v.account.id} view={v} />)}
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
