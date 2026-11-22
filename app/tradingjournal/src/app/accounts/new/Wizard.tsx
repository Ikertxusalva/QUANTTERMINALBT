"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createAccount } from "@/app/actions";
import { money, parseMoney } from "@/lib/format";
import { DRAWDOWN_LABEL, FIRMS, PHASE_LABEL } from "@/lib/presets";
import type { AccountRules, DrawdownType, Market, Phase } from "@/lib/rules/types.ts";

type Mode = "firm" | "manual" | "personal";

/** Rules as the form holds them: dollars as text, so a field can be empty. */
interface RulesForm {
  maxLoss: string;
  drawdownType: DrawdownType;
  lockLevel: string;
  payoutLocksFloor: boolean;
  payoutsLowerBalance: boolean;
  dailyLoss: string;
  dailyLossMode: "soft" | "hard";
  profitTarget: string;
  minDays: string;
  consistencyPct: string;
  consistencyBasis: "total" | "target";
  consistencySinceLastPayout: boolean;
  payoutDays: string;
  minProfitPerDay: string;
  maxContracts: string;
}

const usd = (c: number | null | undefined) => (c == null ? "" : String(c / 100));
const int = (n: number | null | undefined) => (n == null ? "" : String(n));

function toForm(r: AccountRules = {}): RulesForm {
  return {
    maxLoss: usd(r.maxLoss),
    drawdownType: r.drawdownType ?? "static",
    lockLevel: usd(r.lockLevel),
    payoutLocksFloor: !!r.payoutLocksFloor,
    payoutsLowerBalance: r.payoutsLowerBalance !== false,
    dailyLoss: usd(r.dailyLoss),
    dailyLossMode: r.dailyLossMode ?? "soft",
    profitTarget: usd(r.profitTarget),
    minDays: int(r.minDays),
    consistencyPct: int(r.consistencyPct),
    consistencyBasis: r.consistencyBasis ?? "total",
    consistencySinceLastPayout: !!r.consistencySinceLastPayout,
    payoutDays: int(r.payoutDays),
    minProfitPerDay: usd(r.minProfitPerDay),
    maxContracts: int(r.maxContracts),
  };
}

const posInt = (s: string) => {
  const n = Math.floor(Number(s));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};
const posMoney = (s: string) => {
  const c = parseMoney(s);
  return c != null && c > 0 ? c : null;
};

function toRules(f: RulesForm, phase: Phase): AccountRules {
  const r: AccountRules = {};
  const maxLoss = posMoney(f.maxLoss);
  if (maxLoss) {
    r.maxLoss = maxLoss;
    r.drawdownType = phase === "personal" ? "static" : f.drawdownType;
    if (r.drawdownType !== "static") {
      const lock = parseMoney(f.lockLevel);
      if (lock != null && lock >= 0) {
        r.lockLevel = lock;
        if (f.payoutLocksFloor) r.payoutLocksFloor = true;
      }
    }
    if (!f.payoutsLowerBalance) r.payoutsLowerBalance = false;
  }
  const daily = posMoney(f.dailyLoss);
  if (daily) {
    r.dailyLoss = daily;
    r.dailyLossMode = f.dailyLossMode;
  }
  const maxContracts = posInt(f.maxContracts);
  if (maxContracts) r.maxContracts = maxContracts;
  if (phase === "personal") return r;

  const pct = posInt(f.consistencyPct);
  if (pct) {
    r.consistencyPct = pct;
    r.consistencyBasis = f.consistencyBasis;
    if (phase === "funded" && f.consistencySinceLastPayout) r.consistencySinceLastPayout = true;
  }
  if (phase === "evaluation") {
    const target = posMoney(f.profitTarget);
    if (target) r.profitTarget = target;
    const minDays = posInt(f.minDays);
    if (minDays) r.minDays = minDays;
  } else {
    const days = posInt(f.payoutDays);
    if (days) {
      r.payoutDays = days;
      const min = posMoney(f.minProfitPerDay);
      if (min) r.minProfitPerDay = min;
    }
  }
  return r;
}

