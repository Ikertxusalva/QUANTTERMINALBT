import Link from "next/link";
import { PageHead, Shell } from "@/components/Shell";
import { getScope, listAccounts, listStrategies } from "@/lib/data";
import { instrumentsFor } from "@/lib/instruments";
import { toNyLocal } from "@/lib/rules/session.ts";
import { LogTradeForm } from "../accounts/[id]/Forms";

export const dynamic = "force-dynamic";

export default async function LogPage(props: PageProps<"/log">) {
  const sp = await props.searchParams;
  const accounts = (await listAccounts()).filter((a) => a.status === "active");
  const scope = await getScope(accounts);
  const account = accounts.find((a) => String(a.id) === sp.account) ?? scope ?? accounts[0];
  const strategies = (await listStrategies()).filter((s) => !s.archived);

  return (
    <Shell active="/journal">
      <PageHead title="Registrar trade" sub="Un trade que ya hiciste. Aquí nunca se envían órdenes.">
        <Link href="/import" className="btn">Importar un archivo</Link>
      </PageHead>
      {!account ? (
        <div className="card p-8 text-center">
          <p className="text-tx-2">Cada trade se registra en una cuenta.</p>
          <Link href="/accounts/new" className="btn btn-primary mt-4">Crea tu primera cuenta</Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {accounts.map((a) => (
              <Link key={a.id} href={`/log?account=${a.id}`} className={`pill ${a.id === account.id ? "pill-on" : ""}`}>{a.name}</Link>
            ))}
          </div>
          <section className="card p-6">
            <LogTradeForm
              key={account.id}
              accountId={account.id}
              symbols={instrumentsFor(account.market).map((i) => i.symbol)}
              defaultTime={toNyLocal(new Date())}
              cfd={account.market === "cfd"}
              strategies={strategies.map((s) => ({ id: s.id, name: s.name }))}
            />
          </section>
        </>
      )}
    </Shell>
  );
}
