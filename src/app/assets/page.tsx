import Link from "next/link";

export default function Page() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <Link href="/" className="btn btn-link px-0 mb-3">
          <i className="bi bi-arrow-left me-2" />
          Dashboard
        </Link>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <h1 className="h3 mb-2">Fixed Asset Register</h1>
            <p className="text-secondary mb-4">Manage asset IDs, QR tags, custodians, location, depreciation, and movement history.</p>
            <div className="alert alert-info mb-0">
              <i className="bi bi-tools me-2" />
              Module screen scaffolded. Forms, tables, filters, and API wiring will be added in the next build pass.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
