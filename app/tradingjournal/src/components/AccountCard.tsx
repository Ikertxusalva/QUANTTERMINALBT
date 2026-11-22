import Link from "next/link";
import type { AccountView } from "@/lib/data";
import { money } from "@/lib/format";
import { PHASE_LABEL } from "@/lib/presets";
import type { AccountHealth } from "@/lib/rules/engine.ts";

export const HEALTH_TONE: Record<AccountHealth, string> = {
  ok: "text-tx-2",
  at_risk: "text-warn",
  breached: "text-bad",
  daily_hit: "text-warn",
  target_met: "text-good",
  payout_ready: "text-good",
};

function Meter({ label, value, share, tone = "#f4f4f4" }: { label: string; value: string; share: number; tone?: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr_auto] items-center gap-3">
      <span className="text-tx-3">{label}</span>
      <div className="bar"><span style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`, background: tone }} /></div>
      <span className="num min-w-[70px] text-right font-semibold">{value}</span>
    </div>
  );
}

export function AccountCard({ view }: { view: AccountView }) {
  const { account: a, status: s } = view;
  const result = s.balance.tradesNet + a.prior_pnl;
  const dd = s.drawdown;
  const archived = a.status === "archived";
  const note =
    s.attention ??
    (s.payoutDays
      ? `Payout posible en ${Math.max(0, s.payoutDays.required - s.payoutDays.counted)} días que cuenten`
      : s.target
        ? `${money(s.target.toGo, { whole: true })} para el objetivo`
        : a.kind === "personal"
          ? "Cuenta personal"
          : "En regla");
  return (
    <Link href={`/accounts/${a.id}`} className={`card block overflow-hidden transition-colors hover:border-line-2 ${archived ? "opacity-60" : ""}`}>
      <div className="p-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="well flex h-11 w-11 shrink-0 items-center justify-center text-[17px] font-bold">
              {(a.firm ?? a.name).trim()[0]?.toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-bold tracking-tight">{a.name}</div>
              <div className="truncate text-[13.5px] text-tx-3">
                {a.kind === "personal" ? "Cuenta personal" : [a.firm, a.plan].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <span className={`chip !h-7 !px-3 !text-[12.5px] ${a.phase === "funded" && !archived ? "chip-solid" : ""}`}>
            {archived ? "Archivada" : PHASE_LABEL[a.phase]}
          </span>
        </div>
        <div className="mt-5 flex items-baseline gap-2">
          <span className={`figure !text-[44px] !font-bold ${result < 0 ? "text-down" : ""}`}>{money(result, { sign: true, whole: true })}</span>
          <span className="text-tx-3">resultado</span>
        </div>
        <div className="num mt-1 text-[13.5px] text-tx-3">Balance {money(s.balance.balance)}</div>
      </div>
      <div className="space-y-2.5 border-t border-line p-6 pt-5 text-[13.5px]">
        {dd && (
          <Meter
            label="Margen a pérd. máx."
            value={`${dd.estimate ? "≤ " : ""}${money(Math.max(0, dd.headroom), { whole: true })}`}
            share={1 - dd.used}
            tone={dd.used >= 0.8 ? "var(--bad)" : dd.used >= 0.5 ? "var(--warn)" : "#f4f4f4"}
          />
        )}
        {s.target && <Meter label="Objetivo" value={`${Math.round(s.target.progress * 100)}%`} share={s.target.progress} />}
        {s.payoutDays && <Meter label="Días para payout" value={`${s.payoutDays.atLeast ? "≥ " : ""}${s.payoutDays.counted}/${s.payoutDays.required}`} share={s.payoutDays.counted / s.payoutDays.required} />}
        {a.kind === "prop" && (
          <>
            <Meter label="Cobrado" value={money(view.paidOut, { whole: true })} share={view.paidOut / Math.max(view.paidOut, view.spent, 1)} />
            <Meter label="Gastado" value={money(view.spent, { whole: true })} share={view.spent / Math.max(view.paidOut, view.spent, 1)} tone="#6a6a6a" />
          </>
        )}
        <div className={`well mt-3 px-4 py-3 ${HEALTH_TONE[s.health]}`}>{note}</div>
      </div>
    </Link>
  );
}
