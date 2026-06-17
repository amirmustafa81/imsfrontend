# IMS UI Audit

## Scope
This audit reviews IMS pages under `src/app/*/page.tsx` against:
- `/Users/amirmustafa/Documents/inventory/imsfrontend/DESIGN_SYSTEM.md`
- `/Users/amirmustafa/Documents/inventory/imsfrontend/COMPONENT_INVENTORY.md`

## 1) Inconsistent layouts

### Fully-compliant pages
- `src/app/page.tsx`
- `src/app/assets/page.tsx`
- `src/app/audit-logs/page.tsx`
- `src/app/master-data/page.tsx`
- `src/app/reports/page.tsx`
- `src/app/depreciation/page.tsx`
- `src/app/export-history/page.tsx`
- `src/app/import/page.tsx`
- `src/app/it-assets/page.tsx`
- `src/app/items/page.tsx`
- `src/app/lab/page.tsx`
- `src/app/projects/page.tsx`
- `src/app/stock/page.tsx`
- `src/app/tag-print-log/page.tsx`

### Legacy-pattern screens needing refactor
- `src/app/controlled-stationery/page.tsx`
- `src/app/inventory-receipts/page.tsx`
- `src/app/issues-returns/page.tsx`
- `src/app/transfers/page.tsx`
- `src/app/verification/page.tsx`
- `src/app/disposals/page.tsx`

These files currently build page composition outside the shared `PageHeader` / `FilterBar` / `DataTable` pattern and are visually inconsistent with Loveable-generated screens.

## 2) Inconsistent sidebar/topbar usage

Legacy screens render local “Dashboard” links and manual header cards instead of the shared shell top-level composition (`PageHeader` with global token/actions context):
- `controlled-stationery`
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`
- `disposals`

## 3) Inconsistent tables

Custom table wrappers are used in list views and nested expansion sections:
- `controlled-stationery`: batch table + serial table
- `inventory-receipts`: receipt list + receipt item inline detail table
- `issues-returns`: transaction list + item detail table
- `transfers`: transfer list + transfer item detail table
- `verification`: verification list + verification-item detail table
- `disposals`: disposal list + disposal-item expansion table

## 4) Inconsistent filter/search bars

Filters are implemented with raw grid/card blocks and local reset/refresh controls instead of `FilterBar` in:
- `controlled-stationery`
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`
- `disposals`

## 5) Inconsistent buttons

Button placement and density is inconsistent with shared list/form patterns:
- Token save controls are inside ad-hoc cards (`controlled-stationery`, `inventory-receipts`, `issues-returns`, `transfers`, `verification`, `disposals`).
- Action groups inside tables mix raw buttons and icon-only controls instead of consistently structured utility groups.
- Adjustment radio/inline controls in `issues-returns` are unique and not aligned with global button patterns.

## 6) Inconsistent badges/status labels

Local status color maps are defined on several screens instead of `StatusBadge`:
- `controlled-stationery`
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`
- `disposals`

## 7) Inconsistent forms

These screens keep bespoke form layout blocks (token entry + form in separate cards with local headings) and should move to `PageHeader`/`FilterBar` + shared form fragments where possible.

## 8) Inconsistent cards/KPI blocks

- KPI-style summaries are not shared where available (no `KpiCard` usage in legacy transaction/stock modules).
- List/summary sections use mixed card nesting and custom borders, unlike the newer standardized `card border-0 shadow-sm` pattern with shared component shells.

## 9) Missing/weak empty and loading states

- Several list pages show row-level “no data” rows but do not use standardized `EmptyState` cards for full-list empty states.
- Detail-loading states are inconsistent (alerts, text placeholders, and table spinners mixed across screens).
