import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function ItAssetsPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="IT Assets" subtitle="Specialized IT assets workflows are planned in Phase 2." />
        <PhaseTwoStub title="IT Assets" description="IT-focused asset inventory and assignment tracking are planned in Phase 2." />
      </div>
    </main>
  );
}
