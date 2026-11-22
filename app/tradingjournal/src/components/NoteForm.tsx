import Link from "next/link";
import { deleteNote, saveNote } from "@/app/journal-actions";
import type { Note } from "@/lib/data";

export function NoteForm({ note, title = "", body = "", folder = "" }: { note?: Note; title?: string; body?: string; folder?: string }) {
  return (
    <>
      <form action={saveNote} className="card space-y-4 p-6">
        {note && <input type="hidden" name="id" value={note.id} />}
        <input name="title" required defaultValue={note?.title ?? title} placeholder="Título" aria-label="Título" className="w-full bg-transparent text-[30px] font-bold tracking-tight outline-none placeholder:text-tx-4" />
        <textarea name="body" rows={18} defaultValue={note?.body ?? body} className="input leading-relaxed" placeholder="Escribe aquí…" aria-label="Contenido" />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label><span className="label">Carpeta</span><input name="folder" className="input" defaultValue={note?.folder ?? folder} placeholder="Planes, Setups…" /></label>
          <label><span className="label">Etiquetas · separadas por comas</span><input name="tags" className="input" defaultValue={note?.tags ?? ""} /></label>
          <label className="flex items-end gap-2 pb-2.5 text-tx-2"><input type="checkbox" name="pinned" defaultChecked={note?.pinned} /> Fijar arriba</label>
        </div>
        <div className="flex justify-end gap-2">
          <Link href="/notes" className="btn">{note ? "Volver" : "Cancelar"}</Link>
          <button className="btn btn-primary">{note ? "Guardar" : "Crear nota"}</button>
        </div>
      </form>
      {note && (
        <form action={deleteNote} className="mt-3 text-right">
          <input type="hidden" name="id" value={note.id} />
          <button className="btn btn-sm btn-danger">Eliminar nota</button>
        </form>
      )}
    </>
  );
}
