"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, FilterBar, PageHeader, SearchableSelect, type SearchableSelectOption } from "@/components/ims";

type DocRow = {
  id: number;
  document_type: string;
  entity_type: string;
  entity_id: number;
  original_file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
};

type Filters = { entity_type: string; document_type: string; entity_id: string };
type UploadForm = { entity_type: string; entity_id: string; document_type: string; file: File | null };
type DocumentEntityType = { id: number; code: string; name: string; description?: string | null; status: string };

const emptyForm: UploadForm = { entity_type: "asset", entity_id: "", document_type: "", file: null };

export default function DocumentsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;
  const headers = useMemo(() => ({}), []);

  const [rows, setRows] = useState<DocRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<DocumentEntityType[]>([]);
  const [form, setForm] = useState<UploadForm>(emptyForm);
  const [filters, setFilters] = useState<Filters>({ entity_type: "", document_type: "", entity_id: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async () => {
    if (!authReady) return;
    const params: Record<string, string> = {};
    if (filters.entity_type.trim()) params.entity_type = filters.entity_type.trim();
    if (filters.document_type.trim()) params.document_type = filters.document_type.trim();
    if (filters.entity_id.trim()) params.entity_id = filters.entity_id.trim();

    try {
      const response = await api.get<{ data: DocRow[] }>("/documents", { ...headers, params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load documents.");
    }
  }, [headers, authReady, filters.entity_type, filters.document_type, filters.entity_id]);

  const loadEntityTypes = useCallback(async () => {
    if (!authReady) return;

    try {
      const response = await api.get<{ data: DocumentEntityType[] }>("/master-data/document-entity-types", {
        ...headers,
        params: { status: "active" },
      });
      const data = response.data?.data ?? [];
      setEntityTypes(data);
      setForm((current) => {
        if (current.entity_type && data.some((type) => type.code === current.entity_type)) {
          return current;
        }

        return { ...current, entity_type: data[0]?.code ?? "" };
      });
    } catch {
      setEntityTypes([]);
      setError("Unable to load document entity types.");
    }
  }, [authReady, headers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntityTypes();
  }, [loadEntityTypes]);

  const entityTypeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      entityTypes.map((type) => ({
        value: type.code,
        label: `${type.name} (${type.code})`,
        keywords: `${type.code} ${type.description ?? ""}`,
      })),
    [entityTypes],
  );

  const entityTypeLabel = useCallback(
    (code: string) => entityTypes.find((type) => type.code === code)?.name ?? code,
    [entityTypes],
  );

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }
    if (!form.file || !form.entity_type || !form.entity_id || !form.document_type) {
      setError("Entity and document info are required.");
      return;
    }

    const payload = new FormData();
    payload.append("entity_type", form.entity_type);
    payload.append("entity_id", form.entity_id);
    payload.append("document_type", form.document_type);
    payload.append("file", form.file);

    try {
      await api.post("/documents", payload, headers);
      setMessage("Document uploaded.");
      setForm((current) => ({ ...emptyForm, entity_type: current.entity_type || entityTypeOptions[0]?.value || "asset" }));
      await loadRows();
    } catch {
      setError("Upload failed.");
    }
  };

  const deleteRow = async (id: number) => {
    try {
      await api.delete(`/documents/${id}`, headers);
      await loadRows();
      setMessage("Document deleted.");
    } catch {
      setError("Unable to delete document.");
    }
  };

  const columns = [
    { key: "document_type", header: "Type" },
    { key: "entity_type", header: "Entity Type", render: (row: DocRow) => <>{entityTypeLabel(row.entity_type)}</> },
    { key: "entity_id", header: "Entity ID" },
    { key: "original_file_name", header: "File" },
    { key: "mime_type", header: "MIME" },
    { key: "file_size", header: "Size" },
    { key: "file_path", header: "Stored Path" },
    {
      key: "action",
      header: "Action",
      render: (row: DocRow) => (
        <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteRow(row.id)}>
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
          title="Documents"
          subtitle="Upload, search, and manage document attachments."
          
        />
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Upload Document</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={upload}>
                  <div className="col-12">
                    <label className="form-label small">Entity Type</label>
                    <SearchableSelect
                      id="document-entity-type"
                      options={entityTypeOptions}
                      value={form.entity_type}
                      placeholder="Search entity type"
                      emptyLabel="No active document entity types found."
                      onChange={(value) => setForm((current) => ({ ...current, entity_type: value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Entity ID</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.entity_id}
                      onChange={(event) => setForm((current) => ({ ...current, entity_id: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Document Type</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.document_type}
                      onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">File</label>
                    <input
                      className="form-control form-control-sm"
                      type="file"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))
                      }
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary" type="submit">
                      <i className="bi bi-upload me-1" />
                      Upload
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setFilters({ entity_type: "", document_type: "", entity_id: "" })}>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Entity Type</label>
                <SearchableSelect
                  id="documents-filter-entity-type"
                  options={entityTypeOptions}
                  value={filters.entity_type}
                  placeholder="All entity types"
                  emptyLabel="No active document entity types found."
                  onChange={(value) => setFilters((current) => ({ ...current, entity_type: value }))}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Document Type</label>
                <input
                  className="form-control form-control-sm"
                  value={filters.document_type}
                  onChange={(event) => setFilters((current) => ({ ...current, document_type: event.target.value }))}
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Entity ID</label>
                <input
                  className="form-control form-control-sm"
                  value={filters.entity_id}
                  onChange={(event) => setFilters((current) => ({ ...current, entity_id: event.target.value }))}
                />
              </div>
            </FilterBar>

            {rows.length === 0 ? <EmptyState title="No documents" message="No documents uploaded." /> : <DataTable columns={columns} rows={rows} />}
          </div>
        </div>
      </div>
    </main>
  );
}
