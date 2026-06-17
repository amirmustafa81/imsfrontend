"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey = "departments" | "buildings" | "rooms" | "items" | "funding-sources" | "research-projects";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type Verification = {
  id: number;
  verification_no: string;
  verification_type: string;
  start_date: string;
  end_date: string | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  department_id: number | null;
  building_id: number | null;
  room_id: number | null;
  project_id: number | null;
  custodian_user_id: number | null;
  funding_source_id: number | null;
  conducted_by: number | null;
  remarks: string | null;
  items_count?: number;
};

type VerificationItem = {
  id: number;
  verification_id: number;
  asset_id: number | null;
  item_id: number | null;
  expected_department_id: number | null;
  found_department_id: number | null;
  expected_room_id: number | null;
  found_room_id: number | null;
  expected_custodian_user_id: number | null;
  found_custodian_user_id: number | null;
  expected_quantity: number | null;
  found_quantity: number | null;
  verification_status:
    | "found"
    | "missing"
    | "damaged"
    | "obsolete"
    | "expired"
    | "in_repair"
    | "excess"
    | "location_mismatch";
  condition_remarks: string | null;
  verified_by: number | null;
  verified_at: string | null;
};

type VerificationItemInput = {
  asset_id: string;
  item_id: string;
  expected_department_id: string;
  found_department_id: string;
  expected_room_id: string;
  found_room_id: string;
  expected_custodian_user_id: string;
  found_custodian_user_id: string;
  expected_quantity: string;
  found_quantity: string;
  verification_status:
    | "found"
    | "missing"
    | "damaged"
    | "obsolete"
    | "expired"
    | "in_repair"
    | "excess"
    | "location_mismatch"
    | "";
  condition_remarks: string;
  verified_by: string;
  verified_at: string;
};

type VerificationForm = {
  verification_no: string;
  verification_type: string;
  department_id: string;
  building_id: string;
  room_id: string;
  project_id: string;
  custodian_user_id: string;
  funding_source_id: string;
  start_date: string;
  end_date: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  conducted_by: string;
  remarks: string;
};

const verificationTypes = [
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "laboratory", label: "Laboratory" },
  { value: "project", label: "Project" },
  { value: "custodian", label: "Custodian" },
  { value: "funding_source", label: "Funding Source" },
  { value: "university_wide", label: "University Wide" },
];

const verificationStatuses = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const itemStatuses = [
  "found",
  "missing",
  "damaged",
  "obsolete",
  "expired",
  "in_repair",
  "excess",
  "location_mismatch",
];

const toPayloadDate = (value: string): string | null => (value.trim() ? value : null);

const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultForm: VerificationForm = {
  verification_no: "",
  verification_type: "department",
  department_id: "",
  building_id: "",
  room_id: "",
  project_id: "",
  custodian_user_id: "",
  funding_source_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  status: "planned",
  conducted_by: "",
  remarks: "",
};

const emptyItem: VerificationItemInput = {
  asset_id: "",
  item_id: "",
  expected_department_id: "",
  found_department_id: "",
  expected_room_id: "",
  found_room_id: "",
  expected_custodian_user_id: "",
  found_custodian_user_id: "",
  expected_quantity: "",
  found_quantity: "",
  verification_status: "",
  condition_remarks: "",
  verified_by: "",
  verified_at: "",
};

