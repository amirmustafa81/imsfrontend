"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Lookup = { id: number; code?: string; name?: string };

type MaintenanceRecord = {
  id: number;
  maintenance_no: string;
  maintenance_type: string;
  status: string;
  asset_id: number;
  asset?: { asset_id: string; serial_number: string | null };
  vendor_id: number | null;
  sent_date: string | null;
  returned_date: string | null;
  issue_description: string | null;
  repair_details: string | null;
  cost: string | number | null;
};

type FormState = {
  maintenance_no: string;
  asset_id: string;
  maintenance_type: string;
  sent_date: string;
  returned_date: string;
  vendor_id: string;
  issue_description: string;
  repair_details: string;
  cost: string;
  status: string;
};

const emptyForm: FormState = {
  maintenance_no: "",
  asset_id: "",
  maintenance_type: "",
  sent_date: "",
  returned_date: "",
  vendor_id: "",
  issue_description: "",
  repair_details: "",
  cost: "",
  status: "",
};

export default function MaintenanceRecordsPage() {
  const storedToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token, setToken] = useState(storedToken);
  const [tmpToken, setTmpToken] = useState(storedToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [assets, setAssets] = useState<Lookup[]>([]);
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [rows, setRows] = useState<MaintenanceRecord[]>([]);
  const [filters, setFilters] = useState({ status: "", maintenance_type: "", search: "" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLookups = useCallback(async () => {
    if (!token) return;
    try {
      const [assetResponse, vendorResponse] = await Promise.all([
        api.get<{ data: Array<{ id: number; asset_id: string; serial_number: string | null }>} >("/assets", headers),
        api.get<{ data: Lookup[] }>("/master-data/suppliers", headers),
      ]);
      setAssets(assetResponse.data?.data ?? []);
      setVendors(vendorResponse.data?.data ?? []);
    } catch {
      setAssets([]);
      setVendors([]);
    }
  }, [headers, token]);

  const loadRows = useCallback(async () => {
    if (!token) return;
    const params: Record<string, string> = {};
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.status) params.status = filters.status;
    if (filters.maintenance_type) params.maintenance_type = filters.maintenance_type;

    try {
      const response = await api.get<{ data: MaintenanceRecord[] }>("/maintenance-records", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load maintenance records.");
    }
  }, [headers, token, filters.search, filters.status, filters.maintenance_type]);

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

  const reset = () => setForm(emptyForm);

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Save token first.");
      return;
    }
    if (!form.maintenance_no || !form.asset_id || !form.maintenance_type) {
      setError("Maintenance no., asset and type are required.");
      return;
    }

    try {
      await api.post(
        "/maintenance-records",
        {
          maintenance_no: form.maintenance_no,
          asset_id: Number(form.asset_id),
          maintenance_type: form.maintenance_type,
          sent_date: form.sent_date || null,
          returned_date: form.returned_date || null,
          vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
          issue_description: form.issue_description || null,
          repair_details: form.repair_details || null,
          cost: form.cost ? Number(form.cost) : null,
          status: form.status || null,
        },
        headers,
      );
      setForm(emptyForm);
      setMessage("Maintenance record saved.");
      setError("");
      await loadRows();
    } catch {
      setError("Unable to save record.");
    }
  };

  const removeRecord = async (id: number) => {
    try {
      await api.delete(`/maintenance-records/${id}`, headers);
      await loadRows();
      setMessage("Record deleted.");
    } catch {
      setError("Unable to delete record.");
    }
  };

  const columns = [
    { key: "maintenance_no", header: "Maintenance No" },
    {
      key: "asset_id",
      header: "Asset",
      render: (row: MaintenanceRecord) => `${row.asset?.asset_id ?? row.asset_id} - ${row.asset?.serial_number ?? ""}`,
    },
    { key: "maintenance_type", header: "Type" },
    {
      key: "status",
      header: "Status",
      render: (row: MaintenanceRecord) => <StatusBadge status={row.status} />,
    },
    { key: "sent_date", header: "Sent" },
    { key: "returned_date", header: "Returned" },
    { key: "cost", header: "Cost" },
    {
      key: "action",
      header: "Action",
      render: (row: MaintenanceRecord) => (
        <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => removeRecord(row.id)}>
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
          title="Maintenance Records"
          subtitle="Track repair, service, warranty, inspection, and other maintenance events."
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
              <div className="card-header bg-white fw-semibold">Create / Record Maintenance</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={saveRecord}>
                  <div className="col-12">
                    <label className="form-label small">Maintenance No</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.maintenance_no}
                      onChange={(event) => setForm((current) => ({ ...current, maintenance_no: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Asset</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.asset_id}
                      onChange={(event) => setForm((current) => ({ ...current, asset_id: event.target.value }))}
                    >
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {(asset as unknown as { asset_id: string; serial_number?: string }).asset_id ??
                            `${asset.code ?? ""} ${asset.name ?? ""}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Maintenance Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.maintenance_type}
                      onChange={(event) => setForm((current) => ({ ...current, maintenance_type: event.target.value }))}
                    >
                      <option value="">Select type</option>
                      <option value="repair">Repair</option>
                      <option value="service">Service</option>
                      <option value="warranty_claim">Warranty Claim</option>
                      <option value="inspection">Inspection</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Vendor</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.vendor_id}
                      onChange={(event) => setForm((current) => ({ ...current, vendor_id: event.target.value }))}
                    >
                      <option value="">No vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Status</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="">Default open</option>
                      <option value="open">Open</option>
                      <option value="sent_for_repair">Sent for Repair</option>
                      <option value="repaired">Repaired</option>
                      <option value="not_repairable">Not Repairable</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Sent Date</label>
                    <input
                      className="form-control form-control-sm"
                      type="date"
                      value={form.sent_date}
                      onChange={(event) => setForm((current) => ({ ...current, sent_date: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Returned Date</label>
                    <input
                      className="form-control form-control-sm"
                      type="date"
                      value={form.returned_date}
                      onChange={(event) => setForm((current) => ({ ...current, returned_date: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Cost</label>
                    <input
                      className="form-control form-control-sm"
                      type="number"
                      step="0.01"
                      value={form.cost}
                      onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Issue Description</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={form.issue_description}
                      onChange={(event) => setForm((current) => ({ ...current, issue_description: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Repair Details</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={form.repair_details}
                      onChange={(event) => setForm((current) => ({ ...current, repair_details: event.target.value }))}
                    />
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button className="btn btn-sm btn-primary" type="submit">
                      <i className="bi bi-plus-circle me-1" />
                      Save
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" type="button" onClick={reset}>
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setFilters({ status: "", maintenance_type: "", search: "" })}>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Search</label>
                <input
                  className="form-control form-control-sm"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Type</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.maintenance_type}
                  onChange={(event) => setFilters((current) => ({ ...current, maintenance_type: event.target.value }))}
                >
                  <option value="">All</option>
                  <option value="repair">Repair</option>
                  <option value="service">Service</option>
                  <option value="warranty_claim">Warranty Claim</option>
                  <option value="inspection">Inspection</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="sent_for_repair">Sent for Repair</option>
                  <option value="repaired">Repaired</option>
                  <option value="not_repairable">Not Repairable</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </FilterBar>

            {rows.length === 0 ? (
              <EmptyState title="No maintenance records" message="No maintenance activity recorded yet." />
            ) : (
              <DataTable columns={columns} rows={rows} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
