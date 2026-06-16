"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LookupKey = "departments" | "stores" | "items" | "funding-sources" | "research-projects";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type Transfer = {
  id: number;
  transaction_no: string;
  transaction_date: string;
  status: "draft" | "posted" | "cancelled";
  from_department_id: number | null;
  to_department_id: number | null;
  from_store_id: number | null;
  to_store_id: number | null;
  project_id: number | null;
  funding_source_id: number | null;
  purpose: string | null;
  remarks: string | null;
};

type TransferItem = {
  id: number;
  transaction_id: number;
  item_id: number;
  asset_id: number | null;
  quantity: number;
  unit_cost: number | null;
  remarks: string | null;
};

type TransferItemInput = {
  item_id: string;
  asset_id: string;
  quantity: string;
  unit_cost: string;
  remarks: string;
};

type TransferForm = {
  transaction_no: string;
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
  status: "draft" | "posted" | "cancelled";
  post_now: boolean;
};

const emptyItem: TransferItemInput = {
  item_id: "",
  asset_id: "",
  quantity: "",
  unit_cost: "",
  remarks: "",
};

const defaultForm: TransferForm = {
  transaction_no: "",
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

export default function TransfersPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [rows, setRows] = useState<Transfer[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({
    departments: [],
    stores: [],
    items: [],
    "funding-sources": [],
    "research-projects": [],
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [form, setForm] = useState<TransferForm>(defaultForm);
  const [items, setItems] = useState<TransferItemInput[]>([emptyItem]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, TransferItem[]>>({});
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

    return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? ""}`;
  };

  const loadRows = useCallback(async () => {
    if (!token) return;

    const params: Record<string, string> = {
      transaction_type: "transfer",
    };

    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
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
      setError("Unable to load transfer transactions.");
    }
  }, [token, search, statusFilter, departmentFilter, storeFilter, authHeaders]);

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
    setMessage("Token saved. Reloading transfers.");
    setError("");
  };

  const setFormValue = (key: keyof TransferForm, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setItemValue = (index: number, key: keyof TransferItemInput, value: string) => {
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

  const saveTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Save token first.");
      return;
    }

    const requiredSource = [
      "from_department_id",
      "to_department_id",
      "from_store_id",
      "to_store_id",
    ];

    for (const field of requiredSource) {
      if (!String(form[field as keyof TransferForm] ?? "").trim()) {
        setError(`Please complete ${field.replaceAll("_", " ")} for transfer.`);
        return;
      }
    }

    if (form.from_department_id === form.to_department_id && form.from_store_id === form.to_store_id) {
      setError("Source and destination cannot be the same.");
      return;
    }

    const rowsToPost = items
      .map((row): TransferItemInput | null => {
        const itemId = Number(row.item_id);
        const quantity = numberOrNull(row.quantity);
        if (!itemId || !quantity || quantity <= 0) return null;
        return row;
      })
      .filter((row): row is TransferItemInput => row !== null);

    if (!rowsToPost.length) {
      setError("At least one valid item row with quantity is required.");
      return;
    }

    const payload = {
      transaction_no: form.transaction_no.trim(),
      transaction_type: "transfer",
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
        setMessage(`Transfer saved with id ${response.data.transaction.id}`);
      } else {
        setMessage("Transfer saved.");
      }

      resetForm();
      await loadRows();
    } catch {
      setError("Failed to save transfer. Check unique transfer number and stock availability.");
    }
  };

  const loadItems = async (transferId: number) => {
    if (expandedItems[transferId]) return;

    setExpandedLoading((prev) => ({ ...prev, [transferId]: true }));
    try {
      const response = await api.get(`/inventory-transactions/${transferId}`, {
        ...authHeaders,
      });
      const itemRows = response.data?.items;
      setExpandedItems((prev) => ({
        ...prev,
        [transferId]: Array.isArray(itemRows) ? itemRows : [],
      }));
      setError("");
    } catch {
      setExpandedItems((prev) => ({ ...prev, [transferId]: [] }));
      setError("Could not load transfer items.");
    } finally {
      setExpandedLoading((prev) => ({ ...prev, [transferId]: false }));
    }
  };

  const toggleExpand = async (transferId: number) => {
    if (expandedId === transferId) {
      setExpandedId(null);
      return;
    }
    await loadItems(transferId);
    setExpandedId(transferId);
  };

  const postTransfer = async (id: number) => {
    try {
      const response = await api.post(`/inventory-transactions/${id}/post`, {}, authHeaders);
      setMessage(response.data?.message ?? "Transfer posted.");
      setError("");
      await loadRows();
    } catch {
      setError("Post failed. Verify stock availability and transfer status.");
    }
  };

  const deleteTransfer = async (id: number) => {
    try {
      await api.delete(`/inventory-transactions/${id}`, authHeaders);
      setMessage("Transfer deleted.");
      setError("");
      await loadRows();
      if (expandedId === id) {
        setExpandedId(null);
      }
    } catch {
      setError("Delete failed. Only draft transfers can be deleted.");
    }
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
                    <h1 className="h4 mb-3">Asset Transfers</h1>
                    <p className="text-secondary mb-0">
                      Create internal transfer transactions and post to move stock between departments and stores.
                    </p>
                  </div>
                </div>
              </div>
              {(message || error) && (
                <div className="col-12">
                  {message && <div className="alert alert-success mb-0">{message}</div>}
                  {error && <div className="alert alert-danger mb-0">{error}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="row g-4">
          <section className="col-12 col-xxl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">New Transfer</div>
              <div className="card-body">
                <form onSubmit={saveTransfer}>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Transfer no</label>
                      <input
                        className="form-control"
                        value={form.transaction_no}
                        required
                        onChange={(e) => setFormValue("transaction_no", e.target.value)}
                        placeholder="TRF-2026-0001"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Transfer date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.transaction_date}
                        onChange={(e) => setFormValue("transaction_date", e.target.value)}
                      />
                    </div>

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
                      <label className="form-label">Manual approval reference</label>
                      <input
                        className="form-control"
                        value={form.manual_approval_ref}
                        onChange={(e) => setFormValue("manual_approval_ref", e.target.value)}
                        placeholder="e.g. MO/2026/011"
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
                        placeholder="Approver name"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Purpose</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={form.purpose}
                        onChange={(e) => setFormValue("purpose", e.target.value)}
                        placeholder="Transfer reason"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Remarks</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={form.remarks}
                        onChange={(e) => setFormValue("remarks", e.target.value)}
                        placeholder="Notes and comments"
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
                        <label className="form-label mb-1 small">Asset ID</label>
                        <input
                          className="form-control"
                          value={item.asset_id}
                          onChange={(e) => setItemValue(index, "asset_id", e.target.value)}
                          placeholder="Optional fixed asset"
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
                        Save Transfer
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>

          <section className="col-12 col-xxl-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Transfer List</div>
              <div className="card-body">
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <input
                      className="form-control"
                      placeholder="Search transfer number / purpose / remarks"
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
                  <div className="col-12 col-md-3">
                    <select className="form-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                      <option value="">All departments</option>
                      {lookups.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code} - {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <select className="form-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                      <option value="">All stores</option>
                      {lookups.stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.code} - {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Transfer</th>
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
                            <div className="small text-secondary">{row.purpose ?? "-"}</div>
                          </td>
                          <td>{row.transaction_date}</td>
                          <td>
                            <div className="small">
                              <div>
                                <strong>From:</strong> {lookupLabel("departments", row.from_department_id)} / {lookupLabel("stores", row.from_store_id)}
                              </div>
                              <div>
                                <strong>To:</strong> {lookupLabel("departments", row.to_department_id)} / {lookupLabel("stores", row.to_store_id)}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${row.status === "draft" ? "text-bg-warning" : row.status === "posted" ? "text-bg-success" : "text-bg-danger"}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="btn-group">
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleExpand(row.id)} title="View items">
                                <i className="bi bi-eye" />
                              </button>
                              {row.status !== "posted" && (
                                <>
                                  <button type="button" className="btn btn-sm btn-outline-success" onClick={() => postTransfer(row.id)} title="Post">
                                    <i className="bi bi-upload" />
                                  </button>
                                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteTransfer(row.id)} title="Delete">
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
                    <h3 className="h6">Transfer items for #{expandedId}</h3>
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
