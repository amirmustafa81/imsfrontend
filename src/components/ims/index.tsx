"use client";

import { type ReactNode, useState } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  return (
    <div className="mb-3 d-flex flex-wrap justify-content-between align-items-end gap-2 border-bottom pb-2">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1 small">
              {breadcrumbs.map((item, index) => (
                <li
                  key={`${item.label}-${index}`}
                  className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? "active" : ""}`}
                >
                  {item.label}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <h4 className="mb-0 fw-semibold">{title}</h4>
        {subtitle ? <div className="text-secondary small">{subtitle}</div> : null}
      </div>

      {actions ? <div className="d-flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "secondary";
}) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div
          className={`d-flex align-items-center justify-content-center rounded bg-${tone}-subtle text-${tone}`}
          style={{ width: 48, height: 48 }}
        >
          <i className={`bi ${icon} fs-4`} />
        </div>

        <div className="flex-grow-1">
          <div className="text-secondary small text-uppercase">{label}</div>
          <div className="fs-4 fw-bold lh-1">{value}</div>
          {hint ? <div className="small text-secondary mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  "In Store": "bg-secondary",
  Issued: "bg-info text-dark",
  "In Use": "bg-success",
  "Under Repair": "bg-warning text-dark",
  "Missing/Under Investigation": "bg-danger",
  Damaged: "bg-danger",
  Obsolete: "bg-secondary",
  Disposed: "bg-dark",
  "Written Off": "bg-dark",
  Draft: "bg-secondary",
  Posted: "bg-success",
  "Partially Accepted": "bg-warning text-dark",
  Rejected: "bg-danger",
  Active: "bg-success",
  Closed: "bg-secondary",
  Found: "bg-success",
  Missing: "bg-danger",
  "Under Investigation": "bg-danger",
  MissingUnderInvestigation: "bg-danger",
  Inactive: "bg-secondary",
  Cancelled: "bg-dark",
  Queued: "bg-secondary",
  "In Progress": "bg-warning text-dark",
  Issue: "bg-danger",
  Return: "bg-success",
  Transfer: "bg-primary",
  Consumption: "bg-secondary",
  Adjustment: "bg-info",
  "Missing Under Investigation": "bg-danger",
};

const STATUS_DISPLAY: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Posted",
  partially_accepted: "Partially Accepted",
  posted: "Posted",
  cancelled: "Cancelled",
  missing_under_investigation: "Missing/Under Investigation",
  missingunderinvestigation: "Missing/Under Investigation",
  under_investigation: "Missing/Under Investigation",
  in_stock: "In Store",
  issued: "Issued",
  consumed: "Issued",
  pending_disposal: "Disposed",
  in_use: "In Use",
  active: "Active",
  closed: "Closed",
  written_off: "Written Off",
  obsolete: "Obsolete",
  damaged: "Damaged",
  found: "Found",
  missing: "Missing",
  queued: "Queued",
  in_progress: "In Progress",
  issue: "Issue",
  return: "Return",
  transfer: "Transfer",
  consumption: "Consumption",
  adjustment: "Adjustment",
  under_repair: "Under Repair",
};

const normalizeStatus = (status: string) => {
  const normalized = status.trim();
  return STATUS_DISPLAY[normalized.toLowerCase()] ?? normalized;
};

export function StatusBadge({ status }: { status: string }) {
  const display = normalizeStatus(status);
  return <span className={`badge ${STATUS_TONES[display] ?? "bg-secondary"}`}>{display}</span>;
}

export function EmptyState({
  icon = "bi-inbox",
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body text-center py-5">
        <i className={`bi ${icon} display-4 text-secondary opacity-50`} />
        <h5 className="mt-3 mb-1">{title}</h5>
        {message ? <p className="text-secondary mb-3">{message}</p> : null}
        {action}
      </div>
    </div>
  );
}

export function PhaseTwoStub({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      icon="bi-tools"
      title={`${title} - Coming in Phase 2`}
      message={description}
      action={<span className="badge text-bg-warning">Planned</span>}
    />
  );
}

export function FilterBar({ children, onReset }: { children: ReactNode; onReset?: () => void }) {
  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-body py-2">
        <div className="row g-2 align-items-end">
          {children}
          {onReset ? (
            <div className="col-auto">
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onReset}>
                <i className="bi bi-x-circle me-1" />
                Reset
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty = "No records.",
}: {
  columns: { key: string; header: string; render?: (row: T) => ReactNode; className?: string }[];
  rows: T[];
  empty?: string;
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="table-responsive">
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              {columns.map((column) => (
                <th className={column.className} key={column.key}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-center text-secondary py-4" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.id ?? index}`}>
                  {columns.map((column) => (
                    <td className={column.className} key={column.key}>
                      {column.render ? column.render(row) : (row[column.key] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Timeline({ events }: { events: { at: string; actor: string; action: string; detail?: string }[] }) {
  return (
    <ul className="list-group list-group-flush">
      {events.map((event, index) => (
        <li className="list-group-item d-flex gap-3" key={`${event.at}-${index}`}>
          <div className="text-secondary small" style={{ minWidth: 130 }}>
            {event.at}
          </div>
          <div className="flex-grow-1">
            <div>
              <strong>{event.action}</strong>
              <span className="text-secondary"> — {event.actor}</span>
            </div>
            {event.detail ? <div className="small text-secondary">{event.detail}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ApprovalReferenceFields({
  value,
  onChange,
}: {
  value: { ref: string; authority: string; date: string; remarks: string };
  onChange: (value: { ref: string; authority: string; date: string; remarks: string }) => void;
}) {
  const setField = (field: keyof typeof value, updatedValue: string) =>
    onChange({
      ...value,
      [field]: updatedValue,
    });

  return (
    <fieldset className="border rounded p-3 mb-3">
      <legend className="float-none w-auto px-2 fs-6 fw-semibold text-secondary">
        <i className="bi bi-shield-check me-1" />
        Manual Approval Reference
      </legend>

      <div className="row g-2">
        <div className="col-md-4">
          <label className="form-label small">Approval Reference No.</label>
          <input
            className="form-control form-control-sm"
            value={value.ref}
            onChange={(event) => setField("ref", event.target.value)}
            placeholder="e.g. VC/IT/2025/55"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label small">Approving Authority</label>
          <input
            className="form-control form-control-sm"
            value={value.authority}
            onChange={(event) => setField("authority", event.target.value)}
            placeholder="e.g. Director IT"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label small">Approval Date</label>
          <input
            className="form-control form-control-sm"
            type="date"
            value={value.date}
            onChange={(event) => setField("date", event.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label small">Remarks</label>
          <textarea
            className="form-control form-control-sm"
            rows={2}
            value={value.remarks}
            onChange={(event) => setField("remarks", event.target.value)}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function FileAttachmentList({ files = [] }: { files?: { name: string; size: string; uploadedBy: string; at: string }[] }) {
  const [addedItems, setAddedItems] = useState<{ name: string; size: string; uploadedBy: string; at: string }[]>([]);
  const items = [...files, ...addedItems];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Attachments</h6>
        <label className="btn btn-sm btn-outline-primary mb-0">
          <i className="bi bi-paperclip me-1" />
          Attach file
          <input
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              setAddedItems((current) => [
                ...current,
                {
                  name: file.name,
                  size: `${(file.size / 1024).toFixed(1)} KB`,
                  uploadedBy: "You",
                  at: new Date().toLocaleString(),
                },
              ]);
            }}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <div className="text-secondary small">No attachments.</div>
      ) : (
        <ul className="list-group list-group-flush">
          {items.map((file, index) => (
            <li className="list-group-item d-flex justify-content-between align-items-center px-0" key={`${file.name}-${index}`}>
              <div>
                <i className="bi bi-file-earmark me-2" />
                {file.name}
                <span className="text-secondary small ms-2">{file.size}</span>
              </div>
              <div className="small text-secondary">
                {file.uploadedBy} · {file.at}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ExportHandlers = {
  name?: string;
  onExportPdf?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
};

export function ExportButtons({
  name = "report",
  onExportPdf,
  onExportExcel,
}: ExportHandlers) {
  const fireStub = (format: "pdf" | "xlsx") => {
    if (typeof window === "undefined") return;
    alert(`Export queued: ${name}.${format}`);
  };

  return (
    <div className="btn-group">
      <button
        className="btn btn-sm btn-outline-danger"
        type="button"
        onClick={onExportPdf ?? (() => fireStub("pdf"))}
      >
        <i className="bi bi-file-earmark-pdf me-1" />
        PDF
      </button>
      <button
        className="btn btn-sm btn-outline-success"
        type="button"
        onClick={onExportExcel ?? (() => fireStub("xlsx"))}
      >
        <i className="bi bi-file-earmark-excel me-1" />
        Excel
      </button>
    </div>
  );
}
