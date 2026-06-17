"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, KpiCard, PageHeader, StatusBadge } from "@/components/ims";
import { api } from "@/lib/api";

type NextStep = [string, string, string];

type KpiStat = {
  label: string;
  value: number;
  icon: string;
  tone: "primary" | "success" | "warning" | "info";
};

type ApiMetric = {
  area: string;
  status: "Queued" | "In Progress";
  nextStep: string;
};

const stats: KpiStat[] = [
  { label: "Fixed Assets", value: 0, icon: "bi-upc-scan", tone: "primary" },
  { label: "Stock Items", value: 0, icon: "bi-boxes", tone: "success" },
  { label: "Low Stock", value: 0, icon: "bi-exclamation-triangle", tone: "warning" },
  { label: "Pending Verification", value: 0, icon: "bi-clipboard-check", tone: "info" },
];

const nextSteps: NextStep[] = [
  ["Auth & RBAC", "In Progress", "Roles, permissions, department access"],
  ["Master Data", "In Progress", "Departments, locations, stores, categories"],
  ["Inventory Core", "Queued", "Receipts, stock ledger, asset registration"],
];

export default function Home() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token] = useState(initialToken);
  const [statsRows, setStatsRows] = useState(stats);
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const loadDashboardStats = useCallback(async () => {
    if (!token) {
      setDashboardError("Save the API token to load dashboard metrics.");
      return;
    }

    setLoading(true);
    setDashboardError("");

    try {
      const [fixedAssetResponse, stockResponse, lowStockResponse, verificationResponse] = await Promise.all([
        api.get<{ data: unknown[] }>("/assets", authHeaders),
        api.get<{ data: unknown[] }>("/reports/stock-balance", authHeaders),
        api.get<{ data: unknown[] }>("/reports/low-stock", authHeaders),
        api.get<{ data: Array<{ status: string }> }>("/physical-verifications", authHeaders),
      ]);

      const fixedAssets = Array.isArray(fixedAssetResponse.data?.data) ? fixedAssetResponse.data.data.length : 0;
      const stockItems = Array.isArray(stockResponse.data?.data) ? stockResponse.data.data.length : 0;
      const lowStock = Array.isArray(lowStockResponse.data?.data) ? lowStockResponse.data.data.length : 0;
      const verifications = Array.isArray(verificationResponse.data?.data) ? verificationResponse.data.data : [];
      const pendingVerification = verifications.filter((verification) => {
        const status = verification.status?.toLowerCase();
        return status !== "completed" && status !== "cancelled";
      }).length;

      setStatsRows([
        { label: "Fixed Assets", value: fixedAssets, icon: "bi-upc-scan", tone: "primary" },
        { label: "Stock Items", value: stockItems, icon: "bi-boxes", tone: "success" },
        { label: "Low Stock", value: lowStock, icon: "bi-exclamation-triangle", tone: "warning" },
        {
          label: "Pending Verification",
          value: pendingVerification,
          icon: "bi-clipboard-check",
          tone: "info",
        },
      ]);
    } catch {
      setDashboardError("Unable to load dashboard counts from backend. Verify token and permissions.");
      setStatsRows(stats);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    void loadDashboardStats();
  }, [loadDashboardStats]);

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
        render: (row: ApiMetric) => <StatusBadge status={row.status} />,
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
          {statsRows.map((stat) => (
            <div className="col-12 col-md-6 col-xl-3" key={stat.label}>
              <KpiCard icon={stat.icon} label={stat.label} value={stat.value} tone={stat.tone} />
            </div>
          ))}
        </div>

        {dashboardError ? <div className="alert alert-danger">{dashboardError}</div> : null}
        {loading ? <div className="text-secondary small mb-3">Loading latest dashboard metrics...</div> : null}

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
