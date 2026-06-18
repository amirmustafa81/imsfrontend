"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type User = { id: number; name: string; email: string };
type Department = { id: number; name: string };
type Delegation = {
  id: number;
  delegator_user_id: number;
  delegated_to_user_id: number;
  department_id: number;
  authority_type: string;
  limit_amount: number | null;
  start_date: string;
  end_date: string;
  authorization_ref: string | null;
  status: "active" | "expired" | "cancelled";
  remarks: string | null;
  delegator?: User;
  delegatedTo?: User;
  department?: Department;
};

type FormState = {
  delegator_user_id: string;
  delegated_to_user_id: string;
  department_id: string;
  authority_type: string;
  limit_amount: string;
  start_date: string;
  end_date: string;
  authorization_ref: string;
  status: "active" | "expired" | "cancelled" | "";
  remarks: string;
};

const emptyForm: FormState = {
  delegator_user_id: "",
  delegated_to_user_id: "",
  department_id: "",
  authority_type: "",
  limit_amount: "",
  start_date: "",
  end_date: "",
  authorization_ref: "",
  status: "",
  remarks: "",
};

export default function UserDelegationsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const headers = useMemo(() => ({}), [authReady]);

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<Delegation[]>([]);
  const [filters, setFilters] = useState({ status: "", authority_type: "", delegatedTo: "" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLookups = useCallback(async () => {
    if (!authReady) return;
    try {
      const [userResponse, deptResponse] = await Promise.all([
        api.get<{ data: User[] }>("/users", headers),
        api.get<{ data: Department[] }>("/master-data/departments", headers),
      ]);
      setUsers(userResponse.data?.data ?? []);
      setDepartments(deptResponse.data?.data ?? []);
    } catch {
      setUsers([]);
      setDepartments([]);
    }
  }, [headers, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) return;
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.authority_type) params.authority_type = filters.authority_type;
    if (filters.delegatedTo) params.delegated_to_user_id = filters.delegatedTo;

    try {
      const response = await api.get<{ data: Delegation[] }>("/user-delegations", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load delegations.");
    }
  }, [headers, authReady, filters.status, filters.authority_type, filters.delegatedTo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }
    if (!form.delegator_user_id || !form.delegated_to_user_id || !form.department_id || !form.authority_type || !form.start_date || !form.end_date) {
      setError("Delegator, delegate, department, authority and dates are required.");
      return;
    }

    try {
      await api.post("/user-delegations", {
        delegator_user_id: Number(form.delegator_user_id),
        delegated_to_user_id: Number(form.delegated_to_user_id),
        department_id: Number(form.department_id),
        authority_type: form.authority_type,
        limit_amount: form.limit_amount ? Number(form.limit_amount) : null,
        start_date: form.start_date,
        end_date: form.end_date,
        authorization_ref: form.authorization_ref || null,
        status: form.status || null,
        remarks: form.remarks || null,
      }, headers);
      setForm(emptyForm);
      setMessage("Delegation created.");
      setError("");
      await loadRows();
    } catch {
      setError("Unable to create delegation.");
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/user-delegations/${id}`, headers);
      await loadRows();
      setMessage("Delegation deleted.");
    } catch {
      setError("Unable to delete delegation.");
    }
  };

  const columns = [
    {
      key: "delegator",
      header: "Delegator",
      render: (row: Delegation) => row.delegator?.name ?? String(row.delegator_user_id),
    },
    {
      key: "delegatedTo",
      header: "Delegated To",
      render: (row: Delegation) => row.delegatedTo?.name ?? String(row.delegated_to_user_id),
    },
    {
      key: "department",
      header: "Department",
      render: (row: Delegation) => row.department?.name ?? String(row.department_id),
    },
    { key: "authority_type", header: "Authority Type" },
    { key: "limit_amount", header: "Limit" },
    { key: "start_date", header: "Start" },
    { key: "end_date", header: "End" },
    {
      key: "status",
      header: "Status",
      render: (row: Delegation) => <StatusBadge status={row.status} />,
    },
    { key: "authorization_ref", header: "Authorization Ref" },
    {
      key: "action",
      header: "Action",
      render: (row: Delegation) => (
        <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => remove(row.id)}>
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
          title="User Delegations"
          subtitle="Create and manage temporary authority delegation records."
          
        />
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Create Delegation</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={save}>
                  <div className="col-12">
                    <label className="form-label small">Delegator</label>
                    <select className="form-select form-select-sm" value={form.delegator_user_id} onChange={(event) => setForm((current) => ({ ...current, delegator_user_id: event.target.value }))}>
                      <option value="">Select user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Delegated To</label>
                    <select className="form-select form-select-sm" value={form.delegated_to_user_id} onChange={(event) => setForm((current) => ({ ...current, delegated_to_user_id: event.target.value }))}>
                      <option value="">Select user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Department</label>
                    <select className="form-select form-select-sm" value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}>
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Authority Type</label>
                    <input className="form-control form-control-sm" value={form.authority_type} onChange={(event) => setForm((current) => ({ ...current, authority_type: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Amount Limit</label>
                    <input className="form-control form-control-sm" type="number" value={form.limit_amount} onChange={(event) => setForm((current) => ({ ...current, limit_amount: event.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Start Date</label>
                    <input className="form-control form-control-sm" type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">End Date</label>
                    <input className="form-control form-control-sm" type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Reference</label>
                    <input className="form-control form-control-sm" value={form.authorization_ref} onChange={(event) => setForm((current) => ({ ...current, authorization_ref: event.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Status</label>
                    <select className="form-select form-select-sm" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FormState["status"] }))}>
                      <option value="">Default active</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Remarks</label>
                    <textarea className="form-control form-control-sm" rows={2} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} />
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
            <FilterBar onReset={() => setFilters({ status: "", authority_type: "", delegatedTo: "" })}>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Status</label>
                <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Authority Type</label>
                <input className="form-control form-control-sm" value={filters.authority_type} onChange={(event) => setFilters((current) => ({ ...current, authority_type: event.target.value }))} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Delegated User</label>
                <input className="form-control form-control-sm" value={filters.delegatedTo} onChange={(event) => setFilters((current) => ({ ...current, delegatedTo: event.target.value }))} />
              </div>
            </FilterBar>
            {rows.length === 0 ? <EmptyState title="No delegations" message="No user delegations configured." /> : <DataTable columns={columns} rows={rows} />}
          </div>
        </div>
      </div>
    </main>
  );
}
