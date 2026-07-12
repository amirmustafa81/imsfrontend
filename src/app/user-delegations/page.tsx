"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DataTable,
  EmptyState,
  FieldLabel,
  FilterBar,
  PageHeader,
  SearchableSelect,
  StatusBadge,
  type SearchableSelectOption,
} from "@/components/ims";

type User = { id: number; name: string; email: string };
type Department = { id: number; code?: string; name: string };
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
  delegated_to?: User;
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

const delegationFieldInfo = {
  delegator: "User who is temporarily handing over authority, such as an HOD or responsible officer.",
  delegatedTo: "User who will act on behalf of the delegator during the approved period.",
  department: "Department where this temporary delegation applies.",
  authorityType: "Type of authority being delegated, for example inventory acknowledgement, issue approval, or verification sign-off.",
  amountLimit: "Maximum value covered by this delegation, if the written authorization defines a limit.",
  startDate: "First date on which the delegated authority becomes active.",
  endDate: "Last date on which the delegated authority remains valid.",
  reference: "Written approval/reference number that authorizes this delegation.",
  status: "Active delegations can be used; expired or cancelled records remain for audit history.",
  remarks: "Optional notes about scope, limits, or special conditions.",
};

const statusOptions: SearchableSelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const formStatusOptions: SearchableSelectOption[] = [
  { value: "", label: "Default active" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const [year, month, day] = value.split("T")[0]?.split("-") ?? [];
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatAmount = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value);
};

