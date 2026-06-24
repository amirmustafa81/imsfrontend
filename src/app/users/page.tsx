"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, FieldLabel, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Permission = { id: number; name: string };
type Role = {
  id: number;
  name: string;
  is_system_role?: boolean;
  permissions?: Permission[];
};
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

type RoleUser = {
  id: number;
  name: string;
  email: string;
  employee_code: string | null;
  department_id: number | null;
  access_scope: string;
  status: string;
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

const userFieldInfo = {
  name: "Full display name shown in audit logs, approvals, and user lists.",
  email: "Login email address for the IMS account.",
  password: "Set a temporary password for new users, or leave blank while editing to keep the current password.",
  designation: "Official role/title of the employee, such as HOD, Store Officer, or Lab In-charge.",
  employeeCode: "Employee code used for ERP matching and custodian references.",
  phone: "Contact number for user records and future notification support.",
  department: "Primary department used for department-scoped access and inventory visibility.",
  accessScope: "Department scope limits visibility to the assigned department; university-wide scope allows cross-department access where permitted.",
  status: "Inactive or suspended users cannot operate normally but remain in history for audit traceability.",
  roles: "Roles define the permissions this user receives, such as admin, store officer, HOD, or auditor.",
};

export default function UsersPage() {
  const { hasPermission, isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const canCreateUser = hasPermission(["users.create", "users.manage", "users.write", "users.update"]);
  const canUpdateUser = hasPermission(["users.update", "users.manage", "users.write"]);
  const headers = useMemo(() => ({}), []);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<RowFilter>({ search: "", status: "", accessScope: "", department: "" });
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(false);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [roleUsersRole, setRoleUsersRole] = useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;
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
  }, [headers, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) return;

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
  }, [headers, authReady, filters.search, filters.status, filters.accessScope, filters.department]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

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
    setLoadingUserRoles(false);
    setDialogOpen(true);
    setError("");
    setMessage("");
  };

  const startEdit = async (user: UserRow) => {
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
    setLoadingUserRoles(true);

    try {
      const response = await api.get<{ data: { roles: Role[] } }>(`/users/${user.id}/roles`, headers);
      const authoritativeRoles = response.data?.data?.roles ?? [];

      setForm((current) => ({
        ...current,
        role_ids: authoritativeRoles.map((role) => String(role.id)),
      }));
    } catch {
      // keep the row snapshot as fallback role assignment if the endpoint is unavailable.
    } finally {
      setLoadingUserRoles(false);
    }
  };

  const toggleRole = (roleId: number, checked: boolean) => {
    const roleIdString = String(roleId);
    setForm((current) => ({
      ...current,
      role_ids: checked ? [...current.role_ids, roleIdString] : current.role_ids.filter((id) => id !== roleIdString),
    }));
  };

  const openRoleUsersDialog = async (role: Role) => {
    setRoleUsersRole(role);
    setLoadingRoleUsers(true);
    setRoleUsers([]);
    setError("");

    try {
      const response = await api.get<{ data: { users: RoleUser[] } }>(`/roles/${role.id}/users`, headers);
      setRoleUsers(response.data?.data?.users ?? []);
    } catch {
      setError("Unable to load users assigned to this role.");
      setRoleUsers([]);
    } finally {
      setLoadingRoleUsers(false);
    }
  };

  const closeRoleUsersDialog = () => {
    setRoleUsersRole(null);
    setRoleUsers([]);
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Authentication token required.");
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
      render: (row: UserRow) => (
        <div className="d-flex flex-wrap gap-2">
          {row.roles.length === 0 ? (
            <span className="text-secondary">-</span>
          ) : (
            row.roles.map((role) => (
              <button
                className="btn btn-sm btn-outline-secondary"
                key={role.id}
                type="button"
                onClick={() => void openRoleUsersDialog(role)}
                title={`View users assigned to ${role.name}`}
              >
                {role.name}
              </button>
            ))
          )}
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row: UserRow) =>
        canUpdateUser ? (
          <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => startEdit(row)}>
            <i className="bi bi-pencil-square me-1" />
            Edit user
          </button>
        ) : (
          <span className="small text-secondary">Read-only</span>
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
            canCreateUser ? (
              <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
                <i className="bi bi-plus-lg me-1" />
                Create User
              </button>
            ) : (
              <span className="small text-secondary">Read-only user mode</span>
            )
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
            <div
              className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
              style={{ width: "min(44vw, 860px)", maxWidth: "min(44vw, 860px)" }}
            >
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
                      <FieldLabel htmlFor="user-name" info={userFieldInfo.name}>Name</FieldLabel>
                      <input id="user-name" className="form-control" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <FieldLabel htmlFor="user-email" info={userFieldInfo.email}>Email</FieldLabel>
                      <input id="user-email" className="form-control" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <FieldLabel htmlFor="user-password" info={userFieldInfo.password}>{editingUserId === null ? "Password" : "Reset Password"}</FieldLabel>
                      <input id="user-password" className="form-control" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={editingUserId === null ? "Minimum 8 characters" : "Leave blank to keep current password"} />
                    </div>
                    <div className="col-12 col-md-6">
                      <FieldLabel htmlFor="user-designation" info={userFieldInfo.designation}>Designation</FieldLabel>
                      <input id="user-designation" className="form-control" value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <FieldLabel htmlFor="user-employee-code" info={userFieldInfo.employeeCode}>Employee Code</FieldLabel>
                      <input id="user-employee-code" className="form-control" value={form.employee_code} onChange={(event) => setForm((current) => ({ ...current, employee_code: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-6">
                      <FieldLabel htmlFor="user-phone" info={userFieldInfo.phone}>Phone</FieldLabel>
                      <input id="user-phone" className="form-control" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                    </div>
                    <div className="col-12 col-md-4">
                      <FieldLabel htmlFor="user-department" info={userFieldInfo.department}>Department</FieldLabel>
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
                      <FieldLabel htmlFor="user-access-scope" info={userFieldInfo.accessScope}>Access Scope</FieldLabel>
                      <select id="user-access-scope" className="form-select" value={form.access_scope} onChange={(event) => setForm((current) => ({ ...current, access_scope: event.target.value as UserForm["access_scope"] }))}>
                        <option value="department">Department</option>
                        <option value="university">University-wide</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <FieldLabel htmlFor="user-status" info={userFieldInfo.status}>Status</FieldLabel>
                      <select id="user-status" className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserForm["status"] }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div className="col-12 col-lg-8">
                      <FieldLabel info={userFieldInfo.roles}>Roles</FieldLabel>
                      {roles.length === 0 ? (
                        <div className="border rounded px-3 py-2 text-secondary">No roles available.</div>
                      ) : (
                        <div className="border rounded p-3" style={{ maxHeight: 260, overflowY: "auto" }}>
                          <div className="row g-2">
                            {roles.map((role) => {
                              const roleId = String(role.id);
                              return (
                                <div className="col-12 col-lg-6" key={role.id}>
                                  <div className="form-check">
                                    <input
                                      id={`user-role-${role.id}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={form.role_ids.includes(roleId)}
                                      onChange={(event) => toggleRole(role.id, event.target.checked)}
                                    />
                                    <label htmlFor={`user-role-${role.id}`} className="form-check-label">
                                      {role.name}
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      {loadingUserRoles ? (
                        <div className="small text-secondary">
                          <i className="bi bi-arrow-repeat me-2" />
                          Loading authoritative role assignment...
                        </div>
                      ) : null}
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

      {roleUsersRole ? (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(58vw, 900px)", maxWidth: "min(58vw, 900px)" }}>
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header px-4 py-3">
                  <div>
                    <h5 className="modal-title mb-1">Users assigned to {roleUsersRole.name}</h5>
                    <div className="small text-secondary">Review role membership in one place.</div>
                  </div>
                  <button className="btn-close" type="button" aria-label="Close" onClick={closeRoleUsersDialog} />
                </div>
                <div className="modal-body px-4 py-4">
                  {loadingRoleUsers ? (
                    <div className="text-secondary">
                      <i className="bi bi-arrow-repeat me-2" />
                      Loading assigned users...
                    </div>
                  ) : roleUsers.length === 0 ? (
                    <EmptyState title="No users found" message={`No users currently have ${roleUsersRole.name}.`} />
                  ) : (
                    <div className="card border-0 shadow-sm">
                      <div className="table-responsive">
                        <table className="table table-sm table-hover mb-0 align-middle">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Employee Code</th>
                              <th>Department</th>
                              <th>Scope</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roleUsers.map((roleUser) => (
                              <tr key={roleUser.id}>
                                <td>{roleUser.name}</td>
                                <td>{roleUser.email}</td>
                                <td>{roleUser.employee_code ?? "-"}</td>
                                <td>{roleUser.department_id ? departments.find((department) => department.id === roleUser.department_id)?.name ?? "-" : "-"}</td>
                                <td>{roleUser.access_scope === "university" ? "University-wide" : "Department"}</td>
                                <td>
                                  <StatusBadge status={roleUser.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer px-4 py-3">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeRoleUsersDialog}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeRoleUsersDialog} />
        </>
      ) : null}
    </main>
  );
}
