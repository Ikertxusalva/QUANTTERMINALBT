import Link from "next/link";
import { AccountCard } from "@/components/AccountCard";
import { Shell } from "@/components/Shell";
import { loadViews } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const views = await loadViews();
  const active = views.filter((v) => v.account.status === "active");
  const archived = views.filter((v) => v.account.status === "archived");

  return (
    <Shell active="/accounts">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Cuentas</h1>
        <span className="text-tx-3">
          {active.length} activas · {archived.length} archivadas
        </span>
      </div>

      {views.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-tx-2">Todavía no hay ninguna cuenta.</p>
          <Link href="/accounts/new" className="btn btn-primary mt-4">
            Crear cuenta
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((v) => (
              <AccountCard key={v.account.id} view={v} />
            ))}
          </div>
          {archived.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 font-medium text-tx-2">Archivadas</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((v) => (
                  <AccountCard key={v.account.id} view={v} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
