# IMS UI Audit

Source: `/Users/amirmustafa/Documents/inventory/imsfrontend`

Scope: all production IMS pages under `src/app` excluding `layout.tsx` and test files.

## 1) Current compliance status

### Core IA coverage
- Dashboard: `src/app/page.tsx`
- Item Master: `src/app/items/page.tsx`
- Receipts / GRN: `src/app/inventory-receipts/page.tsx`
- Stock Balances: `src/app/stock/page.tsx`
- Issue / Return / Transfer: `src/app/issues-returns/page.tsx`, `src/app/transfers/page.tsx`
- Fixed Asset Register: `src/app/assets/page.tsx`
- Tag Print Log: `src/app/tag-print-log/page.tsx`
- Project Inventory: `src/app/projects/page.tsx`
- Laboratory Inventory: `src/app/lab/page.tsx`
- IT Assets: `src/app/it-assets/page.tsx`
- Controlled Stationery: `src/app/controlled-stationery/page.tsx`
- Physical Verification: `src/app/verification/page.tsx`
- Disposal / Write-Off: `src/app/disposals/page.tsx`
- Audit Log: `src/app/audit-logs/page.tsx`
- Reports: `src/app/reports/page.tsx`
- Masters / Admin Settings: `src/app/master-data/page.tsx`
- Planned placeholder routes: `import`, `export-history`

### Result at a glance
- **Most operational screens are now aligned** with the Loveable IMS system.
- Remaining variances are intentionally low-impact and scoped to helper-level details.

## 2) Inconsistent layouts

- ✅ Active pages use shared shell layout and `PageHeader` consistently.
- ✅ Main layout pattern is `main.min-vh-100.bg-body-tertiary` with `container-fluid` and shared card structure.
- ❗ Dashboard `src/app/page.tsx` uses `container-fluid p-4` with a shell-consistent main class; the `p-4` is applied on the container, not `<main>`, which is acceptable but slightly different from the default style.

## 3) Inconsistent sidebar/topbar usage

- ✅ No local route-nav back-links were found in page bodies.
- ✅ Page entry points use shell navigation context (no duplicate topbar/sidebar construction).

## 4) Inconsistent tables

- ✅ Primary tables in operational pages are rendered via `DataTable`.
- ✅ List empties use either `DataTable` empty message or `EmptyState`.
- ✅ Expanded detail tables were normalized to `DataTable` in `inventory-receipts/page.tsx`.
- ℹ Only non-UI `<table>` usage left is report print HTML construction in `reports/page.tsx`.

## 5) Inconsistent filters/search bars

- ✅ Filter-heavy pages use `FilterBar` with compact `form-control-sm`/`form-select-sm` controls.
- ✅ Reset behavior is consistently available in filter blocks where filters are mutable.

## 6) Inconsistent buttons

- ✅ Action buttons follow Bootstrap utility hierarchy (`btn`, `btn-sm`, `btn-outline-*`, `btn-group`).
- ⚠️ `controlled-stationery/page.tsx` still derives action button colors from a local map (`serialActionClass`) to preserve business semantics.

## 7) Inconsistent badges/status labels

- ✅ Status display is now centralized through `StatusBadge` in all status-heavy pages:
  - `page.tsx`
  - `assets/page.tsx`
  - `audit-logs/page.tsx` (status surface not present)
  - `verification/page.tsx`
  - `disposals/page.tsx`
  - `inventory-receipts/page.tsx`
  - `issues-returns/page.tsx` (transaction type now represented through badge component)
  - `controlled-stationery/page.tsx`
  - `depreciation/page.tsx`
  - `master-data/page.tsx`
  - `reports/page.tsx`
  - `transfers/page.tsx`
- ⚠️ A non-status quantity badge in `controlled-stationery/page.tsx` still uses `text-bg-light` for numeric summary.

## 8) Inconsistent forms

- ✅ Forms use shared form utility classes and shared approval block (`ApprovalReferenceFields`) in transactional workflows.
- ✅ Dense forms use compact controls and common spacing patterns.
- ✅ Placeholder routes use `PhaseTwoStub` for intentionally incomplete functionality.

## 9) Inconsistent cards / KPI blocks

- ✅ KPI and summary blocks use `KpiCard` on dashboard.
- ✅ Repeated card surfaces follow `card border-0 shadow-sm`.
- ✅ Placeholder routes intentionally use shared `PhaseTwoStub` + `PageHeader`.

## 10) Missing empty/loading states

- ✅ Empty states are present for major operational lists.
- ✅ Expanded details show explicit loading/empty handling before detail table rendering.

## 11) Component-inventory adoption status

- `PageHeader`: all non-test screens.
- `FilterBar`: all filter-heavy screens.
- `DataTable`: all active list screens.
- `StatusBadge`: all operational status screens.
- `EmptyState`: all applicable screens and placeholder modules.
- `KpiCard`: dashboard.
- `Timeline`: not yet used (no active timeline view in current screens).
- `ApprovalReferenceFields`: `inventory-receipts`, `issues-returns`, `transfers`, `disposals`.
- `FileAttachmentList`: currently not used in existing pages.
- `ExportButtons`: `reports/page.tsx`.

## 12) Prioritized follow-up gaps

1. **Low** – standardize remaining custom action color helpers (e.g., `controlled-stationery/page.tsx`) to a shared utility pattern if design consistency is tightened further.
2. **Low** – add explicit dashboard empty state treatment if/when dynamic metrics are sourced live.
3. **Low** – introduce `FileAttachmentList` only when an attachment workflow is added to IMS screens.
