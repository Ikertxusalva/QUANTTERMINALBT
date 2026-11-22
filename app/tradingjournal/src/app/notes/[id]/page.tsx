import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteForm } from "@/components/NoteForm";
import { Shell } from "@/components/Shell";
import { getNote, listNotes } from "@/lib/data";

export const dynamic = "force-dynamic";

const rawLinks = (body: string) => [...body.matchAll(/\[\[([^\]\n]+)\]\]/g)].map((m) => m[1].trim());
const linksIn = (body: string) => rawLinks(body).map((t) => t.toLowerCase());

export default async function NotePage(props: PageProps<"/notes/[id]">) {
  const { id } = await props.params;
  const note = await getNote(Number(id));
  if (!note) notFound();
  const all = await listNotes();
  const byTitle = new Map(all.map((n) => [n.title.trim().toLowerCase(), n]));
  const outgoing = [...new Map(rawLinks(note.body).map((t) => [t.toLowerCase(), t])).values()];
  const backlinks = all.filter((n) => n.id !== note.id && linksIn(n.body).includes(note.title.trim().toLowerCase()));

  return (
    <Shell active="/notes">
      <NoteForm key={`${note.id}-${new Date(note.updated_at).getTime()}`} note={note} />
      {(outgoing.length > 0 || backlinks.length > 0) && (
        <section className="card mt-4 grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <div className="eyebrow">Enlaza a</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {outgoing.length === 0 && <span className="text-tx-3">Nada todavía.</span>}
              {outgoing.map((t) => {
                const target = byTitle.get(t.toLowerCase());
                return target ? (
                  <Link key={t} href={`/notes/${target.id}`} className="pill">{target.title}</Link>
                ) : (
                  <span key={t} className="pill pill-static border-dashed text-tx-3" title="No existe ninguna nota con ese título">{t}</span>
                );
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow">Mencionada en</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {backlinks.length === 0 && <span className="text-tx-3">Ninguna nota la menciona.</span>}
              {backlinks.map((n) => <Link key={n.id} href={`/notes/${n.id}`} className="pill">{n.title}</Link>)}
            </div>
          </div>
        </section>
      )}
    </Shell>
  );
}
