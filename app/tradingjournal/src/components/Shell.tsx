import Link from "next/link";
import { logout } from "@/app/actions";
import { authMode } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Panel" },
  { href: "/accounts", label: "Cuentas" },
];

export function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
          <Link href="/" className="mr-1 font-semibold tracking-tight sm:mr-4">
            Bitácora
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 ${
                  active === l.href ? "bg-raised text-tx" : "text-tx-2 hover:text-tx"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/accounts/new" className="btn btn-sm btn-primary">
              <span className="sm:hidden">+ Cuenta</span>
              <span className="hidden sm:inline">Nueva cuenta</span>
            </Link>
            {authMode() === "locked" && (
              <form action={logout}>
                <button className="btn btn-sm">Salir</button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
