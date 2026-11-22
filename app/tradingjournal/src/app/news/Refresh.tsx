"use client";

import { useActionState } from "react";
import { refreshNewsAction } from "@/app/journal-actions";

export function Refresh() {
  const [message, action, pending] = useActionState(refreshNewsAction, null);
  return (
    <form action={action} className="flex items-center gap-3">
      {message && <span className="text-[13px] text-tx-3">{message}</span>}
      <button className="btn" disabled={pending}>{pending ? "Descargando…" : "Actualizar calendario"}</button>
    </form>
  );
}
