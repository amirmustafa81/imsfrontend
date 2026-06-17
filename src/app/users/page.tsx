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
  access_scope: string;
  status: "active" | "inactive" | "suspended";
  department_id: number | null;
  roles: Role[];
};

type RowFilter = { search: string; status: string; accessScope: string; department: string };

export default function UsersPage() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token, setToken] = useState(initialToken);
  const [tmpToken, setTmpToken] = useState(initialToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<RowFilter>({ search: "", status: "", accessScope: "", department: "" });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Record<number, string[]>>({});
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
      const users = response.data?.data ?? [];
      setRows(users);
      const nextSelections: Record<number, string[]> = {};
      users.forEach((user) => {
        nextSelections[user.id] = (user.roles ?? []).map((role) => String(role.id));
      });
      setSelectedRoleIds(nextSelections);
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

  const saveRoles = async (userId: number) => {
    if (!token) {
      setError("Save token first.");
      return;
    }
    const roleIds = selectedRoleIds[userId] ?? [];
    try {
      await api.post(
        `/users/${userId}/roles`,
        { role_ids: roleIds.map((value) => Number(value)).filter((id) => Number.isFinite(id)) },
        headers,
      );
      setMessage("Roles updated.");
      setError("");
      setEditingUserId(null);
      await loadRows();
    } catch {
      setError("Unable to update roles.");
    }
  };

  const columns = [
    { key: "name", header: "User" },
    { key: "email", header: "Email" },
    { key: "employee_code", header: "Employee Code" },
    {
      key: "department_id",
      header: "Department",
      render: (row: UserRow) => {
        const dept = departments.find((d) => d.id === row.department_id);
        return dept ? `${dept.name} (${dept.code})` : String(row.department_id ?? "-");
      },
    },
    { key: "access_scope", header: "Scope" },
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
      render: (row: UserRow) =>
        editingUserId === row.id ? (
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-primary" onClick={() => saveRoles(row.id)}>
              Save roles
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingUserId(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-sm btn-outline-primary" onClick={() => setEditingUserId(row.id)}>
            <i className="bi bi-gear me-1" />
            Roles
          </button>
        ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Users"
          subtitle="View users and manage role assignments."
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

        <FilterBar onReset={() => setFilters({ search: "", status: "", accessScope: "", department: "" })}>
          <div className="col-12 col-md-4">
            <label className="form-label small mb-1">Search</label>
            <input className="form-control form-control-sm" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small mb-1">Access Scope</label>
            <input className="form-control form-control-sm" value={filters.accessScope} onChange={(event) => setFilters((current) => ({ ...current, accessScope: event.target.value }))} />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small mb-1">Department</label>
            <select className="form-select form-select-sm" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="">All</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState title="No users found" message="No users match the selected filters." />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} />
            {editingUserId !== null ? (
              <div className="card border-0 shadow-sm mt-3">
                <div className="card-header bg-white fw-semibold">Assign Roles for User #{editingUserId}</div>
                <div className="card-body">
                  <label className="form-label small mb-1">Roles</label>
                  <select
                    multiple
                    className="form-select"
                    size={6}
                    value={selectedRoleIds[editingUserId] ?? []}
                    onChange={(event) =>
                      setSelectedRoleIds((current) => ({
                        ...current,
                        [editingUserId]: Array.from(event.target.selectedOptions).map((option) => option.value),
                      }))
                    }
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
