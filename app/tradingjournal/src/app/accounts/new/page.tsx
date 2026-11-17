import { Shell } from "@/components/Shell";
import { Wizard } from "./Wizard";

export const dynamic = "force-dynamic";

export default function NewAccountPage() {
  return (
    <Shell active="/accounts">
      <h1 className="mb-5 text-xl font-semibold tracking-tight">Nueva cuenta</h1>
      <Wizard />
    </Shell>
  );
}
