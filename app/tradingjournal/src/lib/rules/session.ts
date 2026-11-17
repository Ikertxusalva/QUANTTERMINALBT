import type { Market } from "./types.ts";

const nyFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock time in New York, expressed as a UTC Date (for date math only). */
export function nyWallClock(d: Date): Date {
  const p: Record<string, number> = {};
  for (const part of nyFormat.formatToParts(d)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The trading session a moment belongs to, named for the day it ends.
 * Futures: 6pm ET → 5pm ET. CFD & Forex: 5pm ET → 5pm ET.
 * Futures have no weekend session: Friday evening to Sunday evening counts toward Monday.
 */
export function sessionDateOf(d: Date, market: Market): string {
  const ny = nyWallClock(d);
  const shifted = new Date(ny.getTime() + (market === "futures" ? 6 : 7) * 3600_000);
  if (market === "futures") {
    const dow = shifted.getUTCDay();
    if (dow === 6) shifted.setUTCDate(shifted.getUTCDate() + 2);
    else if (dow === 0) shifted.setUTCDate(shifted.getUTCDate() + 1);
  }
  return iso(shifted);
}

/** New York calendar date of a moment. */
export function nyDateOf(d: Date): string {
  return iso(nyWallClock(d));
}

/**
 * Convert a New York wall-clock time ("YYYY-MM-DDTHH:mm") to a real Date.
 */
export function fromNyLocal(local: string): Date {
  const [datePart, timePart = "00:00"] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset between the guess read as UTC and what New York shows for it.
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const diff = nyWallClock(new Date(t)).getTime() - t;
    t = guess - diff;
  }
  return new Date(t);
}

/** "YYYY-MM-DDTHH:mm" in New York for a Date (for datetime-local inputs). */
export function toNyLocal(d: Date): string {
  return nyWallClock(d).toISOString().slice(0, 16);
}
