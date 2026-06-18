"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Lookup = { id: number; name: string };
type AssetLookup = { id: number; asset_id: string; serial_number: string | null };

type AssetMovement = {
  id: number;
  movement_no: string;
  movement_type: string;
  movement_date: string;
  from_department_id: number | null;
  to_department_id: number | null;
  from_department?: { name: string };
  to_department?: { name: string };
  from_custodian_user_id: number | null;
  to_custodian_user_id: number | null;
  from_custodian?: { name: string };
  to_custodian?: { name: string };
  status: string;
  manual_approval_ref: string | null;
  manual_approval_date: string | null;
  remarks: string | null;
  asset?: AssetLookup & { id: number; };
};

type FormState = {
  movement_no: string;
  asset_id: string;
  movement_type: string;
  movement_date: string;
  from_department_id: string;
  to_department_id: string;
  from_custodian_user_id: string;
  to_custodian_user_id: string;
  remarks: string;
  manual_approval_ref: string;
};

const emptyForm: FormState = {
  movement_no: "",
  asset_id: "",
  movement_type: "",
  movement_date: new Date().toISOString().slice(0, 10),
  from_department_id: "",
  to_department_id: "",
  from_custodian_user_id: "",
  to_custodian_user_id: "",
  remarks: "",
  manual_approval_ref: "",
};

