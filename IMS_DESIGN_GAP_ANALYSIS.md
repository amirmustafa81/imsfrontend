# IMS Design Gap Analysis

## Objective
Align all IMS screens with Loveable IMS design contracts while preserving existing business logic and routes.

## Current implementation snapshot

- Shared UI primitives exist in `src/components/ims/index.tsx` and are used in dashboard, asset, audit-log, depreciation, master-data, and report screens.
- Legacy patterns remain in:
  - `src/app/controlled-stationery/page.tsx`
  - `src/app/inventory-receipts/page.tsx`
  - `src/app/issues-returns/page.tsx`
  - `src/app/transfers/page.tsx`
  - `src/app/verification/page.tsx`
  - `src/app/disposals/page.tsx`
- These pages are functionally complete but bypass shared components in critical layout areas.

## Gap matrix

| Area | Current | Target design pattern | Affected files | Priority | Effort | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| Page shell/header | Manual dashboard links and bespoke card headers | `PageHeader` with optional token/action controls | `controlled-stationery`, `inventory-receipts`, `issues-returns`, `transfers`, `verification`, `disposals` | High | Low-Medium | Replace top section with `PageHeader`; move token save action into header actions; preserve submit behavior |
| Filter layout | Grid cards with manual reset semantics | `FilterBar` with `form-control-sm`/`form-select-sm` and optional reset | Same six files | High | Low | Replace manual filter cards with `FilterBar` wrappers for each logical filter context |
| List tables | Custom table shells + raw expand rows | `DataTable` for primary list rendering | Same six files | High | Medium | Convert list views to `DataTable` columns; keep expansion tables as secondary detail blocks where needed |
| Status badges | Local badge color maps | Shared `StatusBadge` for normalized status terms | Same six files | Medium | Low | Use `StatusBadge` in all status columns; add minimal display mapping for local lowercase enums where necessary |
| Empty states | Inline row messages | Standardized `EmptyState` for whole-list empty cases | Same six files | Medium | Low | Use `EmptyState` for list-level empties where no rows are returned before table rendering |
| Form consistency | Form cards and action blocks duplicated per screen | Shared form-level sections and common spacing utilities | Same six files | Medium | Medium | Keep domain forms intact; normalize classnames (dense controls, row/gap patterns) and component wrappers |
| Manual approval blocks | Repeated approval field sets | `ApprovalReferenceFields` where a four-field approval block is present | `inventory-receipts`, `issues-returns`, `transfers`, `verification`, `disposals` | Medium | Low-Medium | Replace duplicate manual approval input groups with shared component, while preserving field names and payload mapping |
| Top navigation consistency | Route-local back links inside content | Shell topbar and breadcrumb/heading-only page context | All affected legacy files | Medium | Low | Remove local dashboard-link rows and align page actions with shell style |

## Recommended implementation sequence

1. **Schema-safe helper pass (no behavior changes)**  
   Add small status-display adapters where legacy enums differ from shared badge vocabulary.

2. **Page-level shell migration**  
   Replace manual headers and dashboard links with `PageHeader` in all six legacy pages.

3. **List/list-filter migration**  
   Replace list filters with `FilterBar`; convert primary tables to `DataTable`.

4. **Status badge normalization**  
   Introduce shared usage of `StatusBadge` and remove local color token objects where they duplicate behavior.

5. **Shared approval block migration**  
   Replace repetitive approval field groups with `ApprovalReferenceFields` where payload shape is preserved.

6. **Final verification**  
   Run lint/build checks and smoke-check pages in browser if required by the change scale.

## Expected result

- All six legacy pages visually match the Loveable patterns used by other IMS pages.
- Functional behavior remains unchanged (token persistence, filters, CRUD calls, expand/detail loading, post/delete actions).
- Design system adherence becomes coherent across:
  - page layout
  - sidebar/topbar usage
  - filters and search controls
  - table style
  - status badge semantics
  - empty state usage
