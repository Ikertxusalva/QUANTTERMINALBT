import { Shell } from "@/components/Shell";
import { Wizard } from "./Wizard";

export const dynamic = "force-dynamic";

export default function NewAccountPage() {
  return (
    <Shell active="/accounts">
      <h1 className="h1 mb-6">Nueva cuenta</h1>
      <Wizard />
    </Shell>
  );
}
