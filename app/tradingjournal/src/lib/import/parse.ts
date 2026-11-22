import { fromNyLocal } from "../rules/session.ts";
import {
  csvRows, decodeText, htmlRows, parseNumber, parseWallTime, xlsxRows,
  type Table, type WallTime,
} from "./tabular.ts";

/** How the times written in a file map to real time. */
export type TimeBase =
  /** Broker server clock that reads N hours ahead of New York (MT5 default: 7). */
  | { kind: "ny"; plusHours: number }
  /** Fixed offset from UTC, in minutes. */
  | { kind: "utc"; offsetMin: number };

export interface ParsedTrade {
  externalId: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  /** Cents. Result before commission and swap. */
  gross: number;
  /** Cents, positive = cost. */
  fees: number;
  /** Cents, signed. */
  swap: number;
  openedAt: Date | null;
  closedAt: Date;
  entryPrice: number | null;
  exitPrice: number | null;
}

export interface ParseResult {
  source: "mt5" | "ctrader" | "csv";
  trades: ParsedTrade[];
  /** Rows that could not be read, with the reason. */
  skipped: string[];
  /** UTC offset found in the file's own headers, if any. */
  detectedOffsetMin: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toDate(w: WallTime, base: TimeBase): Date {
  if (base.kind === "utc") {
    return new Date(Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - base.offsetMin * 60_000);
  }
  const ny = new Date(Date.UTC(w.y, w.mo - 1, w.d, w.h - base.plusHours, w.mi, w.s));
  const local = `${ny.getUTCFullYear()}-${pad(ny.getUTCMonth() + 1)}-${pad(ny.getUTCDate())}T${pad(ny.getUTCHours())}:${pad(ny.getUTCMinutes())}`;
  return new Date(fromNyLocal(local).getTime() + w.s * 1000);
}

const cents = (n: number) => Math.round(n * 100);
const isDate = (s: string) => /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(s);

// ---------------------------------------------------------------------- MT5

/**
 * MT5 History report (History → Report → HTML). One closed position per row of the
 * "Positions" table: open time, position, symbol, type, volume, open price, S/L, T/P,
 * close time, close price, commission, swap, profit.
 */
export function parseMt5(rows: Table, base: TimeBase): ParseResult {
  const trades: ParsedTrade[] = [];
  const skipped: string[] = [];
  let inPositions = false;
  for (const r of rows) {
    if (r.length === 1) {
      inPositions = /^(positions|posiciones)$/i.test(r[0]);
      continue;
    }
    if (!inPositions || r.length < 13 || !isDate(r[0])) continue;
    const [open, id, symbol, type, vol, openPrice, , , close, closePrice, commission, swap, profit] = r;
    const o = parseWallTime(open), c = parseWallTime(close);
    const p = parseNumber(profit), q = parseNumber(vol);
    if (!o || !c || p == null || q == null || !/^(buy|sell)$/i.test(type)) {
      skipped.push(`Posición ${id || "?"} (${symbol || "?"}): no se pudo leer`);
      continue;
    }
    const com = parseNumber(commission) ?? 0;
    trades.push({
      externalId: `mt5:${id}`,
      symbol: symbol.toUpperCase(),
      side: type.toLowerCase() === "buy" ? "long" : "short",
      qty: q,
      gross: cents(p),
      fees: cents(-com),
      swap: cents(parseNumber(swap) ?? 0),
      openedAt: toDate(o, base),
      closedAt: toDate(c, base),
      entryPrice: parseNumber(openPrice),
      exitPrice: parseNumber(closePrice),
    });
  }
  return { source: "mt5", trades, skipped, detectedOffsetMin: null };
}

// ------------------------------------------------- cTrader and generic tables

const ALIASES: Record<string, RegExp> = {
  id: /^(id|position id|order id|deal id|ticket|trade id|posición)$/i,
  symbol: /^(symbol|símbolo|simbolo|instrument|instrumento|market)$/i,
  side: /^(opening direction|direction|side|type|tipo|dirección|direccion|lado)$/i,
  openTime: /^(opening time|open time|entry time|time opened|fecha de apertura|apertura)/i,
  closeTime: /^(closing time|close time|exit time|time closed|fecha de cierre|cierre|time|date)/i,
  entry: /^(entry price|open price|opening price|precio de entrada|entrada)$/i,
  exit: /^(closing price|close price|exit price|precio de cierre|salida)$/i,
  qty: /^(closing quantity|quantity|volume|lots|size|qty|cantidad|volumen|lotes|closing volume)$/i,
  gross: /^(gross profit|gross|gross \S+|profit|beneficio|p&l|pnl|resultado)$/i,
  commission: /^(commissions?|comisión|comision|comisiones|fees?)$/i,
  swap: /^(swap|swaps)$/i,
  net: /^(net|net \S+|net profit|neto)$/i,
};

function mapHeader(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    const name = h.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
    for (const [key, re] of Object.entries(ALIASES)) {
      if (map[key] == null && re.test(name)) { map[key] = i; break; }
    }
  });
  return map;
}

