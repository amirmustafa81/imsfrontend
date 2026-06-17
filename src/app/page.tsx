"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ims";
import { api } from "@/lib/api";

type AssetRow = {
  id: number;
  status?: string | null;
  department?: {
    id?: number | null;
    name?: string | null;
  } | null;
};

type StockRow = {
  id: number;
  item_name?: string | null;
  store_name?: string | null;
  quantity_on_hand?: number | string | null;
  minimum_stock_level?: number | string | null;
};

type VerificationRow = {
  id: number;
  verification_no?: string | null;
  status?: string | null;
};

type MissingDamagedRow = {
  id: number;
};

type ReceiptReportRow = {
  id: number;
  receipt_no?: string | null;
  receipt_date?: string | null;
  supplier_name?: string | null;
  status?: string | null;
};

type InventoryTransactionRow = {
  id: number;
  status?: string | null;
};

type IssueReturnRow = {
  id: number;
  transaction_type?: string | null;
  transaction_date?: string | null;
  item_name?: string | null;
  to_department_name?: string | null;
  from_department_name?: string | null;
};

type AssetTransferRow = {
  id: number;
  movement_type?: string | null;
  movement_date?: string | null;
  item_name?: string | null;
  to_department_name?: string | null;
};

type MaintenanceRow = {
  id: number;
  status?: string | null;
};

type ControlledStationeryBatchRow = {
  id: number;
  status?: string | null;
};

type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: string;
};

type DepartmentCount = {
  name: string;
  count: number;
};

type LowStockTableRow = {
  id: number;
  item: string;
  store: string;
  onHand: string;
  minimum: string;
};

type ReceiptTableRow = {
  id: number;
  grn: string;
  date: string;
  rawDate: string | null;
  supplier: string;
  status: string;
};

type MovementTableRow = {
  id: number;
  date: string;
  type: string;
  item: string;
  department: string;
};

const METRIC_TONES: Record<string, string> = {
  primary: "primary",
  info: "info",
  warning: "warning",
  secondary: "secondary",
  danger: "danger",
  success: "success",
};

const DEFAULT_METRICS: DashboardMetric[] = [
  { label: "Fixed Assets", value: "0", hint: "0 in use", icon: "bi-tags", tone: "primary" },
  { label: "Stock Items", value: "0", hint: "distinct SKUs", icon: "bi-box-seam", tone: "info" },
  { label: "Low Stock Alerts", value: "0", hint: "below reorder level", icon: "bi-exclamation-triangle", tone: "warning" },
  { label: "Pending Approvals", value: "0", hint: "awaiting manual ref", icon: "bi-clipboard2-check", tone: "secondary" },
  { label: "Missing / Damaged", value: "0", hint: "under investigation", icon: "bi-patch-question", tone: "danger" },
  { label: "Recent Receipts", value: "0", hint: "last 30 days", icon: "bi-truck", tone: "success" },
  { label: "Issues / Returns", value: "0", hint: "recent movements", icon: "bi-arrow-left-right", tone: "info" },
  { label: "Controlled Stationery Alerts", value: "0", hint: "active tracked batches", icon: "bi-shield-exclamation", tone: "danger" },
  { label: "Verification Progress", value: "0%", hint: "current cycle", icon: "bi-clipboard-check", tone: "primary" },
  { label: "Under Repair", value: "0", hint: "assets in workshop", icon: "bi-wrench", tone: "warning" },
];

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
};

const formatCount = (value: number) => numberFormatter.format(value);

const isWithinLastDays = (value: string | null | undefined, days: number) => {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return parsed.getTime() >= threshold;
};

const sortByNewest = <T,>(rows: T[], getter: (row: T) => string | null | undefined) =>
  [...rows].sort((left, right) => {
    const leftTime = getter(left) ? new Date(getter(left) as string).getTime() : 0;
    const rightTime = getter(right) ? new Date(getter(right) as string).getTime() : 0;
    return rightTime - leftTime;
  });

