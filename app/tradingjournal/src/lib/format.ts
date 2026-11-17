/** Cents → "$1,234.56" (or "−$1,234.56"). */
export function money(cents: number, opts: { sign?: boolean; whole?: boolean } = {}): string {
  const abs = Math.abs(cents) / 100;
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: opts.whole ? 0 : 2,
    maximumFractionDigits: opts.whole ? 0 : 2,
  });
  const sign = cents < 0 ? "−" : opts.sign && cents > 0 ? "+" : "";
  return `${sign}$${s}`;
}

/** "1234.5" or "1,234.50" → cents. Empty or invalid → null. */
export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$,\s]/g, "").replace("−", "-");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function pnlClass(cents: number): string {
  return cents > 0 ? "text-up" : cents < 0 ? "text-down" : "text-tx-2";
}

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  timeZone: "America/New_York",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export function nyDateTime(d: Date): string {
  return `${dateFmt.format(d)} ET`;
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
