"use client";

import { selectScope } from "@/app/journal-actions";

export function ScopePicker({
  accounts,
  current,
}: {
  accounts: { id: number; name: string; archived: boolean }[];
  current: number | null;
}) {
  return (
    <form action={selectScope} className="flex items-center gap-1 pl-2">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tx" />
      <select
        name="account"
        aria-label="Cuenta"
        defaultValue={current ?? "all"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="all">Todas las cuentas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.archived ? " · archivada" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
