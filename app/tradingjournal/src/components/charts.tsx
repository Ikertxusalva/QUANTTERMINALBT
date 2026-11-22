import Link from "next/link";
import { money } from "@/lib/format";
import type { CalendarWeek, Equity, GroupRow, HeatCell } from "@/lib/stats.ts";

/** Equity line with the time-under-water area beneath it. */
export function EquityChart({ data, height = 260 }: { data: Equity; height?: number }) {
  const pts = [0, ...data.points];
  if (pts.length < 2) {
    return (
      <div className="flex items-center justify-center text-tx-3" style={{ height }}>
        La curva aparece con tu primer trade.
      </div>
    );
  }
  const W = 1000, top = 12, split = height * 0.74, bottom = height - 6;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => top + (1 - (v - min) / span) * (split - top - 8);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const uw = [0, ...data.underwater];
  const deepest = Math.min(...uw) || -1;
  const uy = (v: number) => split + (v / deepest) * (bottom - split);
  const under = `M0,${split}` + uw.map((v, i) => `L${x(i).toFixed(1)},${uy(v).toFixed(1)}`).join("") + `L${W},${split}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label="Curva de resultado acumulado">
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${split}L0,${split}Z`} fill="url(#eq)" />
      <path d={under} fill="rgb(255 255 255 / 0.08)" stroke="rgb(255 255 255 / 0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="0" x2={W} y1={split} y2={split} stroke="rgb(255 255 255 / 0.25)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={line} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const WEEK = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const short = (c: number) => money(c, { sign: true, whole: Math.abs(c) % 100 === 0 });

