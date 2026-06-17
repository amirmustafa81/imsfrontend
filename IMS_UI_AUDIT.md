# IMS UI Audit

Scope: `src/app` pages in `/Users/amirmustafa/Documents/inventory/imsfrontend` compared against `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md`.

## 1) Current inconsistent screens

The following pages still bypass shared IMS UI components and do not fully match the documented system:

- `src/app/issues-returns/page.tsx`
- `src/app/transfers/page.tsx`
- `src/app/verification/page.tsx`
- `src/app/disposals/page.tsx`

`src/app/inventory-receipts/page.tsx` has already been refactored and is excluded from the pending gap list.

## 2) Inconsistent layouts

- Missing `PageHeader` at the page top.
- Manual dashboard backlink cards (`<Link href="/" ...>Dashboard</Link>`) still in content body.
- Token controls are implemented in local cards instead of a shared header action area.

## 3) Inconsistent sidebar/topbar usage

- Route-local navigation hints remain in page content.
- No shared `PageHeader`/actions pattern used consistently with shell conventions.

## 4) Inconsistent tables

- Primary list tables are custom `<table>` markup instead of `DataTable`.
- List empty-state copy is custom and not consistently rendered using `EmptyState`.
- Expanded detail rows are kept as inline custom table rows.

## 5) Inconsistent filters/search bars

- Filter/search controls are local card blocks instead of `FilterBar`.
- Mixed control density (`form-control`, `form-select`) and no shared reset style.

## 6) Inconsistent buttons

- Action grouping and scale vary by page (full/compact mix without consistent pattern).
- Token/post/delete button styling is inconsistent with other aligned screens.

## 7) Inconsistent badges/status labels

- Local status maps still exist (`statusColors`, `typeColors`, etc.).
- Row statuses use custom class names and are not consistently mapped through `StatusBadge`.

## 8) Inconsistent forms

- Approval reference fields are hand-built in the four legacy screens (`manual_approval_ref`, `manual_approved_by`, `manual_approval_date`).
- Form control classes are not consistently compact (`form-control-sm`, `form-select-sm`) for dense sections.

## 9) Inconsistent cards / KPI blocks

- Legacy pages use custom section headers and card composition that diverges from the aligned shell-first layout pattern.

## 10) Missing empty/loading states

- No shared `EmptyState` in list views.
- Inline loading/error strings vary and are not standardized.

## 11) Component inventory alignment state

Not yet consistently used in the four legacy screens:

- `PageHeader`
- `FilterBar`
- `DataTable`
- `StatusBadge`
- `EmptyState`
- `ApprovalReferenceFields`

(`KpiCard`, `Timeline`, `FileAttachmentList`, `ExportButtons` are not currently required in these pages by existing flows.)

## 12) IA coverage check

The IA surfaces are present in routing:

- Dashboard
- Item Master
- Receipts / GRN
- Stock Balances
- Issue / Return / Transfer
- Fixed Asset Register
- Tag Print Log
- Project Inventory
- Laboratory Inventory
- IT Assets
- Controlled Stationery
- Physical Verification
- Disposal / Write-Off
- Audit Log
- Reports
- Masters / Admin Settings

Current backlog is fully limited to four pages above.
