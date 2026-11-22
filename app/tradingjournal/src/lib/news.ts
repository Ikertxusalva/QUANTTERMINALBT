import { q } from "./db";

export interface NewsEvent {
  id: string;
  title: string;
  country: string;
  at: Date;
  impact: "High" | "Medium" | "Low" | "Holiday";
  forecast: string | null;
  previous: string | null;
}

const FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

interface FeedItem {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
}

/**
 * Download this week's economic calendar and keep it. Past weeks stay stored, so the
 * history used for "you on news days" grows from the first refresh on.
 */
export async function refreshNews(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  let items: FeedItem[];
  try {
    const res = await fetch(FEED, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, error: `El calendario respondió ${res.status}.` };
    items = (await res.json()) as FeedItem[];
  } catch {
    return { ok: false, error: "No se pudo descargar el calendario. Comprueba la conexión." };
  }
  let count = 0;
  for (const it of items) {
    const at = new Date(it.date);
    if (!it.title || !it.country || Number.isNaN(at.getTime())) continue;
    await q(
      `insert into news_events (id, title, country, at, impact, forecast, previous)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set impact = excluded.impact, forecast = excluded.forecast, previous = excluded.previous`,
      [`${it.country}|${it.title}|${at.toISOString()}`, it.title, it.country, at.toISOString(), it.impact, it.forecast || null, it.previous || null],
    );
    count++;
  }
  return { ok: true, count };
}

export const listNews = (from: Date, to: Date) =>
  q<NewsEvent>("select * from news_events where at >= $1 and at < $2 order by at", [
    from.toISOString(),
    to.toISOString(),
  ]);

export const listHighImpact = (country: string) =>
  q<NewsEvent>("select * from news_events where impact = 'High' and country = $1 order by at", [country]);
