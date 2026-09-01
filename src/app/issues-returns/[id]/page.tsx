"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { printTransactionDocument } from "@/lib/transaction-print";
import { DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "departments" | "stores" | "buildings" | "rooms" | "items" | "funding-sources" | "research-projects" | "storage-bins";

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
  to_building_id?: number | null;
  to_room_id?: number | null;
  requested_by?: number | null;
  requested_by_name?: string | null;
  requested_by_employee_code?: string | null;
  recipient_user_id?: number | null;
  recipient_user_name?: string | null;
  recipient_employee_code?: string | null;
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

type StockSourceRow = {
  id: number;
  item_id: number;
  department_id: number | null;
  store_id: number | null;
  project_id: number | null;
  funding_source_id: number | null;
  base_uom_code?: string | null;
  base_uom_name?: string | null;
  last_receipt_uom_code?: string | null;
  last_receipt_uom_name?: string | null;
  last_qty_per_receipt_unit?: number | null;
  available_quantity: number;
};

const initialLookups: Record<LookupKey, LookupRow[]> = {
  departments: [],
  stores: [],
  buildings: [],
  rooms: [],
  items: [],
  "funding-sources": [],
  "research-projects": [],
  "storage-bins": [],
};

const toDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.includes("T") ? value.split("T")[0] ?? "-" : value;
};

const formatQuantity = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
};

