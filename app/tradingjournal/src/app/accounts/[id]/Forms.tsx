"use client";

import { useActionState } from "react";
import { addLedgerEntry, logTrade } from "@/app/actions";

export function LogTradeForm({
  accountId,
  symbols,
  defaultTime,
  cfd,
  strategies = [],
}: {
  accountId: number;
  symbols: string[];
  defaultTime: string;
  cfd: boolean;
  strategies?: { id: number; name: string }[];
}) {
  const [error, action, pending] = useActionState(logTrade, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <input type="hidden" name="account_id" value={accountId} />
      <label>
        <span className="label">Instrumento</span>
        <input name="symbol" className="input" list="symbols" defaultValue={symbols[0]} required />
        <datalist id="symbols">
          {symbols.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label>
        <span className="label">Lado</span>
        <select name="side" className="input">
          <option value="long">Largo</option>
          <option value="short">Corto</option>
        </select>
      </label>
      <label>
        <span className="label">{cfd ? "Lotes" : "Contratos"}</span>
        <input name="qty" className="input num" inputMode="decimal" defaultValue="1" required />
      </label>
      <label>
        <span className="label">Resultado antes de costes ($)</span>
        <input name="result" className="input num" inputMode="decimal" placeholder="-150 o 320.50" required />
      </label>
      <label>
        <span className="label">Comisión ($)</span>
        <input name="fees" className="input num" inputMode="decimal" placeholder="0" />
      </label>
      {cfd && (
        <label>
          <span className="label">Swap ($) · negativo si es cargo</span>
          <input name="swap" className="input num" inputMode="decimal" placeholder="0" />
        </label>
      )}
      <label>
        <span className="label">Riesgo · 1R ($)</span>
        <input name="risk" className="input num" inputMode="decimal" placeholder="opcional" />
      </label>
      <label>
        <span className="label">Apertura · Nueva York</span>
        <input name="opened_at" type="datetime-local" className="input num" />
      </label>
      <label>
        <span className="label">Cierre · Nueva York</span>
        <input name="closed_at" type="datetime-local" className="input num" defaultValue={defaultTime} required />
      </label>
      {strategies.length > 0 && (
        <label>
          <span className="label">Estrategia</span>
          <select name="strategy_id" className="input">
            <option value="">Sin estrategia</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span className="label">Nota de ejecución</span>
        <select name="grade" className="input">
          <option value="">Sin nota</option>
          {["A+", "A", "B", "C", "D"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="col-span-2">
        <span className="label">Comentario</span>
        <input name="note" className="input" placeholder="opcional" />
      </label>
      <div className="col-span-2 flex items-end md:col-span-1 md:col-start-4">
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Guardando…" : "Registrar trade"}
        </button>
      </div>
      {error && <p className="col-span-full text-bad">{error}</p>}
    </form>
  );
}

export function LedgerForm({
  accountId,
  today,
  funded,
}: {
  accountId: number;
  today: string;
  funded: boolean;
}) {
  const [error, action, pending] = useActionState(addLedgerEntry, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <input type="hidden" name="account_id" value={accountId} />
      <label>
        <span className="label">Tipo</span>
        <select name="type" className="input" defaultValue={funded ? "payout" : "eval_fee"}>
          <option value="payout">Payout</option>
          <option value="eval_fee">Evaluación</option>
          <option value="reset">Reset</option>
          <option value="activation">Activación</option>
          <option value="subscription">Suscripción</option>
          <option value="other">Otro coste</option>
        </select>
      </label>
      <label>
        <span className="label">Importe ($)</span>
        <input name="amount" className="input num" inputMode="decimal" required />
      </label>
      <label>
        <span className="label">Fecha</span>
        <input name="date" type="date" className="input num" defaultValue={today} required />
      </label>
      <label>
        <span className="label">Comentario</span>
        <input name="note" className="input" />
      </label>
      <div className="col-span-2 flex items-end md:col-span-1">
        <button className="btn w-full" disabled={pending}>
          {pending ? "Guardando…" : "Añadir"}
        </button>
      </div>
      {error && <p className="col-span-full text-bad">{error}</p>}
    </form>
  );
}
