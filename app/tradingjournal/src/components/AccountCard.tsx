import Link from "next/link";
import type { AccountView } from "@/lib/data";
import { money, pnlClass } from "@/lib/format";
import { PHASE_LABEL } from "@/lib/presets";
import type { AccountHealth } from "@/lib/rules/engine.ts";

export const HEALTH_TONE: Record<AccountHealth, string> = {
  ok: "text-tx-2",
  at_risk: "text-warn",
  breached: "text-down",
  daily_hit: "text-warn",
  target_met: "text-up",
  payout_ready: "text-up",
};

export function AccountCard({ view }: { view: AccountView }) {
  const { account: a, status: s } = view;
  const net = s.balance.tradesNet + a.prior_pnl;
  const dd = s.drawdown;
  return (
    <Link
      href={`/accounts/${a.id}`}
      className={`card block p-4 transition-colors hover:border-line-2 ${
        a.status === "archived" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{a.name}</div>
          <div className="truncate text-[13px] text-tx-3">
            {a.kind === "personal" ? "Cuenta personal" : [a.firm, a.plan].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span className="chip">{a.status === "archived" ? "Archivada" : PHASE_LABEL[a.phase]}</span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] text-tx-3">Balance</div>
          <div className="num text-2xl font-semibold">{money(s.balance.balance)}</div>
        </div>
        <div className={`num ${pnlClass(net)}`}>{money(net, { sign: true })}</div>
      </div>

      {dd && (
        <div className="mt-4">
          <div className="flex justify-between text-[12px] text-tx-3">
            <span>Margen hasta pérdida máxima</span>
            <span className={`num ${dd.breached ? "text-down" : "text-tx-2"}`}>
              {dd.estimate ? "≤ " : ""}
              {money(Math.max(0, dd.headroom), { whole: true })}
            </span>
          </div>
          <div className="bar mt-1.5">
            <span
              style={{
                width: `${Math.round((1 - dd.used) * 100)}%`,
                background: dd.used >= 0.8 ? "var(--down)" : dd.used >= 0.5 ? "var(--warn)" : "var(--up)",
              }}
            />
          </div>
        </div>
      )}

      {s.target && (
        <div className="mt-3 flex justify-between text-[12px] text-tx-3">
          <span>Objetivo</span>
          <span className="num text-tx-2">
            {s.target.reached ? "Cumplido" : `${money(s.target.toGo, { whole: true })} restantes`}
          </span>
        </div>
      )}
      {s.payoutDays && (
        <div className="mt-3 flex justify-between text-[12px] text-tx-3">
          <span>Días para payout</span>
          <span className="num text-tx-2">
            {s.payoutDays.atLeast ? "≥ " : ""}
            {s.payoutDays.counted} de {s.payoutDays.required}
          </span>
        </div>
      )}

      {s.attention && (
        <div className={`mt-3 text-[13px] ${HEALTH_TONE[s.health]}`}>{s.attention}</div>
      )}
    </Link>
  );
}
