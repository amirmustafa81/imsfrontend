"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type ImportBatch = {
  id: number;
  import_no: string;
  import_type: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  imported_rows: number;
  created_at: string;
  original_file_name: string;
};

type ErrorRow = {
  id: number;
  row_number: number;
  error_message: string;
  raw_row_data: Record<string, unknown>;
};

const importTypeOptions = [
  { value: "opening_inventory", label: "Opening Inventory" },
  { value: "assets", label: "Assets" },
  { value: "stock", label: "Stock" },
  { value: "controlled_stationery", label: "Controlled Stationery" },
  { value: "users", label: "Users" },
  { value: "departments", label: "Departments" },
  { value: "locations", label: "Locations" },
  { value: "projects", label: "Projects" },
];

const templateTypeOptions = [
  { value: "opening_inventory", label: "Opening Inventory" },
  { value: "stock", label: "Stock" },
  { value: "assets", label: "Assets" },
  { value: "controlled_stationery", label: "Controlled Stationery" },
];

export default function ImportPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tempToken, setTempToken] = useState(token);
  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const [importTypeFilter, setImportTypeFilter] = useState("");
  const [uploadType, setUploadType] = useState("assets");
  const [file, setFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tempToken);
    setToken(tempToken);
  };

  const loadBatches = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ data: ImportBatch[] }>("/excel-import/batches", {
        ...authHeaders,
        params: importTypeFilter ? { import_type: importTypeFilter } : undefined,
      });

      setBatches(response.data.data ?? response.data ?? []);
    } catch {
      setBatches([]);
      setError("Unable to load import batches. Verify token and backend connectivity.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, importTypeFilter, token]);

  const loadErrors = useCallback(
    async (batchId: number) => {
      if (!token) {
        return;
      }

      try {
        const response = await api.get<{ data: ErrorRow[] }>(`/excel-import/${batchId}/errors`, authHeaders);
        setErrors(response.data.data ?? []);
      } catch {
        setErrors([]);
        setError("Unable to load errors for selected import batch.");
      }
    },
    [authHeaders, token],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBatches();
  }, [loadBatches]);

  const reset = () => {
    setImportTypeFilter("");
    setSelectedBatchId(null);
    setErrors([]);
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Save token first.");
      return;
    }

    if (!file) {
      setError("Select a file before upload.");
      return;
    }

    const formData = new FormData();
    formData.append("import_type", uploadType);
    formData.append("file", file);

    try {
      await api.post("/excel-import/imports", formData, {
        ...authHeaders,
      });
      setMessage("Import batch uploaded.");
      setFile(null);
      await loadBatches();
    } catch {
      setError("Upload failed. Verify file format and permissions.");
    }
  };

  const actionValidate = async (batchId: number) => {
    if (!token) {
      setError("Save token first.");
      return;
    }

    try {
      const response = await api.post<{ data: ImportBatch }>(`/excel-import/${batchId}/validate`, {}, authHeaders);
      setMessage(response.data.data?.status ? `Batch validation status: ${response.data.data.status}` : "Validation completed.");
      await loadBatches();
      await loadErrors(batchId);
    } catch {
      setError("Validation failed.");
    }
  };

  const actionRun = async (batchId: number) => {
    if (!token) {
      setError("Save token first.");
      return;
    }

    try {
      const response = await api.post<{ data: ImportBatch }>(`/excel-import/${batchId}/run`, {}, authHeaders);
      setMessage(response.data.data?.status ? `Run completed: ${response.data.data.status}` : "Run completed.");
      await loadBatches();
      await loadErrors(batchId);
    } catch {
      setError("Run failed. Validate first and check errors.");
    }
  };

  const onSelectBatch = (batchId: number) => {
    setSelectedBatchId((current) => (current === batchId ? null : batchId));
    void loadErrors(batchId);
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="ERP Import"
          subtitle="Upload staged CSV templates, validate, run and review import outcomes."
          actions={
            <form className="d-flex gap-2" onSubmit={submitToken}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-key" />
                </span>
                <input
                  className="form-control"
                  placeholder="Bearer token"
                  value={tempToken}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setTempToken(event.target.value)}
                />
              </div>
              <button className="btn btn-sm btn-outline-primary" type="submit">
                Save token
              </button>
            </form>
          }
        />

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">Templates</div>
              <div className="card-body">
                <div className="row g-2">
                  {templateTypeOptions.map((template) => (
                    <div className="col-12 col-sm-6" key={template.value}>
                      <a
                        className="btn btn-sm btn-outline-primary w-100"
                        href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api"}/excel-import/templates/${template.value}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <i className="bi bi-download me-1" />
                        {template.label}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mt-4">
              <div className="card-header bg-white fw-semibold">Upload Batch</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={upload}>
                  <div className="col-12">
                    <label className="form-label small mb-1">Import Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={uploadType}
                      onChange={(event) => setUploadType(event.target.value)}
                    >
                      {importTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">File</label>
                    <input
                      className="form-control form-control-sm"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary" type="submit" disabled={!file}>
                      <i className="bi bi-upload me-1" />
                      Upload
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={reset}>
              <div className="col-12 col-lg-6">
                <label className="form-label small mb-1">Import type</label>
                <select
                  className="form-select form-select-sm"
                  value={importTypeFilter}
                  onChange={(event) => setImportTypeFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {importTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </FilterBar>

            <DataTable
              columns={[
                { key: "import_no", header: "Batch" },
                { key: "import_type", header: "Type" },
                { key: "status", header: "Status", render: (row: ImportBatch) => <StatusBadge status={row.status} /> },
                { key: "original_file_name", header: "File" },
                { key: "total_rows", header: "Rows", className: "text-end" },
                { key: "valid_rows", header: "Valid", className: "text-end" },
                { key: "error_rows", header: "Errors", className: "text-end" },
                { key: "imported_rows", header: "Imported", className: "text-end" },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row: ImportBatch) => (
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-primary" type="button" onClick={() => actionValidate(row.id)}>
                        Validate
                      </button>
                      <button className="btn btn-outline-success" type="button" onClick={() => actionRun(row.id)}>
                        Run
                      </button>
                      <button className="btn btn-outline-secondary" type="button" onClick={() => onSelectBatch(row.id)}>
                        {selectedBatchId === row.id ? "Hide" : "Errors"}
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={batches}
              empty="No import batches found."
            />

            {selectedBatchId ? (
              <div className="card border-0 shadow-sm mt-3">
                <div className="card-header bg-white fw-semibold">Import Errors</div>
                <div className="card-body">
                  {errors.length === 0 ? (
                    <div className="text-secondary small">No errors for selected batch.</div>
                  ) : (
                    <DataTable
                      columns={[
                        { key: "row_number", header: "Row" },
                        { key: "error_message", header: "Message" },
                      ]}
                      rows={errors}
                      empty="No errors found."
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {loading ? <span className="small text-secondary">Loading…</span> : null}
        {message ? <div className="alert alert-success mt-3">{message}</div> : null}
        {error ? <div className="alert alert-danger mt-3">{error}</div> : null}
      </div>
    </main>
  );
}
