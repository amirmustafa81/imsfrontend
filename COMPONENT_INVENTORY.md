# IMS Component Inventory (Reusable `src/components/ims` Library)

Source: `/Users/amirmustafa/Documents/inventory/imsfrontend/src/components/ims/index.tsx`  
Import path in screens: `import { ... } from "@/components/ims"`  
This is the canonical component surface to use for new IMS screens unless an explicit reason requires a new component.

Use this inventory as default for future screens unless an explicit reason requires a new component.

## PageHeader

- **Props**
  - `title: string`
  - `subtitle?: string`
  - `actions?: ReactNode`
  - `breadcrumbs?: { label: string; to?: string }[]`
- **Output**
  - `mb-3 d-flex flex-wrap justify-content-between align-items-end gap-2 border-bottom pb-2`
  - Optional bootstrap breadcrumb row when `breadcrumbs` exists
- **Use for**
  - All top-of-page headings and actions.
- **Examples**
  - Dashboard/action title and button links
  - Token entry action blocks used in many pages
  - Consistent spacing and bottom separator between header and body

## KpiCard

- **Props**
  - `icon: string` (Bootstrap icon class without `bi-`)
  - `label: string`
  - `value: string | number`
  - `hint?: string`
  - `tone?: "primary" | "success" | "warning" | "danger" | "info" | "secondary"`
- **Output**
  - `card border-0 shadow-sm h-100`
  - icon tile: `rounded bg-{tone}-subtle text-{tone}` at `48x48`
  - numeric value with `fs-4 fw-bold`
- **Use for**
  - Summary KPI blocks on home and dashboard-like screens.

## StatusBadge

- **Props**
  - `status: string`
- **Behavior**
  - Normalizes input via internal map (`Draft`, `Posted`, `Missing`, etc.) then maps to
    bootstrap `badge` class colors.
- **Output**
  - `<span className="badge {tone}">` where tone comes from the status map
- **Current statuses covered**
  - Draft, Posted, In Store, Issued, In Use, Under Repair, Missing/Under Investigation,
    Damaged, Obsolete, Disposed, Written Off, Partially Accepted, Cancelled, Found, Active,
    Closed, etc.
- **Use for**
  - Status columns in tables to keep color semantics centralized.

## EmptyState

- **Props**
  - `icon?: string` (default `bi-inbox`)
  - `title: string`
  - `message?: string`
  - `action?: ReactNode`
- **Output**
  - `card border-0 shadow-sm` with centered icon/title/message
- **Use for**
  - Planned modules and missing-data screens.

## PhaseTwoStub

- **Props**
  - `title: string`
  - `description: string`
- **Output**
  - wraps `EmptyState` with icon `bi-tools`, title suffixed with `- Coming in Phase 2`, and a warning badge
- **Use for**
  - Modules not fully delivered in current phase but visible in navigation.

## FilterBar

- **Props**
  - `children: ReactNode`
  - `onReset?: () => void`
- **Output**
  - `card border-0 shadow-sm mb-3`
  - child grid row: `row g-2 align-items-end`
  - optional reset button: `btn btn-sm btn-outline-secondary`
- **Use for**
  - Search/filter rows above list tables across all IMS modules.

## DataTable

- **Props**
  - `columns: { key: string; header: string; render?: (row) => ReactNode; className?: string }[]`
  - `rows: T[]`
  - `empty?: string`
- **Output**
  - `card border-0 shadow-sm`
  - `table-responsive` wrapper
  - `table table-sm table-hover mb-0 align-middle` with `table-light` head
- **Behavior**
  - Uses `columns.render(row)` when present, otherwise prints `row[column.key]`.
  - Empty list shows centered message in a full-width row.
- **Use for**
  - All list/grid data views where row actions or status rendering is needed.

## Timeline

- **Props**
  - `events: { at: string; actor: string; action: string; detail?: string }[]`
- **Output**
  - `list-group list-group-flush` with actor/action rows and timestamps
- **Use for**
  - Audit style event sequencing blocks.

## ApprovalReferenceFields

- **Props**
  - `value: { ref; authority; date; remarks }`
  - `onChange: (value) => void`
- **Output**
  - `<fieldset className="border rounded p-3 mb-3">` with legend and four form fields
  - includes `Approval Reference No.`, `Approving Authority`, `Approval Date`, `Remarks`
- **Use for**
  - Receipt/transfer/disposal forms requiring manual approval metadata.

## FileAttachmentList

- **Props**
  - `files?: { name; size; uploadedBy; at }[]`
- **Output**
  - cardless list with attach button (`label.btn btn-sm btn-outline-primary`)
  - file rows include name, size, uploader and timestamp
- **Use for**
  - Upload preview lists.

## ExportButtons

- **Props**
  - `name?: string` (default `report`)
  - `onExportPdf?: () => void | Promise<void>`
  - `onExportExcel?: () => void | Promise<void>`
- **Output**
  - `btn-group` with:
    - `btn btn-sm btn-outline-danger` (PDF)
    - `btn btn-sm btn-outline-success` (Excel)
- **Behavior**
  - If handlers are missing, buttons show stub alert `Export queued: {name}.{ext}`
- **Use for**
  - Report and list export actions in screens that produce exports.

## Adoption notes

- Prefer importing all shared UI from:
  - `import { PageHeader, ... } from "@/components/ims";`
- Keep bootstrap `btn`, `card`, `table`, `form-control`, `form-select`,
  `badge`, `d-flex`, `row`, and spacing utilities as-is.
- Avoid introducing new layout or visual abstractions when the existing shared
  component or bootstrap utility already covers the use case.

## Current screen usage

- `PageHeader`: widely used in dashboard and report-like pages (`assets`, `depreciation`, `master-data`, `reports`, `audit-logs`, phase-two placeholders)
- `KpiCard`: dashboard (`/`), `Kpi` style summaries.
- `StatusBadge`: `assets`, `depreciation`, `reports`
- `FilterBar`: `assets`, `depreciation`, `audit-logs`, `master-data`, `reports`
- `DataTable`: `assets`, `depreciation`, `audit-logs`, `master-data`, `reports`, dashboard
- `EmptyState`, `PhaseTwoStub`: `/export-history`, `/import`, `/it-assets`, `/items`, `/lab`, `/projects`, `/stock`, `/tag-print-log`
- `Timeline`, `ApprovalReferenceFields`, `FileAttachmentList`, `ExportButtons`: reusable but currently consumed primarily by `reports` and form screens as needed.