/** Month of P&L by day, with each week's total on the right. */
export function Calendar({ weeks, band = 0 }: { weeks: CalendarWeek[]; band?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_56px_56px_112px] gap-2">
          {WEEK.map((d) => (
            <div key={d} className="eyebrow py-2 text-center">{d}</div>
          ))}
          <div className="eyebrow py-2 text-right">Semana</div>
        </div>
        <div className="space-y-2">
          {weeks.map((w) => (
            <div key={w.days[0].date} className="grid grid-cols-[repeat(5,minmax(0,1fr))_56px_56px_112px] gap-2">
              {w.days.map((d, i) => {
                const n = Number(d.date.slice(8));
                const weekend = i >= 5;
                if (!d.stat) {
                  return (
                    <Link
                      key={d.date}
                      href={`/days/${d.date}`}
                      className={`h-[92px] rounded-[14px] p-3 text-[13px] font-semibold ${d.inMonth ? "text-tx hover:bg-panel" : "text-tx-4"}`}
                    >
                      {n}
                    </Link>
                  );
                }
                const decided = d.stat.wins + d.stat.losses;
                return (
                  <Link key={d.date} href={`/days/${d.date}`} className="well flex h-[92px] flex-col justify-between p-3 hover:border-line-2">
                    <span className="text-[13px] font-semibold">{n}</span>
                    <span>
                      <span className={`num block font-semibold ${weekend ? "text-[12px]" : "text-[16px]"} ${d.stat.net > band ? "text-up" : d.stat.net < -band ? "text-down" : "text-tx-2"}`}>
                        {weekend ? money(d.stat.net, { sign: true, whole: true }) : short(d.stat.net)}
                      </span>
                      {!weekend && (
                        <span className="block text-[11.5px] text-tx-3">
                          {d.stat.trades} {d.stat.trades === 1 ? "trade" : "trades"}
                          {decided > 0 && ` · ${Math.round((d.stat.wins / decided) * 100)}%`}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
              <div className="flex flex-col items-end justify-center">
                {w.traded > 0 && (
                  <>
                    <span className="font-mono text-[11.5px] text-tx-3">{w.green}/{w.traded} en verde</span>
                    <span className={`num font-semibold ${w.net >= 0 ? "text-up" : "text-down"}`}>{short(w.net)}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type Measure = "net" | "win" | "r";

/** One row per group: a bar sized by the chosen measure, then win rate, R and net. */
export function EdgeRows({ rows, measure, hrefFor }: { rows: GroupRow[]; measure: Measure; hrefFor?: (r: GroupRow) => string }) {
  const value = (r: GroupRow) => (measure === "net" ? r.net : measure === "win" ? (r.winRate ?? 0) : (r.rPerTrade ?? 0));
  const max = Math.max(...rows.map((r) => Math.abs(value(r))), 1e-9);
  const best = rows.reduce<GroupRow | null>((m, r) => (!m || value(r) > value(m) ? r : m), null);
  if (rows.length === 0) return <p className="py-6 text-tx-3">Sin trades en este grupo.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="t w-full min-w-[720px]">
        <thead>
          <tr>
            <th className="w-[26%] pb-2 text-left" />
            <th className="pb-2" />
            <th className="pb-2 text-right">Aciertos</th>
            <th className="pb-2 text-right">R / trade</th>
            <th className="pb-2 text-right">RR medio</th>
            <th className="pb-2 pr-3 text-right">Neto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = value(r);
            const label = (
              <>
                <span className="text-[16px] font-semibold">{r.label}</span>
                <span className="ml-2 font-mono text-[12px] text-tx-3">n={r.n}</span>
                {r.small && <span className="chip ml-2 font-mono uppercase">poco</span>}
              </>
            );
            return (
              <tr key={r.label} className={r === best && rows.length > 1 ? "bg-panel" : ""}>
                <td className="rounded-l-[14px] py-3.5 pl-3">{hrefFor ? <Link href={hrefFor(r)} className="hover:underline">{label}</Link> : label}</td>
                <td className="py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="block h-7 rounded-[9px]"
                      style={{
                        width: `${Math.max(4, (Math.abs(v) / max) * 62)}%`,
                        background: v < 0 ? "#1c1c1c" : r === best ? "#f4f4f4" : "#3a3a3a",
                        border: v < 0 ? "1px solid rgb(255 255 255 / 0.12)" : undefined,
                      }}
                    />
                    <span className={`num whitespace-nowrap text-[13px] ${v < 0 ? "text-down" : "text-tx-2"}`}>
                      {measure === "net" ? money(r.net, { sign: true }) : measure === "win" ? pct(r.winRate) : rr(r.rPerTrade)}
                    </span>
                  </div>
                </td>
                <td className="num py-3.5 text-right text-tx-2">{pct(r.winRate)}</td>
                <td className="num py-3.5 text-right text-tx-2">{rr(r.rPerTrade)}</td>
                <td className="num py-3.5 text-right text-tx-2">{r.avgRR == null ? "—" : `1:${r.avgRR.toFixed(1)}`}</td>
                <td className={`num rounded-r-[14px] py-3.5 pr-3 text-right text-[16px] font-semibold ${r.net < 0 ? "text-down" : "text-up"}`}>
                  {money(r.net, { sign: true })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
export const rr = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}R`);

/** Net by weekday × entry hour. Brighter = more made; outlined = lost. */
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  if (cells.length === 0) return <p className="py-6 text-tx-3">Sin trades todavía.</p>;
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const range = Array.from({ length: hours.at(-1)! - hours[0] + 1 }, (_, i) => hours[0] + i);
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => d >= 1 && d <= 5 ? true : cells.some((c) => c.weekday === d));
  const names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const max = Math.max(...cells.map((c) => Math.abs(c.net)), 1);
  const at = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h);
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {range.map((h) => (
              <th key={h} className="font-mono text-[10.5px] font-normal text-tx-3">{String(h).padStart(2, "0")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <td className="pr-2 text-[12.5px] text-tx-2">{names[d]}</td>
              {range.map((h) => {
                const c = at(d, h);
                const a = c ? 0.12 + 0.88 * (Math.abs(c.net) / max) : 0;
                return (
                  <td key={h}>
                    <div
                      title={c ? `${names[d]} ${String(h).padStart(2, "0")}:00 · ${money(c.net, { sign: true })} · ${c.n} trades` : undefined}
                      className="h-7 w-9 rounded-[7px]"
                      style={
                        !c
                          ? { background: "#0d0d0d" }
                          : c.net >= 0
                            ? { background: `rgb(244 244 244 / ${a.toFixed(2)})` }
                            : { background: "#0d0d0d", boxShadow: `inset 0 0 0 1.5px rgb(255 255 255 / ${(0.15 + a * 0.5).toFixed(2)})` }
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-tx-3">Hora de entrada en Nueva York. Relleno = ganancia · contorno = pérdida.</p>
    </div>
  );
}
