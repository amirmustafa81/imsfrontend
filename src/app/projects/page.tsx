"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";
import { AssetCreateDialog } from "@/components/ims/AssetCreateDialog";

type Lookup = {
  id: number;
  name?: string;
  title?: string;
  project_code?: string;
};

type ProjectAssetRow = {
  id: number;
  asset_id: string;
  serial_number: string;
  item_name: string;
  category_name: string;
  department_name: string;
  store_name: string;
  project_code: string;
  project_title: string;
  status: string;
  condition_status: string;
  is_sensitive_controlled: boolean;
  custodian_name: string;
};

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "in_use", label: "In Use" },
  { value: "disposed", label: "Disposed" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
];

const unwrapRows = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }

  return [];
};

export default function ProjectsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const authHeaders = useMemo(() => ({}), []);

  const [projects, setProjects] = useState<Lookup[]>([]);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
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

  const loadLookups = useCallback(async () => {
    if (!authReady) {
      return;
    }

    try {
      const response = await api.get("/master-data/research-projects", authHeaders);
      setProjects(unwrapRows<Lookup>(response.data));
    } catch {
      setError("Unable to load projects. Verify token and backend connectivity.");
    }
  }, [authHeaders, authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.get<{ data: ProjectAssetRow[] }>("/reports/fixed-assets", {
        ...authHeaders,
        params: {
          ...(projectId ? { project_id: projectId } : {}),
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
  }, [authHeaders, projectId, search, status, authReady]);

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
    setStatus("");
  };

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
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
          subtitle="Project-linked assets and consumables grouped by project context."
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

        <FilterBar onReset={reset}>
          <div className="col-12 col-lg-4">
            <label className="form-label small mb-1">Search</label>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Asset id, item, project"
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Project</label>
            <select
              className="form-select form-select-sm"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name ?? project.title ?? project.project_code ?? project.id}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label small mb-1">Status</label>
            <select className="form-select form-select-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 fw-semibold mb-0">Research project asset register</h2>
          {loading ? <span className="small text-secondary">Loading…</span> : null}
        </div>

        <DataTable
          columns={[
            { key: "asset_id", header: "Asset ID" },
            { key: "project_code", header: "Project" },
            { key: "item_name", header: "Item" },
            { key: "category_name", header: "Category" },
            { key: "department_name", header: "Department" },
            { key: "store_name", header: "Store" },
            { key: "serial_number", header: "Serial No" },
            { key: "custodian_name", header: "Custodian" },
            { key: "status", header: "Status", render: (row: ProjectAssetRow) => <StatusBadge status={row.status} /> },
            { key: "condition_status", header: "Condition" },
            {
              key: "is_sensitive_controlled",
              header: "Sensitive",
              className: "text-center",
              render: (row: ProjectAssetRow) => (row.is_sensitive_controlled ? <i className="bi bi-shield-check text-warning" /> : <span className="text-secondary">—</span>),
            },
          ]}
          rows={rows}
          empty="No project-linked assets found."
        />

        {!authReady ? <div className="alert alert-info mt-3 mb-0">Authentication token required to load live data.</div> : null}

        <AssetCreateDialog
          open={assetDialogOpen}
          title="Register Project Asset"
          subtitle="Create a fixed asset record and link it with a research project."
          defaults={{ project_id: projectId, status: "in_store" }}
          onClose={() => setAssetDialogOpen(false)}
          onCreated={loadRows}
        />

        {projectDialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(50vw, 860px)", maxWidth: "min(50vw, 860px)" }}>
                <form className="modal-content border-0 shadow-lg" onSubmit={createProject}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h5 className="modal-title mb-1">Create Project</h5>
                      <div className="text-secondary small">Add the research project before linking inventory or assets.</div>
                    </div>
                    <button className="btn-close" type="button" aria-label="Close" onClick={() => setProjectDialogOpen(false)} />
                  </div>
                  <div className="modal-body px-4 py-4">
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Project Code *</label>
                        <input className="form-control form-control-sm" value={projectForm.project_code} onChange={(event) => setProjectForm((current) => ({ ...current, project_code: event.target.value }))} placeholder="e.g. HEC-2026-01" required />
                      </div>
                      <div className="col-12 col-md-8">
                        <label className="form-label small">Project Title *</label>
                        <input className="form-control form-control-sm" value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} placeholder="Research project title" required />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Category *</label>
                        <select className="form-select form-select-sm" value={projectForm.project_category} onChange={(event) => setProjectForm((current) => ({ ...current, project_category: event.target.value }))} required>
                          <option value="hec_nrpu">HEC NRPU</option>
                          <option value="psf">PSF</option>
                          <option value="internal_grant">Internal Grant</option>
                          <option value="donor_project">Donor Project</option>
                          <option value="industry_project">Industry Project</option>
                          <option value="international_collaboration">International Collaboration</option>
                          <option value="student_fyp">Student FYP</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Sponsor</label>
                        <input className="form-control form-control-sm" value={projectForm.sponsor} onChange={(event) => setProjectForm((current) => ({ ...current, sponsor: event.target.value }))} placeholder="Sponsor / donor" />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Cost Center</label>
                        <input className="form-control form-control-sm" value={projectForm.cost_center_code} onChange={(event) => setProjectForm((current) => ({ ...current, cost_center_code: event.target.value }))} placeholder="Cost center code" />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Status</label>
                        <select className="form-select form-select-sm" value={projectForm.status} onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value }))}>
                          <option value="active">Active</option>
                          <option value="closed">Closed</option>
                          <option value="suspended">Suspended</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setProjectDialogOpen(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={savingProject}>
                      <i className="bi bi-plus-circle me-1" />
                      {savingProject ? "Saving..." : "Create Project"}
                    </button>
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
