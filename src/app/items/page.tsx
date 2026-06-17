import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function ItemsPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="Item Master" subtitle="Core item catalog workflow is planned for Phase 2." />
        <PhaseTwoStub title="Item Master" description="Item master, form builders, and category mapping are planned in Phase 2." />
      </div>
    </main>
  );
}
