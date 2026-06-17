# IMS Design Gap Analysis

## Objective

Use `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md` as implementation source and keep the IMS frontend aligned to shared primitives while preserving business logic.

## Current implementation status (high confidence)

- Shared shell (`src/components/ims/shell.tsx`) and shared UI primitives are in active use across route-level pages.
- Route wrappers, filters, tables, and status semantics follow the design system.
- No documented visual-system gaps are currently known in implemented screens.

## Gap matrix

| Gap | Current pattern | Target pattern | Affected files | Priority | Effort | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Shell parity | Dark-sidebar shell with compact topbar/search | Use `src/components/ims/shell.tsx` consistently | `src/components/ims/shell.tsx`, `src/app/globals.css` | Medium | Ongoing | ✅ Complete |
| Shared component usage | Direct/custom table/nav patterns | Use `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge` | `src/app/**/*.tsx` | High | Ongoing | ✅ Complete |
| Layout consistency | Route-specific wrappers and spacing | Use `main.min-vh-100.bg-body-tertiary` + `container-fluid.p-4` | `src/app/**/*.tsx` | High | Ongoing | ✅ Complete |
| Report export artifacts | Export actions without attachment trace | Use `ExportButtons` + `FileAttachmentList` where relevant | `src/app/reports/page.tsx` | Low | Ongoing | ✅ Complete |

## Verification checklist

- `DESIGN_SYSTEM.md` and `COMPONENT_INVENTORY.md` remain source of truth for class-level patterns and component usage.
- No route-level top bars or duplicate nav containers.
- Shared components preferred for all operational list/edit surfaces.
- Periodic re-run of `npm run lint`, `npm run typecheck`, and `npm run test -- --run` after future UI additions.
