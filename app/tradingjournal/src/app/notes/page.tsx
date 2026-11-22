import Link from "next/link";
import { PageHead, Shell } from "@/components/Shell";
import { listNotes } from "@/lib/data";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  { key: "blank", label: "En blanco" },
  { key: "premarket", label: "Plan pre-mercado" },
  { key: "review", label: "Revisión de sesión" },
  { key: "setup", label: "Ficha de setup" },
  { key: "mistakes", label: "Registro de errores" },
];

const when = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });

export default async function NotesPage(props: PageProps<"/notes">) {
  const sp = await props.searchParams;
  const term = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const folder = typeof sp.folder === "string" ? sp.folder : null;
  const notes = await listNotes();
  const folders = [...new Set(notes.map((n) => n.folder).filter(Boolean))] as string[];
  const shown = notes.filter(
    (n) =>
      (!folder || n.folder === folder) &&
      (!term || `${n.title} ${n.body} ${n.tags ?? ""}`.toLowerCase().includes(term)),
  );

  return (
    <Shell active="/notes">
      <PageHead title="Notas" sub="Planes, revisiones y fichas de setup. Escribe [[Título]] para enlazar una nota con otra.">
        <form className="flex gap-2">
          {folder && <input type="hidden" name="folder" value={folder} />}
          <input name="q" defaultValue={term} className="input !w-56" placeholder="Buscar…" aria-label="Buscar notas" />
        </form>
      </PageHead>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-5">
        <span className="mr-2 text-[15px] font-semibold">Escribir</span>
        {TEMPLATES.map((t) => <Link key={t.key} href={`/notes/new?t=${t.key}`} className="pill">{t.label}</Link>)}
      </div>

      {folders.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Link href="/notes" className={`pill ${!folder ? "pill-on" : ""}`}>Todas</Link>
          {folders.map((f) => <Link key={f} href={`/notes?folder=${encodeURIComponent(f)}`} className={`pill ${folder === f ? "pill-on" : ""}`}>{f}</Link>)}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card p-8 text-center text-tx-2">{notes.length === 0 ? "Aún no hay notas. Empieza con una plantilla." : "Ninguna nota coincide."}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="card flex h-[190px] flex-col p-5 hover:border-line-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="line-clamp-2 text-[17px] font-bold leading-snug tracking-tight">{n.title}</h2>
                {n.pinned && <span className="chip chip-solid">Fijada</span>}
              </div>
              <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-line text-[13px] text-tx-3">{n.body || "Vacía"}</p>
              <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-tx-3">
                <span>{[n.folder, n.tags].filter(Boolean).join(" · ")}</span>
                <span>{when.format(new Date(n.updated_at))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
