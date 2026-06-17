"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader } from "@/components/ims";

type Permission = { id: number; name: string; module: string; description: string | null };
type Role = {
  id: number;
  name: string;
  description: string | null;
  is_system_role: boolean;
  permissions: Permission[];
};

type RoleForm = {
  name: string;
  description: string;
  is_system_role: boolean;
  permission_ids: string[];
};

type PermissionFilter = { search: string };

const emptyForm: RoleForm = {
  name: "",
  description: "",
  is_system_role: false,
  permission_ids: [],
};

export default function RolesPage() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token, setToken] = useState(initialToken);
  const [tmpToken, setTmpToken] = useState(initialToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [filters, setFilters] = useState<PermissionFilter>({ search: "" });
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async () => {
    if (!token) return;
    try {
      const params = filters.search ? { search: filters.search } : undefined;
      const [roleResponse, permissionResponse] = await Promise.all([
        api.get<{ data: Role[] }>("/roles", { ...headers, params }),
        api.get<{ data: Permission[] }>("/permissions", headers),
      ]);
      setRoles(roleResponse.data?.data ?? []);
      setPermissions(permissionResponse.data?.data ?? []);
      setError("");
    } catch {
      setRoles([]);
      setPermissions([]);
      setError("Unable to load RBAC lists.");
    }
  }, [headers, token, filters.search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
  };

  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Save token first.");
      return;
    }
    if (!form.name.trim()) {
      setError("Role name is required.");
      return;
    }
    try {
      await api.post("/roles", {
        name: form.name.trim(),
        description: form.description || null,
        is_system_role: form.is_system_role,
        permission_ids: form.permission_ids.map((id) => Number(id)),
      }, headers);
      setForm(emptyForm);
      setMessage("Role created.");
      setError("");
      await loadRows();
    } catch {
      setError("Unable to create role.");
    }
  };

  const deleteRole = async (id: number) => {
    try {
      await api.delete(`/roles/${id}`, headers);
      await loadRows();
      setMessage("Role deleted.");
    } catch {
      setError("Unable to delete role.");
    }
  };

  const columns = [
    { key: "name", header: "Role" },
    { key: "description", header: "Description" },
    { key: "is_system_role", header: "System Role", render: (row: Role) => (row.is_system_role ? "Yes" : "No") },
    {
      key: "permissions",
      header: "Permissions",
      render: (row: Role) => row.permissions?.map((permission) => permission.name).join(", ") || "-",
    },
    {
      key: "action",
      header: "Action",
      render: (row: Role) => (
        <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteRole(row.id)} disabled={row.is_system_role}>
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
          title="Roles & Permissions"
          subtitle="Create roles and assign permissions. User assignment is managed in Users."
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
            <form className="card border-0 shadow-sm" onSubmit={createRole}>
              <div className="card-header bg-white fw-semibold">Create Role</div>
              <div className="card-body row g-3">
                <div className="col-12">
                  <label className="form-label small">Role Name</label>
                  <input className="form-control form-control-sm" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="col-12">
                  <label className="form-label small">Description</label>
                  <textarea className="form-control form-control-sm" rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                </div>
                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={form.is_system_role}
                      onChange={(event) => setForm((current) => ({ ...current, is_system_role: event.target.checked }))}
                      id="is-system-role"
                    />
                    <label htmlFor="is-system-role" className="form-check-label">
                      System role
                    </label>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label small">Permissions</label>
                  <select
                    multiple
                    className="form-select"
                    size={8}
                    value={form.permission_ids}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        permission_ids: Array.from(event.target.selectedOptions).map((option) => option.value),
                      }))
                    }
                  >
                    {permissions.map((permission) => (
                      <option key={permission.id} value={permission.id}>
                        {permission.module}: {permission.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <button className="btn btn-sm btn-primary" type="submit">
                    <i className="bi bi-plus-circle me-1" />
                    Create Role
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setFilters({ search: "" })}>
              <div className="col-12">
                <label className="form-label small mb-1">Search</label>
                <input className="form-control form-control-sm" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
              </div>
            </FilterBar>
            {roles.length === 0 ? <EmptyState title="No roles" message="No roles found." /> : <DataTable columns={columns} rows={roles} />}
          </div>
        </div>
      </div>
    </main>
  );
}
