import Link from "next/link";
import { notFound } from "next/navigation";
import { saveDay, setPlanMark } from "@/app/journal-actions";
import { Shell } from "@/components/Shell";
import { getDay, listTrades, net, tradeDay } from "@/lib/data";
import { money, nyDateTime } from "@/lib/format";
import { listNews } from "@/lib/news";
import { fromNyLocal } from "@/lib/rules/session.ts";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function shift(date: string, by: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

function Choice({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="relative">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="pill-check" />
      <span className="pill">{label}</span>
    </label>
  );
}

export default async function DayPage(props: PageProps<"/days/[date]">) {
  const { date } = await props.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) notFound();
  const start = fromNyLocal(`${date}T00:00`);
  const [day, all, news] = await Promise.all([
    getDay(date),
    listTrades(),
    listNews(start, new Date(start.getTime() + 24 * 3600_000)),
  ]);
  const trades = all.filter((t) => tradeDay(t) === date).reverse();
  const dayNet = trades.reduce((s, t) => s + net(t), 0);
  const onPlan = trades.filter((t) => t.plan_followed === "yes").length;
  const high = news.filter((n) => n.impact === "High");

  return (
    <Shell active="/days">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link href="/days" className="btn btn-sm">← Días</Link>
        <div className="flex gap-2">
          <Link href={`/days/${shift(date, -1)}`} className="btn btn-sm">‹ Día anterior</Link>
          <Link href={`/days/${shift(date, 1)}`} className="btn btn-sm">Día siguiente ›</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1 capitalize">{fmt.format(new Date(`${date}T00:00:00Z`))}</h1>
          <p className="mt-2 text-tx-3">
            {trades.length === 0 ? "Sin trades este día" : `${trades.length} ${trades.length === 1 ? "trade" : "trades"} · ${onPlan} dentro del plan`}
          </p>
        </div>
        <div className="text-right">
          <div className="eyebrow">P&L del día</div>
          <div className={`figure mt-1 !text-[36px] ${dayNet < 0 ? "text-down" : ""}`}>{trades.length ? money(dayNet, { sign: true }) : "—"}</div>
        </div>
      </div>

      {high.length > 0 && (
        <div className="card mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 px-6 py-4">
          <span className="eyebrow">Noticias de alto impacto</span>
          {high.map((n) => (
            <span key={n.id} className="text-[13.5px]"><b>{n.country}</b> {n.title} <span className="text-tx-3">· {nyDateTime(new Date(n.at)).split(", ")[1]}</span></span>
          ))}
        </div>
      )}

      <form action={saveDay} className="mt-5 space-y-4">
        <input type="hidden" name="date" value={date} />
        <section className="card space-y-5 p-6">
          <div className="flex items-center gap-3"><span className="chip chip-solid">1</span><h2 className="text-[19px] font-bold tracking-tight">Plan</h2><span className="text-[13px] text-tx-3">antes de la apertura</span></div>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <div>
              <div className="label">Sesgo</div>
              <div className="flex gap-2">
                <Choice name="bias" value="long" label="Alcista" checked={day?.bias === "long"} />
                <Choice name="bias" value="short" label="Bajista" checked={day?.bias === "short"} />
                <Choice name="bias" value="neutral" label="Neutral" checked={day?.bias === "neutral"} />
              </div>
            </div>
            <label>
              <span className="label">Instrumento</span>
              <input name="instrument" className="input" defaultValue={day?.instrument ?? ""} placeholder="NAS100, EURUSD…" />
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="label">Niveles clave · uno por línea</span>
              <textarea name="levels" rows={5} className="input font-mono text-[13px]" defaultValue={day?.levels ?? ""} placeholder={"PDH 21480\nPDL 21310\nApertura NY 21402"} />
            </label>
            <label>
              <span className="label">Si → entonces · un escenario por línea</span>
              <textarea name="scenarios" rows={5} className="input" defaultValue={day?.scenarios ?? ""} placeholder={"Si barre el mínimo de Londres → busco largo en la recuperación\nSi abre con gap → espero 15 minutos"} />
            </label>
          </div>
          <label className="block">
            <span className="label">El plan</span>
            <textarea name="plan" rows={3} className="input" defaultValue={day?.plan ?? ""} placeholder="Máximo 3 trades, paro en −$500." />
          </label>
        </section>

        <section className="card space-y-5 p-6">
          <div className="flex items-center gap-3"><span className="chip chip-solid">3</span><h2 className="text-[19px] font-bold tracking-tight">Revisión</h2><span className="text-[13px] text-tx-3">después del cierre</span></div>
          <div>
            <div className="label">¿El plan fue correcto?</div>
            <div className="flex flex-wrap gap-2">
              <Choice name="verdict" value="correct" label="Correcto" checked={day?.verdict === "correct"} />
              <Choice name="verdict" value="partly" label="En parte" checked={day?.verdict === "partly"} />
              <Choice name="verdict" value="wrong" label="Equivocado" checked={day?.verdict === "wrong"} />
              <Choice name="verdict" value="no_trade" label="Sin operar" checked={day?.verdict === "no_trade"} />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label><span className="label">Lo que dijiste</span><textarea name="said" rows={3} className="input" defaultValue={day?.said ?? ""} /></label>
            <label><span className="label">Lo que hizo el mercado</span><textarea name="market_did" rows={3} className="input" defaultValue={day?.market_did ?? ""} /></label>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label><span className="label">La próxima vez</span><textarea name="next_time" rows={3} className="input" defaultValue={day?.next_time ?? ""} /></label>
            <label><span className="label">Qué repetirías</span><textarea name="review" rows={3} className="input" defaultValue={day?.review ?? ""} /></label>
          </div>
          <div className="flex justify-end"><button className="btn btn-primary">Guardar el día</button></div>
        </section>
      </form>

      <section className="card mt-4 p-6">
        <div className="flex items-center gap-3"><span className="chip chip-solid">2</span><h2 className="text-[19px] font-bold tracking-tight">Trades del día</h2><span className="text-[13px] text-tx-3">todas las cuentas</span></div>
        {trades.length === 0 ? (
          <p className="mt-3 text-tx-3">Sin trades. <Link href="/log" className="text-tx underline">Registrar uno</Link>.</p>
        ) : (
          <div className="mt-2 divide-y divide-line">
            {trades.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <Link href={`/trades/${t.id}`} className="w-[86px] text-[15px] font-semibold hover:underline">{t.symbol}</Link>
                <span className={`chip ${t.side === "long" ? "chip-solid" : ""}`}>{t.side === "long" ? "Largo" : "Corto"}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-tx-3">{t.account_name} · {nyDateTime(new Date(t.closed_at))}</span>
                <form action={setPlanMark} className="flex gap-1.5">
                  <input type="hidden" name="id" value={t.id} />
                  <button name="plan_followed" value="yes" className={`pill !h-7 ${t.plan_followed === "yes" ? "pill-on" : ""}`}>En plan</button>
                  <button name="plan_followed" value="no" className={`pill !h-7 ${t.plan_followed === "no" ? "pill-on" : ""}`}>Fuera de plan</button>
                </form>
                <span className={`num w-[100px] text-right text-[15px] font-semibold ${net(t) < 0 ? "text-down" : ""}`}>{money(net(t), { sign: true })}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
