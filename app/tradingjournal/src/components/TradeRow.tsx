import Link from "next/link";
import { isReviewed, net, type Trade } from "@/lib/data";
import { money, nyDateTime } from "@/lib/format";

export const SOURCE_LABEL: Record<string, string> = {
  manual: "A mano",
  mt5: "Importado · MT5",
  ctrader: "Importado · cTrader",
  csv: "Importado · CSV",
};

export function TradeRow({ t, showAccount = false }: { t: Trade; showAccount?: boolean }) {
  const n = net(t);
  return (
    <Link href={`/trades/${t.id}`} className="flex items-center gap-3 py-3 hover:bg-raised/50">
      <span className="min-w-0 flex-1 md:w-[86px] md:flex-none">
        <span className="block truncate text-[15px] font-semibold">{t.symbol}</span>
        <span className="block truncate text-[12px] text-tx-3 md:hidden">
          {nyDateTime(new Date(t.closed_at))}{showAccount ? ` · ${t.account_name}` : ""}
        </span>
      </span>
      <span className={`chip ${t.side === "long" ? "chip-solid" : ""}`}>{t.side === "long" ? "Largo" : "Corto"}</span>
      {!isReviewed(t) && <span className="chip hidden border-dashed sm:inline-flex">Por revisar</span>}
      {t.grade && <span className="chip hidden sm:inline-flex">{t.grade}</span>}
      <span className="hidden min-w-0 flex-1 truncate text-[13px] text-tx-3 md:block">
        {showAccount ? t.account_name : (SOURCE_LABEL[t.source] ?? t.source)}
      </span>
      <span className="hidden whitespace-nowrap text-[13px] text-tx-3 md:block">{nyDateTime(new Date(t.closed_at))}</span>
      <span className="shrink-0 text-right md:w-[104px]">
        <span className={`num block text-[15px] font-semibold ${n < 0 ? "text-down" : n > 0 ? "text-up" : "text-tx-2"}`}>
          {money(n, { sign: true })}
        </span>
        {t.risk ? (
          <span className="num block text-[11.5px] text-tx-3">{n >= 0 ? "+" : "−"}{Math.abs(n / t.risk).toFixed(2)}R</span>
        ) : null}
      </span>
    </Link>
  );
}