export default function UserDelegationsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const headers = useMemo(() => ({}), []);

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<Delegation[]>([]);
  const [filters, setFilters] = useState({ status: "", authority_type: "", delegatedTo: "" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const userOptions = useMemo<SearchableSelectOption[]>(
    () =>
      users.map((user) => ({
        value: String(user.id),
        label: `${user.name} (${user.email})`,
        keywords: user.email,
      })),
    [users],
  );

  const userFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [{ value: "", label: "All delegated users" }, ...userOptions],
    [userOptions],
  );

  const departmentOptions = useMemo<SearchableSelectOption[]>(
    () =>
      departments.map((department) => ({
        value: String(department.id),
        label: department.code ? `${department.code} - ${department.name}` : department.name,
        keywords: department.code,
      })),
    [departments],
  );

  const openCreateDialog = () => {
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyForm);
  };

  const setFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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
      setSaving(true);
      await api.post(
        "/user-delegations",
        {
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
        },
        headers,
      );
      setForm(emptyForm);
      setDialogOpen(false);
      setMessage("Delegation created.");
      setError("");
      await loadRows();
    } catch {
      setError("Unable to create delegation.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this user delegation record?")) return;

    try {
      await api.delete(`/user-delegations/${id}`, headers);
      await loadRows();
      setMessage("Delegation deleted.");
    } catch {
      setError("Unable to delete delegation.");
    }
  };

  const delegatedUserName = (row: Delegation) => row.delegatedTo?.name ?? row.delegated_to?.name ?? String(row.delegated_to_user_id);

  const columns = [
    {
      key: "delegator",
      header: "Delegator",
      render: (row: Delegation) => row.delegator?.name ?? String(row.delegator_user_id),
    },
    {
      key: "delegatedTo",
      header: "Delegated To",
      render: (row: Delegation) => delegatedUserName(row),
    },
    {
      key: "department",
      header: "Department",
      render: (row: Delegation) => row.department?.name ?? String(row.department_id),
    },
    { key: "authority_type", header: "Authority Type" },
    { key: "limit_amount", header: "Limit", render: (row: Delegation) => formatAmount(row.limit_amount) },
    { key: "start_date", header: "Start", render: (row: Delegation) => formatDate(row.start_date) },
    { key: "end_date", header: "End", render: (row: Delegation) => formatDate(row.end_date) },
    {
      key: "status",
      header: "Status",
      render: (row: Delegation) => <StatusBadge status={row.status} />,
    },
    { key: "authorization_ref", header: "Authorization Ref", render: (row: Delegation) => row.authorization_ref ?? "-" },
    {
      key: "action",
      header: "Action",
      className: "text-end",
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
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              Create Delegation
            </button>
          }
        />
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <FilterBar onReset={() => setFilters({ status: "", authority_type: "", delegatedTo: "" })}>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Status</label>
            <SearchableSelect
              id="delegation-filter-status"
              value={filters.status}
              options={statusOptions}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              placeholder="Search status"
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Authority Type</label>
            <input
              className="form-control"
              value={filters.authority_type}
              onChange={(event) => setFilters((current) => ({ ...current, authority_type: event.target.value }))}
              placeholder="e.g. issue approval"
            />
          </div>
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Delegated User</label>
            <SearchableSelect
              id="delegation-filter-user"
              value={filters.delegatedTo}
              options={userFilterOptions}
              onChange={(value) => setFilters((current) => ({ ...current, delegatedTo: value }))}
              placeholder="Search delegated user"
            />
          </div>
        </FilterBar>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Delegation list</h2>
          <span className="small text-secondary">{rows.length} records</span>
        </div>

        {rows.length === 0 ? <EmptyState title="No delegations" message="No user delegations configured." /> : <DataTable columns={columns} rows={rows} />}

        {dialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(54vw, 920px)", maxWidth: "min(54vw, 920px)" }}>
                <form className="modal-content border-0 shadow-lg" onSubmit={save}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">Create Delegation</h5>
                      <div className="small text-secondary">Record temporary authority delegation with dates, scope, and written authorization reference.</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeDialog} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <FieldLabel info={delegationFieldInfo.delegator}>Delegator</FieldLabel>
                        <SearchableSelect id="delegation-delegator" value={form.delegator_user_id} options={userOptions} onChange={(value) => setFormField("delegator_user_id", value)} placeholder="Search delegator" />
                      </div>
                      <div className="col-12 col-md-6">
                        <FieldLabel info={delegationFieldInfo.delegatedTo}>Delegated To</FieldLabel>
                        <SearchableSelect id="delegation-delegated-to" value={form.delegated_to_user_id} options={userOptions} onChange={(value) => setFormField("delegated_to_user_id", value)} placeholder="Search delegated user" />
                      </div>
                      <div className="col-12 col-md-6">
                        <FieldLabel info={delegationFieldInfo.department}>Department</FieldLabel>
                        <SearchableSelect id="delegation-department" value={form.department_id} options={departmentOptions} onChange={(value) => setFormField("department_id", value)} placeholder="Search department" />
                      </div>
                      <div className="col-12 col-md-6">
                        <FieldLabel info={delegationFieldInfo.authorityType}>Authority Type</FieldLabel>
                        <input className="form-control form-control-sm" value={form.authority_type} onChange={(event) => setFormField("authority_type", event.target.value)} placeholder="e.g. inventory_acknowledgement" />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={delegationFieldInfo.amountLimit}>Amount Limit</FieldLabel>
                        <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={form.limit_amount} onChange={(event) => setFormField("limit_amount", event.target.value)} placeholder="Optional" />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={delegationFieldInfo.startDate}>Start Date</FieldLabel>
                        <input className="form-control form-control-sm" type="date" value={form.start_date} onChange={(event) => setFormField("start_date", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={delegationFieldInfo.endDate}>End Date</FieldLabel>
                        <input className="form-control form-control-sm" type="date" value={form.end_date} onChange={(event) => setFormField("end_date", event.target.value)} min={form.start_date || undefined} />
                      </div>
                      <div className="col-12 col-md-8">
                        <FieldLabel info={delegationFieldInfo.reference}>Reference</FieldLabel>
                        <input className="form-control form-control-sm" value={form.authorization_ref} onChange={(event) => setFormField("authorization_ref", event.target.value)} placeholder="Written authorization/reference no." />
                      </div>
                      <div className="col-12 col-md-4">
                        <FieldLabel info={delegationFieldInfo.status}>Status</FieldLabel>
                        <SearchableSelect id="delegation-status" value={form.status} options={formStatusOptions} onChange={(value) => setFormField("status", value as FormState["status"])} placeholder="Search status" />
                      </div>
                      <div className="col-12">
                        <FieldLabel info={delegationFieldInfo.remarks}>Remarks</FieldLabel>
                        <textarea className="form-control form-control-sm" rows={3} value={form.remarks} onChange={(event) => setFormField("remarks", event.target.value)} placeholder="Optional scope notes or special conditions" />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeDialog}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving || !authReady}>
                      <i className="bi bi-plus-circle me-1" />
                      {saving ? "Saving..." : "Save Delegation"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div className="modal-backdrop fade show" onClick={closeDialog} />
          </>
        ) : null}
      </div>
    </main>
  );
}
