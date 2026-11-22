import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public liveness check: says whether the database answers, and nothing else. */
export async function GET() {
  try {
    await q("select 1");
    return Response.json({ ok: true });
  } catch (e) {
    // The reason goes to the server log only; the response stays opaque.
    console.error("health check failed:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
