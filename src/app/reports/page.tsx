"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, ExportButtons, FileAttachmentList, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type ReportType =
  | "controlled_stationery_batches"
  | "controlled_stationery_serials"
  | "controlled_stationery_movements"
  | "fixed_assets"
  | "stock_balance"
  | "low_stock"
  | "issue_return"
  | "stock_adjustment"
  | "asset_transfer"
  | "physical_verification"
  | "missing_damaged_assets"
  | "purchase_receipt"
  | "consumable_issuance"
  | "disposal_writeoff"
  | "depreciation";

type FilterKey =
  | "search"
  | "date_from"
  | "date_to"
  | "status"
  | "item_id"
  | "category_id"
  | "department_id"
  | "building_id"
  | "room_id"
  | "store_id"
  | "project_id"
  | "funding_source_id"
  | "supplier_id"
  | "custodian_id"
  | "batch_id"
  | "serial_id"
  | "movement_type"
  | "receipt_type"
  | "verification_type";

type LookupKey =
  | "departments"
  | "stores"
  | "items"
  | "research-projects"
  | "asset-categories"
  | "buildings"
  | "rooms"
  | "funding-sources"
  | "suppliers";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined | Date;
};

type ReportFilters = Record<FilterKey, string>;

type ReportColumn = {
  key: string;
  label: string;
};

type ExportArtifact = {
  name: string;
  size: string;
  uploadedBy: string;
  at: string;
};

type FilterSelectOption = {
  value: string;
  label: string;
};

type ReportConfig = {
  title: string;
  subtitle: string;
  endpoint: string;
  columns: ReportColumn[];
  filters: {
    includeSearch?: boolean;
    includeDates?: boolean;
    includeDepartment?: boolean;
    includeItem?: boolean;
    includeCategory?: boolean;
    includeStore?: boolean;
    includeProject?: boolean;
    includeBuilding?: boolean;
    includeRoom?: boolean;
    includeFundingSource?: boolean;
    includeSupplier?: boolean;
    includeCustodian?: boolean;
    includeBatch?: boolean;
    includeSerial?: boolean;
    statusFilter?: {
      field: keyof ReportFilters;
      options: FilterSelectOption[];
    };
    movementTypeFilter?: {
      field: keyof ReportFilters;
      options: FilterSelectOption[];
    };
    verificationTypeFilter?: {
      field: keyof ReportFilters;
      options: FilterSelectOption[];
    };
    receiptTypeFilter?: {
      field: keyof ReportFilters;
      options: FilterSelectOption[];
    };
  };
};

const statusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "in_stock", label: "In Stock" },
  { value: "issued", label: "Issued" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "damaged", label: "Damaged" },
];

const fixedAssetStatusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "in_use", label: "In Use" },
  { value: "disposed", label: "Disposed" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "pending_disposal", label: "Pending Disposal" },
];

const transactionStatusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

const movementTypeOptions: FilterSelectOption[] = [
  { value: "", label: "All Movement Types" },
  { value: "issue", label: "Issue" },
  { value: "return", label: "Return" },
  { value: "adjustment", label: "Adjustment" },
  { value: "consumption", label: "Consumption" },
  { value: "transfer", label: "Transfer" },
];

const controlledMovementOptions: FilterSelectOption[] = [
  { value: "", label: "All Movement Types" },
  { value: "receive", label: "Receive" },
  { value: "issue", label: "Issue" },
  { value: "consume", label: "Consume" },
  { value: "return", label: "Return" },
  { value: "mark_missing", label: "Mark Missing" },
  { value: "mark_damaged", label: "Mark Damaged" },
  { value: "cancel", label: "Cancel" },
];

const verificationTypeOptions: FilterSelectOption[] = [
  { value: "", label: "All Verification Types" },
  { value: "full", label: "Full" },
  { value: "spot", label: "Spot" },
  { value: "random", label: "Random" },
];

const verificationStatusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

const receiptTypeOptions: FilterSelectOption[] = [
  { value: "", label: "All Receipt Types" },
  { value: "direct", label: "Direct" },
  { value: "po", label: "Purchase Order" },
  { value: "return", label: "Return" },
];

const stockReceiptStatusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "partially_received", label: "Partially Received" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const disposalStatusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];

const missingDamagedStatusOptions: FilterSelectOption[] = [
  { value: "", label: "All Status" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "active", label: "Active" },
];

