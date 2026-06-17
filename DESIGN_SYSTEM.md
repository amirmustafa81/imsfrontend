# IMS Design System (Loveable-Generated UI Source of Truth)

This document captures the current UI system used across the IMS frontend at
`/Users/amirmustafa/Documents/inventory/imsfrontend`.

Note: the file names you listed from the attachment (`styles.css`, `.lovable/plan.md`, and
`project.json`) are not present in this repository copy. Their source-of-truth equivalents in this
checkout are documented below and used by the live app.

- Source styling entry points used:
  - `/Users/amirmustafa/Documents/inventory/imsfrontend/src/app/globals.css`
  - `/Users/amirmustafa/Documents/inventory/imsfrontend/src/app/layout.tsx`
  - `/Users/amirmustafa/Documents/inventory/imsfrontend/src/components/ims/shell.tsx`
  - `/Users/amirmustafa/Documents/inventory/imsfrontend/src/components/ims/index.tsx`
  - `Bootstrap 5` classes and Bootstrap Icons imported in layout

If a future screen must be added, prefer these primitives and do not create new
color values or a new visual language.

## 1. Color tokens

The global theme is token-driven in `globals.css` under `:root` and `.dark`.

### Light theme tokens (active defaults)

- Background: `--background` (`oklch(1 0 0)`)
- Foreground: `--foreground` (`oklch(0.129 0.042 264.695)`)
- Card: `--card` (`oklch(1 0 0)`)
- Card foreground: `--card-foreground` (`oklch(0.129 0.042 264.695)`)
- Popover: `--popover` (`oklch(1 0 0)`)
- Popover foreground: `--popover-foreground` (`oklch(0.129 0.042 264.695)`)
- Primary: `--primary` (`oklch(0.208 0.042 265.755)`)
- Primary foreground: `--primary-foreground` (`oklch(0.984 0.003 247.858)`)
- Secondary: `--secondary` (`oklch(0.968 0.007 247.896)`)
- Secondary foreground: `--secondary-foreground` (`oklch(0.208 0.042 265.755)`)
- Muted: `--muted` (`oklch(0.968 0.007 247.896)`)
- Muted foreground: `--muted-foreground` (`oklch(0.554 0.046 257.417)`)
- Accent: `--accent` (`oklch(0.968 0.007 247.896)`)
- Accent foreground: `--accent-foreground` (`oklch(0.208 0.042 265.755)`)
- Destructive: `--destructive` (`oklch(0.577 0.245 27.325)`)
- Destructive foreground: `--destructive-foreground` (`oklch(0.984 0.003 247.858)`)
- Border: `--border` (`oklch(0.929 0.013 255.508)`)
- Input: `--input` (`oklch(0.929 0.013 255.508)`)
- Ring: `--ring` (`oklch(0.704 0.04 256.788)`)

### Sidebar tokens

- Sidebar: `--sidebar` (`oklch(0.984 0.003 247.858)`)
- Sidebar foreground: `--sidebar-foreground` (`oklch(0.129 0.042 264.695)`)
- Sidebar primary: `--sidebar-primary` (`oklch(0.208 0.042 265.755)`)
- Sidebar primary foreground: `--sidebar-primary-foreground` (`oklch(0.984 0.003 247.858)`)
- Sidebar accent: `--sidebar-accent` (`oklch(0.968 0.007 247.896)`)
- Sidebar accent foreground: `--sidebar-accent-foreground` (`oklch(0.208 0.042 265.755)`)
- Sidebar border: `--sidebar-border` (`oklch(0.929 0.013 255.508)`)
- Sidebar ring: `--sidebar-ring` (`oklch(0.704 0.04 256.788)`)

### Accepted IMS shell tokens

The accepted prototype uses additional named IMS tokens in `globals.css`; use these
instead of one-off colors when building shell/table experiences:

- Shell background: `--ims-shell-bg` (`#f3f5f9`)
- Sidebar background: `--ims-sidebar-bg` (`#162b49`)
- Sidebar border: `--ims-sidebar-border` (`#243957`)
- Sidebar muted text: `--ims-sidebar-muted` (`#95a3b8`)
- Sidebar active blue: `--ims-sidebar-active` (`#2f6df6`)
- Brand accent: `--ims-brand-accent` (`#f6c343`)
- Table border: `--ims-table-border` (`#d9dee7`)
- Selected row: `--ims-row-active` (`#e7e7e7`)

### Dark theme

`globals.css` defines dark-mode variants for each token under `.dark`.  
The same token names are reused with dark `oklch` values; keep the token names and
use `var(--color-*)` references instead of hard-coded alternatives.

## 2. Radius scale

Base radius family in `globals.css`:

- `--radius`: `0.625rem`
- `--radius-sm`: `calc(var(--radius) - 4px)`
- `--radius-md`: `calc(var(--radius) - 2px)`
- `--radius-lg`: `var(--radius)`
- `--radius-xl`: `calc(var(--radius) + 4px)`
- `--radius-2xl`: `calc(var(--radius) + 8px)`
- `--radius-3xl`: `calc(var(--radius) + 12px)`
- `--radius-4xl`: `calc(var(--radius) + 16px)`

No custom component CSS in repo introduces additional radii; when needed, use existing
Bootstrap or existing utility behavior.

## 3. Semantic color roles

- Background: `body { background: var(--color-background); color: var(--color-foreground); }`
- Card: `.card` currently relies on bootstrap defaults + `--color-card` alias
- Border: `* { border-color: var(--color-border); }`
- Input: bootstrap input classes with `--color-input` theme variable in token map
- Primary: `btn btn-primary`, `.text-bg-primary`/`.bg-primary-subtle`
- Secondary: `--secondary` + bootstrap secondary variants
- Muted: muted text and section labels via `text-secondary`
- Destructive: `btn btn-danger`, `text-bg-danger`, `bg-danger`
- Sidebar: accepted IMS shell uses `--ims-sidebar-bg`, muted nav labels, and `--ims-sidebar-active`

