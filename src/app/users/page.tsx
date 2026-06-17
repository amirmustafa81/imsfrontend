"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Permission = { id: number; name: string };
type Role = { id: number; name: string; permissions?: Permission[] };
type Department = { id: number; name: string; code: string };
type UserRow = {
  id: number;
  name: string;
  email: string;
  employee_code: string | null;
  phone?: string | null;
  designation?: string | null;
  access_scope: "department" | "university";
  status: "active" | "inactive" | "suspended";
  department_id: number | null;
  roles: Role[];
};

type RowFilter = { search: string; status: string; accessScope: string; department: string };
type UserForm = {
  name: string;
  email: string;
  password: string;
  employee_code: string;
  phone: string;
  designation: string;
  department_id: string;
  access_scope: "department" | "university";
  status: "active" | "inactive" | "suspended";
  role_ids: string[];
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  employee_code: "",
  phone: "",
  designation: "",
  department_id: "",
  access_scope: "department",
  status: "active",
  role_ids: [],
};

export default function UsersPage() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token, setToken] = useState(initialToken);
  const [tmpToken, setTmpToken] = useState(initialToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<RowFilter>({ search: "", status: "", accessScope: "", department: "" });
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadLookups = useCallback(async () => {
    if (!token) return;
    try {
      const [rolesResponse, deptResponse] = await Promise.all([
        api.get<{ data: Role[] }>("/roles", headers),
        api.get<{ data: Department[] }>("/master-data/departments", headers),
      ]);
      setRoles(rolesResponse.data?.data ?? []);
      setDepartments(deptResponse.data?.data ?? []);
    } catch {
      setRoles([]);
      setDepartments([]);
    }
  }, [headers, token]);

  const loadRows = useCallback(async () => {
    if (!token) return;

    const params: Record<string, string> = {};
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.status) params.status = filters.status;
    if (filters.accessScope) params.access_scope = filters.accessScope;
    if (filters.department) params.department_id = filters.department;

    try {
      const response = await api.get<{ data: UserRow[] }>("/users", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load users.");
    }
  }, [headers, token, filters.search, filters.status, filters.accessScope, filters.department]);

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

  const resetForm = () => {
    setEditingUserId(null);
    setForm(emptyForm);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
    setError("");
    setMessage("");
  };

  const startEdit = (user: UserRow) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      employee_code: user.employee_code ?? "",
      phone: user.phone ?? "",
      designation: user.designation ?? "",
      department_id: user.department_id ? String(user.department_id) : "",
      access_scope: user.access_scope,
      status: user.status,
      role_ids: (user.roles ?? []).map((role) => String(role.id)),
    });
    setDialogOpen(true);
    setError("");
    setMessage("");
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Save token first.");
      return;
    }

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    if (editingUserId === null && !form.password.trim()) {
      setError("Password is required for new users.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim() || undefined,
      employee_code: form.employee_code.trim() || null,
      phone: form.phone.trim() || null,
      designation: form.designation.trim() || null,
      department_id: form.department_id ? Number(form.department_id) : null,
      access_scope: form.access_scope,
      status: form.status,
      role_ids: form.role_ids.map((value) => Number(value)).filter((id) => Number.isFinite(id)),
    };

    try {
      setSaving(true);
      if (editingUserId === null) {
        await api.post("/users", payload, headers);
        setMessage("User created successfully.");
      } else {
        await api.put(`/users/${editingUserId}`, payload, headers);
        setMessage("User updated successfully.");
      }
      setError("");
      closeDialog();
      await loadRows();
    } catch (saveError: unknown) {
      const apiMessage =
        typeof saveError === "object" && saveError !== null && "response" in saveError
          ? (saveError as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : null;
      setError(typeof apiMessage === "string" && apiMessage ? apiMessage : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "name", header: "User" },
    { key: "email", header: "Email" },
    { key: "employee_code", header: "Employee Code" },
    { key: "designation", header: "Designation" },
    {
      key: "department_id",
      header: "Department",
      render: (row: UserRow) => {
        const dept = departments.find((department) => department.id === row.department_id);
        return dept ? `${dept.name} (${dept.code})` : "-";
      },
    },
    {
      key: "access_scope",
      header: "Scope",
      render: (row: UserRow) => row.access_scope === "university" ? "University-wide" : "Department",
    },
    {
      key: "status",
      header: "Status",
      render: (row: UserRow) => <StatusBadge status={row.status} />,
    },
    {
      key: "roles",
      header: "Assigned Roles",
      render: (row: UserRow) => row.roles.map((role) => role.name).join(", ") || "-",
    },
    {
      key: "action",
      header: "Action",
      render: (row: UserRow) => (
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => startEdit(row)}>
          <i className="bi bi-pencil-square me-1" />
          Edit user
        </button>
      ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Users"
          subtitle="Create users, update access details, and assign roles."
          actions={
            <>
              <button className="btn btn-primary" type="button" onClick={openCreateDialog}>
                <i className="bi bi-plus-lg me-1" />
                Create User
              </button>
              <form className="d-flex gap-2 align-items-end" onSubmit={submitToken}>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">
                    <i className="bi bi-key" />
                  </span>
                  <input
                    className="form-control"
                    value={tmpToken}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setTmpToken(event.target.value)}
                    type="password"
                  />
                </div>
                <button className="btn btn-sm btn-outline-primary" type="submit">
                  Save token
                </button>
              </form>
            </>
          }
        />
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <FilterBar onReset={() => setFilters({ search: "", status: "", accessScope: "", department: "" })}>
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input className="form-control" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Status</label>
            <select className="form-select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Access Scope</label>
            <select className="form-select" value={filters.accessScope} onChange={(event) => setFilters((current) => ({ ...current, accessScope: event.target.value }))}>
              <option value="">All</option>
              <option value="department">Department</option>
              <option value="university">University-wide</option>
            </select>
          </div>
          <div className="col-12 col-lg-2">
            <label className="form-label fw-semibold">Department</label>
            <select className="form-select" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="">All</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">User list</h2>
          <span className="small text-secondary">{rows.length} record{rows.length === 1 ? "" : "s"}</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No users found" message="Create the first user or adjust the selected filters." />
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}
      </div>

      {dialogOpen ? (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <form className="modal-content border-0 shadow-lg" onSubmit={saveUser}>
                <div className="modal-header px-4 py-3">
                  <div>
                    <h5 className="modal-title mb-1">{editingUserId === null ? "Create User" : `Edit User #${editingUserId}`}</h5>
                    <div className="small text-secondary">Manage identity, department scope, and assigned roles.</div>
                  </div>
                  <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                </div>
                <div className="modal-body px-4 py-4">
                  <div className="row g-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="user-name">Name</label>
                      <input id="user-name" className="form-control" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="user-email">Email</label>
                      <input id="user-email" className="form-control" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="user-password">{editingUserId === null ? "Password" : "Reset Password"}</label>
                      <input id="user-password" className="form-control" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={editingUserId === null ? "Minimum 8 characters" : "Leave blank to keep current password"} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="user-designation">Designation</label>
                      <input id="user-designation" className="form-control" value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="user-employee-code">Employee Code</label>
                      <input id="user-employee-code" className="form-control" value={form.employee_code} onChange={(event) => setForm((current) => ({ ...current, employee_code: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small" htmlFor="user-phone">Phone</label>
                      <input id="user-phone" className="form-control" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small" htmlFor="user-department">Department</label>
                      <select id="user-department" className="form-select" value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}>
                        <option value="">Select department</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small" htmlFor="user-access-scope">Access Scope</label>
                      <select id="user-access-scope" className="form-select" value={form.access_scope} onChange={(event) => setForm((current) => ({ ...current, access_scope: event.target.value as UserForm["access_scope"] }))}>
                        <option value="department">Department</option>
                        <option value="university">University-wide</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small" htmlFor="user-status">Status</label>
                      <select id="user-status" className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserForm["status"] }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div className="col-12 col-lg-8">
                      <label className="form-label small" htmlFor="user-roles">Roles</label>
                      <select
                        id="user-roles"
                        multiple
                        className="form-select"
                        size={5}
                        value={form.role_ids}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            role_ids: Array.from(event.target.selectedOptions).map((option) => option.value),
                          }))
                        }
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">Hold Command/Ctrl to select multiple roles.</div>
                    </div>
                    <div className="col-12 col-lg-4">
                      <div className="h-100 rounded-3 border bg-body-tertiary p-3">
                        <div className="small fw-semibold text-uppercase text-secondary mb-2">Access Notes</div>
                        <div className="small text-secondary">
                          Department scope limits the user to assigned departments. University-wide scope allows cross-department visibility where policy permits.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer px-4 py-3">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeDialog}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    <i className={`bi ${editingUserId === null ? "bi-person-plus" : "bi-save"} me-1`} />
                    {saving ? "Saving..." : editingUserId === null ? "Create User" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeDialog} />
        </>
      ) : null}
    </main>
  );
}
