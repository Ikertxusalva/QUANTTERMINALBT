"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { runImport, type ImportState } from "@/app/journal-actions";
import { money, nyDateTime } from "@/lib/format";

const OFFSETS = [-8, -7, -6, -5, -4, -3, 0, 1, 2, 3, 4, 8, 9, 10];

export function ImportForm({ accounts, defaultAccount }: { accounts: { id: number; name: string }[]; defaultAccount: number | null }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(runImport, {});
  const [account, setAccount] = useState(String(defaultAccount ?? accounts[0]?.id ?? ""));
  const [tz, setTz] = useState("ny:7");
  const [file, setFile] = useState<File | null>(null);
  // The file lives in state: a form is cleared after each submit, and the same file is sent
  // twice, once to check it and once to import it.
  const run = (intent: "preview" | "commit") => {
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("account_id", account);
    fd.set("tz", tz);
    if (file) fd.set("file", file);
    startTransition(() => action(fd));
  };
  const p = state.preview;

  if (state.imported) {
    return (
      <div className="card p-8 text-center">
        <div className="eyebrow">Importación completada</div>
        <div className="figure mt-3 !text-[40px]">{state.imported.count} trades</div>
        <p className="mt-2 text-tx-2">Entran sin revisar: ponles nota, plan y sensación cuando puedas.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/journal?f=review" className="btn btn-primary">Revisar trades</Link>
          <Link href={`/accounts/${state.imported.accountId}`} className="btn">Ver la cuenta</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); run("preview"); }} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">¿A qué cuenta?</span>
          <select name="account_id" className="input" value={account} onChange={(e) => setAccount(e.target.value)} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Las horas del archivo están en</span>
          <select name="tz" className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
            <option value="ny:7">Servidor del broker · Nueva York +7 (habitual en MT5)</option>
            <option value="ny:0">Hora de Nueva York</option>
            {OFFSETS.map((o) => (
              <option key={o} value={`utc:${o * 60}`}>UTC{o === 0 ? "" : o > 0 ? `+${o}` : o}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Archivo</span>
        <input name="file" type="file" accept=".html,.htm,.csv,.xlsx,.txt" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input !h-auto py-3 file:mr-3 file:rounded-full file:border-0 file:bg-[#f4f4f4] file:px-3 file:py-1 file:font-medium file:text-[#050505]" />
        <span className="mt-1.5 block text-[12.5px] text-tx-3">
          MT5: informe HTML del historial. cTrader: exportación del historial en Excel, HTML o CSV. También cualquier CSV con
          símbolo, hora de cierre y resultado.
        </span>
      </label>

      {state.error && <p className="text-bad">{state.error}</p>}

      {p && (
        <div className="well space-y-4 p-5">
          <div className="eyebrow">Comprueba antes de importar · {p.source}</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><div className="figure">{p.fresh}</div><div className="text-[13px] text-tx-3">trades nuevos</div></div>
            <div><div className="figure">{p.duplicates}</div><div className="text-[13px] text-tx-3">ya importados</div></div>
            <div><div className={`figure ${p.net < 0 ? "text-down" : ""}`}>{money(p.net, { sign: true })}</div><div className="text-[13px] text-tx-3">neto de los nuevos</div></div>
            <div><div className="figure">{p.skipped.length}</div><div className="text-[13px] text-tx-3">filas sin leer</div></div>
          </div>
          {p.first && p.last && (
            <p className="text-[13px] text-tx-2">
              Del {nyDateTime(new Date(p.first))} al {nyDateTime(new Date(p.last))}.{" "}
              {p.detectedOffsetMin != null
                ? `El archivo indica su zona (UTC${p.detectedOffsetMin >= 0 ? "+" : "−"}${Math.abs(p.detectedOffsetMin) / 60}) y se ha usado esa.`
                : "Si esas horas no coinciden con cuando operaste, cambia la zona horaria arriba y vuelve a comprobar."}
            </p>
          )}
          <div className="divide-y divide-line text-[13.5px]">
            {p.sample.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="w-20 font-semibold">{t.symbol}</span>
                <span className="w-14 text-tx-2">{t.side === "long" ? "Largo" : "Corto"}</span>
                <span className="num w-14 text-tx-2">{t.qty}</span>
                <span className="flex-1 text-tx-3">{nyDateTime(new Date(t.closedAt))}{t.dup ? " · ya importado" : ""}</span>
                <span className={`num font-semibold ${t.net < 0 ? "text-down" : ""}`}>{money(t.net, { sign: true })}</span>
              </div>
            ))}
          </div>
          {p.total > p.sample.length && <p className="text-[12.5px] text-tx-3">…y {p.total - p.sample.length} más.</p>}
          {p.skipped.length > 0 && <p className="text-[12.5px] text-warn">{p.skipped.join(" · ")}</p>}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn" disabled={pending}>
          {pending ? "Leyendo…" : p ? "Volver a comprobar" : "Comprobar archivo"}
        </button>
        {p && p.fresh > 0 && (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run("commit")}>
            Importar {p.fresh} trades
          </button>
        )}
      </div>
    </form>
  );
}