/** "(UTC+1)", "(UTC-05:00)" in a header → minutes. */
function headerOffset(header: string[]): number | null {
  for (const h of header) {
    const m = /UTC\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?/i.exec(h);
    if (m) return (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
    if (/\(UTC\)/i.test(h)) return 0;
  }
  return null;
}

/**
 * Any table with a header row naming at least a symbol, a closing time and a result.
 * Covers cTrader's History export (Excel, HTML or CSV) and generic CSV files.
 */
export function parseTable(rows: Table, base: TimeBase): ParseResult {
  let headerAt = -1;
  let cols: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const m = mapHeader(rows[i]);
    if (m.symbol != null && m.closeTime != null && (m.net != null || m.gross != null)) {
      headerAt = i; cols = m; break;
    }
  }
  if (headerAt === -1) {
    return { source: "csv", trades: [], skipped: ["No se encontró una fila de cabecera con símbolo, hora de cierre y resultado."], detectedOffsetMin: null };
  }
  const header = rows[headerAt];
  const detected = headerOffset(header);
  const tb: TimeBase = detected != null ? { kind: "utc", offsetMin: detected } : base;
  const isCtrader = header.some((h) => /opening direction|closing quantity/i.test(h));
  const get = (r: string[], k: string) => (cols[k] != null ? (r[cols[k]] ?? "") : "");
  const trades: ParsedTrade[] = [];
  const skipped: string[] = [];

  rows.slice(headerAt + 1).forEach((r, idx) => {
    const symbol = get(r, "symbol");
    const c = parseWallTime(get(r, "closeTime"));
    if (!symbol || !c) return; // totals and blank lines
    const line = headerAt + idx + 2;
    const com = parseNumber(get(r, "commission")) ?? 0;
    const swap = parseNumber(get(r, "swap")) ?? 0;
    const netV = parseNumber(get(r, "net"));
    let gross = parseNumber(get(r, "gross"));
    // Commission is written as a negative number or as a positive cost, depending on the platform.
    const fee = Math.abs(com);
    if (gross == null && netV != null) gross = netV + fee - swap;
    if (gross == null) { skipped.push(`Línea ${line} (${symbol}): sin resultado`); return; }
    const sideRaw = get(r, "side").toLowerCase();
    const side = /sell|short|venta|corto/.test(sideRaw) ? "short" : "long";
    const o = parseWallTime(get(r, "openTime"));
    const closedAt = toDate(c, tb);
    const id = get(r, "id") || `${symbol}|${closedAt.toISOString()}|${gross}`;
    trades.push({
      externalId: `${isCtrader ? "ctrader" : "csv"}:${id}`,
      symbol: symbol.toUpperCase(),
      side,
      qty: parseNumber(get(r, "qty")) ?? 1,
      gross: cents(gross),
      fees: cents(fee),
      swap: cents(swap),
      openedAt: o ? toDate(o, tb) : null,
      closedAt,
      entryPrice: parseNumber(get(r, "entry")),
      exitPrice: parseNumber(get(r, "exit")),
    });
  });
  return { source: isCtrader ? "ctrader" : "csv", trades, skipped, detectedOffsetMin: detected };
}

// ------------------------------------------------------------------- entry

/** Read a file of any supported kind and pick the right parser from its contents. */
export function parseFile(bytes: Uint8Array, base: TimeBase): ParseResult {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return parseTable(xlsxRows(bytes), base);
  const text = decodeText(bytes);
  if (/<table|<tr\b/i.test(text)) {
    const rows = htmlRows(text);
    const mt5 = rows.some((r) => r.length === 1 && /^(positions|posiciones)$/i.test(r[0]));
    return mt5 ? parseMt5(rows, base) : parseTable(rows, base);
  }
  return parseTable(csvRows(text), base);
}
