"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type AssetSummary = { id: number; asset_id: string; serial_number: string | null };
type Investigation = {
  id: number;
  asset_id: number;
  case_no: string;
  status: string;
  reported_date: string;
  verification_item_id: number | null;
  inquiry_ref: string | null;
  final_action_ref: string | null;
  final_action_date: string | null;
  remarks: string | null;
  closed_at: string | null;
  asset?: AssetSummary;
};

type FormState = {
  asset_id: string;
  case_no: string;
  reported_date: string;
  status: string;
  inquiry_ref: string;
  final_action_ref: string;
  final_action_date: string;
  remarks: string;
  closed_at: string;
};

const emptyForm: FormState = {
  asset_id: "",
  case_no: "",
  reported_date: new Date().toISOString().slice(0, 10),
  status: "missing_under_investigation",
  inquiry_ref: "",
  final_action_ref: "",
  final_action_date: "",
  remarks: "",
  closed_at: "",
};

export default function AssetInvestigationsPage() {
  const getToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token, setToken] = useState(getToken);
  const [tmpToken, setTmpToken] = useState(getToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [rows, setRows] = useState<Investigation[]>([]);
  const [filters, setFilters] = useState({ status: "", assetId: "", search: "" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLookups = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get<{ data: AssetSummary[] }>("/assets", headers);
      setAssets(response.data?.data ?? []);
    } catch {
      setAssets([]);
    }
  }, [headers, token]);

  const loadRows = useCallback(async () => {
    if (!token) return;
    const params: Record<string, string> = {};
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.status) params.status = filters.status;
    if (filters.assetId) params.asset_id = filters.assetId;

    try {
      const response = await api.get<{ data: Investigation[] }>("/asset-investigations", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load investigations.");
    }
  }, [headers, token, filters.search, filters.status, filters.assetId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Save token first.");
      return;
    }
    if (!form.asset_id || !form.case_no) {
      setError("Asset and case number are required.");
      return;
    }

    try {
      await api.post(
        "/asset-investigations",
        {
          asset_id: Number(form.asset_id),
          case_no: form.case_no,
          reported_date: form.reported_date || null,
          status: form.status || "missing_under_investigation",
          inquiry_ref: form.inquiry_ref || null,
          final_action_ref: form.final_action_ref || null,
          final_action_date: form.final_action_date || null,
          remarks: form.remarks || null,
          closed_at: form.closed_at || null,
        },
        headers,
      );
      setForm(emptyForm);
      setMessage("Investigation created.");
      setError("");
      await loadRows();
    } catch {
      setError("Unable to save investigation.");
    }
  };

  const deleteRecord = async (id: number) => {
    try {
      await api.delete(`/asset-investigations/${id}`, headers);
      await loadRows();
      setMessage("Investigation deleted.");
    } catch {
      setError("Unable to delete investigation.");
    }
  };

  const columns = [
    { key: "case_no", header: "Case No" },
    {
      key: "asset_id",
      header: "Asset",
      render: (row: Investigation) => `${row.asset?.asset_id ?? row.asset_id} (${row.asset?.serial_number ?? "-"})`,
    },
    { key: "reported_date", header: "Reported" },
    {
      key: "status",
      header: "Status",
      render: (row: Investigation) => <StatusBadge status={row.status} />,
    },
    { key: "inquiry_ref", header: "Inquiry Ref" },
    { key: "final_action_ref", header: "Final Action Ref" },
    { key: "remarks", header: "Remarks" },
    {
      key: "action",
      header: "Action",
      render: (row: Investigation) => (
        <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteRecord(row.id)}>
          <i className="bi bi-trash me-1" />
          Delete
        </button>
      ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Asset Investigations"
          subtitle="Manage missing/under investigation and recovery workflow."
          actions={
            <form className="d-flex gap-2" onSubmit={submitToken}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-key" />
                </span>
                <input
                  className="form-control"
                  value={tmpToken}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTmpToken(event.target.value)}
                />
              </div>
              <button className="btn btn-sm btn-outline-primary" type="submit">
                Save token
              </button>
            </form>
          }
        />

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Create Investigation</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={saveRecord}>
                  <div className="col-12">
                    <label className="form-label small">Case No.</label>
                    <input className="form-control form-control-sm" value={form.case_no} onChange={(event) => setForm((current) => ({ ...current, case_no: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Asset</label>
                    <select className="form-select form-select-sm" value={form.asset_id} onChange={(event) => setForm((current) => ({ ...current, asset_id: event.target.value }))}>
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.asset_id} ({asset.serial_number ?? "-"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small">Reported Date</label>
                    <input className="form-control form-control-sm" type="date" value={form.reported_date} onChange={(event) => setForm((current) => ({ ...current, reported_date: event.target.value }))} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small">Status</label>
                    <select className="form-select form-select-sm" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                      <option value="missing_under_investigation">Missing / Under Investigation</option>
                      <option value="found">Found</option>
                      <option value="recommended_write_off">Recommended Write-off</option>
                      <option value="recovery_pending">Recovery Pending</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Inquiry Ref</label>
                    <input className="form-control form-control-sm" value={form.inquiry_ref} onChange={(event) => setForm((current) => ({ ...current, inquiry_ref: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Final Action Ref</label>
                    <input className="form-control form-control-sm" value={form.final_action_ref} onChange={(event) => setForm((current) => ({ ...current, final_action_ref: event.target.value }))} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small">Final Action Date</label>
                    <input className="form-control form-control-sm" type="date" value={form.final_action_date} onChange={(event) => setForm((current) => ({ ...current, final_action_date: event.target.value }))} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small">Closed At</label>
                    <input className="form-control form-control-sm" type="datetime-local" value={form.closed_at} onChange={(event) => setForm((current) => ({ ...current, closed_at: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Remarks</label>
                    <textarea className="form-control" rows={2} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary" type="submit">
                      <i className="bi bi-plus-circle me-1" />
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setFilters({ status: "", assetId: "", search: "" })}>
              <div className="col-12 col-md-3">
                <label className="form-label small mb-1">Asset</label>
                <select className="form-select form-select-sm" value={filters.assetId} onChange={(event) => setFilters((current) => ({ ...current, assetId: event.target.value }))}>
                  <option value="">All</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small mb-1">Status</label>
                <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">All</option>
                  <option value="missing_under_investigation">Missing / Under Investigation</option>
                  <option value="found">Found</option>
                  <option value="recommended_write_off">Recommended Write-off</option>
                  <option value="recovery_pending">Recovery Pending</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small mb-1">Search</label>
                <input className="form-control form-control-sm" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
              </div>
            </FilterBar>

            {rows.length === 0 ? <EmptyState title="No investigations" message="No investigation records found." /> : <DataTable columns={columns} rows={rows} />}
          </div>
        </div>
      </div>
    </main>
  );
}
