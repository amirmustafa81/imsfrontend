import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function ImportPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="ERP Import" subtitle="Bulk import tooling is planned in Phase 2." />
        <PhaseTwoStub title="ERP Import" description="Import wizards and validation workflows are planned in Phase 2." />
      </div>
    </main>
  );
}
