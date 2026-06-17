"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

type RoleFilter = { search: string };

const emptyForm: RoleForm = {
  name: "",
  description: "",
  is_system_role: false,
  permission_ids: [],
};

export default function RolesPage() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token] = useState(initialToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [filters, setFilters] = useState<RoleFilter>({ search: "" });
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  const loadRows = useCallback(async () => {
    if (!token) return;
    try {
      const params = filters.search.trim() ? { search: filters.search.trim() } : undefined;
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

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyForm);
    setEditingRoleId(null);
  };

  const openCreateDialog = () => {
    setForm(emptyForm);
    setDialogOpen(true);
    setEditingRoleId(null);
    setError("");
    setMessage("");
  };

  const openEditDialog = (role: Role) => {
    if (role.is_system_role) {
      setError("System roles cannot be edited through this screen.");
      return;
    }

    setForm({
      name: role.name,
      description: role.description ?? "",
      is_system_role: role.is_system_role,
      permission_ids: role.permissions?.map((permission) => String(permission.id)) ?? [],
    });
    setEditingRoleId(role.id);
    setDialogOpen(true);
    setError("");
    setMessage("");
  };

  const saveRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Authentication token required.");
      return;
    }
    if (!form.name.trim()) {
      setError("Role name is required.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_system_role: form.is_system_role,
        permission_ids: form.permission_ids.map((id) => Number(id)),
      };

      if (editingRoleId === null) {
        await api.post("/roles", payload, headers);
        setMessage("Role created.");
      } else {
        await api.put(`/roles/${editingRoleId}`, payload, headers);
        setMessage("Role updated.");
      }
      setError("");
      closeDialog();
      await loadRows();
    } catch {
      setError(editingRoleId === null ? "Unable to create role." : "Unable to update role.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (id: number) => {
    try {
      await api.delete(`/roles/${id}`, headers);
      await loadRows();
      setMessage("Role deleted.");
      setError("");
    } catch {
      setError("Unable to delete role.");
    }
  };

  const columns = [
    { key: "name", header: "Role" },
    { key: "description", header: "Description" },
    {
      key: "is_system_role",
      header: "System Role",
      render: (row: Role) => (row.is_system_role ? "Yes" : "No"),
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (row: Role) => row.permissions?.map((permission) => permission.name).join(", ") || "-",
    },
    {
      key: "action",
      header: "Action",
      render: (row: Role) => (
        <>
          <button
            className="btn btn-sm btn-outline-danger"
            type="button"
            onClick={() => deleteRole(row.id)}
            disabled={row.is_system_role}
          >
            <i className="bi bi-trash me-1" />
            Delete
          </button>
          <button
            className="btn btn-sm btn-outline-primary ms-2"
            type="button"
            onClick={() => openEditDialog(row)}
            disabled={row.is_system_role}
          >
            <i className="bi bi-pencil me-1" />
            Edit
          </button>
        </>
      ),
    },
  ];

  const permissionGroups = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    for (const permission of permissions) {
      const moduleName = permission.module || "General";
      if (!groups[moduleName]) {
        groups[moduleName] = [];
      }
      groups[moduleName].push(permission);
    }
    return groups;
  }, [permissions]);

  const togglePermission = (permissionId: number, checked: boolean) => {
    setForm((current) => {
      const permissionIdString = String(permissionId);
      const nextIds = checked ? [...current.permission_ids, permissionIdString] : current.permission_ids.filter((id) => id !== permissionIdString);
      return { ...current, permission_ids: nextIds };
    });
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Roles & Permissions"
          subtitle="Create roles and assign permissions. User assignment is managed in Users."
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              Create Role
            </button>
          }
        />

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <FilterBar onReset={() => setFilters({ search: "" })}>
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
        </FilterBar>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Role list</h2>
          <span className="small text-secondary">{roles.length} record{roles.length === 1 ? "" : "s"}</span>
        </div>

        {roles.length === 0 ? <EmptyState title="No roles" message="Create the first role or adjust the search." /> : <DataTable columns={columns} rows={roles} />}
      </div>

      {dialogOpen ? (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div
              className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
              style={{ width: "min(42vw, 820px)", maxWidth: "min(42vw, 820px)" }}
            >
              <form className="modal-content border-0 shadow-lg" onSubmit={saveRole}>
                <div className="modal-header px-4 py-3">
                  <div>
                    <h5 className="modal-title mb-1">{editingRoleId === null ? "Create Role" : "Edit Role"}</h5>
                    <div className="small text-secondary">Define role identity and the permission set assigned to it.</div>
                  </div>
                  <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                </div>
                <div className="modal-body px-4 py-4">
                  <div className="row g-4">
                    <div className="col-12 col-md-7">
                      <label className="form-label small" htmlFor="role-name">
                        Role Name
                      </label>
                      <input
                        id="role-name"
                        className="form-control"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div className="col-12 col-md-5 d-flex align-items-end">
                      <div className="form-check mb-2">
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
                      <label className="form-label small" htmlFor="role-description">
                        Description
                      </label>
                      <textarea
                        id="role-description"
                        className="form-control"
                        rows={3}
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </div>
                    <div className="col-12 col-lg-8">
                      <label className="form-label small">Permissions</label>
                      {Object.entries(permissionGroups).length === 0 ? (
                        <div className="border rounded px-3 py-2 text-secondary">No permissions available.</div>
                      ) : (
                        <div className="border rounded p-3" style={{ maxHeight: 360, overflowY: "auto" }}>
                          {Object.entries(permissionGroups).map(([moduleName, permissionItems]) => (
                            <fieldset className="mb-3" key={moduleName}>
                              <legend className="small fw-semibold text-secondary px-2">{moduleName}</legend>
                              <div className="row g-2">
                                {permissionItems.map((permission) => {
                                  const permissionId = String(permission.id);
                                  return (
                                    <div className="col-12 col-lg-6" key={permission.id}>
                                      <div className="form-check">
                                        <input
                                          id={`permission-${permission.id}`}
                                          className="form-check-input"
                                          type="checkbox"
                                          checked={form.permission_ids.includes(permissionId)}
                                          onChange={(event) => togglePermission(permission.id, event.target.checked)}
                                        />
                                        <label htmlFor={`permission-${permission.id}`} className="form-check-label">
                                          {permission.name}
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </fieldset>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-12 col-lg-4">
                      <div className="h-100 rounded-3 border bg-body-tertiary p-3">
                        <div className="small fw-semibold text-uppercase text-secondary mb-2">Role Notes</div>
                        <div className="small text-secondary">
                          System roles are protected baseline roles. Custom roles can be shaped for department-specific access patterns.
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
                    <i className={`bi ${editingRoleId === null ? "bi-plus-circle" : "bi-save"} me-1`} />
                    {saving ? (editingRoleId === null ? "Creating..." : "Saving...") : editingRoleId === null ? "Create Role" : "Save Role"}
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
