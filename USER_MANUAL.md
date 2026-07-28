# UoH IMS User Manual

Last updated: 2026-07-28

This manual explains the current user-facing workflows in the University of Haripur Inventory Management System (IMS). The application uses the accepted Bootstrap-style IMS layout with the dark left sidebar, top search bar, compact forms, tables, badges, and report export controls.

## 1. Login and Navigation

- Sign in with the account provided by the system administrator.
- The left sidebar shows only the modules allowed for your assigned role.
- The topbar includes global search, notifications, and the user account menu.
- Use the user menu to confirm the logged-in role and to log out.

### Role-Based Menu Access

The sidebar is permission-aware:

- System Administrator sees all configured modules.
- Store Officer and other custom roles only see permitted modules.
- If a module is missing from the menu, ask the administrator to review the role permissions under `Administration > Roles`.

Note: hiding the menu improves navigation clarity. Backend permissions still control whether actions are allowed.

## 2. Item Master

Use `Inventory > Item Master` to create and maintain item templates used in GRN, stock, issues, fixed assets, reports, and tags.

### Create or Edit an Item

1. Open `Item Master`.
2. Click `Create Item`, or click `Edit` on an existing row.
3. Fill the required fields:
   - Item Name
   - Item Type
   - Category
   - Unit of Measure
4. Add optional fields:
   - Subcategory
   - Brand
   - Model
   - Minimum Stock Level
   - Description
5. Select tracking flags as needed:
   - Capitalizable
   - Sensitive / Controlled
   - Serial Tracking
   - Batch Tracking
   - Expiry Tracking
6. Click `Create Item` or `Update Item`.

Item Code is generated automatically from the selected category, optional subcategory, and the next 4-digit serial number, for example `IT-LAP-0001`.

### Quick Create from Item Form

If a lookup value is missing while creating or editing an item, create it without leaving the item form:

- `New Category`
- `New Subcategory`
- `New UoM`

The new record is saved into Master Data, the dropdown refreshes, and the new value is selected automatically.

### Searchable Dropdowns

Dropdowns are searchable, but selecting a value no longer hides the other values. Click or focus a dropdown to see the full list. Start typing only when you want to filter.

## 3. Category-Specific Specifications

IMS supports configurable item specifications by category/subcategory.

Examples:

- Laptop: Processor, RAM, Storage, Screen Size, Operating System
- Chair: Material, Arm Rest, Seat Type, Color
- Lab item: Specification, pack size, chemical grade, etc.

Admins define these fields in `Master Data > Attribute Definitions`. Item Master then shows the matching fields automatically in the item form.

Item-level specifications are common/default specifications. Asset-level information such as actual serial number and upgraded RAM belongs on the fixed asset record.

## 4. Receipts / GRN

GRN means `Goods Receipt Note`. Use `Inventory > Receipts (GRN)` when goods are received into store.

### Create Receipt

1. Open `Receipts (GRN)`.
2. Click `Create Receipt`.
3. Fill receipt details:
   - Receipt Date
   - Store
   - Department
   - Supplier
   - Funding Source
   - Project, if applicable
   - PO Reference, Invoice No, Challan No, if available
4. Add receipt items.
5. Save the receipt.
6. Post the receipt when ready to update stock.

### Quick Create from GRN

During GRN entry, missing lookup records can be created directly from the receipt popup:

- New Item
- New Store
- New Department
- New Supplier
- New Funding Source
- New Project

The created record is saved to Master Data and selected in the current receipt.

When creating a new item from GRN, Item Code is also generated automatically after category/subcategory selection.

## 5. Stock Balances and Stock Adjustment

Use `Inventory > Stock Balances` to review stock by item, department, store, location, project, and funding source.

The Stock Adjustment tab is used when stock must be corrected manually, such as:

- damage
- count correction
- loss
- found stock
- opening correction

Manual approval references and supporting documents should be attached where required by university procedure.

## 6. Issue / Return / Transfer / Adjustment

Use `Inventory > Issue / Return / Transfer` to create movement vouchers.

### Issue

Issue supports both:

- To Employee
- To Department

When department is selected first, the employee dropdown only shows employees from that selected department.

### Return

Return supports both:

- By Employee
- By Department

Use employee return when a named custodian returns an item. Use department return when the department returns stock or assets without an individual custodian.

### Transaction List

The transaction list displays employee names instead of only employee IDs. Draft vouchers can be edited, posted, printed, or deleted depending on permissions.

## 7. Fixed Asset Register

Use `Assets > Fixed Asset Register` to track capitalized assets.

Asset detail pages show:

- Core Identity
- Location & Custody
- Specifications
- Status updates
- Issue/return, maintenance, and movement links

### QR / Barcode

Asset detail pages show the generated tag preview. QR codes and printed labels encode the asset detail page URL, so scanning a tag opens that specific asset record.

Use `Generate / Print Tag` to open the tag print workflow.

## 8. Tag Print Log

Use `Assets > Tag Print Log` to generate and print QR/barcode labels.

Printed tag preview includes:

- QR code
- Printable tag number
- Asset ID
- Serial number, where available

Scanning the QR code should open the asset detail URL.

## 9. Controlled Stationery

Use `Specialized > Controlled Stationery` for serial-controlled stationery such as answer books or certificate forms.

The system tracks serial status such as:

- In Store
- Issued
- Returned
- Missing or damaged, where applicable

Exports can include controlled stationery serial details.

## 10. Reports and Export History

Use `Reports & Docs > Reports` to generate operational reports and exports.

### PDF Exports

Exported PDFs include a University of Haripur header with the official UoH logo/wordmark and report metadata such as:

- report title
- generated date/time
- row count

### Export Attachments

Generated files appear in the attachment area. The `Attach file` button is for adding supporting documents to the report/export record, such as:

- signed report
- approval memo
- scanned evidence
- verification document

## 11. Master Data

Use `Administration > Master Data` to maintain shared lookup records used across the system.

Common master data includes:

- Departments
- Stores
- Suppliers
- Funding Sources
- Research Projects
- Asset Categories
- Subcategories
- Units of Measure
- Attribute Definitions
- Document Entity Types

Some lookup records can also be created directly from workflows such as GRN and Item Master.

## 12. Users, Roles, and Permissions

Use `Administration > Users` to create users and assign roles.

Use `Administration > Roles` to create custom roles and select permission sets.

Important behavior:

- System roles are protected.
- Custom roles can be edited.
- Sidebar visibility follows the logged-in user permissions.
- If a Store Officer sees too many or too few modules, review the permissions assigned to the Store Officer role.

## 13. Notifications

The notification bell shows unread system notifications. Use the dropdown to mark individual notifications as read or open the notifications page.

## 14. Documents

Use `Reports & Docs > Documents` to manage supporting documents. Documents may be linked to receipt, asset, report, or workflow records depending on the selected entity type.

## 15. Good Operating Practice

- Create master data once and reuse it from dropdowns.
- Use category-specific attributes instead of adding hardcoded columns.
- Use GRN for receiving goods before issuing or capitalizing them.
- Use issue/return workflows to keep employee and department custody accurate.
- Use QR tags for fixed assets so field verification can open the exact asset record.
- Use report exports with attached approvals for audit traceability.
