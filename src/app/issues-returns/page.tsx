"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LookupKey = "departments" | "stores" | "items" | "funding-sources" | "research-projects";

type TransactionType = "issue" | "return" | "transfer" | "consumption" | "adjustment";

type TransactionStatus = "draft" | "posted" | "cancelled";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type Transaction = {
  id: number;
  transaction_no: string;
  transaction_type: TransactionType;
  transaction_date: string;
  status: TransactionStatus;
  from_department_id: number | null;
  to_department_id: number | null;
  from_store_id: number | null;
  to_store_id: number | null;
  project_id: number | null;
  funding_source_id: number | null;
  purpose: string | null;
  remarks: string | null;
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

type TransactionItemInput = {
  item_id: string;
  asset_id: string;
  quantity: string;
  unit_cost: string;
  remarks: string;
};

type TransactionForm = {
  transaction_no: string;
  transaction_type: TransactionType;
  adjustment_direction: "increase" | "decrease";
  transaction_date: string;
  from_department_id: string;
  to_department_id: string;
  from_store_id: string;
  to_store_id: string;
  funding_source_id: string;
  project_id: string;
  manual_approval_ref: string;
  manual_approval_date: string;
  manual_approved_by: string;
  purpose: string;
  remarks: string;
  status: TransactionStatus;
  post_now: boolean;
};

const typeColors: Record<TransactionType, string> = {
  issue: "text-bg-danger",
  return: "text-bg-success",
  transfer: "text-bg-primary",
  consumption: "text-bg-secondary",
  adjustment: "text-bg-info",
};

const typeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: "issue", label: "Issue" },
  { value: "return", label: "Return" },
  { value: "transfer", label: "Transfer" },
  { value: "consumption", label: "Consumption" },
  { value: "adjustment", label: "Adjustment" },
];

const statusColors: Record<TransactionStatus, string> = {
  draft: "text-bg-warning",
  posted: "text-bg-success",
  cancelled: "text-bg-danger",
};

const emptyItem: TransactionItemInput = {
  item_id: "",
  asset_id: "",
  quantity: "",
  unit_cost: "",
  remarks: "",
};

const defaultForm: TransactionForm = {
  transaction_no: "",
  transaction_type: "issue",
  adjustment_direction: "increase",
  transaction_date: new Date().toISOString().slice(0, 10),
  from_department_id: "",
  to_department_id: "",
  from_store_id: "",
  to_store_id: "",
  funding_source_id: "",
  project_id: "",
  manual_approval_ref: "",
  manual_approval_date: "",
  manual_approved_by: "",
  purpose: "",
  remarks: "",
  status: "draft",
  post_now: false,
};

const toPayloadDate = (value: string): string | null => (value.trim() ? value : null);

