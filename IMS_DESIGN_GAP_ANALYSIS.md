# IMS Design Gap Analysis

## Objective

Use `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md` as implementation source and align all IMS screens under `src/app` while preserving business logic and routes.

## Current implementation status (high confidence)

- The shared component model (`PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `EmptyState`, `KpiCard`, `Timeline`, `ApprovalReferenceFields`, `FileAttachmentList`, `ExportButtons`) is present and used in production pages where each pattern applies.
- IA shell and navigation are centralized in `src/components/ims/shell.tsx`.
- The accepted Loveable visual target is the dark-sidebar enterprise admin prototype, now implemented through shared shell/component styles and the Item Master reference screen.
- Remaining work is future module completion only; no open visual-system gap is known in the current route set.

## Gap matrix

| Gap | Current pattern | Target pattern | Affected files | Priority | Effort | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| Accepted screenshot shell not represented | Previous shell used a light sidebar/topbar pattern | Dark sidebar, topbar search, workspace selector, notification, user menu | `src/components/ims/shell.tsx`, `src/app/globals.css`, `DESIGN_SYSTEM.md` | Complete | Implemented | Shell and documentation updated to accepted prototype pattern. |
| Item Master still placeholder | `src/app/items/page.tsx` rendered `PhaseTwoStub` | Reference Item Master screen with breadcrumbs, filters, table, badges, and active row | `src/app/items/page.tsx` | Complete | Implemented | Route now uses `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`. |
| Top-level spacing inconsistent | Some pages applied `p-4` on `<main>` | `main.min-vh-100.bg-body-tertiary` + `container-fluid.p-4` | `src/app/**/*.tsx` | Complete | Implemented | All app routes follow the shared wrapper pattern. |
| Report filters and attachments incomplete | Report filters were larger than target and attachments component unused | Shared `FilterBar` density plus `FileAttachmentList` for export artifacts | `src/app/reports/page.tsx` | Complete | Implemented | Report page uses compact filters and attachment/export artifact list. |

## Refactor plan

### Stage 1 (Safety + Visibility) - Complete

- Updated spacing classes on identified screens to enforce a single top-level padding contract.
- Reduced report filter control density to match shared `FilterBar` style.
- Updated `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md` to reflect the accepted screenshot pattern.

### Stage 2 (Component coverage completion) - Complete

- Added shared `FileAttachmentList` usage in reports, using export actions to append an attachment metadata row (filename/size/uploader/time).
- Converted Item Master to the accepted reference page using shared IMS components.
- Kept component behavior local-only where backend contracts do not yet exist.

### Stage 3 (Validation) - Complete

- Ran `npm run lint` and `npm run typecheck`.
- Visually checked `/items` in the local browser.
- Re-opened audit matrix and confirmed current route coverage.

## Verification checklist

- `DESIGN_SYSTEM.md` tokens and patterns remain source of truth (no custom semantic colors introduced).
- No route adds new business API logic.
- No new route-level top bars or side navigation components.
- Shared components are preferred over local equivalents.
- Every active route uses shell-consistent spacing and shared patterns above.
