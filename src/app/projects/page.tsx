"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AssetCreateDialog } from "@/components/ims/AssetCreateDialog";
import { DataTable, FilterBar, KpiCard, PageHeader, StatusBadge } from "@/components/ims";

type Lookup = {
  id: number;
  name?: string | null;
  title?: string | null;
  project_code?: string | null;
  code?: string | null;
};

type ProjectAssetRow = {
  id: number;
  asset_id: string | null;
  printable_tag_id: string | null;
  serial_number: string | null;
  item_code: string | null;
  item_name: string | null;
  category_name: string | null;
  subcategory_code: string | null;
  department_id: number | null;
  department_name: string | null;
  store_id: number | null;
  store_name: string | null;
  building_name: string | null;
  room_name: string | null;
  project_id: number | null;
  project_code: string | null;
  project_title: string | null;
  model: string | null;
  status: string;
  condition_status: string | null;
  is_sensitive_controlled: boolean;
  custodian_name: string | null;
};

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "in_store", label: "In Store" },
  { value: "issued", label: "Issued" },
  { value: "in_use", label: "In Use" },
  { value: "under_repair", label: "Under Repair" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "disposed", label: "Disposed" },
];

const conditionOptions = [
  { value: "", label: "All Conditions" },
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "needs_repair", label: "Needs Repair" },
  { value: "damaged", label: "Damaged" },
  { value: "obsolete", label: "Obsolete" },
];

const unwrapRows = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

const formatLookup = (row: Lookup) => {
  const code = row.project_code ?? row.code;
  const label = row.title ?? row.name ?? row.id;
  return code ? `${code} - ${label}` : String(label);
};

const formatLocation = (row: ProjectAssetRow) => {
  const location = [row.building_name, row.room_name].filter(Boolean).join(" / ");
  return location || "-";
};

const buildTagUrl = (row: ProjectAssetRow) => {
  const generatedTag = row.printable_tag_id || `${row.asset_id || `FA-${row.id}`}-TAG`;
  return `/tag-print-log?asset_id=${row.id}&asset_code=${encodeURIComponent(row.asset_id ?? "")}&suggested_tag=${encodeURIComponent(generatedTag)}`;
};

