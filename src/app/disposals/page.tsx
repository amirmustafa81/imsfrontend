"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { printTransactionDocument } from "@/lib/transaction-print";
import { ApprovalReferenceFields, DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "fixedAssets";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type Disposal = {
  id: number;
  disposal_no: string;
  disposal_type: "disposed" | "written_off" | "auctioned" | "transferred" | "destroyed";
  request_date: string;
  committee_recommendation: string | null;
  approval_ref: string | null;
  approval_date: string | null;
  approved_by: string | null;
  status: "draft" | "recommended" | "approved" | "completed" | "cancelled";
  remarks: string | null;
  items_count: number | null;
  created_at: string;
  completed_at: string | null;
  items?: DisposalItem[];
};

type DisposalItem = {
  id: number;
  disposal_id: number;
  asset_id: number;
  book_value: number | null;
  disposal_value: number | null;
  reason: string | null;
  asset?: {
    id: number;
    asset_id: string | null;
    serial_number: string | null;
    item_name: string;
    category_name: string;
    department_name: string | null;
  };
};

type FixedAsset = {
  id: number;
  asset_id: string | null;
  serial_number: string | null;
  item_name: string;
  item_code: string;
  status: string;
  category_name: string;
  department_name: string | null;
};

type DisposalItemInput = {
  asset_id: string;
  book_value: string;
  disposal_value: string;
  reason: string;
};

type DisposalForm = {
  disposal_no: string;
  disposal_type: Disposal["disposal_type"];
  request_date: string;
  committee_recommendation: string;
  approval_ref: string;
  approval_date: string;
  approved_by: string;
  status: Disposal["status"];
  remarks: string;
};

type FilterState = {
  search: string;
  status: string;
  disposalType: string;
};

const disposalTypeOptions: Array<{ value: Disposal["disposal_type"]; label: string }> = [
  { value: "disposed", label: "Disposed" },
  { value: "written_off", label: "Written Off" },
  { value: "auctioned", label: "Auctioned" },
  { value: "transferred", label: "Transferred" },
  { value: "destroyed", label: "Destroyed" },
];

const statusOptions: Array<{ value: Disposal["status"] | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "recommended", label: "Recommended" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const emptyItem: DisposalItemInput = {
  asset_id: "",
  book_value: "",
  disposal_value: "",
  reason: "",
};

const initialForm: DisposalForm = {
  disposal_no: "",
  disposal_type: "disposed",
  request_date: new Date().toISOString().slice(0, 10),
  committee_recommendation: "",
  approval_ref: "",
  approval_date: "",
  approved_by: "",
  status: "draft",
  remarks: "",
};

const initialFilters: FilterState = {
  search: "",
  status: "",
  disposalType: "",
};

const toMoney = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const asNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDisplayDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value.includes("T") ? (value.split("T")[0] ?? "-") : value;
};

const labelFromAsset = (asset: FixedAsset | RowData): string => {
  const id = asset.asset_id || `A-${asset.id}`;
  const serial = asset.serial_number ? ` (${asset.serial_number})` : "";
  const dept = asset.department_name ? ` - ${asset.department_name}` : "";
  return `${id}${serial} - ${asset.item_code} ${asset.item_name}${dept}`;
};

export default function DisposalsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);
  const [disposals, setDisposals] = useState<Disposal[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({ fixedAssets: [] });
  const [filter, setFilter] = useState<FilterState>(initialFilters);
  const [form, setForm] = useState<DisposalForm>(initialForm);
  const [items, setItems] = useState<DisposalItemInput[]>([{ ...emptyItem }]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [message, setMessage] = useState("Load disposals to begin.");
  const [error, setError] = useState("");

  const filteredRows = useMemo(
    () =>
      disposals.filter((disposal) =>
        disposal.disposal_no.toLowerCase().includes(filter.search.toLowerCase()) ||
        disposal.approval_ref?.toLowerCase().includes(filter.search.toLowerCase()) ||
        disposal.remarks?.toLowerCase().includes(filter.search.toLowerCase()),
      ),
    [disposals, filter.search],
  );

  const loadRows = useCallback(async () => {
    if (!authReady) return;
    try {
      const params: Record<string, string> = {};
      if (filter.status) params.status = filter.status;
      if (filter.disposalType) params.disposal_type = filter.disposalType;
      if (filter.search.trim()) params.search = filter.search.trim();

      const response = await api.get("/disposals", { ...authHeaders, params });
      const payload = response.data?.data;
      setDisposals(
        Array.isArray(payload)
          ? payload.map((row: Disposal & { items?: DisposalItem[] }) => ({
              ...row,
              items_count: Array.isArray(row.items) ? row.items.length : row.items_count ?? 0,
            }))
          : [],
      );
      setError("");
      setMessage("Disposal records loaded.");
    } catch {
      setDisposals([]);
      setError("Unable to load disposals. Verify token and backend connectivity.");
    }
  }, [authReady, filter.status, filter.disposalType, filter.search, authHeaders]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;
    try {
      const response = await api.get("/reports/fixed-assets", { ...authHeaders });
      const payload = response.data?.data;
      setLookups({
        fixedAssets: Array.isArray(payload) ? (payload as unknown as RowData[]) : [],
      });
    } catch {
      setLookups({
        fixedAssets: [],
      });
    }
  }, [authReady, authHeaders]);

  useEffect(() => {
    void (async () => {
      await loadRows();
    })();
  }, [loadRows]);

  useEffect(() => {
    void (async () => {
      await loadLookups();
    })();
  }, [loadLookups]);

  const setFormValue = (key: keyof DisposalForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setFilterValue = (key: keyof FilterState, value: string) => {
    setFilter((current) => ({ ...current, [key]: value }));
  };

  const setItemValue = (index: number, key: keyof DisposalItemInput, value: string) => {
    setItems((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return { ...row, [key]: value };
      }),
    );
  };

  const addItemRow = () => setItems((current) => [...current, { ...emptyItem }]);

  const removeItemRow = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const resetForm = () => {
    setForm(initialForm);
    setItems([{ ...emptyItem }]);
  };

  const saveDisposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }

    if (!form.disposal_no.trim()) {
      setError("Disposal number is required.");
      return;
    }

    if (!form.disposal_type) {
      setError("Disposal type is required.");
      return;
    }

    const normalizedItems = items
      .map((row) => {
        const assetId = Number(row.asset_id);
        if (!assetId || Number.isNaN(assetId)) return null;
        return {
          asset_id: assetId,
          book_value: asNumberOrNull(row.book_value),
          disposal_value: asNumberOrNull(row.disposal_value),
          reason: row.reason.trim() || null,
        };
      })
      .filter((row): row is { asset_id: number; book_value: number | null; disposal_value: number | null; reason: string | null } => row !== null);

    if (normalizedItems.length === 0) {
      setError("At least one valid disposal item row is required.");
      return;
    }

    const seen = new Set<number>();
    for (const row of normalizedItems) {
      if (seen.has(row.asset_id)) {
        setError("Duplicate assets are not allowed in one disposal record.");
        return;
      }
      seen.add(row.asset_id);
    }

    const payload = {
      disposal_no: form.disposal_no.trim(),
      disposal_type: form.disposal_type,
      request_date: form.request_date,
      committee_recommendation: form.committee_recommendation.trim() || null,
      approval_ref: form.approval_ref.trim() || null,
      approval_date: form.approval_date.trim() || null,
      approved_by: form.approved_by.trim() || null,
      status: form.status,
      remarks: form.remarks.trim() || null,
      items: normalizedItems,
    };

    try {
      const response = await api.post("/disposals", payload, authHeaders);
      const saved = response.data?.data;
      setMessage(`Disposal saved with id #${saved?.id ?? "new"}.`);
      setError("");
      setForm(initialForm);
      setItems([{ ...emptyItem }]);
      await loadRows();
      if (saved?.id) setExpandedId(saved.id);
    } catch {
      setError("Failed to save disposal.");
    }
  };

  const postDisposal = async (disposal: Disposal) => {
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }
    try {
      const response = await api.post(`/disposals/${disposal.id}/post`, {}, authHeaders);
      setMessage(response.data?.message ?? `Disposal ${disposal.disposal_no} posted.`);
      setError("");
      await loadRows();
    } catch {
      setError("Failed to post disposal.");
    }
  };

  const deleteDraft = async (disposal: Disposal) => {
    if (disposal.status !== "draft") return;
    if (!confirm("Delete this draft disposal?")) return;
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }

    try {
      await api.delete(`/disposals/${disposal.id}`, authHeaders);
      setMessage(`Disposal ${disposal.disposal_no} deleted.`);
      setError("");
      await loadRows();
    } catch {
      setError("Failed to delete disposal.");
    }
  };

  const renderAssetLabel = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "-";
    const rows = lookups.fixedAssets;
    const match = rows.find((row) => String((row as FixedAsset).id) === String(value));
    if (!match) return String(value);
    return labelFromAsset(match as FixedAsset);
  };

  const printDisposal = (disposal: Disposal) => {
    const printed = printTransactionDocument<DisposalItem>({
      title: "Asset Disposal Voucher",
      subtitle: "Disposal, write-off, auction, transfer, or destruction record with approval details.",
      reference: disposal.disposal_no,
      status: disposal.status,
      meta: [
        { label: "Disposal No", value: disposal.disposal_no },
        { label: "Disposal Type", value: disposal.disposal_type },
        { label: "Request Date", value: toDisplayDate(disposal.request_date) },
        { label: "Approval Ref", value: disposal.approval_ref },
        { label: "Approved By", value: disposal.approved_by },
        { label: "Approval Date", value: toDisplayDate(disposal.approval_date) },
        { label: "Completed At", value: toDisplayDate(disposal.completed_at) },
        { label: "Items", value: disposal.items_count },
      ],
      columns: [
        { header: "Asset", render: (item) => renderAssetLabel(item.asset_id) },
        { header: "Book Value", render: (item) => toMoney(item.book_value) },
        { header: "Disposal Value", render: (item) => toMoney(item.disposal_value) },
        { header: "Reason", render: (item) => item.reason },
      ],
      rows: disposal.items ?? [],
      note: [disposal.committee_recommendation, disposal.remarks].filter(Boolean).join("\n\n"),
    });

    if (!printed) {
      setError("Popup blocked. Please allow popups to print this disposal.");
    }
  };

  const clearFilters = () => {
    setFilter(initialFilters);
  };

  const disposalColumns = [
    {
      key: "disposal",
      header: "Disposal",
      render: (row: Disposal) => (
        <>
          <button className="btn btn-link p-0" onClick={() => setExpandedId(row.id === expandedId ? null : row.id)} type="button">
            <i className="bi bi-list me-2" />
            {row.disposal_no}
          </button>
          <div className="small text-secondary">
            {row.disposal_type.replace("_", " ")} • {toDisplayDate(row.request_date)}
          </div>
        </>
      ),
    },
    { key: "items_count", header: "Items", render: (row: Disposal) => row.items_count ?? 0 },
    {
      key: "status",
      header: "Status",
      render: (row: Disposal) => <StatusBadge status={row.status} />,
    },
    { key: "approval", header: "Approval", render: (row: Disposal) => row.approval_ref || "-" },
    {
      key: "actions",
      header: "Actions",
      className: "text-end",
      render: (row: Disposal) => (
        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))} title="View items">
            <i className="bi bi-eye" />
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => printDisposal(row)} title="Print disposal">
            <i className="bi bi-printer" />
          </button>
          {row.status !== "completed" ? (
            <button type="button" className="btn btn-sm btn-outline-success" onClick={() => postDisposal(row)} title="Post">
              <i className="bi bi-upload" />
            </button>
          ) : null}
          {row.status === "draft" ? (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteDraft(row)} title="Delete">
              <i className="bi bi-trash" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const expandedItemColumns = [
    { key: "asset", header: "Asset", render: (item: DisposalItem) => renderAssetLabel(item.asset_id) },
    { key: "book", header: "Book Value", render: (item: DisposalItem) => toMoney(item.book_value) },
    {
      key: "disposalValue",
      header: "Disposal Value",
      render: (item: DisposalItem) => toMoney(item.disposal_value),
    },
    {
      key: "reason",
      header: "Reason",
      render: (item: DisposalItem) => item.reason || "-",
    },
  ];

  const selectedDisposal = expandedId === null ? null : disposals.find((disposal) => disposal.id === expandedId) ?? null;

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Asset Disposals"
          subtitle="Create disposal proposals and post disposal transactions with approval metadata."
          
        />

        {(error || message) && (
          <div className="mb-4">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {message && <div className="alert alert-success py-2">{message}</div>}
          </div>
        )}

        <div className="row g-4">
          <section className="col-12 col-xxl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Create Disposal</div>
              <div className="card-body">
                <form onSubmit={saveDisposal} className="row g-2">
                  <div className="col-12">
                    <label className="form-label">Disposal No</label>
                    <input
                      className="form-control"
                      value={form.disposal_no}
                      onChange={(event) => setFormValue("disposal_no", event.target.value)}
                      placeholder="DIS-001"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Disposal Type</label>
                    <select
                      className="form-select"
                      value={form.disposal_type}
                      onChange={(event) => setFormValue("disposal_type", event.target.value as Disposal["disposal_type"])}
                    >
                      {disposalTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Request Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.request_date}
                      onChange={(event) => setFormValue("request_date", event.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Committee Recommendation</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={form.committee_recommendation}
                      onChange={(event) => setFormValue("committee_recommendation", event.target.value)}
                      placeholder="Committee resolution / notes"
                    />
                  </div>

                  <div className="col-12">
                    <ApprovalReferenceFields
                      value={{
                        authority: form.approved_by,
                        date: form.approval_date,
                        ref: form.approval_ref,
                        remarks: form.remarks,
                      }}
                      onChange={(value) => {
                        setFormValue("approval_ref", value.ref);
                        setFormValue("approval_date", value.date);
                        setFormValue("approved_by", value.authority);
                        setFormValue("remarks", value.remarks);
                      }}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={(event) => setFormValue("status", event.target.value as Disposal["status"])}
                    >
                      {statusOptions
                        .filter((option) => option.value !== "")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between">
                      <h6 className="mb-0">Disposal Items</h6>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={addItemRow}>
                        <i className="bi bi-plus-lg me-1" />
                        Add Item
                      </button>
                    </div>

                    <div className="mt-2">
                      <div className="d-grid gap-2">
                        {items.map((item, index) => (
                          <div key={`${item.asset_id}-${index}`} className="border rounded p-2">
                            <div className="row g-2">
                              <div className="col-12">
                                <label className="form-label">Asset</label>
                                <select
                                  className="form-select"
                                  value={item.asset_id}
                                  onChange={(event) => setItemValue(index, "asset_id", event.target.value)}
                                >
                                  <option value="">Select Asset</option>
                                  {lookups.fixedAssets.map((asset) => {
                                    const typed = asset as FixedAsset;
                                    return (
                                      <option key={typed.id} value={typed.id}>
                                        {labelFromAsset(typed)}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              <div className="col-4">
                                <label className="form-label">Book Value</label>
                                <input
                                  className="form-control"
                                  value={item.book_value}
                                  onChange={(event) => setItemValue(index, "book_value", event.target.value)}
                                  placeholder="0"
                                  type="number"
                                  step="0.01"
                                />
                              </div>

                              <div className="col-4">
                                <label className="form-label">Disposal Value</label>
                                <input
                                  className="form-control"
                                  value={item.disposal_value}
                                  onChange={(event) => setItemValue(index, "disposal_value", event.target.value)}
                                  placeholder="0"
                                  type="number"
                                  step="0.01"
                                />
                              </div>

                              <div className="col-4">
                                <label className="form-label">Reason</label>
                                <div className="d-flex gap-2">
                                  <input
                                    className="form-control"
                                    value={item.reason}
                                    onChange={(event) => setItemValue(index, "reason", event.target.value)}
                                    placeholder="Reason"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger"
                                    onClick={() => removeItemRow(index)}
                                    title="Remove"
                                  >
                                    <i className="bi bi-trash" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 d-flex gap-2">
                    <button type="submit" className="btn btn-primary">
                      Save Disposal
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>

          <section className="col-12 col-xxl-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Disposal List</div>
              <div className="card-body">
                <FilterBar onReset={clearFilters}>
                  <div className="col-12 col-md-6">
                    <label className="form-label small mb-1">Search / Disposal No / Approval / Remarks</label>
                    <input
                      value={filter.search}
                      onChange={(event) => setFilterValue("search", event.target.value)}
                      className="form-control form-control-sm"
                      placeholder="Search records..."
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small mb-1">Status</label>
                    <select
                      className="form-select form-select-sm"
                      value={filter.status}
                      onChange={(event) => setFilterValue("status", event.target.value)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value || "all"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small mb-1">Disposal Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={filter.disposalType}
                      onChange={(event) => setFilterValue("disposalType", event.target.value)}
                    >
                      <option value="">All Types</option>
                      {disposalTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </FilterBar>

                {filteredRows.length === 0 ? (
                  <EmptyState title="No disposals found" message="No records match the current filters." icon="bi-recycle" />
                ) : (
                  <DataTable columns={disposalColumns} rows={filteredRows} />
                )}

                {selectedDisposal ? (
                  <div className="mt-3">
                    <h3 className="h6">Disposal items for #{selectedDisposal.disposal_no}</h3>
                    <DataTable columns={expandedItemColumns} rows={selectedDisposal.items ?? []} empty="No item rows returned by backend." />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
