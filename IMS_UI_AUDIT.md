# IMS UI Audit (Design Consistency Audit)

**Scope:** `/Users/amirmustafa/Documents/inventory/imsfrontend/src/app`  
**Source of truth:** `DESIGN_SYSTEM.md`, `COMPONENT_INVENTORY.md`  
**Last updated:** 2026-06-17

## 1) Compliance Summary

- The shell (`src/components/ims/shell.tsx`) and shared components (`src/components/ims/index.tsx`) are used across all IMS routes.
- All implemented routes use the dark-sidebar prototype layout with consistent token-driven styling.
- No route-level custom sidebar or alternate table implementation is used.

## 2) Page-by-page inventory map

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
| `/import` | `src/app/import/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/export-history` | `src/app/export-history/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/items` | `src/app/items/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/lab` | `src/app/lab/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/projects` | `src/app/projects/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/stock` | `src/app/stock/page.tsx` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/tag-print-log` | `src/app/tag-print-log/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/it-assets` | `src/app/it-assets/page.tsx` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## 3) Current implementation status

- No route-level sidebar/topbar duplication.
- Shared shell + shared component primitives are consistently used.
- No open visual-system gaps discovered in the currently implemented route set.
