
type Row = Record<string, unknown>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = `
create table if not exists accounts (
  id serial primary key,
  name text not null,
  kind text not null,
  firm text,
  plan text,
  phase text not null,
  market text not null default 'futures',
  account_number text,
  starting_balance integer not null,
  prior_pnl integer not null default 0,
  initial_floor integer,
  days_before integer not null default 0,
  rules jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create table if not exists trades (
  id serial primary key,
  account_id integer not null references accounts(id) on delete cascade,
  symbol text not null,
  side text not null,
  qty double precision not null default 1,
  gross integer not null,
  fees integer not null default 0,
  risk integer,
  opened_at timestamptz,
  closed_at timestamptz not null,
  source text not null default 'manual',
  grade text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists trades_account_closed on trades(account_id, closed_at);
create table if not exists ledger (
  id serial primary key,
  account_id integer references accounts(id) on delete cascade,
  type text not null,
  amount integer not null,
  date date not null,
  note text,
  created_at timestamptz not null default now()
);
alter table trades add column if not exists swap integer not null default 0;
alter table trades add column if not exists external_id text;
alter table trades add column if not exists import_id integer;
alter table trades add column if not exists session text;
alter table trades add column if not exists strategy_id integer;
alter table trades add column if not exists plan_followed text;
alter table trades add column if not exists feelings jsonb;
alter table trades add column if not exists mistake text;
alter table trades add column if not exists criteria_met jsonb;
alter table trades add column if not exists rules_broken jsonb;
alter table trades add column if not exists chart_url text;
alter table trades add column if not exists entry_price double precision;
alter table trades add column if not exists exit_price double precision;
create unique index if not exists trades_external on trades(account_id, external_id) where external_id is not null;
create table if not exists imports (
  id serial primary key,
  account_id integer not null references accounts(id) on delete cascade,
  source text not null,
  filename text,
  trades integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists strategies (
  id serial primary key,
  name text not null,
  description text,
  criteria jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists rules (
  id serial primary key,
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists days (
  date text primary key,
  bias text,
  instrument text,
  levels text,
  scenarios text,
  plan text,
  verdict text,
  said text,
  market_did text,
  next_time text,
  review text,
  updated_at timestamptz not null default now()
);
create table if not exists notes (
  id serial primary key,
  title text not null,
  body text not null default '',
  folder text,
  tags text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists news_events (
  id text primary key,
  title text not null,
  country text not null,
  at timestamptz not null,
  impact text not null,
  forecast text,
  previous text
);
`;

async function connect(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { prepare: false, max: 5 });
    await sql.unsafe(SCHEMA);
    return async (text, params = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as Row[];
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const dir = process.env.PGLITE_DIR ?? ".data/pg";
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.exec(SCHEMA);
  return async (text, params = []) => (await pg.query<Row>(text, params)).rows;
}

const g = globalThis as unknown as { __tjDb?: Promise<Runner> };

/** Run a parameterised query ($1, $2…) and return its rows. */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  g.__tjDb ??= connect();
  const run = await g.__tjDb;
  return (await run(text, params)) as T[];
}