## 4. Typography and Bootstrap utility usage

- Heading sizes are typically set by semantic tags and bootstrap heading helpers:
  - `h1` / `h2` / `h3` / `h4` classes in page headers and section titles
  - `fs-4`, `fs-5`, `display-4` in KPI/info and empty-state contexts
- Font weight utilities:
  - `fw-semibold`, `fw-bold`, and occasional `fw-medium` not used
- Text color utilities:
  - `text-secondary`, `text-body`, `text-dark`, `text-primary`
- Spacing and layout:
  - `p-4`, `pb-2`, `py-*`, `mb-*`, `mt-*`, `px-*`, `gap-*`, `g-*`
  - `row` and `col-*` grid
  - `d-flex`, `d-grid`, `align-items-*`, `justify-content-*`
- Bootstrap components and utilities dominate; avoid custom layout CSS for page structure.

## 5. Page layout pattern

Standard pages use:

- `main` with `min-vh-100 bg-body-tertiary`
- `container-fluid p-4` wrapper
- `PageHeader` at top with optional breadcrumbs, `title`, optional `subtitle`, optional right-side `actions`
- one or two-column row layout:
  - action / form cards left
  - table/list cards right
- cards for grouped content with `border-0 shadow-sm`

## 6. Sidebar and topbar structure

Implemented in `/Users/amirmustafa/Documents/inventory/imsfrontend/src/components/ims/shell.tsx`:

- Top bar:
  - `header.ims-topbar`
  - left: sidebar toggle and global search (`Search items, assets, tags, GRN...`)
  - right: workspace `<select>`, notification button with count badge, user avatar/menu
- Side navigation:
  - fixed dark `<aside class="ims-sidebar">` width `252px` or `72px` when collapsed
  - grouped sections (`Operations`, `Inventory`, `Assets`, `Specialized`, `Compliance`, `Reports & Docs`, `Administration`)
  - brand block uses yellow building icon and `UoH IMS / Inventory Management`
  - active links use `--ims-sidebar-active` blue
- Main content area: `ims-main` with `ims-content` grey workspace

## 7. Table style

- Shared table component: `DataTable`
- Markup pattern:
  - card wrapper: `card border-0 shadow-sm ims-table-card`
  - responsive container: `table-responsive`
  - table: `table table-sm table-hover mb-0 align-middle ims-data-table`
  - header: white background with bold labels and `--ims-table-border`
  - each row uses compact spacing and text alignment classes as needed
  - optional selected/reference rows use `table-active` via `DataTable.rowClassName`

For complex nested detail rows (expanded sub-tables), the local implementation still uses
bootstrap `table table-sm align-middle` and `table-responsive`.

## 8. Filter / search bar style

Shared filter component: `FilterBar`

- Wrapper: `card border-0 shadow-sm mb-3`
- accepted shell/card class: `ims-filter-card`
- body: `p-3`
- child row: `row g-3 align-items-end`
- controls use `form-control-sm` / `form-select-sm`
- reset action uses `btn btn-sm btn-outline-secondary`
- Item Master reference page may use default-sized controls inside the same `FilterBar`
  to match the accepted screenshot.

## 9. Button hierarchy

Use bootstrap hierarchy and keep semantics consistent:

- Primary action: `btn btn-primary`
- Secondary/action variants: `btn btn-outline-primary`, `btn btn-outline-secondary`, etc.
- Utility actions: `btn-sm` for compact rows, filters, and quick actions
- Toggle groups: `btn-group` + `btn-check` where appropriate
- Danger actions use `btn-outline-danger`/`text-bg-danger` semantics

## 10. Badge / status style

`StatusBadge` maps human statuses to bootstrap context classes:

- Draft/In Store/Inactive: `bg-secondary` or dark variants
- Issued/In Use: `bg-info`/`bg-success`
- Under Repair/Pending: `bg-warning text-dark` or similar warning tones
- Missing/Rejected/Disposed/Cancelled: `bg-danger`/`bg-dark`
- Posted/Active/Found: `bg-success`
- Unknown statuses fallback to `bg-secondary`
- `StatusBadge` renders rounded pill badges.

Elsewhere, many pages also use explicit `badge text-bg-*` patterns.

## 11. Card and KPI style

- General cards: `card border-0 shadow-sm`
- KPI cards from `KpiCard`:
  - horizontal content with icon on left and text on right
  - icon container style: `rounded bg-{tone}-subtle text-{tone}`
  - icon container fixed square (`48x48`)
  - value uses `fs-4 fw-bold`

## 12. Form style

- Labels: `form-label`, optional `form-label small`
- Inputs/selects: `form-control`, `form-select`, mostly `form-control-sm`/`form-select-sm` in filters
- Grouping: `row g-*`, `col-*`
- Checkbox style uses bootstrap form-check
- Multi-line fields use `textarea`
- Token persistence UI:
  - inline input + button within `input-group` or compact row
- Avoid introducing new visual form controls; reuse bootstrap classes above.

## 13. Empty state style

- `EmptyState` uses `card border-0 shadow-sm`
- content is center aligned inside card body with:
  - icon `display-4 text-secondary opacity-50`
  - title + optional descriptive text
  - optional CTA action node

## 14. For future IMS screens

- Build with Bootstrap 5 utility classes and `src/components/ims` primitives first.
- Use existing tokenized colors and status badge semantics.
- Do not create custom enterprise palettes or sidebars/layouts outside this shell.