export default function VerificationPage() {
  const [token] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [rows, setRows] = useState<Verification[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({
    departments: [],
    buildings: [],
    rooms: [],
    items: [],
    "funding-sources": [],
    "research-projects": [],
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [form, setForm] = useState<VerificationForm>(defaultForm);
  const [items, setItems] = useState<VerificationItemInput[]>([emptyItem]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, VerificationItem[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const lookupLabel = (source: LookupKey, value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    const options = lookups[source] ?? [];
    const row = options.find((candidate) => String(candidate.id) === String(value));
    if (!row) return String(value);

    return `${row.code ?? row.project_code ?? row.id} - ${row.name ?? row.title ?? row.title_code ?? ""}`;
  };

  const loadRows = useCallback(async () => {
    if (!token) return;

    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (typeFilter) params.verification_type = typeFilter;
    if (statusFilter) params.status = statusFilter;
    if (departmentFilter) params.department_id = departmentFilter;
    if (projectFilter) params.project_id = projectFilter;

    try {
      const response = await api.get("/physical-verifications", {
        ...authHeaders,
        params,
      });
      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load verification records.");
    }
  }, [authHeaders, search, typeFilter, statusFilter, departmentFilter, projectFilter, token]);

  useEffect(() => {
    (async () => {
      await loadRows();
    })();
  }, [loadRows]);

  useEffect(() => {
    if (!token) return;

    const requiredLookups: LookupKey[] = [
      "departments",
      "buildings",
      "rooms",
      "items",
      "funding-sources",
      "research-projects",
    ];

    const loadLookups = async () => {
      const next = requiredLookups.reduce<Record<LookupKey, RowData[]>>(
        (acc, key) => {
          acc[key] = [];
          return acc;
        },
        {
          departments: [],
          buildings: [],
          rooms: [],
          items: [],
          "funding-sources": [],
          "research-projects": [],
        },
      );

      await Promise.all(
        requiredLookups.map(async (key) => {
          const response = await api.get(`/master-data/${key}`, { ...authHeaders });
          const data = response.data?.data;
          if (Array.isArray(data)) {
            next[key] = data;
          }
        }),
      );

      setLookups(next);
    };

    void loadLookups();
  }, [authHeaders, token]);

  const setFormValue = (key: keyof VerificationForm, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setItemValue = (index: number, key: keyof VerificationItemInput, value: string) => {
    setItems((current) =>
      current.map((row, idx) => {
        if (idx !== index) return row;
        return { ...row, [key]: value };
      }),
    );
  };

  const addItemRow = () => {
    setItems((current) => [...current, { ...emptyItem }]);
  };

  const removeItemRow = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setItems([emptyItem]);
  };

  const saveVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Authentication token required.");
      return;
    }

    const rowsToPost = items
      .map((row): VerificationItemInput | null => {
        if (!row.verification_status) return null;
        if (!row.asset_id && !row.item_id) return null;
        return row;
      })
      .filter((row): row is VerificationItemInput => row !== null);

    if (!rowsToPost.length) {
      setError("At least one valid item row is required.");
      return;
    }

    const payload = {
      verification_no: form.verification_no.trim(),
      verification_type: form.verification_type,
      department_id: numberOrNull(form.department_id),
      building_id: numberOrNull(form.building_id),
      room_id: numberOrNull(form.room_id),
      project_id: numberOrNull(form.project_id),
      custodian_user_id: numberOrNull(form.custodian_user_id),
      funding_source_id: numberOrNull(form.funding_source_id),
      start_date: form.start_date,
      end_date: toPayloadDate(form.end_date),
      status: form.status,
      conducted_by: numberOrNull(form.conducted_by),
      remarks: form.remarks.trim() || null,
      items: rowsToPost.map((row) => ({
        asset_id: numberOrNull(row.asset_id),
        item_id: numberOrNull(row.item_id),
        expected_department_id: numberOrNull(row.expected_department_id),
        found_department_id: numberOrNull(row.found_department_id),
        expected_room_id: numberOrNull(row.expected_room_id),
        found_room_id: numberOrNull(row.found_room_id),
        expected_custodian_user_id: numberOrNull(row.expected_custodian_user_id),
        found_custodian_user_id: numberOrNull(row.found_custodian_user_id),
        expected_quantity: numberOrNull(row.expected_quantity),
        found_quantity: numberOrNull(row.found_quantity),
        verification_status: row.verification_status,
        condition_remarks: row.condition_remarks.trim() || null,
        verified_by: numberOrNull(row.verified_by),
        verified_at: toPayloadDate(row.verified_at),
      })),
    };

    try {
      const response = await api.post("/physical-verifications", payload, authHeaders);
      if (response.data?.data?.id) {
        setMessage(`Verification ${response.data.data.verification_no} created.`);
      } else {
        setMessage("Verification saved.");
      }
      resetForm();
      await loadRows();
    } catch {
      setError("Unable to save verification. Check required fields.");
    }
  };

  const loadItems = async (verificationId: number) => {
    if (expandedItems[verificationId]) return;

    setExpandedLoading((prev) => ({ ...prev, [verificationId]: true }));
    try {
      const response = await api.get(`/physical-verifications/${verificationId}`, {
        ...authHeaders,
      });
      const itemRows = response.data?.items;
      setExpandedItems((prev) => ({
        ...prev,
        [verificationId]: Array.isArray(itemRows) ? itemRows : [],
      }));
      setError("");
    } catch {
      setExpandedItems((prev) => ({ ...prev, [verificationId]: [] }));
      setError("Could not load verification items.");
    } finally {
      setExpandedLoading((prev) => ({ ...prev, [verificationId]: false }));
    }
  };

  const toggleExpand = async (verificationId: number) => {
    if (expandedId === verificationId) {
      setExpandedId(null);
      return;
    }
    await loadItems(verificationId);
    setExpandedId(verificationId);
  };

  const deleteVerification = async (id: number) => {
    try {
      await api.delete(`/physical-verifications/${id}`, authHeaders);
      setMessage("Verification deleted.");
      setError("");
      await loadRows();
      if (expandedId === id) {
        setExpandedId(null);
      }
    } catch {
      setError("Delete failed. Completed verifications cannot be deleted.");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setDepartmentFilter("");
    setProjectFilter("");
  };

  const verificationColumns = [
    {
      key: "verification",
      header: "Verification",
      render: (row: Verification) => (
        <>
          <button className="btn btn-link p-0" type="button" onClick={() => toggleExpand(row.id)}>
            <i className="bi bi-list me-2" />
            {row.verification_no}
          </button>
          <div className="small text-secondary">{row.remarks ?? "-"}</div>
        </>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (row: Verification) => (
        <div className="small">
          {row.start_date}
          {row.end_date ? ` to ${row.end_date}` : ""}
        </div>
      ),
    },
    { key: "type", header: "Type", render: (row: Verification) => row.verification_type },
    {
      key: "scope",
      header: "Location Scope",
      render: (row: Verification) => (
        <div className="small">
          Dept: {lookupLabel("departments", row.department_id)}
          <br />
          Project: {lookupLabel("research-projects", row.project_id)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: Verification) => <StatusBadge status={row.status} />,
    },
    { key: "items", header: "Items", render: (row: Verification) => row.items_count ?? 0 },
    {
      key: "actions",
      header: "Actions",
      className: "text-end",
      render: (row: Verification) => (
        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleExpand(row.id)} title="View items">
            <i className="bi bi-eye" />
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteVerification(row.id)} title="Delete">
            <i className="bi bi-trash" />
          </button>
        </div>
      ),
    },
  ];

  const expandedItemColumns = [
    { key: "asset", header: "Item / Asset", render: (item: VerificationItem) => (item.asset_id ? `Asset ${item.asset_id}` : `Item ${item.item_id ?? "-"}`) },
    {
      key: "expectedScope",
      header: "Expected Scope",
      render: (item: VerificationItem) => (
        <>
          {lookupLabel("departments", item.expected_department_id)} / {lookupLabel("rooms", item.expected_room_id)}
        </>
      ),
    },
    {
      key: "foundScope",
      header: "Found Scope",
      render: (item: VerificationItem) => (
        <>
          {lookupLabel("departments", item.found_department_id)} / {lookupLabel("rooms", item.found_room_id)}
        </>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      render: (item: VerificationItem) => (
        <>
          {item.expected_quantity ?? "-"} / {item.found_quantity ?? "-"}
        </>
      ),
    },
    { key: "status", header: "Status", render: (item: VerificationItem) => <StatusBadge status={item.verification_status} /> },
    { key: "remarks", header: "Remarks", render: (item: VerificationItem) => item.condition_remarks ?? "-" },
  ];

  const selectedVerification = expandedId === null ? null : rows.find((verification) => verification.id === expandedId) ?? null;

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Physical Verification"
          subtitle="Create verification rounds and record item/asset discrepancies for audit trail."
          
        />

        {(message || error) && (
          <div className="mb-4">
            {message && <div className="alert alert-success py-2">{message}</div>}
            {error && <div className="alert alert-danger py-2">{error}</div>}
          </div>
        )}

        <div className="row g-4">
          <section className="col-12 col-xxl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">New Verification</div>
              <div className="card-body">
                <form onSubmit={saveVerification}>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Verification no</label>
                      <input
                        className="form-control"
                        value={form.verification_no}
                        required
                        onChange={(e) => setFormValue("verification_no", e.target.value)}
                        placeholder="VER-2026-0001"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Type</label>
                      <select
                        className="form-select"
                        value={form.verification_type}
                        onChange={(e) => setFormValue("verification_type", e.target.value)}
                      >
                        {verificationTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={form.status}
                        onChange={(e) => setFormValue("status", e.target.value)}
                      >
                        {verificationStatuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">Department</label>
                      <select
                        className="form-select"
                        value={form.department_id}
                        onChange={(e) => setFormValue("department_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups.departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.code} - {department.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">Building</label>
                      <select
                        className="form-select"
                        value={form.building_id}
                        onChange={(e) => setFormValue("building_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups.buildings.map((building) => (
                          <option key={building.id} value={building.id}>
                            {building.code} - {building.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">Room</label>
                      <select
                        className="form-select"
                        value={form.room_id}
                        onChange={(e) => setFormValue("room_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups.rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.code} - {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">Project</label>
                      <select
                        className="form-select"
                        value={form.project_id}
                        onChange={(e) => setFormValue("project_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups["research-projects"].map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.project_code} - {project.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Funding source</label>
                      <select
                        className="form-select"
                        value={form.funding_source_id}
                        onChange={(e) => setFormValue("funding_source_id", e.target.value)}
                      >
                        <option value="">Optional</option>
                        {lookups["funding-sources"].map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.code} - {source.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">Start date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.start_date}
                        onChange={(e) => setFormValue("start_date", e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">End date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.end_date}
                        onChange={(e) => setFormValue("end_date", e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Custodian user id</label>
                      <input
                        type="number"
                        className="form-control"
                        value={form.custodian_user_id}
                        onChange={(e) => setFormValue("custodian_user_id", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Conducted by user id</label>
                      <input
                        type="number"
                        className="form-control"
                        value={form.conducted_by}
                        onChange={(e) => setFormValue("conducted_by", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Remarks</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={form.remarks}
                        onChange={(e) => setFormValue("remarks", e.target.value)}
                        placeholder="Inspection notes"
                      />
                    </div>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="h5 mb-0">Verification Items</h2>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={addItemRow}>
                      <i className="bi bi-plus-lg me-1" />
                      Add row
                    </button>
                  </div>

                  {items.map((item, index) => (
                    <div className="row g-2 align-items-end mb-3" key={`${index}-${item.item_id || item.asset_id || "new"}`}>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Asset ID</label>
                        <input
                          className="form-control"
                          value={item.asset_id}
                          onChange={(e) => setItemValue(index, "asset_id", e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Item</label>
                        <select
                          className="form-select"
                          value={item.item_id}
                          onChange={(e) => setItemValue(index, "item_id", e.target.value)}
                        >
                          <option value="">Select item</option>
                          {lookups.items.map((lookupItem) => (
                            <option key={lookupItem.id} value={lookupItem.id}>
                              {lookupItem.item_code} - {lookupItem.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Status</label>
                        <select
                          className="form-select"
                          value={item.verification_status}
                          onChange={(e) => setItemValue(index, "verification_status", e.target.value as VerificationItemInput["verification_status"])}
                          required
                        >
                          <option value="">Select</option>
                          {itemStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-xl-1">
                        <label className="form-label mb-1 small">Expected Qty</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="form-control"
                          value={item.expected_quantity}
                          onChange={(e) => setItemValue(index, "expected_quantity", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-12 col-xl-1">
                        <label className="form-label mb-1 small">Found Qty</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="form-control"
                          value={item.found_quantity}
                          onChange={(e) => setItemValue(index, "found_quantity", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Expected dept</label>
                        <select
                          className="form-select"
                          value={item.expected_department_id}
                          onChange={(e) => setItemValue(index, "expected_department_id", e.target.value)}
                        >
                          <option value="">Optional</option>
                          {lookups.departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.code} - {department.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Found dept</label>
                        <select
                          className="form-select"
                          value={item.found_department_id}
                          onChange={(e) => setItemValue(index, "found_department_id", e.target.value)}
                        >
                          <option value="">Optional</option>
                          {lookups.departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.code} - {department.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-xl-1">
                        <button
                          type="button"
                          className="btn btn-outline-danger w-100"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length === 1}
                          aria-label="Remove row"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                      <div className="col-12">
                        <label className="form-label mb-1 small">Condition / remarks</label>
                        <textarea
                          className="form-control"
                          rows={1}
                          value={item.condition_remarks}
                          onChange={(e) => setItemValue(index, "condition_remarks", e.target.value)}
                          placeholder="Damage/mismatch notes"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="d-flex justify-content-end">
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-save me-2" />
                      Save Verification
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>

          <section className="col-12 col-xxl-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Verification List</div>
              <div className="card-body">
                <FilterBar onReset={clearFilters}>
                  <div className="col-12 col-md-4">
                    <label className="form-label small mb-1">Search</label>
                    <input
                      className="form-control form-control-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Verification no / remarks"
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Type</label>
                    <select className="form-select form-select-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="">All types</option>
                      {verificationTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Status</label>
                    <select className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {verificationStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Department</label>
                    <select className="form-select form-select-sm" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                      <option value="">All departments</option>
                      {lookups.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code} - {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Project</label>
                    <select className="form-select form-select-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                      <option value="">All projects</option>
                      {lookups["research-projects"].map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_code} - {project.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </FilterBar>

                {rows.length === 0 ? (
                  <EmptyState title="No verification records" message="No verification records match the current filters." icon="bi-clipboard-check" />
                ) : (
                  <DataTable columns={verificationColumns} rows={rows} />
                )}

                {selectedVerification ? (
                  <div className="mt-3">
                    <h3 className="h6">Verification details for #{selectedVerification.verification_no}</h3>
                    {expandedLoading[selectedVerification.id] ? (
                      <div className="text-secondary">Loading details...</div>
                    ) : (
                      <DataTable
                        columns={expandedItemColumns}
                        rows={expandedItems[selectedVerification.id] ?? []}
                        empty="No detail rows returned by backend."
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