const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function IssuesReturnsPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [rows, setRows] = useState<Transaction[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({
    departments: [],
    stores: [],
    items: [],
    "funding-sources": [],
    "research-projects": [],
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [form, setForm] = useState<TransactionForm>(defaultForm);
  const [items, setItems] = useState<TransactionItemInput[]>([emptyItem]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, TransactionItem[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const lookupLabel = (source: LookupKey, value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";

    const rows = lookups[source] ?? [];
    const match = rows.find((row) => String(row.id) === String(value));
    if (!match) return String(value);

    return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? match.title_code ?? ""}`;
  };

  const loadRows = useCallback(async () => {
    if (!token) return;

    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.transaction_type = typeFilter;
    if (departmentFilter) params.department_id = departmentFilter;
    if (storeFilter) params.store_id = storeFilter;

    try {
      const response = await api.get("/inventory-transactions", {
        ...authHeaders,
        params,
      });
      const data = response.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load transactions.");
    }
  }, [token, search, statusFilter, typeFilter, departmentFilter, storeFilter, authHeaders]);

  useEffect(() => {
    (async () => {
      await loadRows();
    })();
  }, [loadRows]);

  useEffect(() => {
    if (!token) return;

    const requiredLookups: LookupKey[] = [
      "departments",
      "stores",
      "items",
      "funding-sources",
      "research-projects",
    ];

    const loadLookups = async () => {
      const next = requiredLookups.reduce<Record<LookupKey, RowData[]>>(
        (acc, key) => {
          acc[key] = [];
          return acc;
        },
        {
          departments: [],
          stores: [],
          items: [],
          "funding-sources": [],
          "research-projects": [],
        },
      );

      const requests = requiredLookups.map(async (key) => {
        const response = await api.get(`/master-data/${key}`, { ...authHeaders });
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[key] = payload;
        }
      });

      await Promise.all(requests);
      setLookups(next);
    };

    void loadLookups();
  }, [token, authHeaders]);

  const submitToken = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
    setMessage("Token saved. Reloading transactions.");
    setError("");
  };

  const setFormValue = (key: keyof TransactionForm, value: string | boolean) => {
    if (key === "transaction_type" && typeof value === "string") {
      setItems([emptyItem]);
      setForm((current) => {
        const next = {
          ...current,
          [key]: value as TransactionType,
        };

        if (value === "return") {
          next.from_department_id = "";
          next.from_store_id = "";
          next.adjustment_direction = "increase";
        }

        if (value === "issue" || value === "consumption") {
          next.to_department_id = "";
          next.to_store_id = "";
          next.adjustment_direction = "decrease";
        }

        if (value === "adjustment") {
          next.from_department_id = "";
          next.from_store_id = "";
          next.to_department_id = "";
          next.to_store_id = "";
          next.adjustment_direction = "increase";
        }

        return next;
      });
      return;
    }

    if (key === "adjustment_direction" && typeof value === "string") {
      setForm((current) => {
        if (current.transaction_type !== "adjustment") {
          return current;
        }

        const next: TransactionForm = {
          ...current,
          [key]: value as TransactionForm["adjustment_direction"],
          from_department_id: "",
          from_store_id: "",
          to_department_id: "",
          to_store_id: "",
        };

        return next;
      });
      return;
    }

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setItemValue = (index: number, key: keyof TransactionItemInput, value: string) => {
    setItems((current) =>
      current.map((row, idx) => {
        if (idx !== index) return row;
        return { ...row, [key]: value };
      }),
    );
  };

  const addItemRow = () => setItems((current) => [...current, { ...emptyItem }]);

  const removeItemRow = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setItems([emptyItem]);
  };

  const canSubmitType = (type: TransactionType, adjustmentDirection: TransactionForm["adjustment_direction"]): string[] => {
    if (type === "issue" || type === "consumption") {
      return ["from_department_id", "from_store_id"];
    }

    if (type === "adjustment") {
      return adjustmentDirection === "increase" ? ["to_department_id", "to_store_id"] : ["from_department_id", "from_store_id"];
    }

    if (type === "return") {
      return ["to_department_id", "to_store_id"];
    }

    return ["from_department_id", "from_store_id", "to_department_id", "to_store_id"];
  };

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Save token first.");
      return;
    }

    const required = canSubmitType(form.transaction_type, form.adjustment_direction);
    for (const field of required) {
      if (!String(form[field as keyof TransactionForm] ?? "").trim()) {
        setError(`Please complete ${field.replaceAll("_", " ")} for ${form.transaction_type}.`);
        return;
      }
    }

    const rowsToPost = items
      .map((row): TransactionItemInput | null => {
        const itemId = Number(row.item_id);
        const qty = numberOrNull(row.quantity);
        if (!itemId || !qty || qty <= 0) return null;
        return row;
      })
      .filter((r): r is TransactionItemInput => r !== null);

    if (!rowsToPost.length) {
      setError("At least one valid item row with quantity is required.");
      return;
    }

    const payload = {
      transaction_no: form.transaction_no.trim(),
      transaction_type: form.transaction_type,
      transaction_date: form.transaction_date,
      from_department_id: numberOrNull(form.from_department_id),
      to_department_id: numberOrNull(form.to_department_id),
      from_store_id: numberOrNull(form.from_store_id),
      to_store_id: numberOrNull(form.to_store_id),
      funding_source_id: numberOrNull(form.funding_source_id),
      project_id: numberOrNull(form.project_id),
      manual_approval_ref: form.manual_approval_ref.trim() || null,
      manual_approval_date: toPayloadDate(form.manual_approval_date),
      manual_approved_by: form.manual_approved_by.trim() || null,
      purpose: form.purpose.trim() || null,
      remarks: form.remarks.trim() || null,
      status: form.status,
      post_now: form.post_now,
      items: rowsToPost.map((row) => ({
        item_id: Number(row.item_id),
        asset_id: numberOrNull(row.asset_id),
        quantity: Number(row.quantity),
        unit_cost: numberOrNull(row.unit_cost),
        remarks: row.remarks.trim() || null,
      })),
    };

    try {
      const response = await api.post("/inventory-transactions", payload, authHeaders);
      if (response.data?.transaction) {
        setMessage(`Transaction saved with id ${response.data.transaction.id}`);
      } else if (response.data?.data?.id) {
        setMessage("Transaction created.");
      }

      resetForm();
      await loadRows();
    } catch (error: unknown) {
      const apiErrorMessage =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;

      setError(typeof apiErrorMessage === "string" ? apiErrorMessage : "Failed to save transaction. Check unique voucher number and fields.");
    }
  };

  const loadItems = async (transactionId: number) => {
    if (expandedItems[transactionId]) return;

    setExpandedLoading((prev) => ({ ...prev, [transactionId]: true }));
    try {
      const response = await api.get(`/inventory-transactions/${transactionId}`, {
        ...authHeaders,
      });

      const itemRows = response.data?.items;
      setExpandedItems((prev) => ({
        ...prev,
        [transactionId]: Array.isArray(itemRows) ? itemRows : [],
      }));
      setError("");
    } catch {
      setExpandedItems((prev) => ({ ...prev, [transactionId]: [] }));
      setError("Could not load transaction items.");
    } finally {
      setExpandedLoading((prev) => ({ ...prev, [transactionId]: false }));
    }
  };

  const toggleExpand = async (transactionId: number) => {
    if (expandedId === transactionId) {
      setExpandedId(null);
      return;
    }

    await loadItems(transactionId);
    setExpandedId(transactionId);
  };

  const postTransaction = async (id: number) => {
    try {
      const response = await api.post(`/inventory-transactions/${id}/post`, {}, authHeaders);
      setMessage(response.data?.message ?? "Transaction posted.");
      setError("");
      await loadRows();
    } catch {
      setError("Post failed. Verify stock and transaction status.");
    }
  };

  const deleteTransaction = async (id: number) => {
    try {
      await api.delete(`/inventory-transactions/${id}`, authHeaders);
      setMessage("Transaction deleted.");
      setError("");
      await loadRows();
      if (expandedId === id) {
        setExpandedId(null);
      }
    } catch {
      setError("Delete failed. Only draft transactions can be deleted.");
    }
  };

  const renderScopeHint = () => {
    if (form.transaction_type === "issue" || form.transaction_type === "consumption") {
      return "Issue/consumption uses source department/store only.";
    }
    if (form.transaction_type === "return") {
      return "Return uses destination department/store only.";
    }
    if (form.transaction_type === "adjustment") {
      return form.adjustment_direction === "increase" ? "Adjustment increase uses destination department/store only." : "Adjustment decrease uses source department/store only.";
    }
    return "Transfer uses both source and destination.";
  };

  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <Link href="/" className="btn btn-link px-0 mb-3">
          <i className="bi bi-arrow-left me-2" />
          Dashboard
        </Link>

        <div className="row g-3 mb-4">
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">API Token</div>
              <div className="card-body">
                <label className="form-label small">Bearer token</label>
                <div className="input-group">
                  <input
                    type="text"
                    value={tmpToken}
                    onChange={(e) => setTmpToken(e.target.value)}
                    className="form-control"
                    placeholder="Paste API token"
                  />
                  <button type="button" className="btn btn-outline-primary" onClick={submitToken}>
                    Save token
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="row g-3">
              <div className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <h1 className="h4 mb-3">Issue / Return / Transfer / Adjustment</h1>
                    <p className="text-secondary mb-0">
                      Create stock movement vouchers and post to update balances for issue, return, transfer, adjustment, and consumption.
                    </p>
                  </div>
                </div>
              </div>
              {(message || error) && (
                <div className="col-12">
                  {message && <div className="alert alert-success mb-0">{String(message)}</div>}
                  {error && <div className="alert alert-danger mb-0">{error}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="row g-4">
          <section className="col-12 col-xxl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">New Voucher</div>
              <div className="card-body">
                <form onSubmit={saveTransaction}>
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Voucher type</label>
                      <select
                        className="form-select"
                        value={form.transaction_type}
                        onChange={(e) => setFormValue("transaction_type", e.target.value as TransactionType)}
                      >
                        {typeOptions.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">{renderScopeHint()}</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Transaction no</label>
                      <input
                        className="form-control"
                        value={form.transaction_no}
                        required
                        onChange={(e) => setFormValue("transaction_no", e.target.value)}
                        placeholder="INV-2026-0001"
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Transaction date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.transaction_date}
                        onChange={(e) => setFormValue("transaction_date", e.target.value)}
                      />
                    </div>

                    {form.transaction_type === "adjustment" && (
                      <div className="col-12">
                        <label className="form-label mb-1 small">Adjustment direction</label>
                        <div className="btn-group w-100" role="group" aria-label="Adjustment direction">
                          <input
                            type="radio"
                            className="btn-check"
                            id="adjustment-increase"
                            name="adjustment_direction"
                            autoComplete="off"
                            value="increase"
                            checked={form.adjustment_direction === "increase"}
                            onChange={(event) => setFormValue("adjustment_direction", event.target.value)}
                          />
                          <label className="btn btn-outline-success" htmlFor="adjustment-increase">
                            Increase stock
                          </label>
                          <input
                            type="radio"
                            className="btn-check"
                            id="adjustment-decrease"
                            name="adjustment_direction"
                            autoComplete="off"
                            value="decrease"
                            checked={form.adjustment_direction === "decrease"}
                            onChange={(event) => setFormValue("adjustment_direction", event.target.value)}
                          />
                          <label className="btn btn-outline-warning" htmlFor="adjustment-decrease">
                            Decrease stock
                          </label>
                        </div>
                      </div>
                    )}

                    {(form.transaction_type === "issue" || form.transaction_type === "consumption" || form.transaction_type === "transfer" || (form.transaction_type === "adjustment" && form.adjustment_direction === "decrease")) && (
                      <>
                        <div className="col-12 col-md-6">
                          <label className="form-label">From Department</label>
                          <select
                            className="form-select"
                            value={form.from_department_id}
                            onChange={(e) => setFormValue("from_department_id", e.target.value)}
                          >
                            <option value="">Select</option>
                            {lookups.departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.code} - {department.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">From Store</label>
                          <select
                            className="form-select"
                            value={form.from_store_id}
                            onChange={(e) => setFormValue("from_store_id", e.target.value)}
                          >
                            <option value="">Select</option>
                            {lookups.stores.map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.code} - {store.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {(form.transaction_type === "return" || form.transaction_type === "transfer" || (form.transaction_type === "adjustment" && form.adjustment_direction === "increase")) && (
                      <>
                        <div className="col-12 col-md-6">
                          <label className="form-label">To Department</label>
                          <select
                            className="form-select"
                            value={form.to_department_id}
                            onChange={(e) => setFormValue("to_department_id", e.target.value)}
                          >
                            <option value="">Select</option>
                            {lookups.departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.code} - {department.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">To Store</label>
                          <select
                            className="form-select"
                            value={form.to_store_id}
                            onChange={(e) => setFormValue("to_store_id", e.target.value)}
                          >
                            <option value="">Select</option>
                            {lookups.stores.map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.code} - {store.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="col-12 col-md-6">
                      <label className="form-label">Funding Source</label>
                      <select
                        className="form-select"
                        value={form.funding_source_id}
                        onChange={(e) => setFormValue("funding_source_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups["funding-sources"].map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.code} - {source.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Research Project</label>
                      <select
                        className="form-select"
                        value={form.project_id}
                        onChange={(e) => setFormValue("project_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups["research-projects"].map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.project_code} - {project.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Purpose</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={form.purpose}
                        onChange={(e) => setFormValue("purpose", e.target.value)}
                        placeholder="Issue/return reason"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Remarks</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={form.remarks}
                        onChange={(e) => setFormValue("remarks", e.target.value)}
                        placeholder="Manual approval notes / comments"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Manual approval reference</label>
                      <input
                        className="form-control"
                        value={form.manual_approval_ref}
                        onChange={(e) => setFormValue("manual_approval_ref", e.target.value)}
                        placeholder="e.g. PO/MANUAL/2026"
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Manual approval date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.manual_approval_date}
                        onChange={(e) => setFormValue("manual_approval_date", e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Manual approval by</label>
                      <input
                        className="form-control"
                        value={form.manual_approved_by}
                        onChange={(e) => setFormValue("manual_approved_by", e.target.value)}
                        placeholder="Approving officer"
                      />
                    </div>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="h5 mb-0">Items</h2>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={addItemRow}>
                      <i className="bi bi-plus-lg me-1" />
                      Add item
                    </button>
                  </div>

                  {items.map((item, index) => (
                    <div className="row g-2 align-items-end mb-3" key={`${index}-${item.item_id || "new"}`}>
                      <div className="col-12 col-xl-3">
                        <label className="form-label mb-1 small">Item</label>
                        <select
                          className="form-select"
                          value={item.item_id}
                          onChange={(e) => setItemValue(index, "item_id", e.target.value)}
                        >
                          <option value="">Select item</option>
                          {lookups.items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.item_code} - {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-xl-3">
                        <label className="form-label mb-1 small">Asset ID (optional)</label>
                        <input
                          className="form-control"
                          value={item.asset_id}
                          onChange={(e) => setItemValue(index, "asset_id", e.target.value)}
                          placeholder="Optional fixed asset ID"
                        />
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Quantity</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="form-control"
                          value={item.quantity}
                          onChange={(e) => setItemValue(index, "quantity", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Unit Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          value={item.unit_cost}
                          onChange={(e) => setItemValue(index, "unit_cost", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-12 col-xl-1">
                        <button
                          type="button"
                          className="btn btn-outline-danger w-100"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length === 1}
                          aria-label="Remove row"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                      <div className="col-12">
                        <label className="form-label mb-1 small">Remarks</label>
                        <textarea
                          className="form-control"
                          rows={1}
                          value={item.remarks}
                          onChange={(e) => setItemValue(index, "remarks", e.target.value)}
                          placeholder="Serial/location/condition notes"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-check-label d-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={form.post_now}
                          onChange={(e) => setFormValue("post_now", e.target.checked)}
                        />
                        Post immediately after save
                      </label>
                    </div>

                    <div className="col-12 d-flex justify-content-end">
                      <button type="submit" className="btn btn-primary">
                        <i className="bi bi-save me-2" />
                        Save Transaction
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>

          <section className="col-12 col-xxl-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Transaction List</div>
              <div className="card-body">
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-5">
                    <input
                      className="form-control"
                      placeholder="Search voucher number / purpose / remarks"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      <option value="draft">Draft</option>
                      <option value="posted">Posted</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType | "")}>
                      <option value="">All types</option>
                      {typeOptions.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-1">
                    <select className="form-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                      <option value="">All departments</option>
                      {lookups.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <select className="form-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                      <option value="">All stores</option>
                      {lookups.stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Voucher</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>From / To</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <button className="btn btn-link p-0" onClick={() => toggleExpand(row.id)} type="button">
                              <i className="bi bi-list me-2" />
                              {row.transaction_no}
                            </button>
                            <div className="small text-secondary">
                              {row.purpose ?? "-"}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${typeColors[row.transaction_type as TransactionType] ?? "text-bg-secondary"}`}>
                              {row.transaction_type}
                            </span>
                          </td>
                          <td>{row.transaction_date}</td>
                          <td>
                            <div className="small">
                              <div>
                                <strong>From:</strong> {lookupLabel("departments", row.from_department_id)} /{" "}
                                {lookupLabel("stores", row.from_store_id)}
                              </div>
                              <div>
                                <strong>To:</strong> {lookupLabel("departments", row.to_department_id)} /{" "}
                                {lookupLabel("stores", row.to_store_id)}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${statusColors[row.status]}`}>{row.status}</span>
                          </td>
                          <td className="text-end">
                            <div className="btn-group">
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleExpand(row.id)} title="View items">
                                <i className="bi bi-eye" />
                              </button>
                              {row.status !== "posted" && (
                                <>
                                  <button type="button" className="btn btn-sm btn-outline-success" onClick={() => postTransaction(row.id)} title="Post">
                                    <i className="bi bi-upload" />
                                  </button>
                                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteTransaction(row.id)} title="Delete">
                                    <i className="bi bi-trash" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {expandedId && (
                  <div className="mt-3">
                    <h3 className="h6">Transaction items for #{expandedId}</h3>
                    {expandedLoading[expandedId] ? (
                      <div className="text-secondary">Loading items...</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Asset</th>
                              <th>Qty</th>
                              <th>Unit Cost</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(expandedItems[expandedId] ?? []).map((item) => (
                              <tr key={item.id}>
                                <td>{lookupLabel("items", item.item_id)}</td>
                                <td>{item.asset_id ?? "-"}</td>
                                <td>{item.quantity}</td>
                                <td>{item.unit_cost ?? "-"}</td>
                                <td>{item.remarks ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
