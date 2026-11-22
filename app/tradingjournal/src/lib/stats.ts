import { nyWallClock } from "./rules/session.ts";

/** A trade as the stats see it. Money in cents. */
export interface STrade {
  id: number;
  net: number;
  risk: number | null;
  openedAt: Date | null;
  closedAt: Date;
  /** Session day YYYY-MM-DD the trade counts on. */
  day: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  session: string | null;
  strategy: string | null;
  feelings: string[];
  mistake: string | null;
  planFollowed: "yes" | "partly" | "no" | null;
  /** Rule ids broken; null = rules not recorded on this trade. */
  rulesBroken: number[] | null;
}

export type Outcome = "win" | "loss" | "be";

/** Win above the breakeven band, loss below minus the band, breakeven otherwise. */
export function outcome(net: number, band = 0): Outcome {
  return net > band ? "win" : net < -band ? "loss" : "be";
}

const byClose = (a: STrade, b: STrade) => a.closedAt.getTime() - b.closedAt.getTime() || a.id - b.id;

export interface Metrics {
  n: number;
  wins: number;
  losses: number;
  breakevens: number;
  net: number;
  won: number;
  lost: number;
  /** null when there are no wins and losses. */
  winRate: number | null;
  /** null with no losing trades. */
  profitFactor: number | null;
  expectancy: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  /** Average R of every trade with a risk amount. */
  rPerTrade: number | null;
  rCount: number;
  totalR: number;
  /** Average R of winners only (shown as 1:X). */
  avgRR: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  winStreak: number;
  lossStreak: number;
  /** Minutes; only trades with an open time. */
  avgHold: number | null;
}

export function metrics(input: STrade[], band = 0): Metrics {
  const trades = [...input].sort(byClose);
  let wins = 0, losses = 0, be = 0, won = 0, lost = 0, net = 0;
  let rSum = 0, rN = 0, rWinSum = 0, rWinN = 0;
  let largestWin: number | null = null, largestLoss: number | null = null;
  let ws = 0, ls = 0, winStreak = 0, lossStreak = 0;
  let holdSum = 0, holdN = 0;
  for (const t of trades) {
    const o = outcome(t.net, band);
    net += t.net;
    if (o === "win") {
      wins++; won += t.net; ws++; ls = 0;
      if (largestWin == null || t.net > largestWin) largestWin = t.net;
    } else if (o === "loss") {
      losses++; lost += -t.net; ls++; ws = 0;
      if (largestLoss == null || t.net < largestLoss) largestLoss = t.net;
    } else {
      be++; ws = 0; ls = 0;
    }
    winStreak = Math.max(winStreak, ws);
    lossStreak = Math.max(lossStreak, ls);
    if (t.risk && t.risk > 0) {
      const r = t.net / t.risk;
      rSum += r; rN++;
      if (o === "win") { rWinSum += r; rWinN++; }
    }
    if (t.openedAt) {
      holdSum += (t.closedAt.getTime() - t.openedAt.getTime()) / 60000;
      holdN++;
    }
  }
  return {
    n: trades.length, wins, losses, breakevens: be, net, won, lost,
    winRate: wins + losses ? wins / (wins + losses) : null,
    profitFactor: lost > 0 ? won / lost : null,
    expectancy: trades.length ? net / trades.length : null,
    avgWin: wins ? won / wins : null,
    avgLoss: losses ? -lost / losses : null,
    rPerTrade: rN ? rSum / rN : null,
    rCount: rN,
    totalR: rSum,
    avgRR: rWinN ? rWinSum / rWinN : null,
    largestWin, largestLoss, winStreak, lossStreak,
    avgHold: holdN ? holdSum / holdN : null,
  };
}

// ------------------------------------------------------------------ equity

export interface Equity {
  /** Running P&L after each trade, starting from 0. */
  points: number[];
  /** Distance below the last high after each trade (≤ 0). */
  underwater: number[];
  maxDrawdown: number;
  currentDrawdown: number;
}

