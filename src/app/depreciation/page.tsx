"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "departments" | "items" | "research-projects";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type AssetOption = {
  id: number;
  asset_id: string | null;
  printable_tag_id: string | null;
  serial_number: string | null;
  item?: {
    name?: string | null;
    item_code?: string | null;
  } | null;
};

type DepreciationRow = {
  id: number;
  depreciation_run_id: number;
  run_no: string;
  period_start: string;
  period_end: string;
  run_type: string;
  run_status: string;
  calculated_at: string | null;
  opening_book_value: number;
  depreciation_amount: number;
  accumulated_depreciation_after: number;
  closing_book_value: number;
  useful_life_years: number | null;
  method: string;
  asset_id: number;
  asset_tag: string;
  printable_tag_id: string | null;
  item_code: string;
  item_name: string;
  department_id: number;
  department_name: string;
  project_id: number | null;
  project_title: string | null;
  asset_status: string;
};

const runStatusOptions = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "closed", label: "Closed" },
];

const toMoney = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value.includes("T") ? (value.split("T")[0] ?? "-") : value;
};

const initialLookups: Record<LookupKey, RowData[]> = {
  departments: [],
  items: [],
  "research-projects": [],
};

const createRunNo = () => `DEP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;

export default function DepreciationPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const [rows, setRows] = useState<DepreciationRow[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>(initialLookups);
  const [assets, setAssets] = useState<AssetOption[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("Load depreciation report to begin.");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runNo, setRunNo] = useState(createRunNo);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [runType, setRunType] = useState<"monthly" | "yearly" | "on_demand">("monthly");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("");
  const [calculateAfterSave, setCalculateAfterSave] = useState(true);

  const authHeaders = useMemo(() => ({}), []);

  const loadRows = useCallback(async () => {
    if (!authReady) return;

    try {
      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department_id = departmentFilter;
      if (itemFilter) params.item_id = itemFilter;
      if (projectFilter) params.project_id = projectFilter;
      if (dateFromFilter) params.date_from = dateFromFilter;
      if (dateToFilter) params.date_to = dateToFilter;

      const response = await api.get("/reports/depreciation", {
        ...authHeaders,
        params,
      });

      const payload = response.data?.data;
      setRows(Array.isArray(payload) ? payload : []);
      setMessage("Depreciation loaded.");
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load depreciation. Verify token and backend connectivity.");
      setMessage("");
    }
  }, [
    authReady,
    search,
    statusFilter,
    departmentFilter,
    itemFilter,
    projectFilter,
    dateFromFilter,
    dateToFilter,
    authHeaders,
  ]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    const next = {
      ...initialLookups,
    } as Record<LookupKey, RowData[]>;

    const loadable = [
      { key: "departments", path: "departments" },
      { key: "items", path: "items" },
      { key: "research-projects", path: "research-projects" },
    ] as const;

    await Promise.all(
    loadable.map(async ({ key, path }) => {
      const response = await api.get(`/master-data/${path}`, { ...authHeaders });
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[key] = payload;
        }
      }),
    );

    setLookups(next);

    const assetsResponse = await api.get<{ data: AssetOption[] }>("/assets", { ...authHeaders });
    const assetPayload = assetsResponse.data?.data;
    setAssets(Array.isArray(assetPayload) ? assetPayload : []);
  }, [authReady, authHeaders]);

  useEffect(() => {
    const reload = async () => {
      await loadRows();
    };

    void reload();
  }, [loadRows]);

  useEffect(() => {
    const reloadLookups = async () => {
      await loadLookups();
    };

    void reloadLookups();
  }, [loadLookups]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setDepartmentFilter("");
    setItemFilter("");
    setProjectFilter("");
    setDateFromFilter("");
    setDateToFilter("");

    setTimeout(() => {
      void loadRows();
    }, 0);
  };

  const openCreateDialog = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    setRunNo(createRunNo());
    setPeriodStart(start);
    setPeriodEnd(end);
    setRunType("monthly");
    setDepartmentId("");
    setSelectedAssetIds([]);
    setRemarks("");
    setCalculateAfterSave(true);
    setDialogOpen(true);
    setError("");
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSaving(false);
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    );
  };

  const saveDepreciationRun = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Please sign in before creating depreciation runs.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post<{ data: { id: number } }>(
        "/depreciation-runs",
        {
          run_no: runNo.trim(),
          period_start: periodStart,
          period_end: periodEnd,
          run_type: runType,
          status: "draft",
          remarks: remarks.trim() || null,
          ...(departmentId ? { department_id: Number(departmentId) } : {}),
          asset_ids: selectedAssetIds.map((id) => Number(id)),
        },
        authHeaders,
      );

      const newRunId = response.data?.data?.id;
      if (calculateAfterSave && newRunId) {
        await api.post(`/depreciation-runs/${newRunId}/calculate`, {}, authHeaders);
      }

      setDialogOpen(false);
      setMessage(calculateAfterSave ? "Depreciation run created and calculated." : "Depreciation run created.");
      await loadRows();
    } catch {
      setError("Unable to create depreciation run. Verify period, unique run number, selected assets, and backend connectivity.");
    } finally {
      setSaving(false);
    }
  };

  const tableColumns = [
    {
      key: "run_no",
      header: "Run No",
      render: (row: DepreciationRow) => (
        <>
          <div className="fw-semibold">{row.run_no}</div>
          <small className="text-secondary">{row.run_type}</small>
        </>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (row: DepreciationRow) => (
        <>
          <div>{toDate(row.period_start)}</div>
          <small className="text-secondary">to {toDate(row.period_end)}</small>
        </>
      ),
    },
    {
      key: "asset",
      header: "Asset",
      render: (row: DepreciationRow) => (
        <>
          <div>{row.asset_tag}</div>
          <small className="text-secondary">{row.printable_tag_id ?? "-"}</small>
        </>
      ),
    },
    {
      key: "item",
      header: "Item",
      render: (row: DepreciationRow) => (
        <>
          <div>{row.item_code}</div>
          <small className="text-secondary">{row.item_name}</small>
        </>
      ),
    },
    { key: "department_name", header: "Department", render: (row: DepreciationRow) => <>{row.department_name}</> },
    { key: "run_status", header: "Status", render: (row: DepreciationRow) => <StatusBadge status={row.run_status} /> },
    { key: "opening_book_value", header: "Opening", render: (row: DepreciationRow) => toMoney(row.opening_book_value) },
    { key: "depreciation_amount", header: "Depreciation", render: (row: DepreciationRow) => toMoney(row.depreciation_amount) },
    {
      key: "accumulated_depreciation_after",
      header: "Accumulated After",
      render: (row: DepreciationRow) => toMoney(row.accumulated_depreciation_after),
    },
    { key: "closing_book_value", header: "Closing", render: (row: DepreciationRow) => toMoney(row.closing_book_value) },
    { key: "method", header: "Method", render: (row: DepreciationRow) => <>{row.method}</> },
    {
      key: "useful_life_years",
      header: "Useful Life",
      render: (row: DepreciationRow) => <>{row.useful_life_years ?? "-"}</>,
    },
    { key: "calculated_at", header: "Calculated At", render: (row: DepreciationRow) => <>{toDate(row.calculated_at)}</> },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Depreciation"
          subtitle="Review straight-line depreciation entries, period totals, and run status by asset."
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              Create Run
            </button>
          }
        />

        {(message || error) && (
          <div className="mb-3">
            {message && <div className="alert alert-success mb-0">{message}</div>}
            {error && <div className="alert alert-danger mb-0">{error}</div>}
          </div>
        )}

        <FilterBar onReset={clearFilters}>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Search</label>
            <input className="form-control form-control-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Status</label>
            <select className="form-select form-select-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {runStatusOptions.map((status) => (
                <option key={status.value || "all"} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Department</label>
            <select className="form-select form-select-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} - {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Item</label>
            <select className="form-select form-select-sm" value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}>
              <option value="">All</option>
              {lookups.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code ? `${item.item_code} - ${item.name}` : `${item.name}`}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Project</label>
            <select className="form-select form-select-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">All</option>
              {lookups["research-projects"].map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_code} - {project.title}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Date from</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateFromFilter}
              onChange={(event) => setDateFromFilter(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label small">Date to</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dateToFilter}
              onChange={(event) => setDateToFilter(event.target.value)}
            />
          </div>
        </FilterBar>

        <DataTable columns={tableColumns} rows={rows} empty="No depreciation entries found." />

        {dialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(54vw, 920px)", maxWidth: "min(54vw, 920px)" }}>
                <form className="modal-content border-0 shadow-lg" onSubmit={saveDepreciationRun}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">Create Depreciation Run</h5>
                      <div className="small text-secondary">Create a straight-line run for selected assets and period.</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Run No <span className="text-danger">*</span></label>
                        <input className="form-control form-control-sm" value={runNo} onChange={(event) => setRunNo(event.target.value)} required />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Run Type</label>
                        <select className="form-select form-select-sm" value={runType} onChange={(event) => setRunType(event.target.value as typeof runType)}>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                          <option value="on_demand">On Demand</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Department</label>
                        <select className="form-select form-select-sm" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                          <option value="">All allowed departments</option>
                          {lookups.departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.code} - {department.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Period Start <span className="text-danger">*</span></label>
                        <input className="form-control form-control-sm" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Period End <span className="text-danger">*</span></label>
                        <input className="form-control form-control-sm" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required />
                      </div>
                      <div className="col-12">
                        <label className="form-label small">Assets</label>
                        <div className="border rounded bg-light p-2" style={{ maxHeight: 180, overflowY: "auto" }}>
                          {assets.length === 0 ? (
                            <div className="small text-secondary px-1 py-2">No assets available.</div>
                          ) : (
                            assets.map((asset) => {
                              const assetId = String(asset.id);
                              const label = `${asset.asset_id ?? `Asset #${asset.id}`} - ${asset.item?.item_code ?? asset.item?.name ?? asset.serial_number ?? "No item"}`;

                              return (
                                <div className="form-check" key={asset.id}>
                                  <input
                                    id={`depreciation-asset-${asset.id}`}
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={selectedAssetIds.includes(assetId)}
                                    onChange={() => toggleAssetSelection(assetId)}
                                  />
                                  <label className="form-check-label small" htmlFor={`depreciation-asset-${asset.id}`}>
                                    {label}
                                  </label>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div className="form-text">Select one or more assets so report entries are created for this run.</div>
                      </div>
                      <div className="col-12">
                        <label className="form-label small">Remarks</label>
                        <textarea className="form-control form-control-sm" rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            id="calculate-after-save"
                            className="form-check-input"
                            type="checkbox"
                            checked={calculateAfterSave}
                            onChange={(event) => setCalculateAfterSave(event.target.checked)}
                          />
                          <label className="form-check-label small" htmlFor="calculate-after-save">
                            Calculate depreciation immediately after creating the run
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeDialog}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving || selectedAssetIds.length === 0 || !authReady}>
                      <i className="bi bi-plus-circle me-1" />
                      {saving ? "Saving..." : "Create Run"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div className="modal-backdrop fade show" onClick={closeDialog} />
          </>
        ) : null}
      </div>
    </main>
  );
}