const toTitle = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const personLabel = (name?: string | null, employeeCode?: string | null, id?: number | null) => {
  if (name && employeeCode) return `${name} (${employeeCode})`;
  if (name) return name;
  if (employeeCode) return employeeCode;
  return id ? `#${id}` : "-";
};

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const id = Number(params.id);

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [stockSourcesByItemId, setStockSourcesByItemId] = useState<Record<string, StockSourceRow[]>>({});
  const [lookups, setLookups] = useState<Record<LookupKey, LookupRow[]>>(initialLookups);
  const [message, setMessage] = useState("Loading voucher details...");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

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

  const loadStockRowsForItem = useCallback(async (itemId: string): Promise<StockSourceRow[]> => {
    if (!itemId) return [];

    try {
      const response = await api.get<{ data?: StockSourceRow[] }>("/reports/stock-balance", {
        params: { item_id: itemId, include_empty: "1" },
      });
      const stockRows = Array.isArray(response.data?.data) ? response.data.data : [];
      setStockSourcesByItemId((current) => ({ ...current, [itemId]: stockRows }));
      return stockRows;
    } catch {
      setStockSourcesByItemId((current) => ({ ...current, [itemId]: [] }));
      return [];
    }
  }, []);

  const matchingStockRowForItem = useCallback(
    (itemId: string, nextTransaction: Transaction | null = transaction): StockSourceRow | undefined => {
      const rows = stockSourcesByItemId[itemId] ?? [];
      if (!rows.length) return undefined;

      const exactMatch = nextTransaction
        ? rows.find(
            (row) =>
              (!nextTransaction.from_department_id || row.department_id === nextTransaction.from_department_id) &&
              (!nextTransaction.from_store_id || row.store_id === nextTransaction.from_store_id) &&
              (!nextTransaction.project_id || row.project_id === nextTransaction.project_id) &&
              (!nextTransaction.funding_source_id || row.funding_source_id === nextTransaction.funding_source_id),
          )
        : undefined;

      return exactMatch ?? rows.find((row) => Number(row.available_quantity ?? 0) > 0) ?? rows[0];
    },
    [stockSourcesByItemId, transaction],
  );

  const transactionQuantityLabel = useCallback(
    (item: TransactionItem) => {
      const baseQuantity = Number(item.quantity ?? 0);
      const stockSource = matchingStockRowForItem(String(item.item_id));
      const baseCode = String(stockSource?.base_uom_code ?? stockSource?.base_uom_name ?? "").trim();
      const packageCode = String(stockSource?.last_receipt_uom_code ?? stockSource?.last_receipt_uom_name ?? "").trim();
      const qtyPer = Number(stockSource?.last_qty_per_receipt_unit ?? 0);

      if (packageCode && baseCode && packageCode !== baseCode && Number.isFinite(qtyPer) && qtyPer > 0 && baseQuantity > 0) {
        const shouldShowBaseCode = baseCode.toUpperCase() !== "EACH";

        return (
          <div className="stock-quantity-cell">
            <span>
              {formatQuantity(baseQuantity / qtyPer)} {packageCode}
            </span>
            <small>
              {formatQuantity(baseQuantity)}
              {shouldShowBaseCode ? ` ${baseCode}` : ""}
            </small>
          </div>
        );
      }

      return (
        <span>
          {formatQuantity(baseQuantity)}
          {baseCode ? ` ${baseCode}` : ""}
        </span>
      );
    },
    [matchingStockRowForItem],
  );

  const transactionQuantityPrintLabel = useCallback(
    (item: TransactionItem) => {
      const baseQuantity = Number(item.quantity ?? 0);
      const stockSource = matchingStockRowForItem(String(item.item_id));
      const baseCode = String(stockSource?.base_uom_code ?? stockSource?.base_uom_name ?? "").trim();
      const packageCode = String(stockSource?.last_receipt_uom_code ?? stockSource?.last_receipt_uom_name ?? "").trim();
      const qtyPer = Number(stockSource?.last_qty_per_receipt_unit ?? 0);

      if (packageCode && baseCode && packageCode !== baseCode && Number.isFinite(qtyPer) && qtyPer > 0 && baseQuantity > 0) {
        const baseSuffix = baseCode.toUpperCase() === "EACH" ? "" : ` ${baseCode}`;
        return `${formatQuantity(baseQuantity / qtyPer)} ${packageCode} (${formatQuantity(baseQuantity)}${baseSuffix})`;
      }

      return `${formatQuantity(baseQuantity)}${baseCode ? ` ${baseCode}` : ""}`;
    },
    [matchingStockRowForItem],
  );

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    const keys: LookupKey[] = ["departments", "stores", "buildings", "rooms", "items", "funding-sources", "research-projects", "storage-bins"];
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
      const normalizedItems = Array.isArray(itemRows) ? (itemRows as TransactionItem[]) : [];

      setTransaction(data);
      setItems(normalizedItems);
      await Promise.all(
        [...new Set(normalizedItems.filter((item) => item.item_id).map((item) => String(item.item_id)))].map((itemId) =>
          loadStockRowsForItem(itemId),
        ),
      );
      setError("");
      setMessage("");
    } catch {
      setTransaction(null);
      setItems([]);
      setMessage("");
      setError("Unable to load voucher details. Check token and permission scope.");
    }
  }, [authReady, id, loadStockRowsForItem]);

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
      { key: "quantity", header: "Qty", className: "text-end", render: (row: TransactionItem) => transactionQuantityLabel(row) },
      { key: "remarks", header: "Remarks", render: (row: TransactionItem) => row.remarks ?? "-" },
    ],
    [lookupLabel, transactionQuantityLabel],
  );

  const printVoucher = () => {
    if (!transaction) return;

    const printed = printTransactionDocument<TransactionItem>({
      title: `${toTitle(transaction.transaction_type)} Voucher`,
      subtitle: "Inventory movement voucher details and item lines.",
      reference: transaction.transaction_no,
      status: transaction.status,
      meta: [
        { label: "Voucher No", value: transaction.transaction_no },
        { label: "Type", value: toTitle(transaction.transaction_type) },
        { label: "Date", value: toDate(transaction.transaction_date) },
        { label: "From Department", value: lookupLabel("departments", transaction.from_department_id) },
        { label: "From Store", value: lookupLabel("stores", transaction.from_store_id) },
        { label: "From Bin", value: lookupLabel("storage-bins", transaction.from_storage_bin_id) },
        { label: "To Department", value: lookupLabel("departments", transaction.to_department_id) },
        { label: "To Store", value: lookupLabel("stores", transaction.to_store_id) },
        { label: "To Bin", value: lookupLabel("storage-bins", transaction.to_storage_bin_id) },
        { label: "To Building", value: lookupLabel("buildings", transaction.to_building_id) },
        { label: "To Room", value: lookupLabel("rooms", transaction.to_room_id) },
        {
          label: "Requested By",
          value: personLabel(transaction.requested_by_name, transaction.requested_by_employee_code, transaction.requested_by),
        },
        {
          label: "Recipient",
          value: personLabel(transaction.recipient_user_name, transaction.recipient_employee_code, transaction.recipient_user_id),
        },
        { label: "Funding", value: lookupLabel("funding-sources", transaction.funding_source_id) },
        { label: "Project", value: lookupLabel("research-projects", transaction.project_id) },
        { label: "Approval Ref", value: transaction.manual_approval_ref },
        { label: "Approved By", value: transaction.manual_approved_by },
        { label: "Approval Date", value: toDate(transaction.manual_approval_date) },
        { label: "Posted At", value: toDate(transaction.posted_at) },
      ],
      columns: [
        { header: "Item", render: (row) => lookupLabel("items", row.item_id) },
        { header: "Quantity", render: (row) => transactionQuantityPrintLabel(row) },
        { header: "Remarks", render: (row) => row.remarks },
      ],
      rows: items,
      note: transaction.remarks ?? transaction.purpose,
    });

    if (!printed) {
      setError("Popup blocked. Please allow popups to print this voucher.");
    }
  };

  const postVoucher = async () => {
    if (!transaction || transaction.status !== "draft" || posting) return;

    setPosting(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/inventory-transactions/${transaction.id}/post`, {});
      setMessage("Transaction posted.");
      await loadTransaction();
    } catch (postError) {
      const apiMessage =
        typeof postError === "object" && postError !== null && "response" in postError
          ? (postError as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;

      setError(typeof apiMessage === "string" && apiMessage.trim() ? apiMessage : "Post failed. Verify stock and transaction status.");
    } finally {
      setPosting(false);
    }
  };

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
              {transaction?.status === "draft" ? (
                <>
                  <Link className="btn btn-sm btn-outline-primary" href={`/issues-returns?edit=${transaction.id}`}>
                    <i className="bi bi-pencil-square me-1" />
                    Edit Draft
                  </Link>
                  <button className="btn btn-sm btn-outline-success" type="button" onClick={postVoucher} disabled={posting}>
                    <i className="bi bi-upload me-1" />
                    {posting ? "Posting..." : "Post"}
                  </button>
                </>
              ) : null}
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={printVoucher} disabled={!transaction}>
                <i className="bi bi-printer me-1" />
                Print
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
                      <dt className="col-5 text-secondary">To Building</dt>
                      <dd className="col-7">{lookupLabel("buildings", transaction.to_building_id)}</dd>
                      <dt className="col-5 text-secondary">To Room</dt>
                      <dd className="col-7">{lookupLabel("rooms", transaction.to_room_id)}</dd>
                      <dt className="col-5 text-secondary">Requested By</dt>
                      <dd className="col-7">
                        {personLabel(transaction.requested_by_name, transaction.requested_by_employee_code, transaction.requested_by)}
                      </dd>
                      <dt className="col-5 text-secondary">Recipient</dt>
                      <dd className="col-7">
                        {personLabel(transaction.recipient_user_name, transaction.recipient_employee_code, transaction.recipient_user_id)}
                      </dd>
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
