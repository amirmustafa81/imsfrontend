"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DataTable,
  ExportButtons,
  FileAttachmentList,
  FilterBar,
  PageHeader,
  PaginationControls,
  SearchableSelect,
  StatusBadge,
  type SearchableSelectOption,
} from "@/components/ims";

type ReportType =
  | "controlled_stationery_batches"
  | "controlled_stationery_serials"
  | "controlled_stationery_movements"
  | "old_stock_issue_history"
  | "old_stock_cleanup"
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
  | "suppliers"
  | "users";

type RowData = {
  id: number;
  [key: string]: string | number | string[] | null | undefined | Date;
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

type TagPrintPreview = {
  assetId: string;
  assetCode: string;
  printableTag: string;
  serialNumber: string;
  location: string;
};

type OldStockCleanupForm = {
  item_id: string;
  department_id: string;
  building_id: string;
  room_id: string;
  recipient_user_id: string;
  issue_date: string;
  issue_no: string;
  requisition_no: string;
  receipt_reference: string;
  legacy_received_by: string;
  remarks: string;
};

const REPORT_EXPORT_ENDPOINT = "/reports/export";

const textValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);

const svgToDataUrl = (svgMarkup: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;

const tagRowKey = (row: RowData) => String(row.id);

const buildReportTagPrintPreview = (row: RowData): TagPrintPreview | null => {
  const assetRecordId = row.asset_record_id;
  const printableTag = textValue(row.printable_tag_id);

  if (!assetRecordId || !printableTag) {
    return null;
  }

  const buildingRoom = [row.building_name, row.room_name].map(textValue).filter(Boolean).join(" / ");
  const department = textValue(row.department_name) || textValue(row.department_code);

  return {
    assetId: String(assetRecordId),
    assetCode: textValue(row.asset_tag),
    printableTag,
    serialNumber: textValue(row.serial_number) || "No serial recorded",
    location: buildingRoom || department || "No location recorded",
  };
};

const buildTagQrPayload = (preview: TagPrintPreview) => {
  if (typeof window === "undefined") return preview.printableTag;
  return new URL(`/assets/${preview.assetId}`, window.location.origin).toString();
};

const generateQrDataUrl = async (value: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#20242a",
        light: "#ffffff",
      },
    });
  } catch {
    const svgMarkup = await QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 192,
      color: {
        dark: "#20242a",
        light: "#ffffff",
      },
    });

    return svgToDataUrl(svgMarkup);
  }
};

