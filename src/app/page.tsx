"use client";

import Link from "next/link";
import { DataTable, KpiCard, PageHeader } from "@/components/ims";

type NextStep = [string, string, string];

type KpiStat = {
  label: string;
  value: string;
  icon: string;
  tone: "primary" | "success" | "warning" | "info";
};

type ApiMetric = {
  area: string;
  status: "Queued" | "In Progress";
  nextStep: string;
};

const stats: KpiStat[] = [
  { label: "Fixed Assets", value: "0", icon: "bi-upc-scan", tone: "primary" },
  { label: "Stock Items", value: "0", icon: "bi-boxes", tone: "success" },
  { label: "Low Stock", value: "0", icon: "bi-exclamation-triangle", tone: "warning" },
  { label: "Pending Verification", value: "0", icon: "bi-clipboard-check", tone: "info" },
];

const nextSteps: NextStep[] = [
  ["Auth & RBAC", "In Progress", "Roles, permissions, department access"],
  ["Master Data", "In Progress", "Departments, locations, stores, categories"],
  ["Inventory Core", "Queued", "Receipts, stock ledger, asset registration"],
];

const statusClass = (status: string) => (status === "Queued" ? "text-bg-secondary" : "text-bg-warning");

export default function Home() {
  const tableRows = nextSteps.map(([area, status, step], index): ApiMetric & { id: number } => ({
    id: index,
    area,
    status: status as "Queued" | "In Progress",
    nextStep: step,
  }));

  const tableColumns = [
    { key: "area", header: "Area" },
    {
      key: "status",
      header: "Status",
      render: (row: ApiMetric) => <span className={`badge ${statusClass(row.status)}`}>{row.status}</span>,
    },
    { key: "nextStep", header: "Next Build Step" },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Inventory Dashboard"
          subtitle="University-wide inventory, assets, verification, and audit visibility."
          actions={
            <Link className="btn btn-primary" href="/inventory-receipts">
              <i className="bi bi-plus-lg me-2" />
              New Receipt
            </Link>
          }
        />

        <div className="row g-3 mb-4">
          {stats.map((stat) => (
            <div className="col-12 col-md-6 col-xl-3" key={stat.label}>
              <KpiCard icon={stat.icon} label={stat.label} value={stat.value} tone={stat.tone} />
            </div>
          ))}
        </div>

        <div className="row g-4">
          <div className="col-12 col-xl-7">
            <DataTable columns={tableColumns} rows={tableRows} empty="No implementation priorities." />
          </div>

          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">API Configuration</div>
              <div className="card-body">
                <label className="form-label text-secondary">Expected API Base URL</label>
                <code className="d-block bg-light border rounded p-3">NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api</code>
                <p className="text-secondary small mt-3 mb-0">
                  Start Laravel on port 8000 and Next.js on port 3000 during local development.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
