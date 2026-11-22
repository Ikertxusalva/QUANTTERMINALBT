import { NoteForm } from "@/components/NoteForm";
import { Shell } from "@/components/Shell";
import { today } from "@/lib/scoped";

export const dynamic = "force-dynamic";

const TEMPLATES: Record<string, { title: (d: string) => string; folder: string; body: string }> = {
  premarket: {
    title: (d) => `Plan pre-mercado · ${d}`,
    folder: "Planes",
    body: "Sesgo:\n\nNiveles clave:\n- \n\nEscenarios (si → entonces):\n- \n\nNoticias de hoy:\n\nLímites: máximo de trades y stop del día.\n",
  },
  review: {
    title: (d) => `Revisión de sesión · ${d}`,
    folder: "Revisiones",
    body: "Qué pasó:\n\nQué hice bien:\n\nQué me costó dinero:\n\nLa próxima vez:\n",
  },
  setup: {
    title: () => "Setup · ",
    folder: "Setups",
    body: "La idea:\n\nCondiciones (todas deben darse):\n- \n\nEntrada:\nStop:\nObjetivo:\n\nCuándo NO tomarlo:\n",
  },
  mistakes: {
    title: () => "Registro de errores",
    folder: "Errores",
    body: "Error:\nQué lo disparó:\nQué me costó:\nRegla que lo evita:\n",
  },
};

export default async function NewNotePage(props: PageProps<"/notes/new">) {
  const t = TEMPLATES[String((await props.searchParams).t)];
  return (
    <Shell active="/notes">
      <NoteForm title={t?.title(today()) ?? ""} body={t?.body ?? ""} folder={t?.folder ?? ""} />
    </Shell>
  );
}
