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
  type SearchableSelectOption,
} from "@/components/ims";

type DocRow = Record<string, unknown> & {
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
const documentTypePresets = [
  "invoice",
  "challan",
  "approval",
  "supporting_document",
  "warranty",
  "quotation",
  "contract",
  "verification",
  "disposal",
  "maintenance",
];

const formatDocumentType = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = isAuthenticated && !authLoading;

  const [rows, setRows] = useState<DocRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<DocumentEntityType[]>([]);
  const [form, setForm] = useState<UploadForm>(emptyForm);
  const [filters, setFilters] = useState<Filters>({ entity_type: "", document_type: "", entity_id: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async () => {
    if (!authReady) return;
    const params: Record<string, string> = {};
    if (filters.entity_type.trim()) params.entity_type = filters.entity_type.trim();
    if (filters.document_type.trim()) params.document_type = filters.document_type.trim();
    if (filters.entity_id.trim()) params.entity_id = filters.entity_id.trim();

    try {
      const response = await api.get<{ data: DocRow[] }>("/documents", { params });
      setRows(response.data?.data ?? []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load documents.");
    }
  }, [authReady, filters.entity_type, filters.document_type, filters.entity_id]);

  const loadEntityTypes = useCallback(async () => {
    if (!authReady) return;

    try {
      const response = await api.get<{ data: DocumentEntityType[] }>("/master-data/document-entity-types", {
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
  }, [authReady]);

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

  const filterEntityTypeOptions = useMemo<SearchableSelectOption[]>(
    () => [{ value: "", label: "All entity types" }, ...entityTypeOptions],
    [entityTypeOptions],
  );

  const documentTypeOptions = useMemo<SearchableSelectOption[]>(() => {
    const values = new Set([...documentTypePresets, ...rows.map((row) => row.document_type).filter(Boolean)]);
    return [
      { value: "", label: "All document types" },
      ...Array.from(values)
        .sort((a, b) => formatDocumentType(a).localeCompare(formatDocumentType(b)))
        .map((type) => ({ value: type, label: formatDocumentType(type), keywords: type })),
    ];
  }, [rows]);

  const entityTypeLabel = useCallback(
    (code: string) => entityTypes.find((type) => type.code === code)?.name ?? formatDocumentType(code),
    [entityTypes],
  );

  const openUploadDialog = () => {
    setMessage("");
    setError("");
    setDialogOpen(true);
    setForm((current) => ({
      ...current,
      entity_type: current.entity_type || entityTypeOptions[0]?.value || "asset",
    }));
  };

  const closeUploadDialog = () => {
    setDialogOpen(false);
    setForm((current) => ({ ...emptyForm, entity_type: current.entity_type || entityTypeOptions[0]?.value || "asset" }));
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authReady) {
      setError("Authentication token required.");
      return;
    }
    if (!form.file || !form.entity_type || !form.entity_id || !form.document_type) {
      setError("Entity type, entity ID, document type, and file are required.");
      return;
    }

    const payload = new FormData();
    payload.append("entity_type", form.entity_type);
    payload.append("entity_id", form.entity_id);
    payload.append("document_type", form.document_type);
    payload.append("file", form.file);

    setSaving(true);
    try {
      await api.post("/documents", payload);
      setMessage("Document uploaded.");
      closeUploadDialog();
      await loadRows();
    } catch {
      setError("Upload failed. Check the entity ID, document type, and file size.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: DocRow) => {
    if (!window.confirm(`Delete ${row.original_file_name}?`)) {
      return;
    }

    setDeletingId(row.id);
    try {
      await api.delete(`/documents/${row.id}`);
      await loadRows();
      setMessage("Document deleted.");
      setError("");
    } catch {
      setError("Unable to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  const downloadRow = async (row: DocRow) => {
    setDownloadingId(row.id);
    try {
      const response = await api.get<Blob>(`/documents/${row.id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = row.original_file_name || `document-${row.id}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setError("");
    } catch {
      setError("Unable to download document.");
    } finally {
      setDownloadingId(null);
    }
  };

  const columns = [
    {
      key: "document_type",
      header: "Document Type",
      render: (row: DocRow) => <span className="fw-semibold">{formatDocumentType(row.document_type)}</span>,
    },
    {
      key: "entity_type",
      header: "Entity",
      render: (row: DocRow) => (
        <div>
          <div className="fw-semibold">{entityTypeLabel(row.entity_type)}</div>
          <div className="small text-secondary">{row.entity_type}</div>
        </div>
      ),
    },
    { key: "entity_id", header: "Entity ID" },
    {
      key: "original_file_name",
      header: "File",
      render: (row: DocRow) => (
        <div>
          <div className="fw-semibold">{row.original_file_name}</div>
          <div className="small text-secondary">{row.mime_type || "Unknown MIME type"}</div>
        </div>
      ),
    },
    { key: "file_size", header: "Size", render: (row: DocRow) => <>{formatFileSize(row.file_size)}</> },
    {
      key: "action",
      header: "Actions",
      className: "text-end",
      render: (row: DocRow) => (
        <div className="btn-group btn-group-sm" onClick={(event) => event.stopPropagation()}>
          <button
            className="btn btn-outline-primary"
            type="button"
            disabled={downloadingId === row.id}
            onClick={() => downloadRow(row)}
          >
            <i className="bi bi-download me-1" />
            {downloadingId === row.id ? "Downloading" : "Download"}
          </button>
          <button
            className="btn btn-outline-danger"
            type="button"
            disabled={deletingId === row.id}
            onClick={() => deleteRow(row)}
          >
            <i className="bi bi-trash me-1" />
            {deletingId === row.id ? "Deleting" : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Documents"
          subtitle="Upload, search, and manage supporting documents attached to IMS records."
          actions={
            <button className="btn btn-sm btn-primary" type="button" onClick={openUploadDialog}>
              <i className="bi bi-plus-lg me-1" />
              Upload Document
            </button>
          }
        />
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <FilterBar onReset={() => setFilters({ entity_type: "", document_type: "", entity_id: "" })}>
          <div className="col-12 col-md-4">
            <label className="form-label small mb-1">Entity Type</label>
            <SearchableSelect
              id="documents-filter-entity-type"
              options={filterEntityTypeOptions}
              value={filters.entity_type}
              placeholder="All entity types"
              emptyLabel="No document entity types found."
              onChange={(value) => setFilters((current) => ({ ...current, entity_type: value }))}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small mb-1">Document Type</label>
            <SearchableSelect
              id="documents-filter-document-type"
              options={documentTypeOptions}
              value={filters.document_type}
              placeholder="All document types"
              emptyLabel="No document types found."
              onChange={(value) => setFilters((current) => ({ ...current, document_type: value }))}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small mb-1">Entity ID</label>
            <input
              className="form-control form-control-sm"
              value={filters.entity_id}
              onChange={(event) => setFilters((current) => ({ ...current, entity_id: event.target.value }))}
              placeholder="e.g. 1"
            />
          </div>
        </FilterBar>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 mb-0">Document list</h2>
          <span className="small text-secondary">{rows.length} records</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No documents"
            message="Upload invoice, approval, verification, disposal, maintenance, or other supporting documents."
            action={
              <button className="btn btn-sm btn-primary" type="button" onClick={openUploadDialog}>
                <i className="bi bi-plus-lg me-1" />
                Upload Document
              </button>
            }
          />
        ) : (
          <DataTable columns={columns} rows={rows} empty="No documents match current filters." />
        )}
      </div>

      {dialogOpen ? (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <form className="modal-content" onSubmit={upload}>
              <div className="modal-header">
                <div>
                  <h3 className="modal-title h5">Upload Document</h3>
                  <div className="small text-secondary">
                    Attach a supporting file to an asset, receipt, voucher, verification, disposal, or other IMS record.
                  </div>
                </div>
                <button className="btn-close" type="button" aria-label="Close" onClick={closeUploadDialog} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <FieldLabel info="Choose the IMS record type this file belongs to. These options are managed from Master Data.">
                      Entity Type
                    </FieldLabel>
                    <SearchableSelect
                      id="document-upload-entity-type"
                      options={entityTypeOptions}
                      value={form.entity_type}
                      placeholder="Search entity type"
                      emptyLabel="No active document entity types found."
                      onChange={(value) => setForm((current) => ({ ...current, entity_type: value }))}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <FieldLabel info="Enter the numeric ID of the selected record, for example asset ID 1 or receipt ID 3.">
                      Entity ID
                    </FieldLabel>
                    <input
                      className="form-control form-control-sm"
                      inputMode="numeric"
                      value={form.entity_id}
                      onChange={(event) => setForm((current) => ({ ...current, entity_id: event.target.value }))}
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <FieldLabel info="Classify the attachment, such as invoice, challan, approval, warranty, or verification.">
                      Document Type
                    </FieldLabel>
                    <input
                      className="form-control form-control-sm"
                      list="document-type-presets"
                      value={form.document_type}
                      onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))}
                      placeholder="e.g. invoice"
                    />
                    <datalist id="document-type-presets">
                      {documentTypePresets.map((type) => (
                        <option key={type} value={type}>
                          {formatDocumentType(type)}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col-12 col-md-6">
                    <FieldLabel info="Upload the supporting file. Maximum 10 MB per file and 50 MB total per record.">
                      File
                    </FieldLabel>
                    <input
                      className="form-control form-control-sm"
                      type="file"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))
                      }
                    />
                    <div className="small text-secondary mt-1">Max 10 MB per file, 50 MB total per entity.</div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={closeUploadDialog}>
                  Cancel
                </button>
                <button className="btn btn-sm btn-primary" type="submit" disabled={saving}>
                  <i className="bi bi-upload me-1" />
                  {saving ? "Uploading" : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeUploadDialog} />
        </>
      ) : null}
    </main>
  );
}
