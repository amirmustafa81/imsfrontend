import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function TagPrintLogPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="Tag Print Log" subtitle="Tag printing and dispatch tracking are planned in Phase 2." />
        <PhaseTwoStub
          title="Tag Print Log"
          description="Tag queue, print batch history, and reconciliation screens are planned in Phase 2."
        />
      </div>
    </main>
  );
}
