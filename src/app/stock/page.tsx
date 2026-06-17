import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function StockPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="Stock Balances" subtitle="Stock balance, low-stock, and adjustment screens are planned for Phase 2." />
        <PhaseTwoStub title="Stock Balances" description="Ledger, reserve, and adjustment workflows are in Phase 2." />
      </div>
    </main>
  );
}
