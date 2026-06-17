import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function LabInventoryPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader title="Laboratory Inventory" subtitle="Lab consumables and consumable issue workflows are planned in Phase 2." />
        <PhaseTwoStub title="Laboratory Inventory" description="Laboratory-specific inventory workflows are planned in Phase 2." />
      </div>
    </main>
  );
}
