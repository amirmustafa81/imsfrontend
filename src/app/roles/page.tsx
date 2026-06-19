"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type Permission = {
  id: number;
  name: string;
  module: string;
  description: string | null;
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

type Role = {
  id: number;
  name: string;
  description: string | null;
  is_system_role: boolean;
  users_count?: number;
  permissions: Permission[];
};

type RoleForm = {
  name: string;
  description: string;
  permission_ids: string[];
};

type RoleFilter = { search: string };

const emptyForm: RoleForm = {
  name: "",
  description: "",
  permission_ids: [],
};

export default function RolesPage() {
  const { hasPermission, isAuthenticated, loading } = useAuth();
  const authReady = useMemo(() => isAuthenticated && !loading, [isAuthenticated, loading]);
  const canCreateRole = hasPermission(["roles.create", "roles.manage", "roles.write"]);
  const canUpdateRole = hasPermission(["roles.update", "roles.manage", "roles.write"]);
  const canDeleteRole = hasPermission(["roles.delete", "roles.manage", "roles.write"]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [filters, setFilters] = useState<RoleFilter>({ search: "" });
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [departmentNames, setDepartmentNames] = useState<Record<number, string>>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(false);

  const loadRows = useCallback(async () => {
    if (!authReady) return;

    try {
      const params = filters.search.trim() ? { search: filters.search.trim() } : undefined;
      const [roleResponse, permissionResponse, departmentResponse] = await Promise.all([
        api.get<{ data: Role[] }>("/roles", { params }),
        api.get<{ data: Permission[] }>("/permissions"),
        api.get<{ data: { id: number; name: string }[] }>("/master-data/departments"),
      ]);

      setRoles(roleResponse.data?.data ?? []);
      setPermissions(permissionResponse.data?.data ?? []);
      setDepartmentNames(Object.fromEntries((departmentResponse.data?.data ?? []).map((department) => [department.id, department.name])));
      setError("");
    } catch {
      setRoles([]);
      setPermissions([]);
      setError("Unable to load RBAC lists.");
    }
  }, [authReady, filters.search]);

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
      setError("System roles are protected and cannot be edited.");
      return;
    }

    setForm({
      name: role.name,
      description: role.description ?? "",
      permission_ids: role.permissions?.map((permission) => String(permission.id)) ?? [],
    });
    setEditingRoleId(role.id);
    setDialogOpen(true);
    setError("");
    setMessage("");
  };

  const saveRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
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
        permission_ids: form.permission_ids.map((id) => Number(id)),
      };

      if (editingRoleId === null) {
        await api.post("/roles", payload);
        setMessage("Role created.");
      } else {
        await api.put(`/roles/${editingRoleId}`, payload);
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

  const deleteRole = async (role: Role) => {
    if (role.is_system_role) {
      setError("System roles are protected and cannot be deleted.");
      return;
    }

    if ((role.users_count ?? 0) > 0) {
      setError("Assigned roles cannot be deleted. Remove user assignments first.");
      return;
    }

    try {
      await api.delete(`/roles/${role.id}`);
      await loadRows();
      setMessage("Role deleted.");
      setError("");
    } catch {
      setError("Unable to delete role.");
    }
  };

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
      const nextIds = checked
        ? Array.from(new Set([...current.permission_ids, permissionIdString]))
        : current.permission_ids.filter((id) => id !== permissionIdString);

      return { ...current, permission_ids: nextIds };
    });
  };

  const setModulePermissions = (permissionItems: Permission[], checked: boolean) => {
    setForm((current) => {
      const moduleIds = permissionItems.map((permission) => String(permission.id));
      const nextIds = checked
        ? Array.from(new Set([...current.permission_ids, ...moduleIds]))
        : current.permission_ids.filter((id) => !moduleIds.includes(id));

      return { ...current, permission_ids: nextIds };
    });
  };

  const openRoleUsersDialog = async (role: Role) => {
    setSelectedRole(role);
    setLoadingRoleUsers(true);
    setRoleUsers([]);

    try {
      const response = await api.get<{ data: { users: RoleUser[] } }>(`/roles/${role.id}/users`);
      setRoleUsers(response.data?.data?.users ?? []);
      setError("");
    } catch {
      setError("Unable to load users assigned to this role.");
      setRoleUsers([]);
    } finally {
      setLoadingRoleUsers(false);
    }
  };

  const closeRoleUsersDialog = () => {
    setSelectedRole(null);
    setRoleUsers([]);
  };

  const columns = [
    { key: "name", header: "Role" },
    { key: "description", header: "Description" },
    {
      key: "is_system_role",
      header: "Type",
      render: (row: Role) =>
        row.is_system_role ? <StatusBadge status="Active" /> : <span className="text-secondary">Custom</span>,
    },
    {
      key: "users_count",
      header: "Assigned Users",
      render: (row: Role) => row.users_count ?? 0,
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (row: Role) => (
        <div>
          <span className="fw-semibold">{row.permissions?.length ?? 0}</span>
          <span className="text-secondary"> permission{row.permissions?.length === 1 ? "" : "s"}</span>
          <div className="small text-secondary text-truncate" style={{ maxWidth: 360 }}>
            {row.permissions?.map((permission) => permission.name).join(", ") || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "users_list",
      header: "Users",
      render: (row: Role) => (
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => void openRoleUsersDialog(row)}>
          <i className="bi bi-people me-1" />
          {row.users_count ?? 0}
        </button>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row: Role) => {
        const deleteDisabled = row.is_system_role || (row.users_count ?? 0) > 0;
        const canEditRole = canUpdateRole && !row.is_system_role;
        const canDelete = canDeleteRole && !deleteDisabled;

        return (
          <div className="d-flex flex-wrap gap-2">
            {row.is_system_role ? <span className="badge text-bg-secondary align-self-center">Protected</span> : null}
            {canUpdateRole ? (
              <button
                className="btn btn-sm btn-outline-primary"
                type="button"
                onClick={() => openEditDialog(row)}
                disabled={!canEditRole}
                title={row.is_system_role ? "System roles are protected" : "Edit role and permissions"}
              >
                <i className="bi bi-pencil me-1" />
                Edit
              </button>
            ) : null}
            {canDeleteRole ? (
              <button
                className="btn btn-sm btn-outline-danger"
                type="button"
                onClick={() => deleteRole(row)}
                disabled={!canDelete}
                title={
                  row.is_system_role
                    ? "System roles are protected"
                    : (row.users_count ?? 0) > 0
                      ? "Assigned roles cannot be deleted"
                      : "Delete role"
                }
              >
                <i className="bi bi-trash me-1" />
                Delete
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Roles & Permissions"
          subtitle="Create custom roles, maintain permission sets, and keep system roles protected."
          actions={
            canCreateRole ? (
              <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
                <i className="bi bi-plus-lg me-1" />
                Create Role
              </button>
            ) : (
              <span className="small text-secondary">Read-only role mode</span>
            )
          }
        />

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <FilterBar onReset={() => setFilters({ search: "" })}>
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control form-control-sm"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
        </FilterBar>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Role list</h2>
          <span className="small text-secondary">
            {roles.length} record{roles.length === 1 ? "" : "s"}
          </span>
        </div>

        {roles.length === 0 ? (
          <EmptyState title="No roles" message="Create the first role or adjust the search." />
        ) : (
          <DataTable columns={columns} rows={roles} />
        )}
      </div>

      {dialogOpen ? (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div
              className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
              style={{ width: "min(54vw, 920px)", maxWidth: "min(54vw, 920px)" }}
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
                        className="form-control form-control-sm"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>

                    <div className="col-12 col-md-5 d-flex align-items-end">
                      <div className="rounded border bg-body-tertiary px-3 py-2 w-100">
                        <div className="small fw-semibold">Role Type</div>
                        <div className="small text-secondary">
                          {editingRoleId === null ? "Custom role" : "Custom role - permissions editable"}
                        </div>
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label small" htmlFor="role-description">
                        Description
                      </label>
                      <textarea
                        id="role-description"
                        className="form-control form-control-sm"
                        rows={3}
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </div>

                    <div className="col-12 col-lg-8">
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <label className="form-label small mb-0">Permissions</label>
                        <span className="badge text-bg-light border">{form.permission_ids.length} selected</span>
                      </div>

                      {Object.entries(permissionGroups).length === 0 ? (
                        <div className="border rounded px-3 py-2 text-secondary">No permissions available.</div>
                      ) : (
                        <div className="border rounded p-3" style={{ maxHeight: 360, overflowY: "auto" }}>
                          {Object.entries(permissionGroups).map(([moduleName, permissionItems]) => (
                            <fieldset className="mb-3" key={moduleName}>
                              <legend className="small fw-semibold text-secondary px-2">
                                <span className="me-2">{moduleName}</span>
                                <button
                                  className="btn btn-link btn-sm p-0 me-2"
                                  type="button"
                                  onClick={() => setModulePermissions(permissionItems, true)}
                                >
                                  Select all
                                </button>
                                <button
                                  className="btn btn-link btn-sm p-0 text-secondary"
                                  type="button"
                                  onClick={() => setModulePermissions(permissionItems, false)}
                                >
                                  Clear
                                </button>
                              </legend>
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
                                          {permission.description ? (
                                            <span className="d-block small text-secondary">{permission.description}</span>
                                          ) : null}
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
                      <div className="h-100 rounded border bg-body-tertiary p-3">
                        <div className="small fw-semibold text-uppercase text-secondary mb-2">Role Notes</div>
                        <div className="small text-secondary">
                          System roles are protected baseline roles and cannot be edited here. Custom roles can be shaped
                          for department-specific access patterns and assigned from the Users module.
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

      {selectedRole ? (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(58vw, 900px)", maxWidth: "min(58vw, 900px)" }}>
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header px-4 py-3">
                  <div>
                    <h5 className="modal-title mb-1">Users assigned to {selectedRole.name}</h5>
                    <div className="small text-secondary">View role membership in one place.</div>
                  </div>
                  <button className="btn-close" type="button" aria-label="Close" onClick={closeRoleUsersDialog} />
                </div>

                <div className="modal-body px-4 py-4">
                  {loadingRoleUsers ? (
                    <div className="text-secondary">
                      <i className="bi bi-arrow-repeat me-2" />
                      Loading assigned users…
                    </div>
                  ) : roleUsers.length === 0 ? (
                    <EmptyState title="No users found" message="No users are currently assigned to this role." />
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
                                <td>{roleUser.department_id ? departmentNames[roleUser.department_id] ?? "-" : "-"}</td>
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