const STEPS = ["Firma", "Plan y tamaño", "Reglas", "Detalles"];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-tx-3">{hint}</span>}
    </label>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-tx-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function Wizard() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("firm");
  const [search, setSearch] = useState("");

  const [firmId, setFirmId] = useState<string | null>(null);
  const [planIdx, setPlanIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
  const [custom, setCustom] = useState(false);

  const [firmName, setFirmName] = useState("");
  const [phase, setPhase] = useState<Phase>("evaluation");
  const [market, setMarket] = useState<Market>("futures");
  const [size, setSize] = useState("50000");

  const [rules, setRules] = useState<RulesForm>(toForm());
  const [presetRules, setPresetRules] = useState<RulesForm | null>(null);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [already, setAlready] = useState(false);
  const [currentBalance, setCurrentBalance] = useState("");
  const [currentFloor, setCurrentFloor] = useState("");
  const [daysBefore, setDaysBefore] = useState("");
  const [howMany, setHowMany] = useState("1");
  const [fee, setFee] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const firm = FIRMS.find((f) => f.id === firmId) ?? null;
  const plan = firm?.plans[planIdx] ?? null;
  const usesPreset = mode === "firm" && !custom && plan != null && sizeIdx != null;
  const effPhase: Phase = mode === "personal" ? "personal" : usesPreset ? plan!.phase : phase;
  const effMarket: Market = mode === "firm" && firm && !custom ? firm.market : market;
  const startCents = usesPreset ? plan!.sizes[sizeIdx!].size * 100 : (posMoney(size) ?? 0);
  const firmLabel = mode === "personal" ? null : mode === "firm" ? (firm?.name ?? null) : firmName;
  const planLabel = usesPreset ? plan!.name : null;

  const built = toRules(rules, effPhase);
  const edited =
    presetRules != null &&
    (Object.keys(rules) as (keyof RulesForm)[]).filter((k) => rules[k] !== presetRules[k]).length;

  const set = <K extends keyof RulesForm>(k: K, v: RulesForm[K]) =>
    setRules((r) => ({ ...r, [k]: v }));

  function suggestName(firmN: string | null, cents: number, ph: Phase) {
    const k = cents >= 100_000 ? `${Math.round(cents / 100_000)}K` : money(cents, { whole: true });
    return ph === "personal" ? `Personal ${k}` : `${firmN ?? "Prop"} ${k} ${PHASE_LABEL[ph]}`;
  }

  function pickFirm(id: string) {
    setMode("firm");
    setFirmId(id);
    setPlanIdx(0);
    setSizeIdx(null);
    setCustom(false);
    setStep(1);
  }
  function pickOther(m: Mode) {
    setMode(m);
    setFirmId(null);
    setSizeIdx(null);
    setCustom(false);
    setPresetRules(null);
    setRules(toForm());
    if (m === "manual") setFirmName(search.trim());
    setStep(1);
  }
  function pickSize(i: number) {
    setCustom(false);
    setSizeIdx(i);
    const f = toForm(plan!.sizes[i].rules);
    setRules(f);
    setPresetRules(f);
  }

  function next() {
    setError(null);
    if (step === 1) {
      if (mode === "firm" && !custom && sizeIdx == null) return setError("Elige un tamaño de cuenta.");
      if (!usesPreset && startCents <= 0) return setError("Indica el balance inicial.");
      if (mode === "manual" && !firmName.trim()) return setError("Escribe el nombre de la firma.");
      if (!name) setName(suggestName(firmLabel, startCents, effPhase));
    }
    setStep((s) => s + 1);
  }

  function submit() {
    setError(null);
    const cur = already ? parseMoney(currentBalance) : null;
    if (already && cur == null) return setError("Indica el balance actual de la cuenta.");
    startTransition(async () => {
      const res = await createAccount({
        kind: mode === "personal" ? "personal" : "prop",
        firm: firmLabel,
        plan: planLabel,
        phase: effPhase,
        market: effMarket,
        startingBalance: startCents,
        rules: built,
        name,
        accountNumber: number,
        currentBalance: cur,
        currentFloor: already ? parseMoney(currentFloor) : null,
        daysBefore: Number(daysBefore) || 0,
        howMany: Number(howMany) || 1,
        feePaid: parseMoney(fee),
      });
      if (res?.error) setError(res.error);
    });
  }

  const firms = FIRMS.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <ol className="mb-5 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`chip ${i === step ? "!border-line-2 !text-tx" : ""} ${i < step ? "!text-up" : ""}`}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        <div className="card p-5">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold">¿De qué firma es la cuenta?</h2>
              <input
                className="input mt-4"
                placeholder="Buscar firma…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {firms.map((f) => (
                  <button key={f.id} className="btn h-auto !whitespace-normal text-left justify-between py-3" onClick={() => pickFirm(f.id)}>
                    <span>{f.name}</span>
                    <span className="text-[12px] text-tx-3">{f.plans.length} planes</span>
                  </button>
                ))}
              </div>
              {firms.length === 0 && <p className="mt-3 text-tx-3">Ninguna firma con ese nombre en los presets.</p>}
              <div className="mt-5 grid gap-2 border-t border-line pt-5 sm:grid-cols-2">
                <button className="btn h-auto !whitespace-normal text-left flex-col items-start py-3" onClick={() => pickOther("manual")}>
                  <span>Añadir firma a mano</span>
                  <span className="text-[12px] font-normal text-tx-3">Una cuenta de prop firm con sus reglas escritas por ti</span>
                </button>
                <button className="btn h-auto !whitespace-normal text-left flex-col items-start py-3" onClick={() => pickOther("personal")}>
                  <span>Cuenta personal</span>
                  <span className="text-[12px] font-normal text-tx-3">Tu propio dinero, con tus propios límites</span>
                </button>
              </div>
            </div>
          )}

          {step === 1 && mode === "firm" && firm && (
            <div>
              <h2 className="text-lg font-semibold">{firm.name} · plan y tamaño</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {firm.plans.map((p, i) => (
                  <button
                    key={p.name}
                    className={`btn btn-sm ${!custom && i === planIdx ? "btn-primary" : ""}`}
                    onClick={() => {
                      setPlanIdx(i);
                      setSizeIdx(null);
                      setCustom(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  className={`btn btn-sm ${custom ? "btn-primary" : ""}`}
                  onClick={() => {
                    setCustom(true);
                    setSizeIdx(null);
                    setPresetRules(null);
                    setRules(toForm());
                  }}
                >
                  Personalizado
                </button>
              </div>

              {!custom && plan && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {plan.sizes.map((s, i) => (
                    <button
                      key={s.size}
                      onClick={() => pickSize(i)}
                      className={`rounded-xl border p-4 text-left ${
                        sizeIdx === i ? "border-tx bg-raised" : "border-line hover:border-line-2"
                      }`}
                    >
                      <div className="num text-xl font-semibold">${s.size / 1000}K</div>
                      <dl className="mt-3 space-y-1 text-[13px] text-tx-2">
                        {s.rules.profitTarget != null && (
                          <div className="flex justify-between">
                            <dt>Objetivo</dt>
                            <dd className="num">{money(s.rules.profitTarget, { whole: true })}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt>Pérdida máx.</dt>
                          <dd className="num">{money(s.rules.maxLoss ?? 0, { whole: true })}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Drawdown</dt>
                          <dd>{DRAWDOWN_LABEL[s.rules.drawdownType ?? "static"]}</dd>
                        </div>
                      </dl>
                    </button>
                  ))}
                </div>
              )}
              {!custom && (
                <p className="mt-4 text-[12px] text-tx-3">
                  Valores de partida; las firmas los cambian. Compruébalos en la web de la firma — en el
                  siguiente paso puedes editar cada uno.
                </p>
              )}
            </div>
          )}

          {step === 1 && (mode !== "firm" || custom) && (
            <div className={custom ? "mt-5" : ""}>
              {!custom && (
                <h2 className="mb-4 text-lg font-semibold">
                  {mode === "personal" ? "Cuenta personal" : "Firma, tamaño y fase"}
                </h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {mode === "manual" && (
                  <Field label="Nombre de la firma">
                    <input className="input" value={firmName} onChange={(e) => setFirmName(e.target.value)} />
                  </Field>
                )}
                {mode !== "personal" && (
                  <Field label="Fase">
                    <select className="input" value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
                      <option value="evaluation">Evaluación</option>
                      <option value="funded">Fondeada</option>
                    </select>
                  </Field>
                )}
                {!(mode === "firm" && custom) && (
                  <Field label="Mercado" hint="Fija el inicio del día: 18:00 ET en futuros, 17:00 ET en CFD y Forex.">
                    <select className="input" value={market} onChange={(e) => setMarket(e.target.value as Market)}>
                      <option value="futures">Futuros</option>
                      <option value="cfd">CFD y Forex</option>
                    </select>
                  </Field>
                )}
                <Field label="Balance inicial ($)">
                  <input className="input num" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Reglas</h2>
                {edited ? (
                  <button className="btn btn-sm" onClick={() => setRules(presetRules!)}>
                    {edited} editadas · Restablecer
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-tx-3">Deja un campo vacío si la cuenta no tiene esa regla.</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {effPhase === "evaluation" && (
                  <>
                    <Field label="Objetivo de beneficio ($)">
                      <input className="input num" inputMode="decimal" value={rules.profitTarget} onChange={(e) => set("profitTarget", e.target.value)} />
                    </Field>
                    <Field label="Días mínimos de trading">
                      <input className="input num" inputMode="numeric" value={rules.minDays} onChange={(e) => set("minDays", e.target.value)} />
                    </Field>
                  </>
                )}
                <Field label="Pérdida máxima ($)">
                  <input className="input num" inputMode="decimal" value={rules.maxLoss} onChange={(e) => set("maxLoss", e.target.value)} />
                </Field>
                {effPhase !== "personal" && (
                  <Field label="Tipo de drawdown">
                    <select className="input" value={rules.drawdownType} onChange={(e) => set("drawdownType", e.target.value as DrawdownType)}>
                      <option value="static">Estático · el suelo no se mueve</option>
                      <option value="eod">Fin de día · sigue tus cierres de sesión</option>
                      <option value="intraday">Intradía · sigue tu máximo (estimación)</option>
                    </select>
                  </Field>
                )}
                {effPhase !== "personal" && rules.drawdownType !== "static" && (
                  <Field label="Nivel de bloqueo ($ sobre el balance inicial)" hint="Donde el suelo deja de subir. Vacío = nunca se bloquea.">
                    <input className="input num" inputMode="decimal" value={rules.lockLevel} onChange={(e) => set("lockLevel", e.target.value)} />
                  </Field>
                )}
                <Field label="Pérdida diaria ($)">
                  <input className="input num" inputMode="decimal" value={rules.dailyLoss} onChange={(e) => set("dailyLoss", e.target.value)} />
                </Field>
                {effPhase !== "personal" && (
                  <Field label="Al alcanzar la pérdida diaria">
                    <select className="input" value={rules.dailyLossMode} onChange={(e) => set("dailyLossMode", e.target.value as "soft" | "hard")}>
                      <option value="soft">Pausa hasta la próxima sesión</option>
                      <option value="hard">La cuenta falla</option>
                    </select>
                  </Field>
                )}
                <Field label="Tamaño máximo (contratos o lotes)">
                  <input className="input num" inputMode="numeric" value={rules.maxContracts} onChange={(e) => set("maxContracts", e.target.value)} />
                </Field>
                {effPhase !== "personal" && (
                  <>
                    <Field label="Consistencia (% máximo del mejor día)">
                      <input className="input num" inputMode="numeric" value={rules.consistencyPct} onChange={(e) => set("consistencyPct", e.target.value)} />
                    </Field>
                    <Field label="El mejor día se mide contra">
                      <select className="input" value={rules.consistencyBasis} onChange={(e) => set("consistencyBasis", e.target.value as "total" | "target")}>
                        <option value="total">El beneficio total</option>
                        <option value="target">El objetivo de beneficio</option>
                      </select>
                    </Field>
                  </>
                )}
                {effPhase === "funded" && (
                  <>
                    <Field label="Días por payout">
                      <input className="input num" inputMode="numeric" value={rules.payoutDays} onChange={(e) => set("payoutDays", e.target.value)} />
                    </Field>
                    <Field label="Beneficio mínimo por día ($)" hint="Vacío = cuenta cualquier día en positivo.">
                      <input className="input num" inputMode="decimal" value={rules.minProfitPerDay} onChange={(e) => set("minProfitPerDay", e.target.value)} />
                    </Field>
                  </>
                )}
              </div>

              {effPhase === "funded" && (
                <div className="mt-4 space-y-2">
                  {rules.drawdownType !== "static" && (
                    <Check checked={rules.payoutLocksFloor} onChange={(v) => set("payoutLocksFloor", v)}>
                      El primer payout lleva el suelo al nivel de bloqueo
                    </Check>
                  )}
                  <Check checked={rules.payoutsLowerBalance} onChange={(v) => set("payoutsLowerBalance", v)}>
                    Los payouts bajan el balance con el que se mide el drawdown
                  </Check>
                  <Check checked={rules.consistencySinceLastPayout} onChange={(v) => set("consistencySinceLastPayout", v)}>
                    La consistencia se reinicia tras cada payout
                  </Check>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold">Detalles</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Número de cuenta · opcional">
                  <input className="input num" value={number} onChange={(e) => setNumber(e.target.value)} />
                </Field>
                {mode !== "personal" && (
                  <>
                    <Field label="¿Cuántas cuentas iguales?" hint="Hasta 20. Se nombran #1, #2…">
                      <input className="input num" inputMode="numeric" value={howMany} onChange={(e) => setHowMany(e.target.value)} />
                    </Field>
                    <Field label="Comisión pagada por cuenta ($) · opcional" hint="Se registra como coste de la cuenta.">
                      <input className="input num" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
                    </Field>
                  </>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button className={`btn btn-sm ${!already ? "btn-primary" : ""}`} onClick={() => setAlready(false)}>
                  Cuenta nueva
                </button>
                <button className={`btn btn-sm ${already ? "btn-primary" : ""}`} onClick={() => setAlready(true)}>
                  Ya la estoy operando
                </button>
              </div>
              {already && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label="Balance actual ($)">
                    <input className="input num" inputMode="decimal" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} />
                  </Field>
                  <Field label="Suelo actual de pérdida máx. ($)" hint="El que muestra tu firma. Vacío = estimación.">
                    <input className="input num" inputMode="decimal" value={currentFloor} onChange={(e) => setCurrentFloor(e.target.value)} />
                  </Field>
                  <Field label="Días ya operados">
                    <input className="input num" inputMode="numeric" value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} />
                  </Field>
                </div>
              )}
              {already && (
                <p className="mt-3 text-[12px] text-tx-3">
                  Si vas a importar trades antiguos que ya incluyen ese beneficio, elige «Cuenta nueva» para no
                  contarlo dos veces.
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-bad">{error}</p>}

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            {step === 0 ? (
              <Link href="/accounts" className="btn">
                Cancelar
              </Link>
            ) : (
              <button className="btn" onClick={() => { setError(null); setStep((s) => s - 1); }}>
                Atrás
              </button>
            )}
            {step > 0 && step < 3 && (
              <button className="btn btn-primary" onClick={next}>
                Continuar
              </button>
            )}
            {step === 3 && (
              <button className="btn btn-primary" onClick={submit} disabled={pending}>
                {pending ? "Creando…" : "Crear cuenta"}
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="card h-fit p-4">
        <div className="text-[12px] text-tx-3">Vista previa</div>
        <div className="mt-2 font-medium">{name || "Cuenta nueva"}</div>
        <div className="text-[13px] text-tx-3">
          {mode === "personal" ? "Cuenta personal" : [firmLabel, planLabel].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="num mt-3 text-2xl font-semibold">{startCents > 0 ? money(startCents, { whole: true }) : "—"}</div>
        {step >= 1 && (
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
            {(
              [
                ["Fase", PHASE_LABEL[effPhase]],
                ["Mercado", effMarket === "futures" ? "Futuros" : "CFD y Forex"],
                ["Objetivo", built.profitTarget ? money(built.profitTarget, { whole: true }) : null],
                ["Pérdida máxima", built.maxLoss ? `${money(built.maxLoss, { whole: true })} · ${DRAWDOWN_LABEL[built.drawdownType ?? "static"]}` : null],
                ["Pérdida diaria", built.dailyLoss ? money(built.dailyLoss, { whole: true }) : null],
                ["Consistencia", built.consistencyPct ? `${built.consistencyPct}%` : null],
                ["Días por payout", built.payoutDays ? String(built.payoutDays) : null],
              ] as [string, string | null][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-tx-3">{k}</dt>
                  <dd className="text-right text-tx-2">{v}</dd>
                </div>
              ))}
          </dl>
        )}
      </aside>
    </div>
  );
}
