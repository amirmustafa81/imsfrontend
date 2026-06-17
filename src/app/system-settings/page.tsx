"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, EmptyState, PageHeader } from "@/components/ims";

type Setting = {
  id: number;
  setting_key: string;
  setting_value: string | null;
  value_type: "string" | "number" | "boolean" | "json" | "date" | null;
  description: string | null;
  updated_at: string;
};

export default function SystemSettingsPage() {
  const initialToken = () => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? "");
  const [token] = useState(initialToken);
  const headers = useMemo(() => ({ headers: token ? { Authorization: `Bearer ${token}` } : undefined }), [token]);

  const [rows, setRows] = useState<Setting[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get<{ data: Setting[] }>("/system-settings", headers);
      const settings = response.data?.data ?? [];
      setRows(settings);
      const nextValues: Record<number, string> = {};
      settings.forEach((setting) => {
        nextValues[setting.id] = setting.setting_value ?? "";
      });
      setValues(nextValues);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load settings.");
    }
  }, [headers, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const updateSetting = async (setting: Setting) => {
    if (!token) {
      setError("Authentication token required.");
      return;
    }

    const value = values[setting.id] ?? "";
    try {
      await api.put(
        `/system-settings/${setting.id}`,
        { setting_value: value, value_type: setting.value_type, description: setting.description },
        headers,
      );
      setMessage(`Updated ${setting.setting_key}`);
      setError("");
      await loadRows();
      setEditingId(null);
    } catch {
      setError(`Unable to update ${setting.setting_key}.`);
    }
  };

  const columns = [
    { key: "setting_key", header: "Setting Key" },
    {
      key: "setting_value",
      header: "Value",
      render: (row: Setting) =>
        editingId === row.id ? (
          <input
            className="form-control form-control-sm"
            value={values[row.id] ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setValues((current) => ({ ...current, [row.id]: event.target.value }))
            }
          />
        ) : (
          <span className="small">{row.setting_value ?? "-"}</span>
        ),
    },
    { key: "value_type", header: "Type" },
    { key: "description", header: "Description" },
    { key: "updated_at", header: "Updated" },
    {
      key: "action",
      header: "Action",
      render: (row: Setting) =>
        editingId === row.id ? (
          <div className="btn-group">
            <button className="btn btn-sm btn-primary" onClick={() => updateSetting(row)}>
              Save
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-sm btn-outline-primary" onClick={() => setEditingId(row.id)}>
            <i className="bi bi-pencil me-1" />
            Edit
          </button>
        ),
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="System Settings"
          subtitle="Update threshold keys used by inventory and operations."
          
        />
        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-danger">{error}</div> : null}

        {rows.length === 0 ? (
          <EmptyState title="No settings found" message="No system settings available." />
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}
      </div>
    </main>
  );
}
