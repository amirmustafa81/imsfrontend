# IMS UI Audit (Design Consistency Audit)

**Scope:** `/Users/amirmustafa/Documents/inventory/imsfrontend/src/app`  
**Source of truth:** `DESIGN_SYSTEM.md`, `COMPONENT_INVENTORY.md`  
**Last updated:** 2026-06-17

## 1) Compliance Summary

- The shell (`src/components/ims/shell.tsx`) and shared components (`src/components/ims/index.tsx`) are used as the baseline across all production IMS routes.
- The accepted Loveable look is the dark-sidebar enterprise admin prototype represented by `src/components/ims/shell.tsx`, `src/components/ims/index.tsx`, and the Item Master reference screen.
- Current implementation uses the shared shell, page header, filter, table, status, KPI, timeline, attachment, export, and approval components where applicable.
- No route-level sidebar/topbar duplication or custom table system remains.

## 2) Page-by-page inventory map

### IA pages currently implemented

| Route | Page | PageHeader | FilterBar | DataTable | StatusBadge | EmptyState | KpiCard | Timeline | ApprovalReferenceFields | FileAttachmentList | ExportButtons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/assets` | `src/app/assets/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/audit-logs` | `src/app/audit-logs/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/controlled-stationery` | `src/app/controlled-stationery/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/depreciation` | `src/app/depreciation/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/disposals` | `src/app/disposals/page.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/master-data` | `src/app/master-data/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/inventory-receipts` | `src/app/inventory-receipts/page.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/issues-returns` | `src/app/issues-returns/page.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/transfers` | `src/app/transfers/page.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/verification` | `src/app/verification/page.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/reports` | `src/app/reports/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/import` | `src/app/import/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/export-history` | `src/app/export-history/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/items` | `src/app/items/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/lab` | `src/app/lab/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/projects` | `src/app/projects/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/stock` | `src/app/stock/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/tag-print-log` | `src/app/tag-print-log/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/it-assets` | `src/app/it-assets/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 3) Inconsistent layouts

- **Pattern found:** Most screens use:
  - `main.min-vh-100.bg-body-tertiary`
  - `div.container-fluid.p-4`
- **Current outliers:** none found in current route files.
- **Impact:** page spacing now matches the accepted shell pattern.

## 4) Inconsistent sidebar/topbar usage

- **Compliant:** No route renders a local top bar or local nav outside shell.
- **Source:** `src/components/ims/shell.tsx` remains the only navigation container.
- **Risk:** none.

## 5) Inconsistent tables

- `DataTable` used broadly across all operational list pages (`/assets`, `/verification`, `/issues-returns`, `/transfers`, `/disposals`, `/depreciation`, `/audit-logs`, `/master-data`, `/reports`, etc.).
- **One exception by design:** `src/app/reports/page.tsx` includes a `<table>` inside `exportPdf()` string template for print generation. This is not UI table rendering and should remain separated as export output logic.
- No new table style introduced; export table still uses raw HTML only for printer payload.

## 6) Inconsistent filters / search bars

- Shared `FilterBar` pattern used widely (`src/components/ims/index.tsx`).
- Report filters use compact controls; Item Master intentionally uses default-sized controls inside `FilterBar` to match the accepted screenshot reference.
- **Current outliers:** none.

## 7) Inconsistent buttons

- Shared styles are generally followed (`btn`, `btn-sm`, `btn-outline-*`, `btn-group`).
- Remaining action styling risk in `src/app/controlled-stationery/page.tsx` was already corrected to tone-based `btn-outline-*` class composition, no remaining color token mismatch expected after that fix.

## 8) Inconsistent badges / status labels

- `StatusBadge` now drives status chips across modules that expose state.
- Transaction/action type chips in `issues-returns`, `transfers`, and `disposals` are using `StatusBadge`.
- No active outlier remains that renders ad-hoc status chips outside the shared mapper for status-like values.

## 9) Inconsistent forms

- Forms consistently use Bootstrap form controls and `row`/`col` grid.
- `master-data`, receipt, transfer, disposal, and controlled-stock screens show consistent `form-control` / `form-select` usage.
- Placeholder routes intentionally do not render forms.

## 10) Inconsistent cards / KPI blocks

- `KpiCard` is used on dashboard.
- Card layout is consistently `card border-0 shadow-sm`.
- Placeholder routes use `PhaseTwoStub` and share a single card.
- No critical inconsistency in card structure.

## 11) Missing empty/loading states

- `DataTable` provides empty state rows on operational screens.
- `EmptyState` is used for non-operational states in multiple module pages (`disposals`, `transfers`, `issues-returns`, `verification`, `inventory-receipts`).
- Loading and error states are mostly communicated through top-level alerts (`message` / `error`) and are preserved.
- `FileAttachmentList` is rendered by reports for export artifact/attachment history.

## 12) Required component adoption status

- **Fully adopted and active:** `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `EmptyState`, `KpiCard`, `Timeline`, `ApprovalReferenceFields`, `FileAttachmentList`, `ExportButtons`.

## 13) IA modules represented

- **Implemented operationally/prototype-aligned:** Dashboard, Item Master, Assets, Controlled Stationery, Receipts, Issue/Return/Transfer, Disposal, Verification, Depreciation, Master Data, Reports, Audit Logs.
- **Planned placeholders using PhaseTwoStub:** Stock Balances, Project Inventory, Laboratory Inventory, IT Assets, Tag Print Log, Import, Export History.
- Placeholder pages follow `PageHeader + PhaseTwoStub` pattern and remain intentionally non-operational per current product scope.