export default function AssetMovementsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const headers = useMemo(() => ({}), [authReady]);

  const [assets, setAssets] = useState<AssetLookup[]>([]);
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [users, setUsers] = useState<Lookup[]>([]);
  const [rows, setRows] = useState<AssetMovement[]>([]);
  const [filters, setFilters] = useState({ movementType: "", search: "", status: "" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLookups = useCallback(async () => {
    if (!authReady) return;
    try {
      const [assetResponse, deptResponse, userResponse] = await Promise.all([
        api.get<{ data: AssetLookup[] }>("/assets", headers),
        api.get<{ data: Lookup[] }>("/master-data/departments", headers),
        api.get<{ data: Lookup[] }>("/users", headers),
      ]);
      setAssets(assetResponse.data?.data ?? []);
      setDepartments(deptResponse.data?.data ?? []);
      setUsers(userResponse.data?.data ?? []);
    } catch {
      setAssets([]);
      setDepartments([]);
      setUsers([]);
    }
  }, [headers, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) return;
    const params: Record<string, string> = {};
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.movementType) params.movement_type = filters.movementType;
    if (filters.status) params.status = filters.status;

    try {
      const response = await api.get<{ data: AssetMovement[] }>("/asset-movements", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load movements.");
    }
  }, [headers, authReady, filters.search, filters.movementType, filters.status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }
    if (!form.movement_no || !form.asset_id || !form.movement_type || !form.movement_date) {
      setError("Movement no., asset, type, date are required.");
      return;
    }

    try {
      await api.post(
        "/asset-movements",
        {
          movement_no: form.movement_no,
          asset_id: Number(form.asset_id),
          movement_type: form.movement_type,
          movement_date: form.movement_date,
          from_department_id: form.from_department_id ? Number(form.from_department_id) : null,
          to_department_id: form.to_department_id ? Number(form.to_department_id) : null,
          from_custodian_user_id: form.from_custodian_user_id ? Number(form.from_custodian_user_id) : null,
          to_custodian_user_id: form.to_custodian_user_id ? Number(form.to_custodian_user_id) : null,
          remarks: form.remarks || null,
          manual_approval_ref: form.manual_approval_ref || null,
        },
        headers,
      );
      setForm(emptyForm);
      setMessage("Movement recorded.");
      setError("");
      await loadRows();
    } catch {
      setError("Unable to save movement.");
    }
  };

  const removeRecord = async (id: number) => {
    try {
      await api.delete(`/asset-movements/${id}`, headers);
      await loadRows();
      setMessage("Movement removed.");
    } catch {
      setError("Unable to remove movement.");
    }
  };

  const columns = [
    { key: "movement_no", header: "Movement No" },
    { key: "movement_type", header: "Type" },
    {
      key: "asset_id",
      header: "Asset",
      render: (row: AssetMovement) => `${row.asset?.asset_id ?? ""} (${row.asset?.serial_number ?? "-"})`,
    },
    { key: "from_department", header: "From Dept", render: (row: AssetMovement) => row.from_department?.name ?? "-" },
    { key: "to_department", header: "To Dept", render: (row: AssetMovement) => row.to_department?.name ?? "-" },
    { key: "from_custodian", header: "From Custodian", render: (row: AssetMovement) => row.from_custodian?.name ?? "-" },
    { key: "to_custodian", header: "To Custodian", render: (row: AssetMovement) => row.to_custodian?.name ?? "-" },
    { key: "movement_date", header: "Date" },
    { key: "manual_approval_ref", header: "Approval Ref" },
    {
      key: "remarks",
      header: "Status",
      render: (row: AssetMovement) => <StatusBadge status={row.status || "draft"} />,
    },
    {
      key: "action",
      header: "Action",
      render: (row: AssetMovement) => (
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
          title="Asset Movements"
          subtitle="Record and track physical asset movements across departments, rooms, and custodians."
          
        />

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Record Movement</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={saveRecord}>
                  <div className="col-12">
                    <label className="form-label small">Movement No</label>
                    <input className="form-control form-control-sm" value={form.movement_no} onChange={(event) => setForm((current) => ({ ...current, movement_no: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Asset</label>
                    <select className="form-select form-select-sm" value={form.asset_id} onChange={(event) => setForm((current) => ({ ...current, asset_id: event.target.value }))}>
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.asset_id} ({asset.serial_number ?? "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Movement Type</label>
                    <select className="form-select form-select-sm" value={form.movement_type} onChange={(event) => setForm((current) => ({ ...current, movement_type: event.target.value }))}>
                      <option value="">Select type</option>
                      <option value="issue">Issue</option>
                      <option value="return">Return</option>
                      <option value="transfer">Transfer</option>
                      <option value="custodian_change">Custodian Change</option>
                      <option value="location_change">Location Change</option>
                      <option value="repair_out">Repair Out</option>
                      <option value="repair_return">Repair Return</option>
                      <option value="verification_update">Verification Update</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Movement Date</label>
                    <input className="form-control form-control-sm" type="date" value={form.movement_date} onChange={(event) => setForm((current) => ({ ...current, movement_date: event.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">From Department</label>
                    <select className="form-select form-select-sm" value={form.from_department_id} onChange={(event) => setForm((current) => ({ ...current, from_department_id: event.target.value }))}>
                      <option value="">Auto from asset</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">To Department</label>
                    <select className="form-select form-select-sm" value={form.to_department_id} onChange={(event) => setForm((current) => ({ ...current, to_department_id: event.target.value }))}>
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">From Custodian</label>
                    <select className="form-select form-select-sm" value={form.from_custodian_user_id} onChange={(event) => setForm((current) => ({ ...current, from_custodian_user_id: event.target.value }))}>
                      <option value="">Select user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">To Custodian</label>
                    <select className="form-select form-select-sm" value={form.to_custodian_user_id} onChange={(event) => setForm((current) => ({ ...current, to_custodian_user_id: event.target.value }))}>
                      <option value="">Select user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Manual Approval Ref</label>
                    <input className="form-control form-control-sm" value={form.manual_approval_ref} onChange={(event) => setForm((current) => ({ ...current, manual_approval_ref: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Remarks</label>
                    <textarea className="form-control form-control-sm" rows={2} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary" type="submit">
                      <i className="bi bi-plus-circle me-1" />
                      Save Movement
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setFilters({ movementType: "", search: "", status: "" })}>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Movement Type</label>
                <select className="form-select form-select-sm" value={filters.movementType} onChange={(event) => setFilters((current) => ({ ...current, movementType: event.target.value }))}>
                  <option value="">All</option>
                  <option value="issue">Issue</option>
                  <option value="return">Return</option>
                  <option value="transfer">Transfer</option>
                  <option value="custodian_change">Custodian Change</option>
                  <option value="location_change">Location Change</option>
                  <option value="repair_out">Repair Out</option>
                  <option value="repair_return">Repair Return</option>
                  <option value="verification_update">Verification Update</option>
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Search</label>
                <input className="form-control form-control-sm" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Status</label>
                <input className="form-control form-control-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} />
              </div>
            </FilterBar>
            {rows.length === 0 ? <EmptyState title="No movements" message="No movement history found." /> : <DataTable columns={columns} rows={rows} />}
          </div>
        </div>
      </div>
    </main>
  );
}
