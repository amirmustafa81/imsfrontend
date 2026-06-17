import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function ExportHistoryPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="Export History" subtitle="Export job history and replay logs are planned in Phase 2." />
        <PhaseTwoStub title="Export History" description="Export history and audit trail screens are planned in Phase 2." />
      </div>
    </main>
  );
}
