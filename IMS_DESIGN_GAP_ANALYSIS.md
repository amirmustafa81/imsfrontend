# IMS Design Gap Analysis

## Objective

Align all active IMS screens with the Loveable source-of-truth system in:

- `DESIGN_SYSTEM.md`
- `COMPONENT_INVENTORY.md`

while keeping business logic, routes, and API behavior unchanged.

## Current implementation

### Completed alignment

- Shell and page entry structure is standardized via `layout.tsx`, `PageHeader`, shared spacing, and card grouping.
- Shared components now used broadly:
  - `PageHeader` in all pages
  - `FilterBar` in all filter-heavy pages
  - `DataTable` for all operational lists
  - `StatusBadge` in all status-heavy views
  - `EmptyState` for list-level empties
  - `ApprovalReferenceFields` in transactional approval flows
  - `ExportButtons` in reports export view
- Expanded item/detail tables in active modules use `DataTable`, including `inventory-receipts/page.tsx`.
- Dashboard status rendering has been moved to `StatusBadge`.

### Remaining gaps

- `controlled-stationery/page.tsx` still contains a helper-driven action-color map (`serialActionClass`) and one non-standard badge style (`text-bg-light`) for quantity summary.
- `Timeline` and `FileAttachmentList` are not yet mapped to active flows.

## Gap matrix

| Item | Current implementation | Target pattern | Affected files | Priority | Effort | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| Shell spacing consistency | Minor variation (`p-4` on container in dashboard page only) | Optional full-page pattern standardization | `src/app/page.tsx` | Low | Very low | Optional: move/normalize spacing if strict parity is required. |
| Action button semantics | Local action color map plus one neutral badge helper | Keep business semantics, but align to shared utility tone map | `src/app/controlled-stationery/page.tsx` | Medium | Low | Replace custom summary badge tone and map action styles to explicit `btn-outline-*` classes. |
| Component coverage | `Timeline` / `FileAttachmentList` not yet used in live flows | Adopt when corresponding flows are implemented | `N/A` (future) | Medium | Medium (on feature introduction) | Add in future stories where timeline/attachment UI is required; add tests and docs at that time. |
| Table source consistency | Non-UI report export creates `<table>` HTML string | Keep for export only | `src/app/reports/page.tsx` | Low | None | No code change needed; this is not a UI table component. |

## Recommended staged implementation

### Stage 1 (Complete)

1. Audit current pages against the design contracts.
2. Refactor active screens to shared layout primitives (`PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `EmptyState`, `ApprovalReferenceFields`).
3. Verify with lint/typecheck.

### Stage 2 (Polish)

1. Tidy remaining helper-driven visual exceptions in `controlled-stationery/page.tsx` if strict visual parity is required.
2. Keep business behavior and endpoints untouched.

### Stage 3 (Future adoption)

1. Wire `Timeline` where chronological audit/action streams are presented.
2. Wire `FileAttachmentList` when attachments become mandatory for a live IMS workflow.

## Verification plan

- Re-run `npm run lint` and `npm run typecheck` after each stage.
- For each page in IA scope, confirm:
  - shell + header pattern
  - shared components for tables/filters/status
  - existing API/form logic preserved
  - no route changes

