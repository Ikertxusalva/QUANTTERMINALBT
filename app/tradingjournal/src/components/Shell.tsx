import Link from "next/link";
import { logout } from "@/app/actions";
import { authMode } from "@/lib/auth";
import { getScope, listAccounts } from "@/lib/data";
import { ScopePicker } from "./ScopePicker";

const LINKS = [
  { href: "/", label: "Panel" },
  { href: "/journal", label: "Journal" },
  { href: "/days", label: "Días" },
  { href: "/stats", label: "Stats" },
  { href: "/strategies", label: "Estrategias" },
  { href: "/accounts", label: "Cuentas" },
  { href: "/news", label: "Noticias" },
  { href: "/notes", label: "Notas" },
];

export async function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  const accounts = await listAccounts();
  const scope = await getScope(accounts);
  return (
    <>
      <header className="sticky top-3 z-20 flex justify-center px-2">
        <div className="dock">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`nav ${active === l.href ? "on" : ""}`}>
              {l.label}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-line-2" />
          <ScopePicker
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, archived: a.status === "archived" }))}
            current={scope?.id ?? null}
          />
          <Link
            href="/log"
            aria-label="Registrar trade"
            title="Registrar trade"
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f4f4] text-lg font-medium text-[#050505]"
          >
            +
          </Link>
          {authMode() === "locked" && (
            <form action={logout} className="shrink-0">
              <button className="nav px-3 text-tx-3 hover:text-tx" style={{ height: 34 }}>
                Salir
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16">{children}</main>
    </>
  );
}

/** Page title with its one-line summary and controls on the right. */
export function PageHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="mt-2 text-tx-3">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Segmented control made of links. */
export function Seg({
  items,
  current,
}: {
  items: { href: string; label: string; key: string }[];
  current: string;
}) {
  return (
    <div className="seg">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={i.key === current ? "on" : ""} scroll={false}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