export function equity(input: STrade[]): Equity {
  const trades = [...input].sort(byClose);
  const points: number[] = [];
  const underwater: number[] = [];
  let run = 0, high = 0, maxDd = 0;
  for (const t of trades) {
    run += t.net;
    high = Math.max(high, run);
    points.push(run);
    underwater.push(run - high);
    maxDd = Math.max(maxDd, high - run);
  }
  return { points, underwater, maxDrawdown: maxDd, currentDrawdown: high - run };
}

// -------------------------------------------------------------------- days

export interface DayStat {
  date: string;
  net: number;
  trades: number;
  wins: number;
  losses: number;
}

export function dayStats(trades: STrade[], band = 0): DayStat[] {
  const map = new Map<string, DayStat>();
  for (const t of trades) {
    const d = map.get(t.day) ?? { date: t.day, net: 0, trades: 0, wins: 0, losses: 0 };
    d.net += t.net;
    d.trades++;
    const o = outcome(t.net, band);
    if (o === "win") d.wins++;
    else if (o === "loss") d.losses++;
    map.set(t.day, d);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function daySummary(days: DayStat[], band = 0) {
  const green = days.filter((d) => d.net > band);
  const red = days.filter((d) => d.net < -band);
  let g = 0, r = 0, greenStreak = 0, redStreak = 0;
  for (const d of days) {
    if (d.net > band) { g++; r = 0; } else if (d.net < -band) { r++; g = 0; } else { g = 0; r = 0; }
    greenStreak = Math.max(greenStreak, g);
    redStreak = Math.max(redStreak, r);
  }
  const avg = (a: DayStat[]) => (a.length ? a.reduce((s, d) => s + d.net, 0) / a.length : null);
  return {
    days: days.length, green: green.length, red: red.length,
    avgGreen: avg(green), avgRed: avg(red), greenStreak, redStreak,
    best: days.reduce<DayStat | null>((m, d) => (!m || d.net > m.net ? d : m), null),
  };
}

// ---------------------------------------------------------------- calendar

export interface CalendarWeek {
  days: { date: string; inMonth: boolean; stat: DayStat | null }[];
  net: number;
  traded: number;
  green: number;
}

/** Monday-first weeks covering a month ("YYYY-MM"). */
export function monthGrid(month: string, days: DayStat[], band = 0): CalendarWeek[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks: CalendarWeek[] = [];
  const cur = new Date(start);
  while (cur.getUTCFullYear() < y || (cur.getUTCFullYear() === y && cur.getUTCMonth() <= m - 1)) {
    const week: CalendarWeek = { days: [], net: 0, traded: 0, green: 0 };
    for (let i = 0; i < 7; i++) {
      const date = cur.toISOString().slice(0, 10);
      const inMonth = cur.getUTCMonth() === m - 1;
      const stat = inMonth ? (byDate.get(date) ?? null) : null;
      if (stat) {
        week.net += stat.net;
        week.traded++;
        if (stat.net > band) week.green++;
      }
      week.days.push({ date, inMonth, stat });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ------------------------------------------------------------------ groups

export type GroupKey =
  | "day" | "session" | "time" | "symbol" | "strategy" | "frequency"
  | "hold" | "size" | "month" | "side" | "feeling" | "mistake";

export const GROUP_LABEL: Record<GroupKey, string> = {
  day: "Día", session: "Sesión", time: "Hora", symbol: "Símbolo", strategy: "Estrategia",
  frequency: "Frecuencia", hold: "Duración", size: "Tamaño", month: "Mes", side: "Lado",
  feeling: "Sensación", mistake: "Error",
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
/** New York hour the trade was entered (its close when no open time is known). */
export const entryHour = (t: STrade) => nyWallClock(t.openedAt ?? t.closedAt).getUTCHours();

interface Keyed { label: string; order: number }

function keysOf(t: STrade, key: GroupKey, perDay: Map<string, number>): Keyed[] {
  switch (key) {
    case "day": { const d = weekdayOf(t.day); return [{ label: WEEKDAYS[d], order: (d + 6) % 7 }]; }
    case "session": return [{ label: t.session ?? "Sin asignar", order: t.session ? 0 : 1 }];
    case "time": { const h = entryHour(t); return [{ label: `${String(h).padStart(2, "0")}:00`, order: h }]; }
    case "symbol": return [{ label: t.symbol, order: 0 }];
    case "strategy": return [{ label: t.strategy ?? "Sin estrategia", order: t.strategy ? 0 : 1 }];
    case "frequency": {
      const n = perDay.get(t.day) ?? 0;
      return [n <= 2 ? { label: "1-2 trades/día", order: 0 } : n <= 4 ? { label: "3-4 trades/día", order: 1 } : { label: "5+ trades/día", order: 2 }];
    }
    case "hold": {
      if (!t.openedAt) return [];
      const min = (t.closedAt.getTime() - t.openedAt.getTime()) / 60000;
      return [min < 5 ? { label: "Menos de 5 min", order: 0 } : min < 15 ? { label: "5–15 min", order: 1 } : min <= 60 ? { label: "15–60 min", order: 2 } : { label: "Más de 60 min", order: 3 }];
    }
    case "size": return [{ label: String(t.qty), order: t.qty }];
    case "month": return [{ label: t.day.slice(0, 7), order: Number(t.day.slice(0, 7).replace("-", "")) }];
    case "side": return [t.side === "long" ? { label: "Largo", order: 0 } : { label: "Corto", order: 1 }];
    case "feeling": return t.feelings.length ? t.feelings.map((f) => ({ label: f, order: 0 })) : [{ label: "Sin etiquetar", order: 1 }];
    case "mistake": return [{ label: t.mistake ?? "Sin etiquetar", order: t.mistake ? 0 : 1 }];
  }
}

export interface GroupRow extends Metrics {
  label: string;
  order: number;
  ids: number[];
  /** Fewer than 10 trades: real numbers, too few to lean on. */
  small: boolean;
}

export function groupBy(trades: STrade[], key: GroupKey, band = 0): GroupRow[] {
  const perDay = new Map<string, number>();
  for (const t of trades) perDay.set(t.day, (perDay.get(t.day) ?? 0) + 1);
  const buckets = new Map<string, { order: number; items: STrade[] }>();
  for (const t of trades) {
    for (const k of keysOf(t, key, perDay)) {
      const b = buckets.get(k.label) ?? { order: k.order, items: [] };
      b.items.push(t);
      buckets.set(k.label, b);
    }
  }
  const ordered = key === "symbol" || key === "strategy" || key === "feeling" || key === "mistake" || key === "session";
  return [...buckets.entries()]
    .map(([label, b]) => ({ label, order: b.order, ids: b.items.map((t) => t.id), small: b.items.length < 10, ...metrics(b.items, band) }))
    .sort((a, b) => a.order - b.order || (ordered ? b.net - a.net : 0) || a.label.localeCompare(b.label));
}

// ----------------------------------------------------------------- heatmap

export interface HeatCell { weekday: number; hour: number; net: number; n: number }

/** Net by weekday × entry hour (New York). */
export function heatmap(trades: STrade[]): HeatCell[] {
  const map = new Map<string, HeatCell>();
  for (const t of trades) {
    const weekday = weekdayOf(t.day), hour = entryHour(t);
    const k = `${weekday}-${hour}`;
    const c = map.get(k) ?? { weekday, hour, net: 0, n: 0 };
    c.net += t.net; c.n++;
    map.set(k, c);
  }
  return [...map.values()];
}

// ---------------------------------------------------------- R distribution

export function rDistribution(trades: STrade[]): { label: string; n: number; positive: boolean }[] {
  const edges = [-2, -1, -0.5, 0, 0.5, 1, 2, 3];
  const labels = ["< −2R", "−2 a −1R", "−1 a −0.5R", "−0.5 a 0R", "0 a 0.5R", "0.5 a 1R", "1 a 2R", "2 a 3R", "> 3R"];
  const out = labels.map((label, i) => ({ label, n: 0, positive: i >= 4 }));
  for (const t of trades) {
    if (!t.risk || t.risk <= 0) continue;
    const r = t.net / t.risk;
    let i = edges.findIndex((e) => r < e);
    if (i === -1) i = edges.length;
    out[i].n++;
  }
  return out;
}

// -------------------------------------------------------------- discipline

export interface Discipline {
  followed: Metrics;
  broke: Metrics;
  /** Win-rate gap in percentage points; null until both sides have 10 trades. */
  gapPp: number | null;
  /** What the rule-breaking trades made, compared with the same count at the followed average. */
  cost: number | null;
}

export function discipline(trades: STrade[], band = 0): Discipline {
  const checked = trades.filter((t) => t.rulesBroken != null);
  const followed = metrics(checked.filter((t) => t.rulesBroken!.length === 0), band);
  const broke = metrics(checked.filter((t) => t.rulesBroken!.length > 0), band);
  const enough = followed.n >= 10 && broke.n >= 10 && followed.winRate != null && broke.winRate != null;
  return {
    followed, broke,
    gapPp: enough ? Math.round((followed.winRate! - broke.winRate!) * 1000) / 10 : null,
    cost: broke.n && followed.expectancy != null ? broke.net - followed.expectancy * broke.n : broke.n ? broke.net : null,
  };
}

// ---------------------------------------------------------------- insights

export interface Insight {
  title: string;
  n: number;
  otherN: number;
  avg: number;
  otherAvg: number;
  winRate: number | null;
  otherWinRate: number | null;
  /** (group avg − other avg) × group size. */
  impact: number;
  early: boolean;
  ids: number[];
}

/**
 * Compare groups of trades with the rest. One appears only when both sides have 10 trades and
 * the gap is clear: 25% of the average trade size, or 10 points of win rate.
 */
export function insights(input: STrade[], band = 0): Insight[] {
  const trades = [...input].sort(byClose);
  if (trades.length < 20) return [];
  const avgSize = trades.reduce((s, t) => s + Math.abs(t.net), 0) / trades.length;
  const nthOfDay = new Map<number, number>();
  const prevLosses = new Map<number, number>();
  const prevWin = new Set<number>();
  const count = new Map<string, number>();
  let streak = 0, lastWin = false;
  for (const t of trades) {
    const n = (count.get(t.day) ?? 0) + 1;
    count.set(t.day, n);
    nthOfDay.set(t.id, n);
    prevLosses.set(t.id, streak);
    if (lastWin) prevWin.add(t.id);
    const o = outcome(t.net, band);
    streak = o === "loss" ? streak + 1 : 0;
    lastWin = o === "win";
  }
  const tests: [string, (t: STrade) => boolean][] = [
    ["Después de una pérdida", (t) => prevLosses.get(t.id)! >= 1],
    ["Después de dos pérdidas seguidas", (t) => prevLosses.get(t.id)! >= 2],
    ["Después de una ganancia", (t) => prevWin.has(t.id)],
    ["El primer trade del día", (t) => nthOfDay.get(t.id) === 1],
    ["A partir del tercer trade del día", (t) => nthOfDay.get(t.id)! >= 3],
    ["Trades en largo", (t) => t.side === "long"],
    ["Trades en corto", (t) => t.side === "short"],
    ["Trades fuera de plan", (t) => t.planFollowed === "no"],
    ...WEEKDAYS.map((w, i): [string, (t: STrade) => boolean] => [`Los ${w.toLowerCase()}`, (t) => weekdayOf(t.day) === i]),
    ...[...new Set(trades.map((t) => t.symbol))].map((s): [string, (t: STrade) => boolean] => [`En ${s}`, (t) => t.symbol === s]),
  ];
  const out: Insight[] = [];
  for (const [title, test] of tests) {
    const a = trades.filter(test), b = trades.filter((t) => !test(t));
    if (a.length < 10 || b.length < 10) continue;
    const ma = metrics(a, band), mb = metrics(b, band);
    const gap = ma.expectancy! - mb.expectancy!;
    const wrGap = ma.winRate != null && mb.winRate != null ? Math.abs(ma.winRate - mb.winRate) : 0;
    if (Math.abs(gap) < 0.25 * avgSize && wrGap < 0.1) continue;
    out.push({
      title, n: a.length, otherN: b.length, avg: ma.expectancy!, otherAvg: mb.expectancy!,
      winRate: ma.winRate, otherWinRate: mb.winRate, impact: gap * a.length,
      early: a.length < 20 || b.length < 20, ids: a.map((t) => t.id),
    });
  }
  return out.sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact));
}