export default function Home() {
  const [token] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(() =>
    token ? "" : "Dashboard metrics need a valid API token in local storage.",
  );
  const [metrics, setMetrics] = useState<DashboardMetric[]>(DEFAULT_METRICS);
  const [departmentCounts, setDepartmentCounts] = useState<DepartmentCount[]>([]);
  const [lowStockRows, setLowStockRows] = useState<LowStockTableRow[]>([]);
  const [recentReceiptRows, setRecentReceiptRows] = useState<ReceiptTableRow[]>([]);
  const [recentMovementRows, setRecentMovementRows] = useState<MovementTableRow[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setLoading(true);
    setDashboardError("");

    const requestConfig = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    void Promise.allSettled([
      api.get<{ data: AssetRow[] }>("/assets", requestConfig),
      api.get<{ data: StockRow[] }>("/reports/stock-balance", requestConfig),
      api.get<{ data: StockRow[] }>("/reports/low-stock", requestConfig),
      api.get<{ data: VerificationRow[] }>("/physical-verifications", requestConfig),
      api.get<{ data: MissingDamagedRow[] }>("/reports/missing-damaged-assets", requestConfig),
      api.get<{ data: ReceiptReportRow[] }>("/reports/purchase-receipt", requestConfig),
      api.get<{ data: InventoryTransactionRow[] }>("/inventory-transactions", requestConfig),
      api.get<{ data: IssueReturnRow[] }>("/reports/issue-return", requestConfig),
      api.get<{ data: AssetTransferRow[] }>("/reports/asset-transfer", requestConfig),
      api.get<{ data: MaintenanceRow[] }>("/maintenance-records", requestConfig),
      api.get<{ data: ControlledStationeryBatchRow[] }>("/controlled-stationery/batches", requestConfig),
    ])
      .then((results) => {
          if (!active) {
            return;
          }

          const getRows = <T,>(index: number): T[] => {
            const result = results[index];

            if (result?.status !== "fulfilled") {
              return [];
            }

            const payload = result.value.data as { data?: unknown };
            return asArray<T>(payload.data);
          };

          const failedRequests = results.filter((result) => result.status === "rejected").length;
          setDashboardError(
            failedRequests > 0
              ? `${failedRequests} dashboard data source${failedRequests > 1 ? "s" : ""} could not be loaded. Showing available data.`
              : "",
          );

          const assets = getRows<AssetRow>(0);
          const stockBalances = getRows<StockRow>(1);
          const lowStock = getRows<StockRow>(2);
          const verifications = getRows<VerificationRow>(3);
          const missingDamaged = getRows<MissingDamagedRow>(4);
          const receiptReport = getRows<ReceiptReportRow>(5);
          const inventoryTransactions = getRows<InventoryTransactionRow>(6);
          const issueReturn = getRows<IssueReturnRow>(7);
          const assetTransfers = getRows<AssetTransferRow>(8);
          const maintenanceRecords = getRows<MaintenanceRow>(9);
          const stationeryBatches = getRows<ControlledStationeryBatchRow>(10);

          const inUseCount = assets.filter((asset) => {
            const status = (asset.status ?? "").toLowerCase();
            return status === "in_use" || status === "issued";
          }).length;

          const pendingReceipts = receiptReport.filter((receipt) => {
            const status = (receipt.status ?? "").toLowerCase();
            return status !== "posted" && status !== "cancelled";
          }).length;

          const pendingTransactions = inventoryTransactions.filter((transaction) => {
            const status = (transaction.status ?? "").toLowerCase();
            return status === "draft";
          }).length;

          const pendingApprovals = pendingReceipts + pendingTransactions;

          const recentReceipts = Array.from(
            receiptReport.reduce<Map<string, ReceiptTableRow>>((map, row) => {
              const key = row.receipt_no ?? `receipt-${row.id}`;

              if (!map.has(key)) {
                map.set(key, {
                  id: row.id,
                  grn: row.receipt_no ?? "-",
                  date: formatDate(row.receipt_date),
                  rawDate: row.receipt_date ?? null,
                  supplier: row.supplier_name ?? "Direct / Not linked",
                  status: row.status ?? "draft",
                });
              }

              return map;
            }, new Map()).values(),
          );

          const sortedRecentReceipts = sortByNewest(recentReceipts, (row) => row.rawDate)
            .slice(0, 4);

          const recentReceiptCount = receiptReport.filter((receipt) => isWithinLastDays(receipt.receipt_date, 30)).length;
          const issueReturnCount = issueReturn.filter((movement) => isWithinLastDays(movement.transaction_date, 30)).length;

          const openMaintenance = maintenanceRecords.filter((record) => {
            const status = (record.status ?? "").toLowerCase();
            return status !== "closed" && status !== "cancelled" && status !== "repaired" && status !== "not_repairable";
          }).length;

          const activeStationeryBatches = stationeryBatches.filter(
            (batch) => (batch.status ?? "").toLowerCase() === "active",
          ).length;

          const completedVerifications = verifications.filter(
            (verification) => (verification.status ?? "").toLowerCase() === "completed",
          ).length;
          const verificationProgress = verifications.length === 0
            ? 0
            : Math.round((completedVerifications / verifications.length) * 100);
          const latestVerification = sortByNewest(verifications, (verification) => verification.verification_no ?? "")
            .find(Boolean);

          const departmentMap = assets.reduce<Map<string, number>>((map, asset) => {
            const name = asset.department?.name?.trim() || "Unassigned";
            map.set(name, (map.get(name) ?? 0) + 1);
            return map;
          }, new Map());

          const groupedDepartments = Array.from(departmentMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
            .slice(0, 7);

          const lowStockTable = lowStock.slice(0, 5).map((row) => ({
            id: row.id,
            item: row.item_name ?? "-",
            store: row.store_name ?? "-",
            onHand: formatCount(toNumber(row.quantity_on_hand)),
            minimum: formatCount(toNumber(row.minimum_stock_level)),
          }));

          const recentMovements = [
            ...issueReturn.map((row) => ({
              id: `issue-${row.id}`,
              date: row.transaction_date ?? "",
              type: row.transaction_type ?? "issue",
              item: row.item_name ?? "-",
              department: row.to_department_name ?? row.from_department_name ?? "-",
            })),
            ...assetTransfers.map((row) => ({
              id: `transfer-${row.id}`,
              date: row.movement_date ?? "",
              type: row.movement_type ?? "transfer",
              item: row.item_name ?? "-",
              department: row.to_department_name ?? "-",
            })),
          ]
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
            .slice(0, 4)
            .map((row, index) => ({
              id: index + 1,
              date: formatDate(row.date),
              type: row.type,
              item: row.item,
              department: row.department,
            }));

          setMetrics([
            {
              label: "Fixed Assets",
              value: formatCount(assets.length),
              hint: `${formatCount(inUseCount)} in use`,
              icon: "bi-tags",
              tone: "primary",
            },
            {
              label: "Stock Items",
              value: formatCount(stockBalances.length),
              hint: "distinct SKUs",
              icon: "bi-box-seam",
              tone: "info",
            },
            {
              label: "Low Stock Alerts",
              value: formatCount(lowStock.length),
              hint: "below reorder level",
              icon: "bi-exclamation-triangle",
              tone: "warning",
            },
            {
              label: "Pending Approvals",
              value: formatCount(pendingApprovals),
              hint: "awaiting manual ref",
              icon: "bi-clipboard2-check",
              tone: "secondary",
            },
            {
              label: "Missing / Damaged",
              value: formatCount(missingDamaged.length),
              hint: "under investigation",
              icon: "bi-patch-question",
              tone: "danger",
            },
            {
              label: "Recent Receipts",
              value: formatCount(recentReceiptCount),
              hint: "last 30 days",
              icon: "bi-truck",
              tone: "success",
            },
            {
              label: "Issues / Returns",
              value: formatCount(issueReturnCount),
              hint: "recent movements",
              icon: "bi-arrow-left-right",
              tone: "info",
            },
            {
              label: "Controlled Stationery Alerts",
              value: formatCount(activeStationeryBatches),
              hint: "active tracked batches",
              icon: "bi-shield-exclamation",
              tone: "danger",
            },
            {
              label: "Verification Progress",
              value: `${verificationProgress}%`,
              hint: latestVerification?.verification_no ?? "current cycle",
              icon: "bi-clipboard-check",
              tone: "primary",
            },
            {
              label: "Under Repair",
              value: formatCount(openMaintenance),
              hint: "assets in workshop",
              icon: "bi-wrench",
              tone: "warning",
            },
          ]);

          setDepartmentCounts(groupedDepartments);
          setLowStockRows(lowStockTable);
          setRecentReceiptRows(sortedRecentReceipts);
          setRecentMovementRows(recentMovements);
        })
      .catch(() => {
        if (!active) {
          return;
        }

        setDashboardError("Unable to load dashboard data from backend. Verify token, API base URL, and permissions.");
        setMetrics(DEFAULT_METRICS);
        setDepartmentCounts([]);
        setLowStockRows([]);
        setRecentReceiptRows([]);
        setRecentMovementRows([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const maxDepartmentCount = Math.max(...departmentCounts.map((row) => row.count), 1);

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Dashboard"
          subtitle="Operational overview across stores, assets, and projects"
        />

        {dashboardError ? <div className="alert alert-danger mb-3">{dashboardError}</div> : null}
        {loading ? <div className="text-secondary small mb-3">Refreshing live dashboard metrics...</div> : null}

        <section className="row g-3 mb-3">
          {metrics.map((metric) => (
            <div className="col-12 col-md-6 col-xl-3" key={metric.label}>
              <div className="card border-0 shadow-sm h-100 ims-dashboard-metric-card">
                <div className="card-body d-flex align-items-center gap-3">
                  <div className={`ims-dashboard-metric-icon bg-${METRIC_TONES[metric.tone]}-subtle text-${METRIC_TONES[metric.tone]}`}>
                    <i className={`bi ${metric.icon}`} />
                  </div>

                  <div className="min-w-0">
                    <div className="text-secondary small text-uppercase fw-semibold">{metric.label}</div>
                    <div className="fs-2 fw-bold lh-1">{metric.value}</div>
                    <div className="text-secondary">{metric.hint}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="row g-3 mb-3">
          <div className="col-12 col-xl-6">
            <div className="card border-0 shadow-sm h-100 ims-dashboard-panel">
              <div className="card-header bg-white d-flex align-items-center gap-2 fw-semibold">
                <i className="bi bi-building text-secondary" />
                Department-wise Asset Count
              </div>
              <div className="card-body">
                {departmentCounts.length === 0 ? (
                  <div className="text-secondary small">No department asset data available.</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {departmentCounts.map((row) => (
                      <div key={row.name}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-medium">{row.name}</span>
                          <span className="text-secondary">{formatCount(row.count)}</span>
                        </div>
                        <div className="ims-dashboard-progress-track">
                          <div
                            className="ims-dashboard-progress-bar"
                            style={{ width: `${Math.max((row.count / maxDepartmentCount) * 100, 14)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-6">
            <div className="card border-0 shadow-sm h-100 ims-dashboard-panel">
              <div className="card-header bg-white d-flex justify-content-between align-items-center gap-2 fw-semibold">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle text-warning" />
                  Low Stock
                </div>
                <Link className="ims-code-link" href="/reports?type=low_stock">
                  View all
                </Link>
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle ims-dashboard-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Store</th>
                      <th className="text-end">On hand</th>
                      <th className="text-end">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockRows.length === 0 ? (
                      <tr>
                        <td className="text-center text-secondary py-4" colSpan={4}>
                          No low stock items right now.
                        </td>
                      </tr>
                    ) : (
                      lowStockRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.item}</td>
                          <td>{row.store}</td>
                          <td className="text-end">{row.onHand}</td>
                          <td className="text-end">{row.minimum}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="row g-3">
          <div className="col-12 col-xl-6">
            <div className="card border-0 shadow-sm ims-dashboard-panel">
              <div className="card-header bg-white d-flex justify-content-between align-items-center gap-2 fw-semibold">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-truck text-success" />
                  Recent Receipts
                </div>
                <Link className="ims-code-link" href="/inventory-receipts">
                  View all
                </Link>
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle ims-dashboard-table">
                  <thead>
                    <tr>
                      <th>GRN</th>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReceiptRows.length === 0 ? (
                      <tr>
                        <td className="text-center text-secondary py-4" colSpan={4}>
                          No receipt activity available.
                        </td>
                      </tr>
                    ) : (
                      recentReceiptRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.grn}</td>
                          <td>{row.date}</td>
                          <td>{row.supplier}</td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-6">
            <div className="card border-0 shadow-sm ims-dashboard-panel">
              <div className="card-header bg-white d-flex justify-content-between align-items-center gap-2 fw-semibold">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-arrow-left-right text-info" />
                  Recent Movements
                </div>
                <Link className="ims-code-link" href="/issues-returns">
                  View all
                </Link>
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle ims-dashboard-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Item / Asset</th>
                      <th>To Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMovementRows.length === 0 ? (
                      <tr>
                        <td className="text-center text-secondary py-4" colSpan={4}>
                          No movement history available.
                        </td>
                      </tr>
                    ) : (
                      recentMovementRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.date}</td>
                          <td>
                            <StatusBadge status={row.type} />
                          </td>
                          <td>{row.item}</td>
                          <td>{row.department}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
