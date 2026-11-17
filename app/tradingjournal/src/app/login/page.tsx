import { authMode } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const misconfigured = authMode() === "misconfigured";
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold tracking-tight">Bitácora</h1>
        <p className="mt-1 text-tx-2">Página privada.</p>
        {misconfigured ? (
          <p className="mt-5 text-warn">
            Falta configurar la variable <span className="num">APP_PASSWORD</span> en el servidor.
            Hasta entonces la web permanece cerrada.
          </p>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}
