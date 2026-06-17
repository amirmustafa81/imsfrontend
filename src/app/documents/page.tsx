"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, FilterBar, PageHeader } from "@/components/ims";

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

const emptyForm: UploadForm = { entity_type: "asset", entity_id: "", document_type: "", file: null };
const entityTypes = [
  "asset",
  "user_delegation",
  "inventory_transaction",
  "inventory_receipt",
  "physical_verification",
  "disposal",
  "maintenance_record",
  "asset_investigation",
];

export default function DocumentsPage() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token, setToken] = useState(initialToken);
  const [tmpToken, setTmpToken] = useState(initialToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [rows, setRows] = useState<DocRow[]>([]);
  const [form, setForm] = useState<UploadForm>(emptyForm);
  const [filters, setFilters] = useState<Filters>({ entity_type: "", document_type: "", entity_id: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async () => {
    if (!token) return;
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
  }, [headers, token, filters.entity_type, filters.document_type, filters.entity_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Save token first.");
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
      setForm(emptyForm);
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
    { key: "entity_type", header: "Entity Type" },
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
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Upload Document</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={upload}>
                  <div className="col-12">
                    <label className="form-label small">Entity Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.entity_type}
                      onChange={(event) => setForm((current) => ({ ...current, entity_type: event.target.value }))}
                    >
                      {entityTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
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
                <input
                  className="form-control form-control-sm"
                  value={filters.entity_type}
                  onChange={(event) => setFilters((current) => ({ ...current, entity_type: event.target.value }))}
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
