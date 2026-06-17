# IMS Design Gap Analysis

## Objective

Use `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md` as implementation source and align all IMS screens under `src/app` while preserving business logic and routes.

## Current implementation status (high confidence)

- The shared component model (`PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `EmptyState`, `KpiCard`, `Timeline`, `ApprovalReferenceFields`, `ExportButtons`) is present and used in most production pages.
- IA shell and navigation are centralized in `src/components/ims/shell.tsx`.
- Remaining implementation gap is now limited to:
  1. Layout wrapper consistency (`p-4` placement),
  2. `reports` filter control density,
  3. `FileAttachmentList` adoption in an active route.

## Gap matrix

| Gap | Current pattern | Target pattern | Affected files | Priority | Effort | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| Top-level spacing is inconsistent | Many pages apply `p-4` on `<main>` and only `container-fluid` on wrapper | Normalize to `main.min-vh-100.bg-body-tertiary` + `container-fluid.p-4` like dashboard and audit log | `src/app/assets/page.tsx`, `src/app/controlled-stationery/page.tsx`, `src/app/depreciation/page.tsx`, `src/app/disposals/page.tsx`, `src/app/inventory-receipts/page.tsx`, `src/app/issues-returns/page.tsx`, `src/app/master-data/page.tsx`, `src/app/reports/page.tsx`, `src/app/stock/page.tsx`, `src/app/tag-print-log/page.tsx`, `src/app/verification/page.tsx`, `src/app/transfers/page.tsx`, `src/app/it-assets/page.tsx`, `src/app/projects/page.tsx`, `src/app/lab/page.tsx`, `src/app/import/page.tsx`, `src/app/items/page.tsx`, `src/app/export-history/page.tsx` | Medium | Low | Update classnames for these routes; no logic changes. |
| Filter controls in reports are larger than design | `renderFilterInput()` uses `form-control` and `renderLookupSelect()` uses `form-select` | Use compact `form-control-sm` and `form-select-sm` inside report `FilterBar` | `src/app/reports/page.tsx` | High | Low | Switch control classes; keep same event handlers and payload builder. |
| `FileAttachmentList` not used | No route currently renders `FileAttachmentList` | Render it where report artifacts are generated/attached | `src/app/reports/page.tsx` | Medium | Low | Add a local attachment-history state and render `<FileAttachmentList files={...} />` alongside export action outcomes. |

## Refactor plan

### Stage 1 (Safety + Visibility)

- Keep `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md` as immutable.
- Update spacing classes on identified screens to enforce a single top-level padding contract.
- Reduce report filter control density to match shared `FilterBar` style.

### Stage 2 (Component coverage completion)

- Add shared `FileAttachmentList` usage in reports, using export actions to append an attachment metadata row (filename/size/uploader/time).
- Keep component read-only behavior and local-only state so API contracts are not changed.

### Stage 3 (Validation)

- Run `npm run lint` and `npm run typecheck`.
- Re-open audit matrix and confirm no other pages deviate from the new layout contract.
- Re-generate `IMS_UI_AUDIT.md` if any new modules are added.

## Verification checklist

- `DESIGN_SYSTEM.md` tokens and patterns remain source of truth (no custom semantic colors introduced).
- No route adds new business API logic.
- No new route-level top bars or side navigation components.
- Shared components are preferred over local equivalents.
- Every active route uses shell-consistent spacing and shared patterns above.

