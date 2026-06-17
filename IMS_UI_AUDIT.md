# IMS UI Audit (Design Consistency Audit)

**Scope:** `/Users/amirmustafa/Documents/inventory/imsfrontend/src/app`  
**Source of truth:** `DESIGN_SYSTEM.md`, `COMPONENT_INVENTORY.md`  
**Last updated:** 2026-06-17

## 1) Compliance Summary

- The shell (`src/components/ims/shell.tsx`) and shared components (`src/components/ims/index.tsx`) are used as the baseline across all production IMS routes.
- Most operational modules now map to the Loveable patterns in `DESIGN_SYSTEM.md`.
- Remaining issues are limited and mechanical:
  1. uneven page spacing application (`main` vs `container-fluid`),
  2. `reports` filter inputs using default-sized controls instead of compact `-sm` variants in the shared `FilterBar` pattern,
  3. `FileAttachmentList` currently not yet consumed by an active route.

## 2) Page-by-page inventory map

### IA pages currently implemented

| Route | Page | PageHeader | FilterBar | DataTable | StatusBadge | EmptyState | KpiCard | Timeline | ApprovalReferenceFields | FileAttachmentList | ExportButtons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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
| `/reports` | `src/app/reports/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/import` | `src/app/import/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/export-history` | `src/app/export-history/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/items` | `src/app/items/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/lab` | `src/app/lab/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/projects` | `src/app/projects/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/stock` | `src/app/stock/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/tag-print-log` | `src/app/tag-print-log/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/it-assets` | `src/app/it-assets/page.tsx` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 3) Inconsistent layouts

- **Pattern found:** Most screens use:
  - `main.min-vh-100.bg-body-tertiary`
  - `div.container-fluid.p-4`
- **Current outliers:** Several routes apply `p-4` on `<main>` instead of the `container-fluid` wrapper, e.g.:
  - `src/app/assets/page.tsx`
  - `src/app/control...` (see `src/app/controlled-stationery/page.tsx`)
  - `src/app/reports/page.tsx`
  - placeholder routes (`src/app/stock/page.tsx`, `src/app/import/page.tsx`, etc.)
- **Impact:** Spacing inconsistency across top-level layout across IA scope; visual alignment drifts between pages.

## 4) Inconsistent sidebar/topbar usage

- **Compliant:** No route renders a local top bar or local nav outside shell.
- **Source:** `src/components/ims/shell.tsx` remains the only navigation container.
- **Risk:** none.

## 5) Inconsistent tables

- `DataTable` used broadly across all operational list pages (`/assets`, `/verification`, `/issues-returns`, `/transfers`, `/disposals`, `/depreciation`, `/audit-logs`, `/master-data`, `/reports`, etc.).
- **One exception by design:** `src/app/reports/page.tsx` includes a `<table>` inside `exportPdf()` string template for print generation. This is not UI table rendering and should remain separated as export output logic.
- No new table style introduced; export table still uses raw HTML only for printer payload.

## 6) Inconsistent filters / search bars

- Shared `FilterBar` pattern used widely (`src/components/ims/index.tsx`), including compact control classes.
- **Outlier:** In `src/app/reports/page.tsx`:
  - `renderFilterInput()` uses `form-control` (not `form-control-sm`),
  - `renderLookupSelect()` uses `form-select` (not `form-select-sm`).
- **Impact:** Denser filter rows now appear slightly taller and visually heavier than other route filters.

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
- No critical inconsistency in card structure; only spacing wrapper differs (see section 3).

## 11) Missing empty/loading states

- `DataTable` provides empty state rows on operational screens.
- `EmptyState` is used for non-operational states in multiple module pages (`disposals`, `transfers`, `issues-returns`, `verification`, `inventory-receipts`).
- Loading and error states are mostly communicated through top-level alerts (`message` / `error`) and are preserved.
- `FileAttachmentList` is not yet rendered by any route, so no attachment-empty behavior exists yet.

## 12) Required component adoption status

- **Fully adopted and active:** `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `EmptyState`, `Timeline`, `ApprovalReferenceFields`, `ExportButtons`.
- **Not yet adopted in active flow:** `FileAttachmentList` (not used in any route yet).

## 13) IA modules represented

- **Implemented operationally:** Dashboard, Assets, Controlled Stockery, Receipts, Issue/Return/Transfer, Disposal, Verification, Depreciation, Master Data, Reports, Audit Logs.
- **Planned placeholders using PhaseTwoStub:** Item Master, Stock Balances, Project Inventory, Laboratory Inventory, IT Assets, Tag Print Log, Import, Export History.
- Placeholder pages follow `PageHeader + PhaseTwoStub` pattern and remain intentionally non-operational per current product scope.