const reportConfigs: Record<ReportType, ReportConfig> = {
  controlled_stationery_batches: {
    title: "Controlled Stationery Batch Register",
    subtitle: "Batch summary grouped by receipt batch and department.",
    endpoint: "/reports/controlled-stationery/batches",
    columns: [
      { key: "batch_no", label: "Batch No" },
      { key: "item_name", label: "Item" },
      { key: "serial_prefix", label: "Serial Prefix" },
      { key: "serial_from", label: "Serial From" },
      { key: "serial_to", label: "Serial To" },
      { key: "total_quantity", label: "Quantity" },
      { key: "department_name", label: "Department" },
      { key: "store_name", label: "Store" },
      { key: "status", label: "Status" },
      { key: "serials_count", label: "Serials Count" },
      { key: "received_date", label: "Received Date" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeStore: true,
      statusFilter: { field: "status", options: statusOptions },
    },
  },
  controlled_stationery_serials: {
    title: "Controlled Stationery Serial Register",
    subtitle: "Serial-level tracking with holder and project context.",
    endpoint: "/reports/controlled-stationery/serials",
    columns: [
      { key: "serial_no", label: "Serial No" },
      { key: "batch_no", label: "Batch No" },
      { key: "item_name", label: "Item" },
      { key: "current_department_name", label: "Department" },
      { key: "current_store_name", label: "Store" },
      { key: "issued_to_user_name", label: "Current Custodian" },
      { key: "project_name", label: "Project" },
      { key: "status", label: "Status" },
      { key: "issued_at", label: "Issued At" },
      { key: "consumed_at", label: "Consumed At" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeStore: true,
      includeProject: true,
      statusFilter: { field: "status", options: statusOptions },
      includeBatch: true,
    },
  },
  controlled_stationery_movements: {
    title: "Controlled Stationery Movement History",
    subtitle: "Serial movement trail for issue/consume/return.",
    endpoint: "/reports/controlled-stationery/movements",
    columns: [
      { key: "movement_date", label: "Date" },
      { key: "serial_no", label: "Serial No" },
      { key: "batch_no", label: "Batch No" },
      { key: "item_name", label: "Item" },
      { key: "movement_type", label: "Movement Type" },
      { key: "from_department_name", label: "From Department" },
      { key: "to_department_name", label: "To Department" },
      { key: "transaction_no", label: "Transaction" },
      { key: "user_name", label: "User" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeStore: true,
      includeSerial: true,
      movementTypeFilter: { field: "movement_type", options: controlledMovementOptions },
    },
  },
  fixed_assets: {
    title: "Fixed Asset Register",
    subtitle: "Asset master with capitalization, depreciation and custody details.",
    endpoint: "/reports/fixed-assets",
    columns: [
      { key: "asset_id", label: "Asset ID" },
      { key: "printable_tag_id", label: "Printable Tag" },
      { key: "serial_number", label: "Serial No" },
      { key: "old_tag_reference", label: "Old Tag" },
      { key: "category_name", label: "Category" },
      { key: "subcategory_code", label: "Subcategory" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "department_code", label: "Dept Code" },
      { key: "building_name", label: "Building" },
      { key: "room_name", label: "Room" },
      { key: "employee_code", label: "Employee Code" },
      { key: "model", label: "Model" },
      { key: "purchase_cost", label: "Purchase Cost" },
      { key: "status", label: "Status" },
      { key: "condition_status", label: "Condition" },
      { key: "is_sensitive_controlled", label: "Sensitive" },
      { key: "is_fully_depreciated", label: "Fully Depreciated" },
      { key: "custodian_name", label: "Custodian" },
      { key: "project_title", label: "Project" },
      { key: "funding_source_name", label: "Funding Source" },
      { key: "created_at", label: "Created At" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeCategory: true,
      includeBuilding: true,
      includeRoom: true,
      includeStore: true,
      includeProject: true,
      includeFundingSource: true,
      includeCustodian: true,
      statusFilter: { field: "status", options: fixedAssetStatusOptions },
    },
  },
  stock_balance: {
    title: "Stock Balance",
    subtitle: "Current stock by item and location with reserved quantities.",
    endpoint: "/reports/stock-balance",
    columns: [
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "category_name", label: "Category" },
      { key: "department_name", label: "Department" },
      { key: "store_name", label: "Store" },
      { key: "project_code", label: "Project" },
      { key: "funding_source_code", label: "Funding Source" },
      { key: "minimum_stock_level", label: "Minimum Stock" },
      { key: "quantity_on_hand", label: "Quantity On Hand" },
      { key: "quantity_reserved", label: "Reserved" },
      { key: "available_quantity", label: "Available" },
      { key: "last_movement_at", label: "Last Movement" },
    ],
    filters: {
      includeSearch: true,
      includeDates: false,
      includeDepartment: true,
      includeItem: true,
      includeCategory: true,
      includeStore: true,
      includeProject: true,
      includeFundingSource: true,
    },
  },
  low_stock: {
    title: "Low Stock",
    subtitle: "Items where available stock is at or below the minimum threshold.",
    endpoint: "/reports/low-stock",
    columns: [
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "category_name", label: "Category" },
      { key: "department_name", label: "Department" },
      { key: "store_name", label: "Store" },
      { key: "project_code", label: "Project" },
      { key: "minimum_stock_level", label: "Minimum Stock" },
      { key: "quantity_on_hand", label: "Quantity On Hand" },
      { key: "quantity_reserved", label: "Reserved" },
      { key: "available_quantity", label: "Available" },
      { key: "last_movement_at", label: "Last Movement" },
    ],
    filters: {
      includeSearch: true,
      includeDates: false,
      includeDepartment: true,
      includeItem: true,
      includeCategory: true,
      includeStore: true,
      includeProject: true,
      includeFundingSource: true,
    },
  },
  issue_return: {
    title: "Issue / Return",
    subtitle: "Consumables and assets issued or returned against requests and approvals.",
    endpoint: "/reports/issue-return",
    columns: [
      { key: "transaction_no", label: "Transaction No" },
      { key: "transaction_type", label: "Type" },
      { key: "transaction_date", label: "Transaction Date" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "category_name", label: "Category" },
      { key: "quantity", label: "Quantity" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "from_department_name", label: "From Dept" },
      { key: "to_department_name", label: "To Dept" },
      { key: "from_store_name", label: "From Store" },
      { key: "to_store_name", label: "To Store" },
      { key: "requested_by_name", label: "Requested By" },
      { key: "recipient_user_name", label: "Recipient" },
      { key: "project_code", label: "Project" },
      { key: "purpose", label: "Purpose" },
      { key: "status", label: "Status" },
      { key: "remarks", label: "Remarks" },
      { key: "manual_approval_ref", label: "Manual Approval Ref" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeCategory: true,
      includeStore: true,
      includeProject: true,
      includeCustodian: true,
      statusFilter: { field: "status", options: transactionStatusOptions },
    },
  },
  stock_adjustment: {
    title: "Stock Adjustment",
    subtitle: "Stock additions and deductions due to adjustments.",
    endpoint: "/reports/stock-adjustment",
    columns: [
      { key: "transaction_no", label: "Transaction No" },
      { key: "transaction_type", label: "Type" },
      { key: "transaction_date", label: "Transaction Date" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "category_name", label: "Category" },
      { key: "quantity", label: "Quantity" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "from_department_name", label: "From Dept" },
      { key: "to_department_name", label: "To Dept" },
      { key: "from_store_name", label: "From Store" },
      { key: "to_store_name", label: "To Store" },
      { key: "requested_by_name", label: "Requested By" },
      { key: "recipient_user_name", label: "Recipient" },
      { key: "project_code", label: "Project" },
      { key: "purpose", label: "Purpose" },
      { key: "status", label: "Status" },
      { key: "remarks", label: "Remarks" },
      { key: "manual_approval_ref", label: "Manual Approval Ref" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeCategory: true,
      includeStore: true,
      includeProject: true,
      includeCustodian: true,
      statusFilter: { field: "status", options: transactionStatusOptions },
    },
  },
  asset_transfer: {
    title: "Asset Transfer",
    subtitle: "Movement of fixed assets across departments, buildings and custodians.",
    endpoint: "/reports/asset-transfer",
    columns: [
      { key: "movement_no", label: "Movement No" },
      { key: "movement_type", label: "Movement Type" },
      { key: "movement_date", label: "Movement Date" },
      { key: "asset_tag", label: "Asset Tag" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "from_department_name", label: "From Dept" },
      { key: "to_department_name", label: "To Dept" },
      { key: "from_building_name", label: "From Building" },
      { key: "to_building_name", label: "To Building" },
      { key: "from_room_name", label: "From Room" },
      { key: "to_room_name", label: "To Room" },
      { key: "from_custodian_name", label: "From Custodian" },
      { key: "to_custodian_name", label: "To Custodian" },
      { key: "manual_approval_ref", label: "Manual Approval Ref" },
      { key: "manual_approval_date", label: "Manual Approval Date" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeBuilding: true,
      includeRoom: true,
      includeCustodian: true,
      movementTypeFilter: {
        field: "status",
        options: movementTypeOptions,
      },
    },
  },
  physical_verification: {
    title: "Physical Verification",
    subtitle: "Department/room/project-wise verification runs and status.",
    endpoint: "/reports/physical-verification",
    columns: [
      { key: "verification_no", label: "Verification No" },
      { key: "verification_type", label: "Type" },
      { key: "department_name", label: "Department" },
      { key: "building_name", label: "Building" },
      { key: "room_name", label: "Room" },
      { key: "project_title", label: "Project" },
      { key: "project_cost_center", label: "Cost Center" },
      { key: "start_date", label: "Start Date" },
      { key: "end_date", label: "End Date" },
      { key: "status", label: "Status" },
      { key: "conducted_by_name", label: "Conducted By" },
      { key: "items_count", label: "Items Count" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeBuilding: true,
      includeRoom: true,
      includeProject: true,
      statusFilter: { field: "status", options: verificationStatusOptions },
      verificationTypeFilter: {
        field: "verification_type",
        options: verificationTypeOptions,
      },
    },
  },
  missing_damaged_assets: {
    title: "Missing / Damaged Assets",
    subtitle: "Active assets under investigation or marked damaged.",
    endpoint: "/reports/missing-damaged-assets",
    columns: [
      { key: "asset_id", label: "Asset ID" },
      { key: "printable_tag_id", label: "Printable Tag" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "status", label: "Status" },
      { key: "condition_status", label: "Condition" },
      { key: "department_name", label: "Department" },
      { key: "store_name", label: "Store" },
      { key: "custodian_name", label: "Custodian" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeStore: true,
      includeCustodian: true,
      statusFilter: {
        field: "status",
        options: missingDamagedStatusOptions,
      },
    },
  },
  purchase_receipt: {
    title: "Purchase / Receipt",
    subtitle: "Consumable and non-sensitive asset receipts with inspection and quantities.",
    endpoint: "/reports/purchase-receipt",
    columns: [
      { key: "receipt_no", label: "Receipt No" },
      { key: "receipt_type", label: "Receipt Type" },
      { key: "receipt_date", label: "Receipt Date" },
      { key: "po_reference", label: "PO Reference" },
      { key: "invoice_no", label: "Invoice No" },
      { key: "challan_no", label: "Challan No" },
      { key: "supplier_name", label: "Supplier" },
      { key: "department_name", label: "Department" },
      { key: "store_name", label: "Store" },
      { key: "funding_source_name", label: "Funding Source" },
      { key: "project_title", label: "Project" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "quantity_received", label: "Received" },
      { key: "quantity_accepted", label: "Accepted" },
      { key: "quantity_rejected", label: "Rejected" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "total_cost", label: "Total Cost" },
      { key: "batch_no", label: "Batch No" },
      { key: "expiry_date", label: "Expiry" },
      { key: "inspection_status", label: "Inspection" },
      { key: "status", label: "Status" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeStore: true,
      includeProject: true,
      includeFundingSource: true,
      includeSupplier: true,
      statusFilter: {
        field: "status",
        options: stockReceiptStatusOptions,
      },
      receiptTypeFilter: {
        field: "receipt_type",
        options: receiptTypeOptions,
      },
    },
  },
  consumable_issuance: {
    title: "Consumable Issuance",
    subtitle: "Issue of consumables by project, store and department.",
    endpoint: "/reports/consumable-issuance",
    columns: [
      { key: "transaction_no", label: "Transaction No" },
      { key: "transaction_type", label: "Type" },
      { key: "transaction_date", label: "Transaction Date" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "category_name", label: "Category" },
      { key: "quantity", label: "Quantity" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "from_department_name", label: "From Dept" },
      { key: "to_department_name", label: "To Dept" },
      { key: "from_store_name", label: "From Store" },
      { key: "to_store_name", label: "To Store" },
      { key: "requested_by_name", label: "Requested By" },
      { key: "recipient_user_name", label: "Recipient" },
      { key: "project_code", label: "Project" },
      { key: "purpose", label: "Purpose" },
      { key: "status", label: "Status" },
      { key: "remarks", label: "Remarks" },
      { key: "manual_approval_ref", label: "Manual Approval Ref" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeCategory: true,
      includeStore: true,
      includeProject: true,
      includeCustodian: true,
      statusFilter: {
        field: "status",
        options: transactionStatusOptions,
      },
    },
  },
  disposal_writeoff: {
    title: "Disposal / Write-Off",
    subtitle: "Assets disposed, written off and approved values.",
    endpoint: "/reports/disposal-writeoff",
    columns: [
      { key: "disposal_no", label: "Disposal No" },
      { key: "disposal_type", label: "Type" },
      { key: "request_date", label: "Request Date" },
      { key: "approval_date", label: "Approval Date" },
      { key: "status", label: "Status" },
      { key: "approval_ref", label: "Approval Ref" },
      { key: "approved_by", label: "Approved By" },
      { key: "reason", label: "Reason" },
      { key: "asset_tag", label: "Asset Tag" },
      { key: "printable_tag_id", label: "Printable Tag" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "asset_status", label: "Asset Status" },
      { key: "department_name", label: "Department" },
      { key: "book_value", label: "Book Value" },
      { key: "disposal_value", label: "Disposal Value" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeProject: true,
      statusFilter: {
        field: "status",
        options: disposalStatusOptions,
      },
    },
  },
  depreciation: {
    title: "Depreciation",
    subtitle: "Depreciation entries by period and asset class.",
    endpoint: "/reports/depreciation",
    columns: [
      { key: "run_no", label: "Run No" },
      { key: "period_start", label: "Period Start" },
      { key: "period_end", label: "Period End" },
      { key: "run_type", label: "Run Type" },
      { key: "run_status", label: "Run Status" },
      { key: "asset_tag", label: "Asset Tag" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item Name" },
      { key: "opening_book_value", label: "Opening Book Value" },
      { key: "depreciation_amount", label: "Depreciation" },
      { key: "accumulated_depreciation_after", label: "Accumulated After" },
      { key: "closing_book_value", label: "Closing Book Value" },
      { key: "method", label: "Method" },
      { key: "useful_life_years", label: "Useful Life (Y)" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeProject: true,
      statusFilter: {
        field: "status",
        options: [
          { value: "", label: "All Status" },
          { value: "draft", label: "Draft" },
          { value: "posted", label: "Posted" },
          { value: "closed", label: "Closed" },
        ],
      },
    },
  },
};

const emptyLookups: Record<LookupKey, RowData[]> = {
  departments: [],
  stores: [],
  items: [],
  "research-projects": [],
  "asset-categories": [],
  buildings: [],
  rooms: [],
  "funding-sources": [],
  suppliers: [],
};

const emptyFilters: ReportFilters = {
  search: "",
  date_from: "",
  date_to: "",
  status: "",
  item_id: "",
  category_id: "",
  department_id: "",
  building_id: "",
  room_id: "",
  store_id: "",
  project_id: "",
  funding_source_id: "",
  supplier_id: "",
  custodian_id: "",
  batch_id: "",
  serial_id: "",
  movement_type: "",
  verification_type: "",
  receipt_type: "",
};

const toDisplayDate = (value: unknown): string => {
  if (!value) return "-";
  const iso = String(value);
  return iso.includes("T") ? iso.split("T")[0] ?? "-" : iso;
};

const boolText = (value: unknown): string => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value);
};

const buildFilterPayload = (config: ReportConfig, filters: ReportFilters): Record<string, string> => {
  const payload: Record<string, string> = {};
  const append = (key: FilterKey, value: string): void => {
    if (value) {
      payload[key] = value;
    }
  };

  if (config.filters.includeSearch && filters.search.trim()) {
    append("search", filters.search.trim());
  }

  if (config.filters.includeDates) {
    append("date_from", filters.date_from);
    append("date_to", filters.date_to);
  }

  if (config.filters.includeDepartment) append("department_id", filters.department_id);
  if (config.filters.includeItem) append("item_id", filters.item_id);
  if (config.filters.includeCategory) append("category_id", filters.category_id);
  if (config.filters.includeStore) append("store_id", filters.store_id);
  if (config.filters.includeProject) append("project_id", filters.project_id);
  if (config.filters.includeBuilding) append("building_id", filters.building_id);
  if (config.filters.includeRoom) append("room_id", filters.room_id);
  if (config.filters.includeFundingSource) append("funding_source_id", filters.funding_source_id);
  if (config.filters.includeSupplier) append("supplier_id", filters.supplier_id);
  if (config.filters.includeCustodian) append("custodian_id", filters.custodian_id);
  if (config.filters.includeBatch) append("batch_id", filters.batch_id);
  if (config.filters.includeSerial) append("serial_id", filters.serial_id);
  if (config.filters.movementTypeFilter) append(config.filters.movementTypeFilter.field, filters[config.filters.movementTypeFilter.field]);
  if (config.filters.statusFilter) append(config.filters.statusFilter.field, filters[config.filters.statusFilter.field]);
  if (config.filters.verificationTypeFilter) {
    append(config.filters.verificationTypeFilter.field, filters[config.filters.verificationTypeFilter.field]);
  }
  if (config.filters.receiptTypeFilter) {
    append(config.filters.receiptTypeFilter.field, filters[config.filters.receiptTypeFilter.field]);
  }

  return payload;
};

const toReportStatus = (status: unknown) => (typeof status === "string" ? status : String(status ?? ""));

export default function ReportsPage() {
  const { isAuthenticated, loading } = useAuth();
  const authReady = isAuthenticated && !loading;
  const [activeReport, setActiveReport] = useState<ReportType>("controlled_stationery_batches");
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>(emptyLookups);
  const [filters, setFilters] = useState<Record<ReportType, ReportFilters>>({
    controlled_stationery_batches: { ...emptyFilters },
    controlled_stationery_serials: { ...emptyFilters },
    controlled_stationery_movements: { ...emptyFilters },
    fixed_assets: { ...emptyFilters },
    stock_balance: { ...emptyFilters },
    low_stock: { ...emptyFilters },
    issue_return: { ...emptyFilters },
    stock_adjustment: { ...emptyFilters },
    asset_transfer: { ...emptyFilters },
    physical_verification: { ...emptyFilters },
    missing_damaged_assets: { ...emptyFilters },
    purchase_receipt: { ...emptyFilters },
    consumable_issuance: { ...emptyFilters },
    disposal_writeoff: { ...emptyFilters },
    depreciation: { ...emptyFilters },
  });
  const [rows, setRows] = useState<RowData[]>([]);
  const [exportArtifacts, setExportArtifacts] = useState<ExportArtifact[]>([]);
  const [message, setMessage] = useState("Load a report to begin.");
  const [error, setError] = useState("");

  const reportConfig = reportConfigs[activeReport];
  const currentFilters = filters[activeReport];
  const addExportArtifact = useCallback((artifact: ExportArtifact) => {
    setExportArtifacts((current) => [artifact, ...current].slice(0, 12));
  }, []);

  const lookupLabel = useCallback((rows: RowData[], value: unknown, fallback?: string) => {
    if (value === null || value === undefined || value === "") return fallback ?? "-";
    const match = rows.find((row) => String(row.id) === String(value));
    if (!match) return String(value);
    if ("code" in match && "name" in match) return `${match.code} - ${match.name}`;
    if ("project_code" in match) return `${match.project_code} - ${match.title ?? ""}`;
    if ("project_code" in match && match.project_code !== undefined) return String(match.project_code);
    return String(match.name ?? match.title ?? match.id);
  }, []);

  const loadLookups = useCallback(async () => {
    if (!authReady) return;

    const next = { ...emptyLookups };
    const loadables: Array<{ key: LookupKey; path: string }> = [
      { key: "departments", path: "departments" },
      { key: "stores", path: "stores" },
      { key: "items", path: "items" },
      { key: "research-projects", path: "research-projects" },
      { key: "asset-categories", path: "asset-categories" },
      { key: "buildings", path: "buildings" },
      { key: "rooms", path: "rooms" },
      { key: "funding-sources", path: "funding-sources" },
      { key: "suppliers", path: "suppliers" },
    ];

    await Promise.all(
      loadables.map(async (lookup) => {
        const response = await api.get(`/master-data/${lookup.path}`);
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[lookup.key] = payload;
        }
      }),
    );

    setLookups(next);
  }, [authReady]);

  const loadRows = useCallback(async () => {
    if (!authReady) return;

    try {
      const payload = buildFilterPayload(reportConfig, currentFilters);
      const response = await api.get(reportConfig.endpoint, { params: payload });
      const data = response.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setError("");
      setMessage(`${reportConfig.title} loaded`);
    } catch {
      setRows([]);
      setMessage("");
      setError("Failed to load report. Verify token and endpoint availability.");
    }
  }, [authReady, currentFilters, reportConfig]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  const updateFilter = (key: FilterKey, value: string) => {
    setFilters((current) => ({
      ...current,
      [activeReport]: {
        ...current[activeReport],
        [key]: value,
      },
    }));
  };

  const resetFilters = () => {
    setFilters((current) => ({
      ...current,
      [activeReport]: { ...emptyFilters },
    }));
    setError("");
    setMessage("Filters reset.");
  };

  const exportReport = async (format: "pdf" | "excel") => {
    if (!authReady) {
      setError("Please sign in before exporting reports.");
      return;
    }

    if (rows.length === 0 && format === "pdf") {
      setError("No rows to export. Select a report with data.");
      return;
    }

    try {
      const payload = buildFilterPayload(reportConfig, currentFilters);
      const response = await api.post(
        "/reports/controlled-stationery/export",
        {
          report: activeReport,
          format,
          ...payload,
        },
        {
          responseType: "blob",
        },
      );

      const isPdf = format === "pdf";
      const extension = isPdf ? "pdf" : "csv";
      const blobType = isPdf ? "application/pdf" : "text/csv;charset=utf-8;";
      const fileName = `ims_${activeReport}_${new Date().toISOString().slice(0, 19).replace(":", "-").replace(":", "-")}.${extension}`;
      const blob = new Blob([response.data], { type: blobType });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      addExportArtifact({
        name: fileName,
        size: `${Math.max(blob.size / 1024, 0).toFixed(1)} KB`,
        uploadedBy: "System",
        at: new Date().toLocaleString(),
      });
      setMessage(`${format === "excel" ? "Excel" : "PDF"} export download started.`);
      setError("");
    } catch {
      setError(`${format === "excel" ? "Excel" : "PDF"} export failed. Try again or reduce filters.`);
    }
  };

  const renderBooleanCell = useCallback((value: unknown): string => {
    return value === undefined || value === null ? "-" : boolText(value);
  }, []);

  const renderCellValue = useCallback((columnKey: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (columnKey.includes("_at") || columnKey.includes("date")) {
      return toDisplayDate(value);
    }

    if (columnKey.includes("is_")) {
      return renderBooleanCell(value);
    }

    if (typeof value === "boolean") {
      return renderBooleanCell(value);
    }

    return String(value);
  }, [renderBooleanCell]);

  const renderFilterInput = (label: string, key: keyof ReportFilters, type: "text" | "number" = "text", min?: number) => (
    <div className="col-6 col-lg-2">
      <label className="form-label small">{label}</label>
      <input
        type={type}
        className="form-control form-control-sm"
        value={currentFilters[key]}
        onChange={(event) => updateFilter(key, event.target.value)}
        min={min}
        placeholder={label}
      />
    </div>
  );

  const renderLookupSelect = (label: string, key: keyof ReportFilters, rows: RowData[], emptyLabel: string, includeCode = true) => (
    <div className="col-6 col-lg-2">
      <label className="form-label small">{label}</label>
      <select
        className="form-select form-select-sm"
        value={currentFilters[key]}
        onChange={(event) => updateFilter(key, event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {includeCode ? lookupLabel(rows, row.id) : lookupLabel(rows, row.id, `${row.name ?? row.title ?? row.id}`)}
          </option>
        ))}
      </select>
    </div>
  );

  const renderStatusSelect = (label: string, options: FilterSelectOption[], field: keyof ReportFilters) => (
    <div className="col-6 col-lg-2">
      <label className="form-label small">{label}</label>
      <select
        className="form-select form-select-sm"
        value={currentFilters[field]}
        onChange={(event) => updateFilter(field, event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const tableColumns = useMemo(
    () =>
      reportConfig.columns.map((column) => ({
        key: column.key,
        header: column.label,
        render: (row: RowData) => {
          const raw = row[column.key];
          if (column.key === "status") {
            return <StatusBadge status={toReportStatus(raw)} />;
          }
          return renderCellValue(column.key, raw);
        },
      })),
    [reportConfig.columns, renderCellValue],
  );

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Reports"
          subtitle={reportConfig.subtitle}
          actions={
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <ExportButtons
                name={`report-${activeReport}`}
                onExportPdf={() => {
                  void exportReport("pdf");
                }}
                onExportExcel={() => {
                  void exportReport("excel");
                }}
              />
            </div>
          }
        />

        <div className="d-flex flex-wrap gap-2 mb-3">
          {(Object.keys(reportConfigs) as ReportType[]).map((reportKey) => (
            <button
              className={`btn ${activeReport === reportKey ? "btn-primary" : "btn-outline-primary"}`
                + (reportKey === "depreciation" ? " d-none d-xl-inline-block" : "")}
              key={reportKey}
              type="button"
              onClick={() => {
                setActiveReport(reportKey);
                setError("");
              }}
            >
              <i className="bi bi-bar-chart-line me-1" />
              {reportConfigs[reportKey].title}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <div className="alert alert-light border">
            <i className="bi bi-graph-up me-2" />
            {reportConfig.title}
          </div>
          {(message || error) && <small className={error ? "text-danger" : "text-success"}>{error || message}</small>}
        </div>

        <FilterBar onReset={resetFilters}>
          {reportConfig.filters.includeSearch && (
            <div className="col-12 col-lg-3">
              <label className="form-label small">Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={currentFilters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Type to search"
              />
            </div>
          )}
          {reportConfig.filters.includeDates && (
            <>
              <div className="col-6 col-lg-2">
                <label className="form-label small">Date From</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={currentFilters.date_from}
                  onChange={(event) => updateFilter("date_from", event.target.value)}
                />
              </div>
              <div className="col-6 col-lg-2">
                <label className="form-label small">Date To</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={currentFilters.date_to}
                  onChange={(event) => updateFilter("date_to", event.target.value)}
                />
              </div>
            </>
          )}

          {reportConfig.filters.includeDepartment &&
            renderLookupSelect("Department", "department_id", lookups.departments, "All Departments")}
          {reportConfig.filters.includeItem && renderLookupSelect("Item", "item_id", lookups.items, "All Items", false)}
          {reportConfig.filters.includeCategory &&
            renderLookupSelect("Category", "category_id", lookups["asset-categories"], "All Categories", false)}
          {reportConfig.filters.includeStore &&
            renderLookupSelect("Store", "store_id", lookups.stores, "All Stores", false)}
          {reportConfig.filters.includeProject &&
            renderLookupSelect("Project", "project_id", lookups["research-projects"], "All Projects", false)}
          {reportConfig.filters.includeBuilding &&
            renderLookupSelect("Building", "building_id", lookups.buildings, "All Buildings", false)}
          {reportConfig.filters.includeRoom &&
            renderLookupSelect("Room", "room_id", lookups.rooms, "All Rooms", false)}
          {reportConfig.filters.includeFundingSource &&
            renderLookupSelect("Funding Source", "funding_source_id", lookups["funding-sources"], "All Funding Sources", false)}
          {reportConfig.filters.includeSupplier &&
            renderLookupSelect("Supplier", "supplier_id", lookups.suppliers, "All Suppliers", false)}
          {reportConfig.filters.includeCustodian &&
            renderFilterInput("Custodian ID", "custodian_id", "number", 1)}
          {reportConfig.filters.includeBatch &&
            renderFilterInput("Batch ID", "batch_id", "number", 1)}
          {reportConfig.filters.includeSerial &&
            renderFilterInput("Serial ID", "serial_id", "number", 1)}
          {reportConfig.filters.statusFilter &&
            renderStatusSelect("Status", reportConfig.filters.statusFilter.options, reportConfig.filters.statusFilter.field)}
          {reportConfig.filters.movementTypeFilter &&
            renderStatusSelect("Movement Type", reportConfig.filters.movementTypeFilter.options, reportConfig.filters.movementTypeFilter.field)}
          {reportConfig.filters.verificationTypeFilter &&
            renderStatusSelect("Verification Type", reportConfig.filters.verificationTypeFilter.options, reportConfig.filters.verificationTypeFilter.field)}
          {reportConfig.filters.receiptTypeFilter &&
            renderStatusSelect("Receipt Type", reportConfig.filters.receiptTypeFilter.options, reportConfig.filters.receiptTypeFilter.field)}
        </FilterBar>

        <div className="row g-3">
          <div className="col-12">
            <DataTable columns={tableColumns} rows={rows} empty="No rows found." />
          </div>
          <div className="col-12">
            <FileAttachmentList files={exportArtifacts} />
          </div>
        </div>
      </div>
    </main>
  );
}
