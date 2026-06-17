# IMS UI Audit

Scope: `src/app` pages in `/Users/amirmustafa/Documents/inventory/imsfrontend` compared against:
- `/Users/amirmustafa/Documents/inventory/imsfrontend/DESIGN_SYSTEM.md`
- `/Users/amirmustafa/Documents/inventory/imsfrontend/COMPONENT_INVENTORY.md`

This audit intentionally captures current code state before final legacy refactor.

## 1) Inconsistent layouts

Pages not using canonical shell page header pattern:

- `src/app/inventory-receipts/page.tsx`
  - Uses local page composition (`<Link href=\"/\"></Link>` backlink, custom token card, custom top title card)
- `src/app/issues-returns/page.tsx`
  - Uses local page composition + custom token and title cards
- `src/app/transfers/page.tsx`
  - Uses local page composition + custom token and title cards
- `src/app/verification/page.tsx`
  - Uses local page composition + custom token and title cards
- `src/app/disposals/page.tsx`
  - Uses local page control surface without canonical `PageHeader` and places token form in filter row

Compliant routes currently using canonical header pattern:
- `assets`, `audit-logs`, `controlled-stationery`, `depreciation`, `export-history`, `import`, `it-assets`, `items`, `lab`, `master-data`, `projects`, `reports`, `stock`, `tag-print-log`

## 2) Inconsistent sidebar/topbar usage

Manual dashboard backlink behavior remains in:
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`

These are local navigation hints inside page content and should be removed in favor of shell topbar and `PageHeader` actions.

## 3) Inconsistent tables

These screens still use custom table shells for list and expansion rows:
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`
- `disposals`

Their list shells currently use raw `<table>` with locally defined rows and custom empty messages.

## 4) Inconsistent filters/search bars

Filter/search UX is still local card-based in:
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`
- `disposals`

Controls are inconsistent (mixed full-size controls, varying reset behavior, local spacing).

## 5) Inconsistent buttons

Button hierarchy and spacing is mixed in all five screens:
- Save token actions are in separate cards/forms.
- Action button groups use mixed variants and spacing patterns compared with page standards.

## 6) Inconsistent badges/status labels

Local badge maps/classes remain in:
- `inventory-receipts` (`statusColors` map)
- `issues-returns` (`typeColors`, `statusColors`)
- `transfers` (inline ternary)
- `verification` (`verificationStatuses` + custom status cell)
- `disposals` (`statusClass` + custom item status tags)

## 7) Inconsistent forms

- All five pages still use local approval/reference field groups instead of `ApprovalReferenceFields`.
- Form density is inconsistent with system defaults (`form-control`/`form-select` over `form-control-sm` and `form-select-sm` in many places).
- API token save pattern differs from shared header action pattern.

## 8) Inconsistent cards/KPI blocks

- Shared `PageHeader` and `FilterBar` are not consistently applied in these five operational screens.
- KPI blocks are not the primary issue here, but these pages do not use the canonical shared action/header card composition used by other pages.

## 9) Missing empty/loading states

- Empty list states exist, but are not using shared `DataTable` empty style consistently.
- Expansion-loading/error text is custom and not standardized.

## 10) Missing design-system component usage

The following component patterns are currently absent in the five remaining screens:
- `FilterBar`
- `DataTable`
- `ApprovalReferenceFields`
- `StatusBadge` (for row status fields)
- `PageHeader`
- `EmptyState` for full section empties

`Timeline`, `FileAttachmentList`, and `ExportButtons` are also not used in these remaining operational routes.

## Remaining target before completion

Bring the following screens fully aligned:
- `inventory-receipts`
- `issues-returns`
- `transfers`
- `verification`
- `disposals`

without changing backend calls, route shape, or business behavior.
