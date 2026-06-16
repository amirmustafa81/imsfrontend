import Link from "next/link";

const stats = [
  { label: "Fixed Assets", value: "0", icon: "bi-upc-scan", tone: "primary" },
  { label: "Stock Items", value: "0", icon: "bi-boxes", tone: "success" },
  { label: "Low Stock", value: "0", icon: "bi-exclamation-triangle", tone: "warning" },
  { label: "Pending Verification", value: "0", icon: "bi-clipboard-check", tone: "info" },
];

const modules = [
  { label: "Inventory Receipt", href: "/inventory-receipts", icon: "bi-receipt" },
  { label: "Fixed Asset Register", href: "/assets", icon: "bi-upc-scan" },
  { label: "Issue / Return", href: "/issues-returns", icon: "bi-arrow-left-right" },
  { label: "Asset Transfer", href: "/transfers", icon: "bi-diagram-3" },
  { label: "Physical Verification", href: "/verification", icon: "bi-clipboard-check" },
  { label: "Controlled Stationery", href: "/controlled-stationery", icon: "bi-journal-check" },
  { label: "Depreciation", href: "/depreciation", icon: "bi-graph-down-arrow" },
  { label: "Reports", href: "/reports", icon: "bi-file-earmark-bar-graph" },
];

const nextSteps = [
  ["Auth & RBAC", "In Progress", "Roles, permissions, department access"],
  ["Master Data", "In Progress", "Departments, locations, stores, categories"],
  ["Inventory Core", "Queued", "Receipts, stock ledger, asset registration"],
];

export default function Home() {
  return (
    <main className="min-vh-100 bg-body-tertiary">
      <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
        <div className="container-fluid px-4">
          <span className="navbar-brand fw-semibold text-primary">
            <i className="bi bi-boxes me-2" />
            UOH IMS
          </span>
          <div className="d-flex align-items-center gap-2 text-secondary small">
            <i className="bi bi-hdd-network" />
            Laravel API + Next.js
          </div>
        </div>
      </nav>

      <div className="container-fluid p-4">
        <div className="row g-4">
          <aside className="col-12 col-lg-2">
            <div className="list-group shadow-sm">
              {modules.map((module) => (
                <Link key={module.label} className="list-group-item list-group-item-action" href={module.href}>
                  <i className={`bi ${module.icon} me-2`} />
                  {module.label}
                </Link>
              ))}
            </div>
          </aside>

          <section className="col-12 col-lg-10">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <h1 className="h3 mb-1">Inventory Dashboard</h1>
                <p className="text-secondary mb-0">
                  University-wide inventory, assets, verification, and audit visibility.
                </p>
              </div>
              <Link className="btn btn-primary" href="/inventory-receipts">
                <i className="bi bi-plus-lg me-2" />
                New Receipt
              </Link>
            </div>

            <div className="row g-3 mb-4">
              {stats.map((stat) => (
                <div className="col-12 col-md-6 col-xl-3" key={stat.label}>
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body d-flex align-items-center justify-content-between">
                      <div>
                        <div className="text-secondary small">{stat.label}</div>
                        <div className="fs-3 fw-semibold">{stat.value}</div>
                      </div>
                      <span className={`text-${stat.tone} fs-2`}>
                        <i className={`bi ${stat.icon}`} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="row g-4">
              <div className="col-12 col-xl-7">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Implementation Priorities</div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Area</th>
                            <th>Status</th>
                            <th>Next Build Step</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nextSteps.map(([area, status, step]) => (
                            <tr key={area}>
                              <td>{area}</td>
                              <td>
                                <span className={`badge ${status === "Queued" ? "text-bg-secondary" : "text-bg-warning"}`}>
                                  {status}
                                </span>
                              </td>
                              <td>{step}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-5">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">API Configuration</div>
                  <div className="card-body">
                    <label className="form-label text-secondary">Expected API Base URL</label>
                    <code className="d-block bg-light border rounded p-3">
                      NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
                    </code>
                    <p className="text-secondary small mt-3 mb-0">
                      Start Laravel on port 8000 and Next.js on port 3000 during local development.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
