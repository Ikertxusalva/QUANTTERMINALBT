import Link from "next/link";
import { AccountCard, HEALTH_TONE } from "@/components/AccountCard";
import { Shell } from "@/components/Shell";
import { loadViews, net } from "@/lib/data";
import { money, nyDateTime, pnlClass } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[12px] text-tx-3">{label}</div>
      <div className={`num mt-1 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default async function Dashboard() {
  const views = await loadViews();
  const active = views.filter((v) => v.account.status === "active");

  if (views.length === 0) {
    return (
      <Shell active="/">
        <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Añade tu primera cuenta</h1>
          <p className="mt-2 text-tx-2">
            Cada trade pertenece a una cuenta: una evaluación, una cuenta fondeada o tu cuenta
            personal. Créala y se seguirá contra sus reglas desde el primer trade.
          </p>
          <Link href="/accounts/new" className="btn btn-primary mt-6">
            Crear cuenta
          </Link>
        </div>
      </Shell>
    );
  }

  const allTrades = views.flatMap((v) => v.trades.map((t) => ({ t, name: v.account.name })));
  const tradingNet = allTrades.reduce((s, x) => s + net(x.t), 0);
  const wins = allTrades.filter((x) => net(x.t) > 0).length;
  const losses = allTrades.filter((x) => net(x.t) < 0).length;
  const paidOut = views.reduce((s, v) => s + v.paidOut, 0);
  const spent = views.reduce((s, v) => s + v.spent, 0);
  const attention = active.filter((v) => v.status.attention);
  const recent = allTrades
    .sort((a, b) => +new Date(b.t.closed_at) - +new Date(a.t.closed_at))
    .slice(0, 8);

  return (
    <Shell active="/">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="P&L de trading · todas las cuentas" value={money(tradingNet, { sign: true })} tone={pnlClass(tradingNet)} />
        <Stat
          label="Aciertos"
          value={wins + losses === 0 ? "—" : `${Math.round((wins / (wins + losses)) * 100)}%`}
        />
        <Stat label="Cobrado en payouts" value={money(paidOut)} />
        <Stat
          label="Neto de prop firms"
          value={money(paidOut - spent, { sign: true })}
          tone={pnlClass(paidOut - spent)}
        />
      </div>

      {attention.length > 0 && (
        <section className="card mt-4 p-4">
          <h2 className="text-[13px] font-medium text-tx-2">Requieren tu atención</h2>
          <ul className="mt-2 divide-y divide-line">
            {attention.map((v) => (
              <li key={v.account.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/accounts/${v.account.id}`} className="truncate hover:underline">
                  {v.account.name}
                </Link>
                <span className={`text-right text-[13px] ${HEALTH_TONE[v.status.health]}`}>
                  {v.status.attention}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-8 mb-3 font-medium">Cuentas activas</h2>
      {active.length === 0 ? (
        <p className="text-tx-2">No hay cuentas activas.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((v) => (
            <AccountCard key={v.account.id} view={v} />
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 font-medium">Últimos trades</h2>
      {recent.length === 0 ? (
        <p className="text-tx-2">Aún no hay trades. Regístralos desde la página de cada cuenta.</p>
      ) : (
        <div className="card divide-y divide-line">
          {recent.map(({ t, name }) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-16 font-medium">{t.symbol}</span>
              <span className="chip">{t.side === "long" ? "Largo" : "Corto"}</span>
              <span className="hidden min-w-0 flex-1 truncate text-tx-3 sm:block">{name}</span>
              <span className="ml-auto text-[13px] text-tx-3 sm:ml-0">
                {nyDateTime(new Date(t.closed_at))}
              </span>
              <span className={`num w-28 text-right ${pnlClass(net(t))}`}>
                {money(net(t), { sign: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
