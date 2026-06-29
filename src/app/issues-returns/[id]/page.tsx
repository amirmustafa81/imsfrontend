"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "departments" | "stores" | "items" | "funding-sources" | "research-projects" | "storage-bins";

type LookupRow = {
  id: number;
  code?: string | null;
  name?: string | null;
  title?: string | null;
  project_code?: string | null;
};

type Transaction = {
  id: number;
  transaction_no: string;
  transaction_type: string;
  transaction_date: string;
  status: string;
  from_department_id: number | null;
  to_department_id: number | null;
  from_store_id: number | null;
  to_store_id: number | null;
  from_storage_bin_id?: number | null;
  to_storage_bin_id?: number | null;
  funding_source_id: number | null;
  project_id: number | null;
  purpose: string | null;
  remarks: string | null;
  manual_approval_ref?: string | null;
  manual_approval_date?: string | null;
  manual_approved_by?: string | null;
  posted_at: string | null;
  created_at: string;
};

type TransactionItem = {
  id: number;
  transaction_id: number;
  item_id: number;
  asset_id: number | null;
  quantity: number;
  unit_cost: number | null;
  remarks: string | null;
};

const initialLookups: Record<LookupKey, LookupRow[]> = {
  departments: [],
  stores: [],
  items: [],
  "funding-sources": [],
  "research-projects": [],
  "storage-bins": [],
};

const toDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.includes("T") ? value.split("T")[0] ?? "-" : value;
};

const toMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toTitle = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const id = Number(params.id);

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, LookupRow[]>>(initialLookups);
  const [message, setMessage] = useState("Loading voucher details...");
  const [error, setError] = useState("");

  const lookupLabel = useCallback(
    (source: LookupKey, value: unknown) => {
      if (value === null || value === undefined || value === "") return "-";

      const row = lookups[source].find((item) => String(item.id) === String(value));
      if (!row) return String(value);

      const code = row.code ?? row.project_code ?? row.id;
      const name = row.name ?? row.title ?? "";
      return `${code}${name ? ` - ${name}` : ""}`;
    },
    [lookups],
  );

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    const keys: LookupKey[] = ["departments", "stores", "items", "funding-sources", "research-projects", "storage-bins"];
    const next: Record<LookupKey, LookupRow[]> = { ...initialLookups };

    await Promise.all(
      keys.map(async (key) => {
        const response = await api.get(`/master-data/${key}`);
        const data = response.data?.data;
        next[key] = Array.isArray(data) ? data : [];
      }),
    );

    setLookups(next);
  }, [authReady]);

  const loadTransaction = useCallback(async () => {
    if (!authReady || Number.isNaN(id) || id <= 0) {
      setError("Unable to resolve this voucher ID.");
      setMessage("");
      return;
    }

    try {
      const response = await api.get(`/inventory-transactions/${id}`);
      const data = response.data?.data ?? response.data?.transaction ?? null;
      const itemRows = response.data?.items ?? data?.items ?? [];

      setTransaction(data);
      setItems(Array.isArray(itemRows) ? itemRows : []);
      setError("");
      setMessage("");
    } catch {
      setTransaction(null);
      setItems([]);
      setMessage("");
      setError("Unable to load voucher details. Check token and permission scope.");
    }
  }, [authReady, id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadTransaction();
  }, [loadTransaction]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const itemColumns = useMemo(
    () => [
      { key: "item", header: "Item", render: (row: TransactionItem) => lookupLabel("items", row.item_id) },
      {
        key: "asset",
        header: "Asset",
        render: (row: TransactionItem) =>
          row.asset_id ? (
            <Link href={`/assets/${row.asset_id}`} className="fw-semibold">
              #{row.asset_id}
            </Link>
          ) : (
            "-"
          ),
      },
      { key: "quantity", header: "Qty", render: (row: TransactionItem) => row.quantity },
      { key: "unit_cost", header: "Unit Cost", render: (row: TransactionItem) => toMoney(row.unit_cost) },
      {
        key: "total",
        header: "Total",
        render: (row: TransactionItem) => toMoney(row.unit_cost === null ? null : Number(row.quantity) * Number(row.unit_cost)),
      },
      { key: "remarks", header: "Remarks", render: (row: TransactionItem) => row.remarks ?? "-" },
    ],
    [lookupLabel],
  );

  if (Number.isNaN(id) || id <= 0) {
    return (
      <main className="min-vh-100 bg-body-tertiary">
        <div className="container-fluid p-4">
          <PageHeader title="Invalid Voucher" subtitle="Selected voucher identifier is invalid." />
          <EmptyState title="Voucher not found" message="Open a valid transaction voucher from the transaction list." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title={transaction ? transaction.transaction_no : "Voucher Detail"}
          subtitle="Transaction voucher details, source/destination scope, manual approval reference, and item lines."
          breadcrumbs={[{ label: "Inventory" }, { label: "Issue / Return / Transfer" }, { label: "Voucher Detail" }]}
          actions={
            <>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => router.back()}>
                <i className="bi bi-arrow-left me-1" />
                Back
              </button>
              <Link className="btn btn-sm btn-primary" href="/issues-returns">
                Transaction List
              </Link>
            </>
          }
        />

        {(message || error) && (
          <div className="mb-4">
            {message && <div className="alert alert-info py-2">{message}</div>}
            {error && <div className="alert alert-danger py-2">{error}</div>}
          </div>
        )}

        {transaction ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-12 col-xl-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                      <div>
                        <div className="text-secondary small text-uppercase">Voucher</div>
                        <div className="fs-5 fw-bold">{transaction.transaction_no}</div>
                      </div>
                      <StatusBadge status={transaction.status} />
                    </div>
                    <dl className="row small mb-0">
                      <dt className="col-5 text-secondary">Type</dt>
                      <dd className="col-7">{toTitle(transaction.transaction_type)}</dd>
                      <dt className="col-5 text-secondary">Date</dt>
                      <dd className="col-7">{toDate(transaction.transaction_date)}</dd>
                      <dt className="col-5 text-secondary">Posted At</dt>
                      <dd className="col-7">{toDate(transaction.posted_at)}</dd>
                      <dt className="col-5 text-secondary">Created</dt>
                      <dd className="col-7">{toDate(transaction.created_at)}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h2 className="h6 fw-semibold mb-3">Movement Scope</h2>
                    <dl className="row small mb-0">
                      <dt className="col-5 text-secondary">From Department</dt>
                      <dd className="col-7">{lookupLabel("departments", transaction.from_department_id)}</dd>
                      <dt className="col-5 text-secondary">From Store</dt>
                      <dd className="col-7">{lookupLabel("stores", transaction.from_store_id)}</dd>
                      <dt className="col-5 text-secondary">From Bin</dt>
                      <dd className="col-7">{lookupLabel("storage-bins", transaction.from_storage_bin_id)}</dd>
                      <dt className="col-5 text-secondary">To Department</dt>
                      <dd className="col-7">{lookupLabel("departments", transaction.to_department_id)}</dd>
                      <dt className="col-5 text-secondary">To Store</dt>
                      <dd className="col-7">{lookupLabel("stores", transaction.to_store_id)}</dd>
                      <dt className="col-5 text-secondary">To Bin</dt>
                      <dd className="col-7">{lookupLabel("storage-bins", transaction.to_storage_bin_id)}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h2 className="h6 fw-semibold mb-3">References</h2>
                    <dl className="row small mb-0">
                      <dt className="col-5 text-secondary">Funding</dt>
                      <dd className="col-7">{lookupLabel("funding-sources", transaction.funding_source_id)}</dd>
                      <dt className="col-5 text-secondary">Project</dt>
                      <dd className="col-7">{lookupLabel("research-projects", transaction.project_id)}</dd>
                      <dt className="col-5 text-secondary">Approval Ref</dt>
                      <dd className="col-7">{transaction.manual_approval_ref ?? "-"}</dd>
                      <dt className="col-5 text-secondary">Approved By</dt>
                      <dd className="col-7">{transaction.manual_approved_by ?? "-"}</dd>
                      <dt className="col-5 text-secondary">Approval Date</dt>
                      <dd className="col-7">{toDate(transaction.manual_approval_date)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <h2 className="h6 fw-semibold">Purpose / Remarks</h2>
                <p className="mb-2">{transaction.purpose ?? "-"}</p>
                <div className="text-secondary small">{transaction.remarks ?? "No remarks recorded."}</div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="h6 fw-semibold mb-0">Voucher item lines</h2>
              <span className="small text-secondary">{items.length} record{items.length === 1 ? "" : "s"}</span>
            </div>
            <DataTable columns={itemColumns} rows={items} empty="No item rows found for this voucher." />
          </>
        ) : error ? (
          <EmptyState title="Voucher not found" message="The selected voucher could not be loaded." icon="bi-receipt" />
        ) : null}
      </div>
    </main>
  );
}
