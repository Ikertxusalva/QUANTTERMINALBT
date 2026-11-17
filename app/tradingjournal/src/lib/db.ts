
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
