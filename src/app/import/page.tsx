import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function ImportPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader title="ERP Import" subtitle="Bulk import tooling is planned in Phase 2." />
        <PhaseTwoStub title="ERP Import" description="Import wizards and validation workflows are planned in Phase 2." />
      </div>
    </main>
  );
}