export default function ProjectsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);

  const [projects, setProjects] = useState<Lookup[]>([]);
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [stores, setStores] = useState<Lookup[]>([]);
  const [projectId, setProjectId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");
  const [conditionStatus, setConditionStatus] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ProjectAssetRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    project_code: "",
    title: "",
    sponsor: "",
    project_category: "internal_grant",
    cost_center_code: "",
    status: "active",
  });

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!row.project_id && !row.project_code && !row.project_title) return false;
        if (conditionStatus && row.condition_status !== conditionStatus) return false;
        return true;
      }),
    [conditionStatus, rows],
  );

  const kpis = useMemo(() => {
    const inUse = filteredRows.filter((row) => row.status === "in_use" || row.status === "issued").length;
    const missing = filteredRows.filter((row) => row.status === "missing_under_investigation").length;
    const damaged = filteredRows.filter((row) => row.status === "damaged" || row.status === "under_repair").length;
    const sensitive = filteredRows.filter((row) => row.is_sensitive_controlled).length;

    return { total: filteredRows.length, inUse, missing, damaged, sensitive };
  }, [filteredRows]);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    try {
      const [projectResponse, departmentResponse, storeResponse] = await Promise.all([
        api.get("/master-data/research-projects", authHeaders),
        api.get("/master-data/departments", authHeaders),
        api.get("/master-data/stores", authHeaders),
      ]);
      setProjects(unwrapRows<Lookup>(projectResponse.data));
      setDepartments(unwrapRows<Lookup>(departmentResponse.data));
      setStores(unwrapRows<Lookup>(storeResponse.data));
    } catch {
      setError("Unable to load project inventory lookups. Verify token and backend connectivity.");
    }
  }, [authHeaders, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) return;

    setError("");
    setLoading(true);

    try {
      const response = await api.get<{ data: ProjectAssetRow[] }>("/reports/fixed-assets", {
        ...authHeaders,
        params: {
          ...(projectId ? { project_id: projectId } : {}),
          ...(departmentId ? { department_id: departmentId } : {}),
          ...(storeId ? { store_id: storeId } : {}),
          ...(status ? { status } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });

      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load project inventory. Verify token and query filters.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, authReady, departmentId, projectId, search, status, storeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const reset = () => {
    setSearch("");
    setProjectId("");
    setDepartmentId("");
    setStoreId("");
    setStatus("");
    setConditionStatus("");
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Please sign in before creating project records.");
      return;
    }

    setSavingProject(true);
    setError("");

    try {
      await api.post("/master-data/research-projects", {
        project_code: projectForm.project_code.trim(),
        title: projectForm.title.trim(),
        sponsor: projectForm.sponsor.trim() || null,
        project_category: projectForm.project_category,
        cost_center_code: projectForm.cost_center_code.trim() || null,
        status: projectForm.status,
      });

      setProjectDialogOpen(false);
      setProjectForm({
        project_code: "",
        title: "",
        sponsor: "",
        project_category: "internal_grant",
        cost_center_code: "",
        status: "active",
      });
      await loadLookups();
      await loadRows();
    } catch {
      setError("Unable to create research project. Verify required fields, duplicate code, and backend connectivity.");
    } finally {
      setSavingProject(false);
    }
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Research Project Inventory"
          subtitle="Project-linked assets and controlled inventory grouped by project, department, location, and custodian."
          actions={
            <>
              <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setProjectDialogOpen(true)}>
                <i className="bi bi-folder-plus me-1" />
                Create Project
              </button>
              <button className="btn btn-sm btn-primary" type="button" onClick={() => setAssetDialogOpen(true)}>
                <i className="bi bi-plus-lg me-1" />
                Register Project Asset
              </button>
            </>
          }
        />

        <div className="row g-3 mb-3">
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-folder2-open" label="Project Assets" value={kpis.total} tone="primary" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-person-check" label="In Use / Issued" value={kpis.inUse} tone="success" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-search" label="Missing" value={kpis.missing} tone="danger" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-tools" label="Damaged / Repair" value={kpis.damaged} tone="warning" />
          </div>
          <div className="col-12 col-sm-6 col-xl">
            <KpiCard icon="bi-shield-check" label="Sensitive" value={kpis.sensitive} tone="info" />
          </div>
        </div>

        <FilterBar onReset={reset}>
          <div className="col-12 col-md-4 col-xl-3">
            <label className="form-label small mb-1">Search</label>
            <input className="form-control form-control-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asset, item, project, serial, custodian" />
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Project</label>
            <select className="form-select form-select-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {formatLookup(project)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Department</label>
            <select className="form-select form-select-sm" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {formatLookup(department)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((statusOption) => (
                <option key={statusOption.value || "all"} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Condition</label>
            <select className="form-select form-select-sm" value={conditionStatus} onChange={(event) => setConditionStatus(event.target.value)}>
              {conditionOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4 col-xl-2">
            <label className="form-label small mb-1">Store</label>
            <select className="form-select form-select-sm" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
              <option value="">All Stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {formatLookup(store)}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Research project asset register</h2>
          {loading ? <span className="small text-secondary">Loading...</span> : null}
        </div>

        <DataTable
          columns={[
            { key: "asset_id", header: "Asset ID", render: (row: ProjectAssetRow) => <Link className="link-primary text-decoration-none fw-medium" href={`/assets/${row.id}`}>{row.asset_id ?? "-"}</Link> },
            { key: "project", header: "Project", render: (row: ProjectAssetRow) => <>{row.project_code || row.project_title || "-"}</> },
            { key: "item", header: "Item", render: (row: ProjectAssetRow) => <><div>{row.item_name ?? "-"}</div><small className="text-secondary">{row.item_code ?? row.category_name ?? "-"}</small></> },
            { key: "subcategory", header: "Subcategory", render: (row: ProjectAssetRow) => <>{row.subcategory_code ?? "-"}</> },
            { key: "department_name", header: "Department", render: (row: ProjectAssetRow) => <>{row.department_name ?? "-"}</> },
            { key: "location", header: "Location", render: (row: ProjectAssetRow) => <>{formatLocation(row)}</> },
            { key: "store_name", header: "Store", render: (row: ProjectAssetRow) => <>{row.store_name ?? "-"}</> },
            { key: "serial_number", header: "Serial", render: (row: ProjectAssetRow) => <>{row.serial_number ?? "-"}</> },
            { key: "custodian_name", header: "Custodian", render: (row: ProjectAssetRow) => <>{row.custodian_name ?? "-"}</> },
            { key: "printable_tag_id", header: "Printable Tag", render: (row: ProjectAssetRow) => <>{row.printable_tag_id ?? "-"}</> },
            { key: "condition_status", header: "Condition", render: (row: ProjectAssetRow) => <>{row.condition_status ?? "-"}</> },
            { key: "status", header: "Status", render: (row: ProjectAssetRow) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              header: "Actions",
              render: (row: ProjectAssetRow) => (
                <div className="d-flex flex-wrap gap-1">
                  <Link className="btn btn-sm btn-outline-secondary" href={`/assets/${row.id}`}><i className="bi bi-eye me-1" />View</Link>
                  <Link className="btn btn-sm btn-outline-primary" href={buildTagUrl(row)}><i className="bi bi-qr-code me-1" />Print Tag</Link>
                  <Link className="btn btn-sm btn-outline-secondary" href={`/assets/${row.id}/movements`}><i className="bi bi-arrow-left-right me-1" />Movements</Link>
                </div>
              ),
            },
          ]}
          rows={filteredRows}
          empty={loading ? "Loading project inventory..." : "No project-linked assets found."}
        />

        {!authReady ? <div className="alert alert-info mt-3 mb-0">Authentication token required to load live data.</div> : null}

        <AssetCreateDialog
          open={assetDialogOpen}
          title="Register Project Asset"
          subtitle="Create a project-linked asset record with project, funding, location, and custodian details."
          defaults={{ status: "in_store", project_id: projectId }}
          onClose={() => setAssetDialogOpen(false)}
          onCreated={loadRows}
        />

        {projectDialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-dialog-centered" style={{ width: "min(44vw, 760px)", maxWidth: "min(44vw, 760px)" }}>
                <form className="modal-content border-0 shadow-lg" onSubmit={createProject}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">Create Research Project</h5>
                      <div className="small text-secondary">Add a project/cost-center record for project inventory tracking.</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={() => setProjectDialogOpen(false)} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Project Code</label>
                        <input className="form-control form-control-sm" value={projectForm.project_code} onChange={(event) => setProjectForm((current) => ({ ...current, project_code: event.target.value }))} required placeholder="e.g. PRJ-ORIC-001" />
                      </div>
                      <div className="col-12 col-md-8">
                        <label className="form-label small">Project Title</label>
                        <input className="form-control form-control-sm" value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} required placeholder="Project title" />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Sponsor</label>
                        <input className="form-control form-control-sm" value={projectForm.sponsor} onChange={(event) => setProjectForm((current) => ({ ...current, sponsor: event.target.value }))} placeholder="HEC / internal / donor" />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Cost Center Code</label>
                        <input className="form-control form-control-sm" value={projectForm.cost_center_code} onChange={(event) => setProjectForm((current) => ({ ...current, cost_center_code: event.target.value }))} placeholder="Optional finance code" />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Category</label>
                        <select className="form-select form-select-sm" value={projectForm.project_category} onChange={(event) => setProjectForm((current) => ({ ...current, project_category: event.target.value }))}>
                          <option value="internal_grant">Internal Grant</option>
                          <option value="external_grant">External Grant</option>
                          <option value="consultancy">Consultancy</option>
                          <option value="donor_funded">Donor Funded</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Status</label>
                        <select className="form-select form-select-sm" value={projectForm.status} onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value }))}>
                          <option value="active">Active</option>
                          <option value="closed">Closed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setProjectDialogOpen(false)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={savingProject}><i className="bi bi-plus-circle me-1" />{savingProject ? "Saving..." : "Create Project"}</button>
                  </div>
                </form>
              </div>
            </div>
            <div className="modal-backdrop fade show" onClick={() => setProjectDialogOpen(false)} />
          </>
        ) : null}
      </div>
    </main>
  );
}
