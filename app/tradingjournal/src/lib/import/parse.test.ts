import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFile, toDate } from "./parse.ts";
import { csvRows, parseNumber, parseWallTime } from "./tabular.ts";

const enc = (s: string) => new TextEncoder().encode(s);

function utf16(s: string): Uint8Array {
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xff; out[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    out[2 + i * 2] = s.charCodeAt(i) & 0xff;
    out[3 + i * 2] = s.charCodeAt(i) >> 8;
  }
  return out;
}

const MT5 = `<html><body><table>
<tr><th colspan="2">Name:</th><th colspan="12"><b>Trader</b></th></tr>
<tr align="center"><th colspan="14"><div><b>Positions</b></div></th></tr>
<tr bgcolor="#E5F0FC"><td><b>Time</b></td><td><b>Position</b></td><td><b>Symbol</b></td><td><b>Type</b></td><td><b>Volume</b></td><td><b>Price</b></td><td><b>S / L</b></td><td><b>T / P</b></td><td><b>Time</b></td><td><b>Price</b></td><td><b>Commission</b></td><td><b>Swap</b></td><td colspan="2"><b>Profit</b></td></tr>
<tr align="right"><td>2026.11.04 16:10:00</td><td>5001</td><td>EURUSD</td><td>buy</td><td class="hidden" colspan="8"></td><td>0.50</td><td>1.08500</td><td>1.08300</td><td></td><td>2026.11.04 16:45:30</td><td>1.08750</td><td>-3.50</td><td>0.00</td><td colspan="2">125.40</td></tr>
<tr align="right"><td>2026.11.05 10:00:00</td><td>5002</td><td>XAUUSD</td><td>sell</td><td class="hidden" colspan="8"></td><td>0.10</td><td>2650.10</td><td></td><td></td><td>2026.11.06 02:00:00</td><td>2655.30</td><td>-0.70</td><td>-2.15</td><td colspan="2">-1 052.00</td></tr>
<tr align="right"><td colspan="10"></td><td>-4.20</td><td>-2.15</td><td colspan="2">-926.60</td></tr>
<tr align="center"><th colspan="14"><div><b>Orders</b></div></th></tr>
<tr align="right"><td>2026.11.04 16:10:00</td><td>9001</td><td>EURUSD</td><td>buy</td><td>0.50 / 0.50</td><td>market</td><td></td><td></td><td>2026.11.04 16:10:00</td><td>filled</td><td></td><td></td><td>x</td></tr>
</table></body></html>`;

test("MT5 report: positions only, UTF-16, server time and signed costs", () => {
  const r = parseFile(utf16(MT5), { kind: "ny", plusHours: 7 });
  assert.equal(r.source, "mt5");
  assert.equal(r.trades.length, 2);
  const [a, b] = r.trades;
  assert.deepEqual(
    [a.externalId, a.symbol, a.side, a.qty, a.gross, a.fees, a.swap],
    ["mt5:5001", "EURUSD", "long", 0.5, 12540, 350, 0],
  );
  // Server 16:10 at New York +7 is 09:10 in New York, 14:10 UTC in November.
  assert.equal(a.openedAt!.toISOString(), "2026-11-04T14:10:00.000Z");
  assert.equal(a.closedAt.toISOString(), "2026-11-04T14:45:30.000Z");
  assert.deepEqual([b.side, b.gross, b.fees, b.swap], ["short", -105200, 70, -215]);
  assert.equal(a.entryPrice, 1.085);
});

const CTRADER = `ID,Order ID,Symbol,Opening Direction,Closing Direction,Opening Time (UTC+1),Closing Time (UTC+1),Entry Price,Closing Price,Closing Quantity,Gross USD,Commissions,Swap,Net USD,Balance USD
31001,7001,EURUSD,Buy,Sell,04/11/2026 15:10:00.000,04/11/2026 15:45:00.000,1.08500,1.08750,0.50 Lots,125.40,-7.00,-2.15,116.25,10116.25
31002,7002,US30,Sell,Buy,05/11/2026 16:00:00.000,05/11/2026 16:20:00.000,43100.5,43150.5,1.00 Lots,-50.00,-1.00,0.00,-51.00,10065.25
`;

test("cTrader export: offset from the header, day-first dates, lots", () => {
  const r = parseFile(enc(CTRADER), { kind: "utc", offsetMin: 0 });
  assert.equal(r.source, "ctrader");
  assert.equal(r.detectedOffsetMin, 60);
  assert.equal(r.trades.length, 2);
  const [a, b] = r.trades;
  assert.deepEqual(
    [a.externalId, a.symbol, a.side, a.qty, a.gross, a.fees, a.swap],
    ["ctrader:31001", "EURUSD", "long", 0.5, 12540, 700, -215],
  );
  assert.equal(a.gross - a.fees + a.swap, 11625);
  assert.equal(a.openedAt!.toISOString(), "2026-11-04T14:10:00.000Z");
  assert.deepEqual([b.side, b.gross - b.fees + b.swap], ["short", -5100]);
});

test("generic CSV: net only, semicolons and decimal commas", () => {
  const csv = "Symbol;Side;Close Time;Net;Commission\nNAS100;sell;2026-11-04 10:00:00;-12,50;1,50\nTotal;;;-12,50;\n";
  const r = parseFile(enc(csv), { kind: "ny", plusHours: 0 });
  assert.equal(r.source, "csv");
  assert.equal(r.trades.length, 1);
  assert.deepEqual([r.trades[0].gross, r.trades[0].fees, r.trades[0].side], [-1100, 150, "short"]);
  assert.equal(r.trades[0].closedAt.toISOString(), "2026-11-04T15:00:00.000Z");
  assert.equal(parseFile(enc("a,b\n1,2\n"), { kind: "utc", offsetMin: 0 }).trades.length, 0);
});

test("numbers, dates and quoted CSV cells", () => {
  assert.equal(parseNumber("-1 052.00"), -1052);
  assert.equal(parseNumber("1,234.56"), 1234.56);
  assert.equal(parseNumber("1.234,56"), 1234.56);
  assert.equal(parseNumber("1,234"), 1234);
  assert.equal(parseNumber("0,5"), 0.5);
  assert.equal(parseNumber("−12.5"), -12.5);
  assert.equal(parseNumber(""), null);
  assert.deepEqual(parseWallTime("13/11/2026 09:05"), { y: 2026, mo: 11, d: 13, h: 9, mi: 5, s: 0 });
  assert.equal(parseWallTime("11/13/2026 09:05")!.mo, 11);
  assert.deepEqual(csvRows('a,"b ""x"", c"\r\n1,2\r\n'), [["a", 'b "x", c'], ["1", "2"]]);
  // Summer: New York is UTC−4, so a server at New York +7 is UTC+3.
  assert.equal(
    toDate({ y: 2026, mo: 7, d: 7, h: 16, mi: 0, s: 0 }, { kind: "ny", plusHours: 7 }).toISOString(),
    "2026-07-07T13:00:00.000Z",
  );
});