const buildPrintableTagHtml = (tags: Array<TagPrintPreview & { qrDataUrl: string }>) => {
  const labels = tags.map((tag) => {
    const qrImageMarkup = tag.qrDataUrl
      ? `<img src="${escapeHtml(tag.qrDataUrl)}" alt="QR code for ${escapeHtml(tag.printableTag)}" />`
      : `<span class="unavailable">QR unavailable</span>`;

    return `
      <div class="label">
        <div class="qr">${qrImageMarkup}</div>
        <div class="text">
          <div class="tag">${escapeHtml(tag.printableTag)}</div>
          <div class="meta">${escapeHtml(tag.assetCode || "No asset selected")}</div>
          <div class="meta">${escapeHtml(tag.serialNumber)}</div>
          <div class="meta">${escapeHtml(tag.location)}</div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <title>IMS tag print</title>
        <style>
          @page { size: A4; margin: 8mm; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            background: #fff;
            color: #20242a;
            font-family: Arial, Helvetica, sans-serif;
          }
          .sheet {
            display: flex;
            flex-wrap: wrap;
            align-content: flex-start;
            align-items: flex-start;
            justify-content: flex-start;
            gap: 4mm;
          }
          .label {
            width: 80mm;
            height: 50mm;
            padding: 7mm;
            display: flex;
            align-items: center;
            gap: 5mm;
            border: 1px solid #20242a;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .qr {
            width: 24mm;
            height: 24mm;
            flex: 0 0 24mm;
            border: 1px solid #dfe3ea;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .text {
            min-width: 0;
            flex: 1;
            line-height: 1.25;
          }
          .tag {
            font-size: 11pt;
            font-weight: 700;
            overflow-wrap: anywhere;
          }
          .meta {
            margin-top: 2mm;
            color: #4f5865;
            font-size: 8.4pt;
            overflow-wrap: anywhere;
          }
          .unavailable {
            color: #9a1f2b;
            font-size: 7pt;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="sheet">${labels}</div>
      </body>
    </html>
  `;
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
  old_stock_issue_history: {
    title: "Old Stock Issue History",
    subtitle: "Imported legacy issue rows with linked taggable assets where available.",
    endpoint: "/reports/old-stock-issue-history",
    columns: [
      { key: "issue_date", label: "Issue Date" },
      { key: "source_sheet", label: "Source Sheet" },
      { key: "source_row_no", label: "Source Row" },
      { key: "source_unit_no", label: "Unit" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item" },
      { key: "quantity_issued", label: "Qty" },
      { key: "department_code", label: "Dept Code" },
      { key: "department_name", label: "Department" },
      { key: "recipient_name", label: "Received By" },
      { key: "asset_tag", label: "Asset Tag" },
      { key: "printable_tag_id", label: "Printable Tag" },
      { key: "asset_status", label: "Asset Status" },
      { key: "remarks", label: "Remarks" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeBuilding: true,
      includeRoom: true,
    },
  },
  old_stock_cleanup: {
    title: "Old Stock Cleanup",
    subtitle: "Correct missing or ambiguous values in imported old stock records.",
    endpoint: "/reports/old-stock-cleanup",
    columns: [
      { key: "cleanup_status", label: "Status" },
      { key: "cleanup_issues", label: "Issues" },
      { key: "issue_date", label: "Issue Date" },
      { key: "source_sheet", label: "Source Sheet" },
      { key: "source_row_no", label: "Source Row" },
      { key: "source_unit_no", label: "Unit" },
      { key: "item_code", label: "Item Code" },
      { key: "item_name", label: "Item" },
      { key: "department_name", label: "Department" },
      { key: "building_name", label: "Building" },
      { key: "room_name", label: "Room" },
      { key: "recipient_name", label: "Received By" },
      { key: "asset_tag", label: "Asset Tag" },
      { key: "remarks", label: "Remarks" },
      { key: "actions", label: "Actions" },
    ],
    filters: {
      includeSearch: true,
      includeDates: true,
      includeDepartment: true,
      includeItem: true,
      includeBuilding: true,
      includeRoom: true,
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
  users: [],
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

const toInputDate = (value: unknown): string => {
  if (!value) return "";
  const iso = String(value);
  return iso.includes("T") ? iso.split("T")[0] ?? "" : iso.slice(0, 10);
};

const oldStockCleanupFormFromRow = (row: RowData): OldStockCleanupForm => ({
  item_id: textValue(row.item_id),
  department_id: textValue(row.department_id),
  building_id: textValue(row.building_id),
  room_id: textValue(row.room_id),
  recipient_user_id: textValue(row.recipient_user_id),
  issue_date: toInputDate(row.issue_date),
  issue_no: textValue(row.issue_no),
  requisition_no: textValue(row.requisition_no),
  receipt_reference: textValue(row.receipt_reference),
  legacy_received_by: textValue(row.legacy_received_by),
  remarks: textValue(row.remarks),
});

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
    old_stock_issue_history: { ...emptyFilters },
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
    old_stock_cleanup: { ...emptyFilters },
  });
  const [rows, setRows] = useState<RowData[]>([]);
  const [exportArtifacts, setExportArtifacts] = useState<ExportArtifact[]>([]);
  const [message, setMessage] = useState("Load a report to begin.");
  const [error, setError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tagPreview, setTagPreview] = useState<TagPrintPreview | null>(null);
  const [tagQrDataUrl, setTagQrDataUrl] = useState("");
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([]);
  const [printingTags, setPrintingTags] = useState(false);
  const [editingCleanupRow, setEditingCleanupRow] = useState<RowData | null>(null);
  const [cleanupForm, setCleanupForm] = useState<OldStockCleanupForm | null>(null);
  const [savingCleanup, setSavingCleanup] = useState(false);

  const reportConfig = reportConfigs[activeReport];
  const currentFilters = filters[activeReport];
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, rows],
  );

  const addExportArtifact = useCallback((artifact: ExportArtifact) => {
    setExportArtifacts((current) => [artifact, ...current].slice(0, 12));
  }, []);

  const tagQrPayload = useMemo(() => {
    if (!tagPreview) return "";
    return buildTagQrPayload(tagPreview);
  }, [tagPreview]);
  const selectedTagPreviews = useMemo(
    () => rows
      .filter((row) => selectedTagKeys.includes(tagRowKey(row)))
      .map(buildReportTagPrintPreview)
      .filter((preview): preview is TagPrintPreview => Boolean(preview)),
    [rows, selectedTagKeys],
  );

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
      { key: "users", path: "users" },
    ];

    await Promise.all(
      loadables.map(async (lookup) => {
        const response = await api.get(lookup.key === "users" ? "/users" : `/master-data/${lookup.path}`);
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

    setReportLoading(true);
    setError("");
    setMessage(`Loading ${reportConfig.title}...`);

    try {
      const payload = buildFilterPayload(reportConfig, currentFilters);
      const response = await api.get(reportConfig.endpoint, { params: payload });
      const data = response.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setPage(1);
      setSelectedTagKeys([]);
      setError("");
      setMessage(`${reportConfig.title} loaded`);
    } catch {
      setRows([]);
      setPage(1);
      setSelectedTagKeys([]);
      setMessage("");
      setError("Failed to load report. Verify token and endpoint availability.");
    } finally {
      setReportLoading(false);
    }
  }, [authReady, currentFilters, reportConfig]);

  useEffect(() => {
    if (page > totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    const qrValue = tagQrPayload.trim();

    if (!qrValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTagQrDataUrl("");
      return;
    }

    let isMounted = true;
    generateQrDataUrl(qrValue)
      .then((dataUrl) => {
        if (isMounted) setTagQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (isMounted) setTagQrDataUrl("");
      });

    return () => {
      isMounted = false;
    };
  }, [tagQrPayload]);

  const openTagPreview = useCallback((row: RowData) => {
    const preview = buildReportTagPrintPreview(row);

    if (!preview) {
      setError("No printable tag is available for this row.");
      return;
    }

    setTagPreview(preview);
    setError("");
  }, []);

  const toggleTagSelection = useCallback((row: RowData, selected: boolean) => {
    const preview = buildReportTagPrintPreview(row);
    const key = tagRowKey(row);

    if (!preview) {
      return;
    }

    setSelectedTagKeys((current) => {
      if (selected) {
        return current.includes(key) ? current : [...current, key];
      }

      return current.filter((currentKey) => currentKey !== key);
    });
  }, []);

  const printTagPreviews = useCallback(async (previews: TagPrintPreview[]) => {
    if (typeof window === "undefined" || previews.length === 0) return;

    setPrintingTags(true);
    setError("");

    let printableTags: Array<TagPrintPreview & { qrDataUrl: string }>;
    try {
      printableTags = await Promise.all(
        previews.map(async (preview) => ({
          ...preview,
          qrDataUrl: await generateQrDataUrl(buildTagQrPayload(preview)),
        })),
      );
    } catch {
      setPrintingTags(false);
      setError("Unable to generate one or more tag QR codes.");
      return;
    }

    const frame = document.createElement("iframe");
    frame.setAttribute("title", "IMS report tag print");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      frame.remove();
      setPrintingTags(false);
      setError("Unable to prepare tag print preview.");
      return;
    }

    frameDocument.open();
    frameDocument.write(buildPrintableTagHtml(printableTags));
    frameDocument.close();

    frameWindow.onafterprint = () => {
      frame.remove();
      setPrintingTags(false);
    };
    window.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(() => {
        frame.remove();
        setPrintingTags(false);
      }, 1000);
    }, 100);
  }, []);

  const printTagPreview = useCallback(() => {
    if (!tagPreview) return;
    void printTagPreviews([tagPreview]);
  }, [printTagPreviews, tagPreview]);

  const printSelectedTags = useCallback(() => {
    if (selectedTagPreviews.length === 0) {
      setError("Select at least one printable tag first.");
      return;
    }

    void printTagPreviews(selectedTagPreviews);
  }, [printTagPreviews, selectedTagPreviews]);

  const openCleanupEdit = useCallback((row: RowData) => {
    setEditingCleanupRow(row);
    setCleanupForm(oldStockCleanupFormFromRow(row));
    setError("");
  }, []);

  const setCleanupField = useCallback((field: keyof OldStockCleanupForm, value: string) => {
    setCleanupForm((current) => current ? { ...current, [field]: value } : current);
  }, []);

  const closeCleanupEdit = useCallback(() => {
    setEditingCleanupRow(null);
    setCleanupForm(null);
    setSavingCleanup(false);
  }, []);

  const saveCleanupEdit = useCallback(async () => {
    if (!editingCleanupRow || !cleanupForm) return;

    if (!cleanupForm.item_id || !cleanupForm.department_id) {
      setError("Item and department are required before saving cleanup changes.");
      return;
    }

    setSavingCleanup(true);
    setError("");

    try {
      const payload = {
        item_id: Number(cleanupForm.item_id),
        department_id: Number(cleanupForm.department_id),
        building_id: cleanupForm.building_id ? Number(cleanupForm.building_id) : null,
        room_id: cleanupForm.room_id ? Number(cleanupForm.room_id) : null,
        recipient_user_id: cleanupForm.recipient_user_id ? Number(cleanupForm.recipient_user_id) : null,
        issue_date: cleanupForm.issue_date || null,
        issue_no: cleanupForm.issue_no || null,
        requisition_no: cleanupForm.requisition_no || null,
        receipt_reference: cleanupForm.receipt_reference || null,
        legacy_received_by: cleanupForm.legacy_received_by || null,
        remarks: cleanupForm.remarks || null,
      };
      const response = await api.put(`/old-stock-issue-histories/${editingCleanupRow.id}`, payload);
      const updatedRow = response.data?.data;

      if (updatedRow) {
        setRows((current) => current.map((row) => row.id === editingCleanupRow.id ? updatedRow : row));
      }

      setMessage("Old stock cleanup row updated.");
      closeCleanupEdit();
    } catch (errorResponse) {
      const message = typeof errorResponse === "object" && errorResponse !== null && "response" in errorResponse
        ? (errorResponse as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(message || "Unable to save cleanup changes.");
    } finally {
      setSavingCleanup(false);
    }
  }, [cleanupForm, closeCleanupEdit, editingCleanupRow]);

  const updateFilter = (key: FilterKey, value: string) => {
    setPage(1);
    setSelectedTagKeys([]);
    setFilters((current) => ({
      ...current,
      [activeReport]: {
        ...current[activeReport],
        [key]: value,
      },
    }));
  };

  const resetFilters = () => {
    setPage(1);
    setSelectedTagKeys([]);
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
        REPORT_EXPORT_ENDPOINT,
        {
          report_type: activeReport,
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

  const toLookupOption = (rows: RowData[], row: RowData, includeCode = true): SearchableSelectOption => {
    const userLabel =
      row.employee_code || row.email
        ? `${row.employee_code ? `${row.employee_code} - ` : ""}${row.name ?? row.email ?? row.id}`
        : null;
    const fallback = String(row.name ?? row.title ?? row.email ?? row.id);
    const label = userLabel ?? (includeCode ? lookupLabel(rows, row.id, fallback) : fallback);

    return {
      value: String(row.id),
      label,
      keywords: `${row.code ?? ""} ${row.project_code ?? ""} ${row.email ?? ""} ${row.phone ?? ""} ${row.department_id ?? ""}`,
    };
  };

  const renderLookupSelect = (label: string, key: keyof ReportFilters, rows: RowData[], emptyLabel: string, includeCode = true) => (
    <div className="col-6 col-lg-2">
      <label className="form-label small">{label}</label>
      <SearchableSelect
        id={`report-filter-${String(key)}`}
        value={currentFilters[key]}
        options={rows.map((row) => toLookupOption(rows, row, includeCode))}
        onChange={(value) => updateFilter(key, value)}
        placeholder={emptyLabel}
        emptyLabel="No records found."
      />
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
    () => {
      const baseColumns = reportConfig.columns.map((column) => ({
        key: column.key,
        header: column.label,
        render: (row: RowData) => {
          const raw = row[column.key];
          if (activeReport === "old_stock_cleanup") {
            if (column.key === "cleanup_status") {
              const status = String(raw ?? "Needs Review");
              return (
                <span className={`badge rounded-pill ${status === "Complete" ? "text-bg-success" : "text-bg-warning"}`}>
                  {status}
                </span>
              );
            }

            if (column.key === "cleanup_issues") {
              const issues = Array.isArray(raw) ? raw : [];

              if (issues.length === 0) {
                return <span className="badge rounded-pill text-bg-success">Complete</span>;
              }

              return (
                <div className="d-flex flex-wrap gap-1">
                  {issues.map((issue) => (
                    <span className="badge rounded-pill text-bg-warning" key={issue}>
                      {issue}
                    </span>
                  ))}
                </div>
              );
            }

            if (column.key === "actions") {
              return (
                <button className="btn btn-sm btn-outline-primary text-nowrap" type="button" onClick={() => openCleanupEdit(row)}>
                  <i className="bi bi-pencil-square me-1" />
                  Edit
                </button>
              );
            }
          }

          if (activeReport === "old_stock_issue_history" && column.key === "printable_tag_id") {
            const tagPrintPreview = buildReportTagPrintPreview(row);

            if (!tagPrintPreview) {
              return "-";
            }

            return (
              <button
                className="btn btn-sm btn-outline-primary text-nowrap"
                type="button"
                onClick={() => openTagPreview(row)}
              >
                <i className="bi bi-qr-code me-1" />
                {String(raw)}
              </button>
            );
          }
          if (column.key === "status") {
            return <StatusBadge status={toReportStatus(raw)} />;
          }
          return renderCellValue(column.key, raw);
        },
      }));

      if (activeReport !== "old_stock_issue_history") {
        return baseColumns;
      }

      return [
        {
          key: "tag_select",
          header: "Select",
          render: (row: RowData) => {
            const preview = buildReportTagPrintPreview(row);
            const key = tagRowKey(row);

            return (
              <input
                className="form-check-input"
                type="checkbox"
                aria-label={`Select ${preview?.printableTag ?? "tag"}`}
                checked={selectedTagKeys.includes(key)}
                disabled={!preview}
                onChange={(event) => toggleTagSelection(row, event.target.checked)}
              />
            );
          },
        },
        ...baseColumns,
      ];
    },
    [activeReport, openCleanupEdit, openTagPreview, renderCellValue, reportConfig.columns, selectedTagKeys, toggleTagSelection],
  );

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Reports"
          subtitle={reportConfig.subtitle}
          actions={
            activeReport === "old_stock_cleanup" ? null : <div className="d-flex gap-2 align-items-end flex-wrap">
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
                setRows([]);
                setPage(1);
                setSelectedTagKeys([]);
                setActiveReport(reportKey);
                setError("");
                setMessage(`Loading ${reportConfigs[reportKey].title}...`);
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
          {(message || error || reportLoading) && (
            <small className={error ? "text-danger" : reportLoading ? "text-primary" : "text-success"}>
              {error || (reportLoading ? `Loading ${reportConfig.title}...` : message)}
            </small>
          )}
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
            renderLookupSelect("Employee / Custodian", "custodian_id", lookups.users, "All Employees", false)}
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
            {reportLoading ? (
              <div className="card shadow-sm">
                <div className="card-body py-5 text-center text-secondary">
                  <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
                  <div className="fw-semibold">Loading report...</div>
                  <div className="small">{reportConfig.title}</div>
                </div>
              </div>
            ) : (
              <>
                {activeReport === "old_stock_issue_history" ? (
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                    <div className="small text-secondary">
                      {selectedTagPreviews.length.toLocaleString()} tag{selectedTagPreviews.length === 1 ? "" : "s"} selected
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        disabled={selectedTagPreviews.length === 0 || printingTags}
                        onClick={() => setSelectedTagKeys([])}
                      >
                        Clear
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        type="button"
                        disabled={selectedTagPreviews.length === 0 || printingTags}
                        onClick={printSelectedTags}
                      >
                        <i className="bi bi-printer me-1" />
                        {printingTags ? "Preparing..." : "Print Selected"}
                      </button>
                    </div>
                  </div>
                ) : null}
                <DataTable columns={tableColumns} rows={paginatedRows} empty="No rows found." />
                <PaginationControls
                  page={currentPage}
                  pageSize={pageSize}
                  totalItems={rows.length}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  }}
                />
              </>
            )}
          </div>
          <div className="col-12">
            <FileAttachmentList files={exportArtifacts} />
          </div>
        </div>

        {editingCleanupRow && cleanupForm ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="old-stock-cleanup-title">
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h2 className="modal-title h5" id="old-stock-cleanup-title">Edit Old Stock Record</h2>
                    <button className="btn-close" type="button" aria-label="Close" onClick={closeCleanupEdit} />
                  </div>
                  <div className="modal-body">
                    <div className="alert alert-light border small mb-3">
                      <div><strong>Source:</strong> {String(editingCleanupRow.source_sheet ?? "-")} row {String(editingCleanupRow.source_row_no ?? "-")}</div>
                      <div><strong>Asset:</strong> {String(editingCleanupRow.asset_tag ?? "-")}</div>
                    </div>
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Item</label>
                        <select className="form-select form-select-sm" value={cleanupForm.item_id} onChange={(event) => setCleanupField("item_id", event.target.value)}>
                          <option value="">Select item</option>
                          {lookups.items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {toLookupOption(lookups.items, item).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Department</label>
                        <select className="form-select form-select-sm" value={cleanupForm.department_id} onChange={(event) => setCleanupField("department_id", event.target.value)}>
                          <option value="">Select department</option>
                          {lookups.departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {toLookupOption(lookups.departments, department).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Building</label>
                        <select className="form-select form-select-sm" value={cleanupForm.building_id} onChange={(event) => setCleanupField("building_id", event.target.value)}>
                          <option value="">No building</option>
                          {lookups.buildings.map((building) => (
                            <option key={building.id} value={building.id}>
                              {toLookupOption(lookups.buildings, building, false).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Room</label>
                        <select className="form-select form-select-sm" value={cleanupForm.room_id} onChange={(event) => setCleanupField("room_id", event.target.value)}>
                          <option value="">No room</option>
                          {lookups.rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {toLookupOption(lookups.rooms, room, false).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Recipient User</label>
                        <select className="form-select form-select-sm" value={cleanupForm.recipient_user_id} onChange={(event) => setCleanupField("recipient_user_id", event.target.value)}>
                          <option value="">No mapped user</option>
                          {lookups.users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {toLookupOption(lookups.users, user, false).label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Legacy Received By</label>
                        <input className="form-control form-control-sm" value={cleanupForm.legacy_received_by} onChange={(event) => setCleanupField("legacy_received_by", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Issue Date</label>
                        <input type="date" className="form-control form-control-sm" value={cleanupForm.issue_date} onChange={(event) => setCleanupField("issue_date", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Issue No</label>
                        <input className="form-control form-control-sm" value={cleanupForm.issue_no} onChange={(event) => setCleanupField("issue_no", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Requisition No</label>
                        <input className="form-control form-control-sm" value={cleanupForm.requisition_no} onChange={(event) => setCleanupField("requisition_no", event.target.value)} />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small">Receipt Reference</label>
                        <input className="form-control form-control-sm" value={cleanupForm.receipt_reference} onChange={(event) => setCleanupField("receipt_reference", event.target.value)} />
                      </div>
                      <div className="col-12">
                        <label className="form-label small">Remarks</label>
                        <textarea className="form-control form-control-sm" rows={3} value={cleanupForm.remarks} onChange={(event) => setCleanupField("remarks", event.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeCleanupEdit} disabled={savingCleanup}>
                      Close
                    </button>
                    <button className="btn btn-primary" type="button" onClick={() => void saveCleanupEdit()} disabled={savingCleanup}>
                      {savingCleanup ? (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      ) : (
                        <i className="bi bi-check2-circle me-1" />
                      )}
                      Save Cleanup
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show" />
          </>
        ) : null}

        {tagPreview ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tag-print-preview-title">
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h2 className="modal-title h5" id="tag-print-preview-title">Print Tag</h2>
                    <button className="btn-close" type="button" aria-label="Close" onClick={() => setTagPreview(null)} />
                  </div>
                  <div className="modal-body">
                    <div className="border rounded bg-light p-3">
                      <div className="small text-secondary mb-2">Tag Preview</div>
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="border bg-white d-flex align-items-center justify-content-center"
                          style={{ width: 132, height: 132, flex: "0 0 132px" }}
                        >
                          {tagQrDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tagQrDataUrl}
                              alt={`QR code for ${tagPreview.printableTag}`}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <span className="small text-secondary text-center">Generating QR...</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="fw-semibold text-break">{tagPreview.printableTag}</div>
                          <div className="small text-secondary text-break">{tagPreview.assetCode || "No asset selected"}</div>
                          <div className="small text-secondary text-break">{tagPreview.serialNumber}</div>
                          <div className="small text-secondary text-break">{tagPreview.location}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setTagPreview(null)}>
                      Close
                    </button>
                    <button
                      className="btn btn-outline-primary"
                      type="button"
                      disabled={selectedTagPreviews.length === 0 || printingTags}
                      onClick={printSelectedTags}
                    >
                      <i className="bi bi-printer me-1" />
                      {printingTags ? "Preparing..." : `Print Selected (${selectedTagPreviews.length})`}
                    </button>
                    <button className="btn btn-primary" type="button" disabled={!tagQrDataUrl || printingTags} onClick={printTagPreview}>
                      <i className="bi bi-printer me-1" />
                      {printingTags ? "Preparing..." : "Print This Tag"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show" />
          </>
        ) : null}
      </div>
    </main>
  );
}
