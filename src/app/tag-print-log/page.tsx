"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type AssetOption = {
  id: number;
  asset_id: string;
  serial_number: string;
};

type TagPrintLog = {
  id: number;
  asset_id: number;
  printable_tag_id: string;
  print_format: string | null;
  printed_at: string | null;
  remarks: string | null;
  printed_by: {
    name: string;
  };
  created_at: string;
  asset: {
    asset_id: string;
    serial_number: string;
  };
};

type TagPrintForm = {
  asset_id: string;
  printable_tag_id: string;
  print_format: string;
  remarks: string;
};

const printFormatOptions = [
  { value: "", label: "Default" },
  { value: "QR", label: "QR" },
  { value: "BARCODE", label: "Barcode" },
  { value: "COMBINED", label: "QR + Barcode" },
];

export default function TagPrintLogPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tempToken, setTempToken] = useState(token);
  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rows, setRows] = useState<TagPrintLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TagPrintForm>({
    asset_id: "",
    printable_tag_id: "",
    print_format: "",
    remarks: "",
  });
  const [message, setMessage] = useState("");

  const loadLookups = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.get<{ data: AssetOption[] }>("/assets", authHeaders);
      setAssets(response.data.data ?? []);
    } catch {
      setError("Unable to load asset list for tagging.");
    }
  }, [authHeaders, token]);

  const loadRows = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<{ data: TagPrintLog[] }>("/asset-tag-print-logs", {
        ...authHeaders,
        params: search.trim() ? { searchable_tag_id: search.trim() } : undefined,
      });
      setRows(response.data.data ?? []);
    } catch {
      setRows([]);
      setError("Unable to load tag print log list.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, search, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("ims_api_token", tempToken);
    setToken(tempToken);
  };

  const setField = useCallback((field: keyof TagPrintForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const saveLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Save token first.");
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.post("/asset-tag-print-logs", form, authHeaders);
      await loadRows();
      setMessage("Tag print log saved.");
      setForm({
        asset_id: "",
        printable_tag_id: "",
        print_format: "",
        remarks: "",
      });
    } catch {
      setError("Unable to save tag print log. Verify required fields.");
    }
  };

  const deleteLog = async (logId: number) => {
    if (!token) {
      setError("Save token first.");
      return;
    }

    try {
      await api.delete(`/asset-tag-print-logs/${logId}`, authHeaders);
      await loadRows();
      setMessage("Tag print log removed.");
    } catch {
      setError("Unable to delete print log.");
    }
  };

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Tag Print Log"
          subtitle="Record tag printing actions per asset and export traceability."
          actions={
            <form className="d-flex gap-2" onSubmit={submitToken}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <i className="bi bi-key" />
                </span>
                <input
                  className="form-control"
                  value={tempToken}
                  placeholder="Bearer token"
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
              <div className="card-header bg-white fw-semibold">New Print Record</div>
              <div className="card-body">
                <form className="row g-3" onSubmit={saveLog}>
                  <div className="col-12">
                    <label className="form-label small mb-1">Asset</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.asset_id}
                      onChange={(event) => setField("asset_id", event.target.value)}
                    >
                      <option value="">Choose asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.asset_id} — {asset.serial_number || "No serial"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">Printable Tag ID</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.printable_tag_id}
                      onChange={(event) => setField("printable_tag_id", event.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">Print Format</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.print_format}
                      onChange={(event) => setField("print_format", event.target.value)}
                    >
                      {printFormatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small mb-1">Remarks</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      value={form.remarks}
                      onChange={(event) => setField("remarks", event.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-sm btn-primary" type="submit" disabled={!form.asset_id || !form.printable_tag_id}>
                      <i className="bi bi-printer me-1" />
                      Save Print Log
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <FilterBar onReset={() => setSearch("") }>
              <div className="col-12 col-lg-8">
                <label className="form-label small mb-1">Search</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="Search tag id or asset serial"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </FilterBar>

            <DataTable
              columns={[
                { key: "asset", header: "Asset", render: (row: TagPrintLog) => row.asset?.asset_id ?? "-" },
                { key: "printable_tag_id", header: "Tag ID" },
                { key: "print_format", header: "Format" },
                { key: "printed_at", header: "Printed At" },
                { key: "printed_by", header: "Printed By", render: (row: TagPrintLog) => row.printed_by?.name ?? "System" },
                {
                  key: "created_at",
                  header: "Status",
                  render: () => <StatusBadge status="Posted" />,
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row: TagPrintLog) => (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      type="button"
                      onClick={() => void deleteLog(row.id)}
                    >
                      <i className="bi bi-trash me-1" />
                      Delete
                    </button>
                  ),
                },
              ]}
              rows={rows}
              empty="No print logs found."
            />
          </div>
        </div>

        {message ? <div className="alert alert-success mt-2">{message}</div> : null}
        {error ? <div className="alert alert-danger mt-2">{error}</div> : null}
        {loading ? <span className="small text-secondary">Loading…</span> : null}
      </div>
    </main>
  );
}
