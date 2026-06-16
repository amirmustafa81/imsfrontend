"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LookupKey = "departments" | "stores" | "items" | "research-projects";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type BatchStatus = "active" | "closed" | "cancelled";

type SerialStatus = "in_stock" | "issued" | "consumed" | "missing" | "cancelled" | "damaged";

type SerialAction =
  | "issue"
  | "consume"
  | "return"
  | "mark_missing"
  | "mark_damaged"
  | "cancel";

type ControlledBatch = {
  id: number;
  batch_no: string;
  item_id: number;
  receipt_item_id: number | null;
  serial_prefix: string | null;
  serial_from: string;
  serial_to: string;
  total_quantity: number;
  received_date: string;
  department_id: number | null;
  store_id: number | null;
  status: BatchStatus;
  remarks: string | null;
  created_at: string;
  serials_count?: number;
};

type ControlledSerial = {
  id: number;
  batch_id: number;
  serial_no: string;
  item_id: number;
  current_department_id: number | null;
  current_store_id: number | null;
  issued_to_user_id: number | null;
  project_id: number | null;
  status: SerialStatus;
  issued_at: string | null;
  consumed_at: string | null;
  remarks: string | null;
  created_at: string;
};

type SerialRow = {
  serial_no: string;
  remarks: string;
};

type SerialActionPayload = {
  action: SerialAction;
  issued_to_user_id: string;
  project_id: string;
  to_department_id: string;
  remarks: string;
};

type BatchForm = {
  batch_no: string;
  item_id: string;
  receipt_item_id: string;
  serial_prefix: string;
  serial_from: string;
  serial_to: string;
  total_quantity: string;
  received_date: string;
  department_id: string;
  store_id: string;
  status: BatchStatus;
  remarks: string;
  use_range: boolean;
};

const batchStatusClass: Record<BatchStatus, string> = {
  active: "text-bg-success",
  closed: "text-bg-primary",
  cancelled: "text-bg-danger",
};

const serialStatusClass: Record<SerialStatus, string> = {
  in_stock: "text-bg-success",
  issued: "text-bg-info",
  consumed: "text-bg-secondary",
  missing: "text-bg-warning",
  cancelled: "text-bg-danger",
  damaged: "text-bg-dark",
};

const serialActionLabels: Array<{ value: SerialAction; label: string }> = [
  { value: "issue", label: "Issue" },
  { value: "consume", label: "Consume" },
  { value: "return", label: "Return" },
  { value: "mark_missing", label: "Mark Missing" },
  { value: "mark_damaged", label: "Mark Damaged" },
  { value: "cancel", label: "Cancel" },
];

const serialActionClass: Record<SerialAction, string> = {
  issue: "text-bg-primary",
  consume: "text-bg-secondary",
  return: "text-bg-success",
  mark_missing: "text-bg-warning",
  mark_damaged: "text-bg-dark",
  cancel: "text-bg-danger",
};

const defaultBatchForm: BatchForm = {
  batch_no: "",
  item_id: "",
  receipt_item_id: "",
  serial_prefix: "",
  serial_from: "",
  serial_to: "",
  total_quantity: "",
  received_date: new Date().toISOString().slice(0, 10),
  department_id: "",
  store_id: "",
  status: "active",
  remarks: "",
  use_range: true,
};

const defaultSerialInput: SerialRow = {
  serial_no: "",
  remarks: "",
};

const defaultSerialAction: SerialActionPayload = {
  action: "issue",
  issued_to_user_id: "",
  project_id: "",
  to_department_id: "",
  remarks: "",
};

const toPayloadNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const lookupLabel = (rows: RowData[], value: unknown, fallback?: string) => {
  if (value === null || value === undefined || value === "") return fallback ?? "-";

  const match = rows.find((row) => String(row.id) === String(value));
  if (!match) return String(value);

  return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? ""}`;
};

export default function ControlledStationeryPage() {
  const [token, setToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));
  const [tmpToken, setTmpToken] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("ims_api_token") ?? ""));

  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({
    departments: [],
    stores: [],
    items: [],
    "research-projects": [],
  });

  const [batches, setBatches] = useState<ControlledBatch[]>([]);
  const [serials, setSerials] = useState<ControlledSerial[]>([]);

  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("");
  const [batchItemFilter, setBatchItemFilter] = useState("");
  const [batchDepartmentFilter, setBatchDepartmentFilter] = useState("");
  const [batchStoreFilter, setBatchStoreFilter] = useState("");

  const [serialSearch, setSerialSearch] = useState("");
  const [serialStatusFilter, setSerialStatusFilter] = useState("");
  const [serialItemFilter, setSerialItemFilter] = useState("");
  const [serialDepartmentFilter, setSerialDepartmentFilter] = useState("");
  const [serialStoreFilter, setSerialStoreFilter] = useState("");

  const [batchForm, setBatchForm] = useState<BatchForm>(defaultBatchForm);
  const [serialRows, setSerialRows] = useState<SerialRow[]>([defaultSerialInput]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [serialActions, setSerialActions] = useState<Record<number, SerialActionPayload>>({});
  const [serialActionBusy, setSerialActionBusy] = useState<Record<number, boolean>>({});

  const authHeaders = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [token],
  );

  const loadLookups = useCallback(async () => {
    const next = {
      departments: [] as RowData[],
      stores: [] as RowData[],
      items: [] as RowData[],
      "research-projects": [] as RowData[],
    };

    const requests = Object.keys(next).map(async (key) => {
      const response = await api.get(`/master-data/${key}`, { ...authHeaders });
      const payload = response.data?.data;
      if (Array.isArray(payload)) {
        next[key as LookupKey] = payload;
      }
    });

    await Promise.all(requests);
    setLookups(next);
  }, [authHeaders]);

  const loadBatches = useCallback(async () => {
    if (!token) return;

    try {
      const params: Record<string, string> = {};
      if (batchSearch.trim()) params.search = batchSearch.trim();
      if (batchStatusFilter) params.status = batchStatusFilter;
      if (batchItemFilter) params.item_id = batchItemFilter;
      if (batchDepartmentFilter) params.department_id = batchDepartmentFilter;
      if (batchStoreFilter) params.store_id = batchStoreFilter;

      const response = await api.get("/controlled-stationery/batches", {
        ...authHeaders,
        params,
      });
      const data = response.data?.data;
      setBatches(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setBatches([]);
      setError("Unable to load controlled stationery batches.");
    }
  }, [
    token,
    batchSearch,
    batchStatusFilter,
    batchItemFilter,
    batchDepartmentFilter,
    batchStoreFilter,
    authHeaders,
  ]);

  const loadSerials = useCallback(async () => {
    if (!token) return;

    try {
      const params: Record<string, string> = {};
      if (serialSearch.trim()) params.search = serialSearch.trim();
      if (serialStatusFilter) params.status = serialStatusFilter;
      if (serialItemFilter) params.item_id = serialItemFilter;
      if (serialDepartmentFilter) params.department_id = serialDepartmentFilter;
      if (serialStoreFilter) params.store_id = serialStoreFilter;

      const response = await api.get("/controlled-stationery/serials", {
        ...authHeaders,
        params,
      });
      const data = response.data?.data;
      setSerials(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setSerials([]);
      setError("Unable to load controlled stationery serials.");
    }
  }, [
    token,
    serialSearch,
    serialStatusFilter,
    serialItemFilter,
    serialDepartmentFilter,
    serialStoreFilter,
    authHeaders,
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadAll = async () => {
      await Promise.all([loadLookups(), loadBatches(), loadSerials()]);
    };

    void loadAll();
  }, [token, loadLookups, loadBatches, loadSerials]);

  const submitToken = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ims_api_token", tmpToken);
    setToken(tmpToken);
    setMessage("Token saved. Reloading inventory module.");
    setError("");
    setTimeout(() => {
      void loadLookups();
      void loadBatches();
      void loadSerials();
    }, 100);
  };

  const setBatchFormValue = (key: keyof BatchForm, value: string | boolean) => {
    setBatchForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setSerialRowValue = (index: number, key: keyof SerialRow, value: string) => {
    setSerialRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return { ...row, [key]: value };
      }),
    );
  };

  const addSerialRow = () => setSerialRows((current) => [...current, { ...defaultSerialInput }]);

  const removeSerialRow = (index: number) => {
    setSerialRows((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const resetBatchForm = () => {
    setBatchForm(defaultBatchForm);
    setSerialRows([defaultSerialInput]);
  };

const loadActionDraft = (serialId: number): SerialActionPayload => {
  return serialActions[serialId] ?? defaultSerialAction;
};

  const setSerialActionValue = (serialId: number, key: keyof SerialActionPayload, value: string) => {
    setSerialActions((current) => ({
      ...current,
      [serialId]: {
        ...loadActionDraft(serialId),
        [key]: value,
      },
    }));
  };

  const submitBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("Save token first.");
      return;
    }

    const quantity = toPayloadNumber(batchForm.total_quantity);
    if (!batchForm.batch_no.trim()) {
      setError("Batch number is required.");
      return;
    }
    if (!batchForm.item_id.trim()) {
      setError("Item is required.");
      return;
    }
    if (!batchForm.department_id.trim()) {
      setError("Department is required.");
      return;
    }
    if (!quantity || quantity <= 0) {
      setError("Total quantity must be greater than zero.");
      return;
    }
    if (!batchForm.received_date.trim()) {
      setError("Received date is required.");
      return;
    }

    if (batchForm.use_range) {
      if (!batchForm.serial_from.trim() || !batchForm.serial_to.trim()) {
        setError("Serial range is required.");
        return;
      }
    } else {
      const usableRows = serialRows.filter((row) => row.serial_no.trim());
      if (!usableRows.length) {
        setError("At least one serial row is required.");
        return;
      }
      if (usableRows.length !== (quantity || 0)) {
        setError("Total quantity must match number of serial rows.");
        return;
      }
    }

    const payload = {
      batch_no: batchForm.batch_no.trim(),
      item_id: toPayloadNumber(batchForm.item_id),
      receipt_item_id: toPayloadNumber(batchForm.receipt_item_id),
      serial_prefix: batchForm.serial_prefix.trim() || null,
      serial_from: batchForm.use_range ? batchForm.serial_from.trim() : null,
      serial_to: batchForm.use_range ? batchForm.serial_to.trim() : null,
      total_quantity: quantity,
      received_date: batchForm.received_date,
      department_id: toPayloadNumber(batchForm.department_id),
      store_id: toPayloadNumber(batchForm.store_id),
      status: batchForm.status,
      remarks: batchForm.remarks.trim() || null,
      serials: batchForm.use_range
        ? []
        : serialRows
            .filter((row) => row.serial_no.trim())
            .map((row) => ({
              serial_no: row.serial_no.trim(),
              remarks: row.remarks.trim() || null,
            })),
    };

    try {
      const response = await api.post("/controlled-stationery/batches", payload, authHeaders);
      if (response.data?.data) {
        setMessage(`Batch created with id ${response.data.data.id}`);
      } else {
        setMessage("Batch created.");
      }
      resetBatchForm();
      await loadBatches();
      await loadSerials();
    } catch {
      setError("Failed to create controlled stationery batch.");
    }
  };

  const deleteBatch = async (id: number) => {
    try {
      const response = await api.delete(`/controlled-stationery/batches/${id}`, authHeaders);
      setMessage(response.data?.message ?? "Batch deleted.");
      setError("");
      await loadBatches();
      await loadSerials();
    } catch {
      setError("Delete batch failed.");
    }
  };

  const applySerialAction = async (serial: ControlledSerial) => {
    const draft = loadActionDraft(serial.id);
    setError("");
    setMessage("");

    if (!token) {
      setError("Save token first.");
      return;
    }

    if (draft.action === "issue" && !draft.issued_to_user_id.trim()) {
      setError("Issue action requires issued_to_user_id.");
      return;
    }

    const payload = {
      action: draft.action,
      issued_to_user_id: toPayloadNumber(draft.issued_to_user_id),
      project_id: toPayloadNumber(draft.project_id),
      to_department_id: toPayloadNumber(draft.to_department_id),
      remarks: draft.remarks.trim() || null,
    };

    setSerialActionBusy((current) => ({ ...current, [serial.id]: true }));
    try {
      const response = await api.post(`/controlled-stationery/serials/${serial.id}/status`, payload, authHeaders);
      const messageText = response.data?.message ?? "Serial updated.";
      setMessage(messageText);
      await loadSerials();
      await loadBatches();
      setSerialActions((current) => ({
        ...current,
        [serial.id]: {
          ...current[serial.id],
          remarks: "",
          issued_to_user_id: "",
        },
      }));
    } catch {
      setError(`Unable to perform ${draft.action} on serial ${serial.serial_no}.`);
    } finally {
      setSerialActionBusy((current) => ({ ...current, [serial.id]: false }));
    }
  };

  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <Link href="/" className="btn btn-link px-0 mb-3">
          <i className="bi bi-arrow-left me-2" />
          Dashboard
        </Link>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <h1 className="h3 mb-2">Controlled Stationery</h1>
            <p className="text-secondary mb-3">
              Track controlled stationery by batch and serial number for per-issue, consumption, return, missing, and damage actions.
            </p>

            <div className="row g-3 align-items-end">
              <div className="col-sm-9">
                <label htmlFor="token" className="form-label">
                  API Token
                </label>
                <input
                  id="token"
                  value={tmpToken}
                  onChange={(event) => setTmpToken(event.target.value)}
                  type="password"
                  className="form-control font-monospace"
                />
              </div>
              <div className="col-sm-3">
                <button className="btn btn-primary w-100" type="button" onClick={submitToken}>
                  Save Token
                </button>
              </div>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className={`alert ${error ? "alert-danger" : "alert-success"} mb-4`} role="alert">
            {error || message}
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Create Controlled Stationery Batch</h2>
                <form onSubmit={submitBatch} className="vstack gap-3">
                  <div className="row g-2">
                    <div className="col-12">
                      <label htmlFor="batch-no" className="form-label">
                        Batch No.
                      </label>
                      <input
                        id="batch-no"
                        className="form-control"
                        value={batchForm.batch_no}
                        onChange={(event) => setBatchFormValue("batch_no", event.target.value)}
                        placeholder="e.g. CS-2026-001"
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="batch-item" className="form-label">
                        Item
                      </label>
                      <select
                        id="batch-item"
                        className="form-select"
                        value={batchForm.item_id}
                        onChange={(event) => setBatchFormValue("item_id", event.target.value)}
                      >
                        <option value="">Select item</option>
                        {lookups.items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_code ? `${item.item_code} - ${item.name}` : `${item.id} - ${item.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="batch-receipt" className="form-label">
                        Receipt Item ID (optional)
                      </label>
                      <input
                        id="batch-receipt"
                        className="form-control"
                        value={batchForm.receipt_item_id}
                        onChange={(event) => setBatchFormValue("receipt_item_id", event.target.value)}
                        placeholder="optional"
                      />
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-6">
                      <label htmlFor="batch-department" className="form-label">
                        Department
                      </label>
                      <select
                        id="batch-department"
                        className="form-select"
                        value={batchForm.department_id}
                        onChange={(event) => setBatchFormValue("department_id", event.target.value)}
                      >
                        <option value="">Select department</option>
                        {lookups.departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.code} - {department.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="batch-store" className="form-label">
                        Store (optional)
                      </label>
                      <select
                        id="batch-store"
                        className="form-select"
                        value={batchForm.store_id}
                        onChange={(event) => setBatchFormValue("store_id", event.target.value)}
                      >
                        <option value="">Select store</option>
                        {lookups.stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.code ?? store.id} - {store.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-4">
                      <label htmlFor="batch-received-date" className="form-label">
                        Received Date
                      </label>
                      <input
                        id="batch-received-date"
                        type="date"
                        className="form-control"
                        value={batchForm.received_date}
                        onChange={(event) => setBatchFormValue("received_date", event.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="batch-status" className="form-label">
                        Batch Status
                      </label>
                      <select
                        id="batch-status"
                        className="form-select"
                        value={batchForm.status}
                        onChange={(event) => setBatchFormValue("status", event.target.value as BatchStatus)}
                      >
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="batch-qty" className="form-label">
                        Total Quantity
                      </label>
                      <input
                        id="batch-qty"
                        className="form-control"
                        value={batchForm.total_quantity}
                        onChange={(event) => setBatchFormValue("total_quantity", event.target.value)}
                        placeholder="e.g. 100"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <label className="form-label">Serialing Method</label>
                      <select
                        className="form-select"
                        value={batchForm.use_range ? "range" : "manual"}
                        onChange={(event) => setBatchFormValue("use_range", event.target.value === "range")}
                      >
                        <option value="range">Numeric Range</option>
                        <option value="manual">Manual Serial List</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="batch-prefix" className="form-label">
                        Serial Prefix
                      </label>
                      <input
                        id="batch-prefix"
                        className="form-control"
                        value={batchForm.serial_prefix}
                        onChange={(event) => setBatchFormValue("serial_prefix", event.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="batch-remarks" className="form-label">
                        Remarks
                      </label>
                      <input
                        id="batch-remarks"
                        className="form-control"
                        value={batchForm.remarks}
                        onChange={(event) => setBatchFormValue("remarks", event.target.value)}
                      />
                    </div>
                  </div>

                  {batchForm.use_range ? (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label htmlFor="serial-from" className="form-label">
                          Serial From
                        </label>
                        <input
                          id="serial-from"
                          className="form-control"
                          value={batchForm.serial_from}
                          onChange={(event) => setBatchFormValue("serial_from", event.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="serial-to" className="form-label">
                          Serial To
                        </label>
                        <input
                          id="serial-to"
                          className="form-control"
                          value={batchForm.serial_to}
                          onChange={(event) => setBatchFormValue("serial_to", event.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded p-3 bg-body-tertiary">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold">Serial Entries</span>
                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={addSerialRow}>
                          <i className="bi bi-plus-lg me-1" />
                          Add Serial Row
                        </button>
                      </div>
                      {serialRows.map((serialRow, index) => (
                        <div key={serialRow.serial_no || `serial-${index}`} className="row g-2 align-items-end mb-2">
                          <div className="col-md-5">
                            <label className="form-label">Serial No.</label>
                            <input
                              className="form-control"
                              value={serialRow.serial_no}
                              onChange={(event) => setSerialRowValue(index, "serial_no", event.target.value)}
                              placeholder="e.g. ANS-001"
                            />
                          </div>
                          <div className="col-md-5">
                            <label className="form-label">Remarks</label>
                            <input
                              className="form-control"
                              value={serialRow.remarks}
                              onChange={(event) => setSerialRowValue(index, "remarks", event.target.value)}
                            />
                          </div>
                          <div className="col-md-2">
                            <button
                              className="btn btn-outline-danger w-100"
                              type="button"
                              onClick={() => removeSerialRow(index)}
                              disabled={serialRows.length <= 1}
                            >
                              <i className="bi bi-trash me-1" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="d-flex justify-content-end gap-2">
                    <button className="btn btn-outline-secondary" type="button" onClick={resetBatchForm}>
                      Reset
                    </button>
                    <button className="btn btn-primary" type="submit">
                      Save Batch
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Batch Filters</h2>
                <div className="row g-2">
                  <div className="col-md-4">
                    <label className="form-label">Search</label>
                    <input
                      className="form-control"
                      value={batchSearch}
                      onChange={(event) => setBatchSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={batchStatusFilter} onChange={(event) => setBatchStatusFilter(event.target.value)}>
                      <option value="">All</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Item</label>
                    <select className="form-select" value={batchItemFilter} onChange={(event) => setBatchItemFilter(event.target.value)}>
                      <option value="">All</option>
                      {lookups.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item_code ? `${item.item_code} - ${item.name}` : `${item.id} - ${item.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Department</label>
                    <select
                      className="form-select"
                      value={batchDepartmentFilter}
                      onChange={(event) => setBatchDepartmentFilter(event.target.value)}
                    >
                      <option value="">All</option>
                      {lookups.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code} - {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Store</label>
                    <select className="form-select" value={batchStoreFilter} onChange={(event) => setBatchStoreFilter(event.target.value)}>
                      <option value="">All</option>
                      {lookups.stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.code ?? store.id} - {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Controlled Stationery Batches</h2>
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Status</th>
                        <th>Department/Store</th>
                        <th>Received</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center text-secondary">
                            No batch records.
                          </td>
                        </tr>
                      ) : (
                        batches.map((batch) => (
                          <tr key={batch.id}>
                            <td>
                              <div className="fw-semibold">{batch.batch_no}</div>
                              <small className="text-secondary">{batch.serial_from} → {batch.serial_to}</small>
                            </td>
                            <td>{lookupLabel(lookups.items, batch.item_id)}</td>
                            <td>
                              <span className="badge text-bg-light text-dark">Total: {batch.total_quantity}</span>
                              {batch.serials_count ? <span className="ms-2">| Serial rows: {batch.serials_count}</span> : null}
                            </td>
                            <td>
                              <span className={`badge ${batchStatusClass[batch.status]}`}>{batch.status}</span>
                            </td>
                            <td>
                              <div>{lookupLabel(lookups.departments, batch.department_id)}</div>
                              <small className="text-secondary">{batch.store_id ? lookupLabel(lookups.stores, batch.store_id) : "-"}</small>
                            </td>
                            <td>{batch.received_date}</td>
                            <td>
                              <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteBatch(batch.id)}>
                                <i className="bi bi-trash3 me-1" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <h2 className="h5 mb-3">Serials Filter & Actions</h2>
            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <label className="form-label">Search</label>
                <input
                  className="form-control"
                  value={serialSearch}
                  onChange={(event) => setSerialSearch(event.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select className="form-select" value={serialStatusFilter} onChange={(event) => setSerialStatusFilter(event.target.value)}>
                  <option value="">All</option>
                  {Object.keys(serialStatusClass).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Item</label>
                <select className="form-select" value={serialItemFilter} onChange={(event) => setSerialItemFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_code ? `${item.item_code} - ${item.name}` : `${item.id} - ${item.name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={serialDepartmentFilter}
                  onChange={(event) => setSerialDepartmentFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {lookups.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} - {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Store</label>
                <select className="form-select" value={serialStoreFilter} onChange={(event) => setSerialStoreFilter(event.target.value)}>
                  <option value="">All</option>
                  {lookups.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.code ?? store.id} - {store.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle">
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Item</th>
                    <th>Location</th>
                    <th>Custodian</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                      {serials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-secondary">
                        No serial records.
                      </td>
                    </tr>
                      ) : (
                        serials.map((serial) => {
                          const actionDraft = loadActionDraft(serial.id);
                          return (
                        <tr key={serial.id}>
                          <td className="text-nowrap">
                            <div className="fw-semibold">{serial.serial_no}</div>
                            <small className="text-secondary">Batch ID {serial.batch_id}</small>
                          </td>
                          <td>{lookupLabel(lookups.items, serial.item_id)}</td>
                          <td>
                            <div>{lookupLabel(lookups.departments, serial.current_department_id)}</div>
                            <small className="text-secondary">{lookupLabel(lookups.stores, serial.current_store_id)}</small>
                          </td>
                          <td>{serial.issued_to_user_id ? `User ${serial.issued_to_user_id}` : "-"}</td>
                          <td>{lookupLabel(lookups["research-projects"], serial.project_id)}</td>
                          <td>
                            <span className={`badge ${serialStatusClass[serial.status]}`}>{serial.status}</span>
                          </td>
                          <td>
                            <div className="d-flex gap-2 flex-wrap mb-2">
                              <select
                                className="form-select form-select-sm"
                                style={{ minWidth: 170 }}
                                value={actionDraft.action}
                                onChange={(event) => setSerialActionValue(serial.id, "action", event.target.value)}
                              >
                                {serialActionLabels.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                className={`btn btn-sm btn-outline-${serialActionClass[actionDraft.action].replace("text-bg-", "")}`}
                                type="button"
                                onClick={() => {
                                  void applySerialAction(serial);
                                }}
                                disabled={serialActionBusy[serial.id]}
                              >
                                {serialActionBusy[serial.id] ? "Applying..." : "Apply"}
                              </button>
                            </div>
                            <div className="d-flex gap-2 flex-wrap">
                              {actionDraft.action === "issue" && (
                                <input
                                  className="form-control form-control-sm"
                                  style={{ minWidth: 180 }}
                                  placeholder="Issued to user ID"
                                  value={actionDraft.issued_to_user_id}
                                  onChange={(event) => setSerialActionValue(serial.id, "issued_to_user_id", event.target.value)}
                                />
                              )}
                              <input
                                className="form-control form-control-sm"
                                style={{ minWidth: 180 }}
                                placeholder="Project ID (optional)"
                                value={actionDraft.project_id}
                                onChange={(event) => setSerialActionValue(serial.id, "project_id", event.target.value)}
                              />
                              <input
                                className="form-control form-control-sm"
                                style={{ minWidth: 180 }}
                                placeholder="To Department ID (optional)"
                                value={actionDraft.to_department_id}
                                onChange={(event) => setSerialActionValue(serial.id, "to_department_id", event.target.value)}
                              />
                            </div>
                            <input
                              className="form-control form-control-sm mt-2"
                              placeholder="Remarks"
                              value={actionDraft.remarks}
                              onChange={(event) => setSerialActionValue(serial.id, "remarks", event.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
