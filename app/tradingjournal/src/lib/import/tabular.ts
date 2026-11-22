import { unzipSync, strFromU8 } from "fflate";

export type Table = string[][];

/** Decode a text file, honouring UTF-16 (MT5 reports) and UTF-8 byte-order marks. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  // UTF-16 without a BOM: every other byte of ASCII text is zero.
  if (bytes.length > 4 && bytes[1] === 0 && bytes[3] === 0) return new TextDecoder("utf-16le").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function unescape(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => unescape(s.replace(/<[^>]*>/g, "")).replace(/[ \s]+/g, " ").trim();

/** Every <tr> of an HTML document as a row of cell texts. Hidden cells are dropped. */
export function htmlRows(html: string): Table {
  const rows: Table = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const c of tr[1].matchAll(/<(t[dh])\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      if (/class\s*=\s*["']?[^"'>]*\bhidden\b/i.test(c[2])) continue;
      cells.push(clean(c[3]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** CSV with quoted fields. The delimiter is the most frequent of , ; tab in the first line. */
export function csvRows(text: string): Table {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const delim = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );
  const rows: Table = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** First worksheet of an .xlsx file as rows of cell texts (numbers stay as written). */
export function xlsxRows(bytes: Uint8Array): Table {
  const files = unzipSync(bytes);
  const shared: string[] = [];
  const ss = files["xl/sharedStrings.xml"];
  if (ss) {
    for (const si of strFromU8(ss).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      shared.push(unescape([...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
    }
  }
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  if (!sheetName) return [];
  const rows: Table = [];
  for (const r of strFromU8(files[sheetName]).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+\d+)"/.exec(c[1])?.[1];
      const type = /\bt="(\w+)"/.exec(c[1])?.[1];
      const inner = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
      let text = v;
      if (type === "s") text = shared[Number(v)] ?? "";
      else if (type === "inlineStr") text = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push("");
      row[i] = unescape(text).trim();
    }
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
}

/** "1 234.56", "1,234.56", "1.234,56", "0.10 Lots", "−12.5" → number. */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[−–]/g, "-").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1) {
    // A lone comma is a decimal separator unless it groups thousands ("1,234").
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface WallTime { y: number; mo: number; d: number; h: number; mi: number; s: number }

/**
 * A date-time as written in a file, with no time zone: "2026.11.04 09:10:00",
 * "2026-11-04T09:10", "04/11/2026 09:10:00.123", or an Excel serial number.
 */
export function parseWallTime(raw: string, monthFirst = false): WallTime | null {
  const s = raw.trim();
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const ms = Math.round((Number(s) - 25569) * 86400_000);
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  let m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    const mf = a > 12 ? false : b > 12 ? true : monthFirst;
    return { y: +m[3], mo: mf ? a : b, d: mf ? b : a, h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  }
  return null;
}
