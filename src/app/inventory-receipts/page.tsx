"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { printTransactionDocument } from "@/lib/transaction-print";
import { AttributeFields, type AttributeDefinition, type AttributeValues } from "@/components/ims/AttributeFields";
import {
  ApprovalReferenceFields,
  DataTable,
  EmptyState,
  FieldLabel,
  FilterBar,
  PageHeader,
  PaginationControls,
  SearchableSelect,
  StatusBadge,
  type SearchableSelectOption,
} from "@/components/ims";

type ReceiptStatus = "draft" | "submitted" | "accepted" | "partially_accepted" | "rejected" | "posted" | "cancelled";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type LookupMap = {
  departments: RowData[];
  stores: RowData[];
  suppliers: RowData[];
  "funding-sources": RowData[];
  "research-projects": RowData[];
  items: RowData[];
  "asset-categories": RowData[];
  "units-of-measure": RowData[];
  "asset-attribute-definitions": AttributeDefinition[];
};

type LookupKey = keyof LookupMap;

type RowLookupKey = Exclude<LookupKey, "asset-attribute-definitions">;

type QuickMasterResource = "departments" | "stores" | "suppliers" | "funding-sources" | "research-projects";

type SystemSetting = {
  setting_key: string;
  setting_value: string | null;
};

type Receipt = {
  id: number;
  receipt_no: string;
  receipt_type: string;
  status: ReceiptStatus;
  supplier_id: number | null;
  po_reference: string | null;
  invoice_no: string | null;
  challan_no: string | null;
  receipt_date: string;
  store_id: number;
  department_id: number;
  funding_source_id: number | null;
  project_id: number | null;
  manual_approval_ref: string | null;
  manual_approval_date: string | null;
  manual_approved_by: string | null;
  remarks: string | null;
  posted_at: string | null;
  created_at: string;
};

type ReceiptItem = {
  id: number;
  receipt_id: number;
  item_id: number;
  description: string | null;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  unit_cost: number | null;
  total_cost: number | null;
  batch_no: string | null;
  expiry_date: string | null;
  inspection_status: string;
  inspection_remarks: string | null;
};

type ReceiptItemInput = {
  item_id: string;
  description: string;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  unit_cost: string;
  total_cost: string;
  batch_no: string;
  expiry_date: string;
  inspection_status: string;
  inspection_remarks: string;
};

type ReceiptForm = {
  receipt_no: string;
  receipt_type: string;
  supplier_id: string;
  po_reference: string;
  invoice_no: string;
  challan_no: string;
  receipt_date: string;
  store_id: string;
  department_id: string;
  funding_source_id: string;
  project_id: string;
  manual_approval_ref: string;
  manual_approval_date: string;
  manual_approved_by: string;
  remarks: string;
  status: ReceiptStatus;
  post_now: boolean;
};

type ItemType =
  | "consumable"
  | "fixed_asset"
  | "repairable"
  | "controlled_item"
  | "project_inventory"
  | "sample_prototype"
  | "software_license";

type QuickItemForm = {
  item_code: string;
  name: string;
  item_type: ItemType;
  category_id: string;
  subcategory_id: string;
  unit_id: string;
  description: string;
  brand: string;
  model: string;
  minimum_stock_level: string;
  is_capitalizable: boolean;
  is_sensitive_controlled: boolean;
  requires_serial_tracking: boolean;
  requires_batch_tracking: boolean;
  requires_expiry_tracking: boolean;
  attributes: AttributeValues;
  status: "active" | "inactive";
};

type QuickMasterForm = Record<string, string>;

type PendingAttachment = {
  file: File;
  name: string;
  size: number;
};

const receiptTypes = [
  { value: "purchase", label: "Purchase" },
  { value: "donation", label: "Donation" },
  { value: "grant", label: "Grant" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "opening_balance", label: "Opening Balance" },
  { value: "other", label: "Other" },
];

const itemTypeOptions: SearchableSelectOption[] = [
  { value: "consumable", label: "Consumable" },
  { value: "fixed_asset", label: "Fixed Asset" },
  { value: "repairable", label: "Repairable" },
  { value: "controlled_item", label: "Controlled Item" },
  { value: "project_inventory", label: "Project Inventory" },
  { value: "sample_prototype", label: "Sample/Prototype" },
  { value: "software_license", label: "Software License" },
];

const quickItemStatusOptions: SearchableSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const departmentTypeOptions: SearchableSelectOption[] = [
  { value: "academic", label: "Academic" },
  { value: "administrative", label: "Administrative" },
  { value: "store", label: "Store" },
  { value: "laboratory", label: "Laboratory" },
  { value: "hostel", label: "Hostel" },
  { value: "transport", label: "Transport" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

const storeTypeOptions: SearchableSelectOption[] = [
  { value: "central", label: "Central" },
  { value: "departmental", label: "Departmental" },
  { value: "laboratory", label: "Laboratory" },
  { value: "examination", label: "Examination" },
  { value: "project", label: "Project" },
  { value: "other", label: "Other" },
];

const projectCategoryOptions: SearchableSelectOption[] = [
  { value: "hec_nrpu", label: "HEC NRPU" },
  { value: "psf", label: "PSF" },
  { value: "internal_grant", label: "Internal Grant" },
  { value: "donor_project", label: "Donor Project" },
  { value: "industry_project", label: "Industry Project" },
  { value: "international_collaboration", label: "International Collaboration" },
  { value: "student_fyp", label: "Student FYP" },
  { value: "other", label: "Other" },
];

const sponsorTypeOptions: SearchableSelectOption[] = [
  { value: "university", label: "University" },
  { value: "government", label: "Government" },
  { value: "hec", label: "HEC" },
  { value: "psf", label: "PSF" },
  { value: "donor", label: "Donor" },
  { value: "industry", label: "Industry" },
  { value: "international", label: "International" },
  { value: "other", label: "Other" },
];

const projectStatusOptions: SearchableSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

const quickMasterResourceMeta: Record<QuickMasterResource, { title: string; selectField: keyof ReceiptForm }> = {
  departments: { title: "Department", selectField: "department_id" },
  stores: { title: "Store", selectField: "store_id" },
  suppliers: { title: "Supplier", selectField: "supplier_id" },
  "funding-sources": { title: "Funding Source", selectField: "funding_source_id" },
  "research-projects": { title: "Project", selectField: "project_id" },
};

const statusOptions: ReceiptStatus[] = [
  "draft",
  "submitted",
  "accepted",
  "partially_accepted",
  "rejected",
  "posted",
  "cancelled",
];

const inspectionStatusDisplay: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  partially_accepted: "Partially Accepted",
  rejected: "Rejected",
};

const extractApiMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

const normalizeQuantityInput = (value: string) => {
  if (value === "") return "";
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "";
  return String(Math.max(0, quantity));
};

const formatQuantityInput = (value: number) => {
  if (!Number.isFinite(value)) return "";
  const fixed = value.toFixed(3);
  return fixed.replace(/\.?0+$/, "");
};

const rejectedQuantityFor = (receivedValue: string, acceptedValue: string) => {
  const received = Number(receivedValue || 0);
  const accepted = Number(acceptedValue || 0);
  if (!Number.isFinite(received) || received <= 0) return "";
  return formatQuantityInput(Math.max(0, received - accepted));
};

const normalizeMoneyInput = (value: string) => {
  if (value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return String(Math.max(0, amount));
};

const formatMoneyInput = (value: number) => {
  if (!Number.isFinite(value)) return "";
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
};

const totalCostFor = (acceptedValue: string, unitCostValue: string) => {
  const accepted = Number(acceptedValue || 0);
  const unitCost = Number(unitCostValue || 0);
  if (!Number.isFinite(accepted) || !Number.isFinite(unitCost) || accepted <= 0 || unitCost < 0) return "";
  return formatMoneyInput(accepted * unitCost);
};

const itemOptionLabel = (row: RowData) =>
  `${row.item_code ?? row.code ?? row.id} - ${row.name ?? row.title ?? ""}`.trim();

const itemCodeSegment = (value: unknown) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const statusOptionLabel = (status: string) => status.replace("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());

type ApprovalReferenceState = {
  ref: string;
  authority: string;
  date: string;
  remarks: string;
};

const emptyItem: ReceiptItemInput = {
  item_id: "",
  description: "",
  quantity_received: "",
  quantity_accepted: "",
  quantity_rejected: "",
  unit_cost: "",
  total_cost: "",
  batch_no: "",
  expiry_date: "",
  inspection_status: "pending",
  inspection_remarks: "",
};

const createEmptyLookups = (): LookupMap => ({
  departments: [],
  stores: [],
  suppliers: [],
  "funding-sources": [],
  "research-projects": [],
  items: [],
  "asset-categories": [],
  "units-of-measure": [],
  "asset-attribute-definitions": [],
});

const createQuickItemForm = (): QuickItemForm => ({
  item_code: "",
  name: "",
  item_type: "consumable",
  category_id: "",
  subcategory_id: "",
  unit_id: "",
  description: "",
  brand: "",
  model: "",
  minimum_stock_level: "0",
  is_capitalizable: false,
  is_sensitive_controlled: false,
  requires_serial_tracking: false,
  requires_batch_tracking: false,
  requires_expiry_tracking: false,
  attributes: {},
  status: "active",
});

const quickItemDefaultsForCategory = (
  category: RowData | null | undefined,
): Pick<
  QuickItemForm,
  | "item_type"
  | "is_capitalizable"
  | "is_sensitive_controlled"
  | "requires_serial_tracking"
  | "requires_batch_tracking"
  | "requires_expiry_tracking"
> => {
  const code = String(category?.code ?? "").trim().toUpperCase();
  const name = String(category?.name ?? "").trim().toLowerCase();
  const haystack = `${code} ${name}`;

  if (code === "STR" || haystack.includes("station")) {
    return {
      item_type: "consumable",
      is_capitalizable: false,
      is_sensitive_controlled: false,
      requires_serial_tracking: false,
      requires_batch_tracking: false,
      requires_expiry_tracking: false,
    };
  }

  if (haystack.includes("controlled")) {
    return {
      item_type: "controlled_item",
      is_capitalizable: false,
      is_sensitive_controlled: true,
      requires_serial_tracking: true,
      requires_batch_tracking: false,
      requires_expiry_tracking: false,
    };
  }

  return {
    item_type: "fixed_asset",
    is_capitalizable: true,
    is_sensitive_controlled: false,
    requires_serial_tracking: false,
    requires_batch_tracking: false,
    requires_expiry_tracking: false,
  };
};

const createQuickMasterForm = (resource: QuickMasterResource, receiptForm: ReceiptForm): QuickMasterForm => {
  if (resource === "departments") {
    return {
      code: "",
      name: "",
      erp_department_id: "",
      department_type: "academic",
      status: "active",
    };
  }

  if (resource === "stores") {
    return {
      code: "",
      name: "",
      department_id: receiptForm.department_id,
      store_type: "departmental",
      status: "active",
    };
  }

  if (resource === "suppliers") {
    return {
      name: "",
      ntn: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      status: "active",
    };
  }

  if (resource === "funding-sources") {
    return {
      code: "",
      name: "",
      sponsor_type: "university",
      status: "active",
    };
  }

  return {
    project_code: "",
    title: "",
    sponsor: "",
    project_category: "internal_grant",
    department_id: receiptForm.department_id,
    funding_source_id: receiptForm.funding_source_id,
    cost_center_code: "",
    start_date: "",
    end_date: "",
    status: "active",
  };
};

const toLookupOption = (row: RowData): SearchableSelectOption => ({
  value: String(row.id),
  label: `${row.code ?? ""}${row.code && row.name ? " - " : ""}${row.name ?? ""}`.trim() || `#${row.id}`,
  keywords: [row.code, row.name].filter(Boolean).join(" "),
});

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 25;

const defaultForm: ReceiptForm = {
  receipt_no: "",
  receipt_type: "purchase",
  supplier_id: "",
  po_reference: "",
  invoice_no: "",
  challan_no: "",
  receipt_date: new Date().toISOString().slice(0, 10),
  store_id: "",
  department_id: "",
  funding_source_id: "",
  project_id: "",
  manual_approval_ref: "",
  manual_approval_date: "",
  manual_approved_by: "",
  remarks: "",
  status: "draft",
  post_now: false,
};

const toPayloadDate = (value: string): string | null => value.trim() ? value : null;

const previewYearFromDate = (date: string): string => {
  const isoYear = date.match(/^(\d{4})-/)?.[1];
  const displayYear = date.match(/(\d{4})$/)?.[1];

  return isoYear ?? displayYear ?? String(new Date().getFullYear());
};

const previewReceiptNo = (date: string): string => `GRN-${previewYearFromDate(date)}-####`;

export default function InventoryReceiptsPage() {
  const { isAuthenticated, loading } = useAuth();
  const [rows, setRows] = useState<Receipt[]>([]);
  const [lookups, setLookups] = useState<LookupMap>(createEmptyLookups);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currency, setCurrency] = useState("PKR");
  const [form, setForm] = useState<ReceiptForm>(defaultForm);
  const [approvalReference, setApprovalReference] = useState<ApprovalReferenceState>({
    ref: defaultForm.manual_approval_ref,
    authority: defaultForm.manual_approved_by,
    date: defaultForm.manual_approval_date,
    remarks: "",
  });
  const [items, setItems] = useState<ReceiptItemInput[]>([emptyItem]);
  const [attachmentFiles, setAttachmentFiles] = useState<PendingAttachment[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, ReceiptItem[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<number, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickItemOpen, setQuickItemOpen] = useState(false);
  const [quickItemRowIndex, setQuickItemRowIndex] = useState<number | null>(null);
  const [quickItemSaving, setQuickItemSaving] = useState(false);
  const [quickItemForm, setQuickItemForm] = useState<QuickItemForm>(createQuickItemForm);
  const [quickItemError, setQuickItemError] = useState("");
  const [quickMasterOpen, setQuickMasterOpen] = useState(false);
  const [quickMasterResource, setQuickMasterResource] = useState<QuickMasterResource>("departments");
  const [quickMasterForm, setQuickMasterForm] = useState<QuickMasterForm>({});
  const [quickMasterSaving, setQuickMasterSaving] = useState(false);
  const [quickMasterError, setQuickMasterError] = useState("");

  const [isPostingReceipt, setIsPostingReceipt] = useState(false);
  const [uploadingAttachmentId, setUploadingAttachmentId] = useState<number | null>(null);

  const attachmentTotalBytes = useMemo(
    () => attachmentFiles.reduce((acc, item) => acc + item.size, 0),
    [attachmentFiles],
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 KB";
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const authReady = useMemo(() => isAuthenticated && !loading, [isAuthenticated, loading]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const loadCurrency = async () => {
      try {
        const response = await api.get<{ data: SystemSetting[] }>("/system-settings");
        const settings = response.data?.data ?? [];
        const currencySetting = settings.find((setting) => setting.setting_key === "finance.default_currency");
        setCurrency(currencySetting?.setting_value || "PKR");
      } catch {
        setCurrency("PKR");
      }
    };

    void loadCurrency();
  }, [authReady]);

  const lookupLabel = (source: RowLookupKey, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const rows = lookups[source] ?? [];
    const match = rows.find((row) => String(row.id) === String(value));

    if (!match) {
      return String(value);
    }

    return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? ""}`;
  };

  const itemOptions = useMemo(
    () =>
      [...lookups.items]
        .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
        .map((row) => ({
          value: String(row.id),
          label: itemOptionLabel(row),
          keywords: [row.item_code, row.code, row.name, row.title].filter(Boolean).join(" "),
        })),
    [lookups.items],
  );

  const receiptTypeOptions = useMemo<SearchableSelectOption[]>(
    () => receiptTypes.map((type) => ({ value: type.value, label: type.label })),
    [],
  );

  const receiptStatusOptions = useMemo<SearchableSelectOption[]>(
    () => statusOptions.map((status) => ({ value: status, label: statusOptionLabel(status) })),
    [],
  );

  const filterStatusOptions = useMemo<SearchableSelectOption[]>(
    () => [{ value: "", label: "All" }, ...receiptStatusOptions],
    [receiptStatusOptions],
  );

  const storeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.stores.map((row) => ({
        value: String(row.id),
        label: `${row.code ?? row.id} - ${row.name ?? ""}`.trim(),
        keywords: [row.code, row.name].filter(Boolean).join(" "),
      })),
    [lookups.stores],
  );

  const filterStoreOptions = useMemo<SearchableSelectOption[]>(
    () => [{ value: "", label: "All stores" }, ...storeOptions],
    [storeOptions],
  );

  const departmentOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.departments.map((row) => ({
        value: String(row.id),
        label: `${row.code ?? row.id} - ${row.name ?? ""}`.trim(),
        keywords: [row.code, row.name].filter(Boolean).join(" "),
      })),
    [lookups.departments],
  );

  const filterDepartmentOptions = useMemo<SearchableSelectOption[]>(
    () => [{ value: "", label: "All departments" }, ...departmentOptions],
    [departmentOptions],
  );

  const supplierOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.suppliers.map((row) => ({
        value: String(row.id),
        label: String(row.name ?? row.code ?? row.id),
        keywords: [row.code, row.name].filter(Boolean).join(" "),
      })),
    [lookups.suppliers],
  );

  const fundingSourceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups["funding-sources"].map((row) => ({
        value: String(row.id),
        label: String(row.name ?? row.code ?? row.id),
        keywords: [row.code, row.name].filter(Boolean).join(" "),
      })),
    [lookups],
  );

  const projectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups["research-projects"].map((row) => ({
        value: String(row.id),
        label: `${row.project_code ?? row.code ?? row.id} - ${row.title ?? row.name ?? ""}`.trim(),
        keywords: [row.project_code, row.code, row.title, row.name].filter(Boolean).join(" "),
      })),
    [lookups],
  );

  const parentCategories = useMemo(
    () => lookups["asset-categories"].filter((category) => !category.parent_category_id),
    [lookups],
  );

  const selectedQuickItemCategory = useMemo(
    () => parentCategories.find((category) => String(category.id) === quickItemForm.category_id),
    [parentCategories, quickItemForm.category_id],
  );

  const quickItemSubcategories = useMemo(
    () =>
      selectedQuickItemCategory
        ? lookups["asset-categories"].filter(
            (category) => String(category.parent_category_id ?? "") === String(selectedQuickItemCategory.id),
          )
        : [],
    [lookups, selectedQuickItemCategory],
  );

  const categoryOptions = useMemo(() => parentCategories.map(toLookupOption), [parentCategories]);
  const subcategoryOptions = useMemo(() => quickItemSubcategories.map(toLookupOption), [quickItemSubcategories]);
  const unitOptions = useMemo(() => lookups["units-of-measure"].map(toLookupOption), [lookups]);
  const generatedQuickItemCode = useMemo(() => {
    if (!selectedQuickItemCategory?.code) {
      return "";
    }

    const subcategory = quickItemForm.subcategory_id
      ? lookups["asset-categories"].find((category) => String(category.id) === quickItemForm.subcategory_id)
      : null;
    const prefix = [itemCodeSegment(selectedQuickItemCategory.code), itemCodeSegment(subcategory?.code)]
      .filter(Boolean)
      .join("-");

    if (!prefix) {
      return "";
    }

    const maxSequence = lookups.items.reduce((max, item) => {
      const code = String(item.item_code ?? item.code ?? "");
      if (!code.startsWith(`${prefix}-`)) {
        return max;
      }

      const match = code.match(/-(\d{4})$/);
      if (!match) {
        return max;
      }

      return Math.max(max, Number(match[1]));
    }, 0);

    return `${prefix}-${String(maxSequence + 1).padStart(4, "0")}`;
  }, [lookups, quickItemForm.subcategory_id, selectedQuickItemCategory]);

  const inspectionStatusOptions = useMemo<SearchableSelectOption[]>(
    () =>
      Object.entries(inspectionStatusDisplay).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const loadRows = async () => {
      try {
        const params: Record<string, string> = {};

        if (search.trim()) {
          params.search = search.trim();
        }

        if (statusFilter) {
          params.status = statusFilter;
        }

        if (storeFilter) {
          params.store_id = storeFilter;
        }

        if (departmentFilter) {
          params.department_id = departmentFilter;
        }

        const response = await api.get("/inventory-receipts", {
          params,
        });

        const data = response.data?.data;
        setRows(Array.isArray(data) ? data : []);
        setError("");
      } catch {
        setRows([]);
        setError("Unable to load receipts. Verify token and endpoint.");
      }
    };

    void loadRows();
  }, [search, statusFilter, storeFilter, departmentFilter, authReady]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [search, statusFilter, storeFilter, departmentFilter]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const requiredLookups: LookupKey[] = [
      "departments",
      "stores",
      "suppliers",
      "funding-sources",
      "research-projects",
      "items",
      "asset-categories",
      "units-of-measure",
      "asset-attribute-definitions",
    ];

    const loadLookups = async () => {
      const updates: Promise<void>[] = [];
      const copy = createEmptyLookups();

      for (const key of requiredLookups) {
        const request = api.get(`/master-data/${key}`).then((res) => {
          const payload = res.data?.data;
          if (Array.isArray(payload)) {
            if (key === "asset-attribute-definitions") {
              copy[key] = payload as AttributeDefinition[];
            } else {
              copy[key] = payload as RowData[];
            }
          }
        });

        updates.push(request.then(() => undefined));
      }

      await Promise.all(updates);
      setLookups(copy);
    };

    void loadLookups();
  }, [authReady]);

  const setFormValue = (key: keyof ReceiptForm, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setApprovalReferenceValue = (next: ApprovalReferenceState) => {
    setApprovalReference(next);
    setForm((current) => ({
      ...current,
      manual_approval_ref: next.ref,
      manual_approval_date: next.date,
      manual_approved_by: next.authority,
    }));
  };

  const setItemValue = (index: number, key: keyof ReceiptItemInput, value: string) => {
    setItems((current) =>
      current.map((row, idx) => {
        if (idx !== index) return row;
        if (key === "quantity_received") {
          const quantityReceived = normalizeQuantityInput(value);
          const received = Number(quantityReceived || 0);
          const currentAccepted = Number(row.quantity_accepted || 0);
          const quantityAccepted =
            quantityReceived === ""
              ? ""
              : formatQuantityInput(Math.min(Math.max(0, currentAccepted), received));

          return {
            ...row,
            quantity_received: quantityReceived,
            quantity_accepted: quantityAccepted,
            quantity_rejected: rejectedQuantityFor(quantityReceived, quantityAccepted),
            total_cost: totalCostFor(quantityAccepted, row.unit_cost),
          };
        }

        if (key === "quantity_accepted") {
          const acceptedInput = normalizeQuantityInput(value);
          const received = Number(row.quantity_received || 0);
          const accepted = Number(acceptedInput || 0);
          const quantityAccepted =
            acceptedInput === ""
              ? ""
              : formatQuantityInput(Math.min(Math.max(0, accepted), Math.max(0, received)));

          return {
            ...row,
            quantity_accepted: quantityAccepted,
            quantity_rejected: rejectedQuantityFor(row.quantity_received, quantityAccepted),
            total_cost: totalCostFor(quantityAccepted, row.unit_cost),
          };
        }

        if (key === "quantity_rejected") {
          const rejectedInput = normalizeQuantityInput(value);
          const received = Number(row.quantity_received || 0);
          const accepted = Number(row.quantity_accepted || 0);
          const maximumRejected = Math.max(0, received - accepted);
          const rejected = Number(rejectedInput || 0);
          const quantityRejected =
            rejectedInput === ""
              ? ""
              : formatQuantityInput(Math.min(Math.max(0, rejected), maximumRejected));

          return {
            ...row,
            quantity_rejected: quantityRejected,
          };
        }

        if (key === "unit_cost") {
          const unitCost = normalizeMoneyInput(value);

          return {
            ...row,
            unit_cost: unitCost,
            total_cost: totalCostFor(row.quantity_accepted, unitCost),
          };
        }

        if (key === "total_cost") {
          return { ...row, total_cost: normalizeMoneyInput(value) };
        }

        return { ...row, [key]: value };
      }),
    );
  };

  const addItemRow = () => {
    setItems((current) => [...current, { ...emptyItem }]);
  };

  const removeItemRow = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((current) => current.filter((_, idx) => idx !== index));
  };

  const resetReceiptForm = () => {
    const nextForm = { ...defaultForm, receipt_date: new Date().toISOString().slice(0, 10) };
    setForm(nextForm);
    setApprovalReference({
      ref: nextForm.manual_approval_ref,
      authority: nextForm.manual_approved_by,
      date: nextForm.manual_approval_date,
      remarks: "",
    });
    setItems([{ ...emptyItem }]);
    setAttachmentFiles([]);
    setIsPostingReceipt(false);
  };

  const openCreateDialog = () => {
    resetReceiptForm();
    setError("");
    setDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setDialogOpen(false);
    setQuickItemOpen(false);
    setQuickItemRowIndex(null);
    setQuickItemError("");
    setQuickMasterOpen(false);
    setQuickMasterError("");
    setIsPostingReceipt(false);
  };

  const openQuickItemDialog = (rowIndex: number) => {
    setQuickItemRowIndex(rowIndex);
    setQuickItemForm(createQuickItemForm());
    setQuickItemError("");
    setQuickItemOpen(true);
  };

  const closeQuickItemDialog = () => {
    setQuickItemOpen(false);
    setQuickItemRowIndex(null);
    setQuickItemSaving(false);
    setQuickItemError("");
  };

  const setQuickItemField = <K extends keyof QuickItemForm>(key: K, value: QuickItemForm[K]) => {
    setQuickItemForm((current) => ({ ...current, [key]: value }));
  };

  const selectQuickItemCategory = (categoryId: string) => {
    const selectedCategory = parentCategories.find((category) => String(category.id) === categoryId);

    setQuickItemForm((current) => ({
      ...current,
      ...quickItemDefaultsForCategory(selectedCategory),
      category_id: categoryId,
      subcategory_id: "",
      attributes: {},
    }));
  };

  const reloadItemLookup = async () => {
    const response = await api.get("/master-data/items");
    const payload = response.data?.data;
    const nextItems = Array.isArray(payload) ? (payload as RowData[]) : [];
    setLookups((current) => ({ ...current, items: nextItems }));
    return nextItems;
  };

  const reloadRowLookup = async (resource: RowLookupKey) => {
    const response = await api.get(`/master-data/${resource}`);
    const payload = response.data?.data;
    const nextRows = Array.isArray(payload) ? (payload as RowData[]) : [];
    setLookups((current) => ({ ...current, [resource]: nextRows }));
    return nextRows;
  };

  const saveQuickItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setQuickItemError("Please sign in before creating item records.");
      return;
    }

    setQuickItemSaving(true);
    setQuickItemError("");

    try {
      if (
        !quickItemForm.name.trim() ||
        !quickItemForm.item_type ||
        !quickItemForm.category_id ||
        !quickItemForm.unit_id
      ) {
        setQuickItemError("Item Name, Item Type, Category, and Unit of Measure are required.");
        setQuickItemSaving(false);
        return;
      }

      const payload = {
        item_code: generatedQuickItemCode,
        name: quickItemForm.name.trim(),
        item_type: quickItemForm.item_type,
        category_id: Number(quickItemForm.category_id),
        subcategory_id: quickItemForm.subcategory_id ? Number(quickItemForm.subcategory_id) : null,
        unit_id: Number(quickItemForm.unit_id),
        description: quickItemForm.description.trim() || null,
        brand: quickItemForm.brand.trim() || null,
        model: quickItemForm.model.trim() || null,
        minimum_stock_level: Number(quickItemForm.minimum_stock_level || 0),
        is_capitalizable: quickItemForm.is_capitalizable,
        is_sensitive_controlled: quickItemForm.is_sensitive_controlled,
        requires_serial_tracking: quickItemForm.requires_serial_tracking,
        requires_batch_tracking: quickItemForm.requires_batch_tracking,
        requires_expiry_tracking: quickItemForm.requires_expiry_tracking,
        attributes: quickItemForm.attributes,
        status: quickItemForm.status,
      };

      const response = await api.post("/master-data/items", payload);
      const created = response.data?.data as RowData | undefined;
      const nextItems = await reloadItemLookup();
      const createdItem =
        created?.id
          ? created
          : nextItems.find((item) => String(item.item_code ?? item.code ?? "") === generatedQuickItemCode);

      if (createdItem?.id && quickItemRowIndex !== null) {
        setItemValue(quickItemRowIndex, "item_id", String(createdItem.id));
      }

      setMessage("Item created in Item Master and selected for this receipt.");
      setError("");
      setQuickItemOpen(false);
      setQuickItemRowIndex(null);
      setQuickItemForm(createQuickItemForm());
    } catch (itemError) {
      setQuickItemError(extractApiMessage(itemError, "Unable to create item. Verify required fields and duplicate code."));
    } finally {
      setQuickItemSaving(false);
    }
  };

  const openQuickMasterDialog = (resource: QuickMasterResource) => {
    setQuickMasterResource(resource);
    setQuickMasterForm(createQuickMasterForm(resource, form));
    setQuickMasterError("");
    setQuickMasterOpen(true);
  };

  const closeQuickMasterDialog = () => {
    setQuickMasterOpen(false);
    setQuickMasterSaving(false);
    setQuickMasterError("");
  };

  const setQuickMasterField = (key: string, value: string) => {
    setQuickMasterForm((current) => ({ ...current, [key]: value }));
  };

  const quickMasterPayload = () => {
    if (quickMasterResource === "departments") {
      return {
        code: quickMasterForm.code?.trim(),
        name: quickMasterForm.name?.trim(),
        erp_department_id: quickMasterForm.erp_department_id?.trim() || null,
        department_type: quickMasterForm.department_type,
        status: quickMasterForm.status,
      };
    }

    if (quickMasterResource === "stores") {
      return {
        code: quickMasterForm.code?.trim(),
        name: quickMasterForm.name?.trim(),
        department_id: Number(quickMasterForm.department_id),
        building_id: null,
        room_id: null,
        store_type: quickMasterForm.store_type,
        status: quickMasterForm.status,
      };
    }

    if (quickMasterResource === "suppliers") {
      return {
        name: quickMasterForm.name?.trim(),
        ntn: quickMasterForm.ntn?.trim() || null,
        contact_person: quickMasterForm.contact_person?.trim() || null,
        phone: quickMasterForm.phone?.trim() || null,
        email: quickMasterForm.email?.trim() || null,
        address: quickMasterForm.address?.trim() || null,
        status: quickMasterForm.status,
      };
    }

    if (quickMasterResource === "funding-sources") {
      return {
        code: quickMasterForm.code?.trim(),
        name: quickMasterForm.name?.trim(),
        sponsor_type: quickMasterForm.sponsor_type,
        status: quickMasterForm.status,
      };
    }

    return {
      project_code: quickMasterForm.project_code?.trim(),
      title: quickMasterForm.title?.trim(),
      sponsor: quickMasterForm.sponsor?.trim() || null,
      project_category: quickMasterForm.project_category,
      pi_user_id: null,
      co_pi_user_id: null,
      department_id: quickMasterForm.department_id ? Number(quickMasterForm.department_id) : null,
      funding_source_id: quickMasterForm.funding_source_id ? Number(quickMasterForm.funding_source_id) : null,
      cost_center_code: quickMasterForm.cost_center_code?.trim() || null,
      start_date: toPayloadDate(quickMasterForm.start_date ?? ""),
      end_date: toPayloadDate(quickMasterForm.end_date ?? ""),
      status: quickMasterForm.status,
    };
  };

  const validateQuickMaster = () => {
    if (quickMasterResource === "departments") {
      return Boolean(quickMasterForm.code?.trim() && quickMasterForm.name?.trim() && quickMasterForm.department_type);
    }

    if (quickMasterResource === "stores") {
      return Boolean(
        quickMasterForm.code?.trim() &&
          quickMasterForm.name?.trim() &&
          quickMasterForm.department_id &&
          quickMasterForm.store_type,
      );
    }

    if (quickMasterResource === "suppliers") {
      return Boolean(quickMasterForm.name?.trim());
    }

    if (quickMasterResource === "funding-sources") {
      return Boolean(quickMasterForm.code?.trim() && quickMasterForm.name?.trim());
    }

    return Boolean(quickMasterForm.project_code?.trim() && quickMasterForm.title?.trim() && quickMasterForm.project_category);
  };

  const saveQuickMaster = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setQuickMasterError("Please sign in before creating master data records.");
      return;
    }

    if (!validateQuickMaster()) {
      setQuickMasterError("Please fill the required fields before saving.");
      return;
    }

    setQuickMasterSaving(true);
    setQuickMasterError("");

    try {
      const response = await api.post(`/master-data/${quickMasterResource}`, quickMasterPayload());
      const created = response.data?.data as RowData | undefined;
      const nextRows = await reloadRowLookup(quickMasterResource);
      const createdRow =
        created?.id
          ? created
          : nextRows.find((row) => {
              if (quickMasterResource === "research-projects") {
                return String(row.project_code ?? "") === quickMasterForm.project_code?.trim();
              }

              if (quickMasterResource === "suppliers") {
                return String(row.name ?? "") === quickMasterForm.name?.trim();
              }

              return String(row.code ?? "") === quickMasterForm.code?.trim();
            });

      if (createdRow?.id) {
        setFormValue(quickMasterResourceMeta[quickMasterResource].selectField, String(createdRow.id));
      }

      setMessage(`${quickMasterResourceMeta[quickMasterResource].title} created and selected for this receipt.`);
      setError("");
      setQuickMasterOpen(false);
    } catch (masterError) {
      setQuickMasterError(extractApiMessage(masterError, "Unable to create record. Verify required fields and duplicates."));
    } finally {
      setQuickMasterSaving(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setStoreFilter("");
    setDepartmentFilter("");
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = event.target.files;
    if (!incoming) return;

    const nextFiles = Array.from(incoming);
    let runningTotal = attachmentTotalBytes;

    for (const file of nextFiles) {
      if (file.size === 0) {
        setError("Each attachment must be greater than 0 bytes.");
        return;
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setError("Each attachment must be 10 MB or less.");
        return;
      }

      if (runningTotal + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
        setError("Total attachment size cannot exceed 50 MB.");
        return;
      }

      setAttachmentFiles((current) => [...current, { file, name: file.name, size: file.size }]);
      runningTotal += file.size;
      setError("");
    }

    event.target.value = "";
  };

  const expandedItemColumns = [
    { key: "item", header: "Item", render: (receiptItem: ReceiptItem) => lookupLabel("items", receiptItem.item_id) },
    { key: "qty", header: "Qty Rec", render: (receiptItem: ReceiptItem) => receiptItem.quantity_received },
    { key: "accepted", header: "Accepted", render: (receiptItem: ReceiptItem) => receiptItem.quantity_accepted },
    { key: "rejected", header: "Rejected", render: (receiptItem: ReceiptItem) => receiptItem.quantity_rejected },
    { key: "unitCost", header: `Unit Cost (${currency})`, render: (receiptItem: ReceiptItem) => receiptItem.unit_cost ?? "-" },
    { key: "totalCost", header: `Total Cost (${currency})`, render: (receiptItem: ReceiptItem) => receiptItem.total_cost ?? "-" },
    {
      key: "inspection",
      header: "Inspection",
      render: (receiptItem: ReceiptItem) => (
        <span className="d-flex align-items-center gap-2">
          <StatusBadge status={inspectionStatusDisplay[receiptItem.inspection_status] ?? receiptItem.inspection_status ?? "-"} />
          <span className="text-secondary small">{receiptItem.inspection_remarks ?? ""}</span>
        </span>
      ),
    },
  ];

  const refreshRows = async () => {
    if (!authReady) return;
    try {
      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (storeFilter) params.store_id = storeFilter;
      if (departmentFilter) params.department_id = departmentFilter;

      const response = await api.get("/inventory-receipts", { params });

      const data = response.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setError("Could not refresh receipts.");
    }
  };

  const postReceipt = async (receiptId: number) => {
    if (!authReady) return;

    await api.post(`/inventory-receipts/${receiptId}/post`, {});
  };

  const uploadReceiptAttachment = async (receiptId: number, file: File) => {
    const formData = new FormData();
    formData.append("entity_type", "inventory_receipt");
    formData.append("entity_id", String(receiptId));
    formData.append("document_type", "supporting");
    formData.append("file", file);

    await api.post("/documents", formData);
  };

  const handleSavedReceiptAttachment = async (receiptId: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.size === 0) {
      setError("Attachment must be greater than 0 bytes.");
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setError("Attachment must be 10 MB or less.");
      return;
    }

    try {
      setUploadingAttachmentId(receiptId);
      await uploadReceiptAttachment(receiptId, file);
      setMessage("Supporting document attached. You can now post the receipt.");
      setError("");
      await refreshRows();
    } catch (attachmentError) {
      setError(extractApiMessage(attachmentError, "Could not attach supporting document."));
    } finally {
      setUploadingAttachmentId(null);
    }
  };

  const saveReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Authentication token required.");
      return;
    }

    const receiptItems = items
      .map((row): ReceiptItemInput | null => {
        const itemId = Number(row.item_id);

        if (!itemId) return null;

        return row;
      })
      .filter(Boolean) as ReceiptItemInput[];

    if (receiptItems.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    if (form.post_now && attachmentFiles.length === 0) {
      setError("Please add at least one supporting document before posting this receipt.");
      return;
    }

    const payload: Record<string, unknown> = {
      receipt_type: form.receipt_type,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      po_reference: form.po_reference.trim() || null,
      invoice_no: form.invoice_no.trim() || null,
      challan_no: form.challan_no.trim() || null,
      receipt_date: form.receipt_date,
      store_id: Number(form.store_id),
      department_id: Number(form.department_id),
      funding_source_id: form.funding_source_id ? Number(form.funding_source_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      manual_approval_ref: form.manual_approval_ref.trim() || null,
      manual_approval_date: toPayloadDate(form.manual_approval_date),
      manual_approved_by: form.manual_approved_by.trim() || null,
      remarks: form.remarks.trim() || null,
      status: form.status,
      post_now: form.post_now,
      items: receiptItems.map((row) => {
        const quantityAccepted = row.quantity_accepted !== "" ? Number(row.quantity_accepted) : null;
        const quantityRejected = row.quantity_rejected !== "" ? Number(row.quantity_rejected) : null;

        return {
          item_id: Number(row.item_id),
          description: row.description.trim() || null,
          quantity_received: Number(row.quantity_received || 0),
          quantity_accepted: Number.isFinite(quantityAccepted ?? 0) ? (quantityAccepted ?? undefined) : undefined,
          quantity_rejected: Number.isFinite(quantityRejected ?? 0) ? (quantityRejected ?? undefined) : undefined,
          unit_cost: row.unit_cost !== "" ? Number(row.unit_cost) : null,
          total_cost: row.total_cost !== "" ? Number(row.total_cost) : null,
          batch_no: row.batch_no.trim() || null,
          expiry_date: toPayloadDate(row.expiry_date),
          inspection_status: row.inspection_status,
          inspection_remarks: row.inspection_remarks.trim() || null,
        };
      }),
    };

    if (!payload.store_id || !payload.department_id || !payload.receipt_type) {
      setError("Receipt Type, Store and Department are required.");
      return;
    }

    if (receiptItems.some((row) => Number(row.quantity_received || 0) <= 0)) {
      setError("All item rows must include quantity received greater than 0.");
      return;
    }

    if (receiptItems.some((row) => Number(row.quantity_accepted || 0) > Number(row.quantity_received || 0))) {
      setError("Qty Accepted cannot be greater than Qty Received.");
      return;
    }

    if (
      receiptItems.some(
        (row) => Number(row.quantity_accepted || 0) + Number(row.quantity_rejected || 0) > Number(row.quantity_received || 0),
      )
    ) {
      setError("Qty Accepted plus Qty Rejected cannot be greater than Qty Received.");
      return;
    }

    try {
      setIsPostingReceipt(true);
      const receiptResponse = await api.post("/inventory-receipts", { ...payload, post_now: false });
      const receiptId = receiptResponse.data?.data?.id;

      if (!receiptId) {
        throw new Error("Could not create receipt.");
      }

      for (const attachment of attachmentFiles) {
        await uploadReceiptAttachment(receiptId, attachment.file);
      }

      if (form.post_now) {
        await postReceipt(receiptId);
        setMessage("Receipt created and posted successfully.");
      } else {
        setMessage("Receipt created successfully.");
      }

      setError("");
      const nextForm = { ...defaultForm, receipt_date: form.receipt_date, receipt_type: form.receipt_type };
      setForm(nextForm);
      setApprovalReference({
        ref: nextForm.manual_approval_ref,
        authority: nextForm.manual_approved_by,
        date: nextForm.manual_approval_date,
        remarks: "",
      });
      setItems([{ ...emptyItem }]);
      setAttachmentFiles([]);
      setDialogOpen(false);
      await refreshRows();
    } catch (saveError) {
      setError(extractApiMessage(saveError, "Could not create receipt. Verify required fields."));
      setIsPostingReceipt(false);
      return;
    }

    setIsPostingReceipt(false);
  };

  const postReceiptAndRefresh = async (receiptId: number) => {
    if (!authReady) return;

    try {
      await postReceipt(receiptId);
      setMessage("Receipt posted and stock updated.");
      setError("");
      await refreshRows();
      if (expandedId === receiptId) {
        const response = await api.get(`/inventory-receipts/${receiptId}`);
        const itemsData = response.data?.items;
        setExpandedItems((current) => ({ ...current, [receiptId]: Array.isArray(itemsData) ? itemsData : [] }));
      }
    } catch (postError) {
      setError(extractApiMessage(postError, "Could not post receipt."));
    }
  };

  const fetchReceiptItems = async (receiptId: number): Promise<ReceiptItem[]> => {
    const response = await api.get(`/inventory-receipts/${receiptId}`);
    const itemsData = response.data?.items;
    return Array.isArray(itemsData) ? itemsData : [];
  };

  const loadReceiptItems = async (receiptId: number) => {
    if (expandedItems[receiptId]) {
      setExpandedId((current) => (current === receiptId ? null : receiptId));
      return;
    }

    try {
      setExpandedLoading((current) => ({ ...current, [receiptId]: true }));
      const normalized = await fetchReceiptItems(receiptId);
      setExpandedItems((current) => ({ ...current, [receiptId]: normalized }));
      setExpandedId(receiptId);
      setExpandedLoading((current) => ({ ...current, [receiptId]: false }));
    } catch {
      setExpandedLoading((current) => ({ ...current, [receiptId]: false }));
      setError("Could not load receipt items.");
    }
  };

  const printReceipt = async (receipt: Receipt) => {
    try {
      const itemRows = expandedItems[receipt.id] ?? (await fetchReceiptItems(receipt.id));
      setExpandedItems((current) => ({ ...current, [receipt.id]: itemRows }));
      const printed = printTransactionDocument<ReceiptItem>({
        title: "Goods Receipt Note",
        subtitle: "Inventory receipt voucher with received, accepted, and rejected quantities.",
        reference: receipt.receipt_no,
        status: receipt.status,
        meta: [
          { label: "Receipt No", value: receipt.receipt_no },
          { label: "Receipt Type", value: receipt.receipt_type },
          { label: "Receipt Date", value: String(receipt.receipt_date).split("T")[0] },
          { label: "Store", value: lookupLabel("stores", receipt.store_id) },
          { label: "Department", value: lookupLabel("departments", receipt.department_id) },
          { label: "Supplier", value: lookupLabel("suppliers", receipt.supplier_id) },
          { label: "Funding Source", value: lookupLabel("funding-sources", receipt.funding_source_id) },
          { label: "Project", value: lookupLabel("research-projects", receipt.project_id) },
          { label: "PO Reference", value: receipt.po_reference },
          { label: "Invoice No", value: receipt.invoice_no },
          { label: "Challan No", value: receipt.challan_no },
          { label: "Approval Ref", value: receipt.manual_approval_ref },
          { label: "Approved By", value: receipt.manual_approved_by },
          { label: "Approval Date", value: receipt.manual_approval_date },
        ],
        columns: [
          { header: "Item", render: (item) => lookupLabel("items", item.item_id) },
          { header: "Description", render: (item) => item.description },
          { header: "Qty Received", render: (item) => item.quantity_received },
          { header: "Qty Accepted", render: (item) => item.quantity_accepted },
          { header: "Qty Rejected", render: (item) => item.quantity_rejected },
          { header: `Unit Cost (${currency})`, render: (item) => item.unit_cost },
          { header: `Total Cost (${currency})`, render: (item) => item.total_cost },
          { header: "Batch", render: (item) => item.batch_no },
          { header: "Expiry", render: (item) => item.expiry_date },
          { header: "Inspection", render: (item) => inspectionStatusDisplay[item.inspection_status] ?? item.inspection_status },
        ],
        rows: itemRows,
        note: receipt.remarks,
      });

      if (!printed) {
        setError("Popup blocked. Please allow popups to print this receipt.");
      }
    } catch {
      setError("Could not prepare receipt print view.");
    }
  };

  const deleteReceipt = async (receiptId: number) => {
    if (!authReady) return;

    if (!window.confirm("Delete this receipt?")) return;

    try {
      await api.delete(`/inventory-receipts/${receiptId}`);
      setMessage("Receipt deleted.");
      await refreshRows();
      setExpandedId((current) => (current === receiptId ? null : current));
    } catch {
      setError("Could not delete receipt.");
    }
  };

  const renderQuickMasterFields = () => {
    if (quickMasterResource === "departments") {
      return (
        <>
          <div className="col-12 col-md-4">
            <FieldLabel required>Code</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.code ?? ""}
              onChange={(event) => setQuickMasterField("code", event.target.value)}
              placeholder="e.g. ENV"
              required
            />
          </div>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. Environmental Sciences"
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">ERP Department ID</label>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.erp_department_id ?? ""}
              onChange={(event) => setQuickMasterField("erp_department_id", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <FieldLabel required>Type</FieldLabel>
            <SearchableSelect
              id="receipt-quick-department-type"
              value={quickMasterForm.department_type ?? ""}
              options={departmentTypeOptions}
              placeholder="Search type"
              onChange={(value) => setQuickMasterField("department_type", value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="receipt-quick-department-status"
              value={quickMasterForm.status ?? "active"}
              options={quickItemStatusOptions}
              placeholder="Search status"
              onChange={(value) => setQuickMasterField("status", value)}
            />
          </div>
        </>
      );
    }

    if (quickMasterResource === "stores") {
      return (
        <>
          <div className="col-12 col-md-4">
            <FieldLabel required>Code</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.code ?? ""}
              onChange={(event) => setQuickMasterField("code", event.target.value)}
              placeholder="e.g. ENV-LAB"
              required
            />
          </div>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. Environmental Lab Store"
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <FieldLabel required>Department</FieldLabel>
            <SearchableSelect
              id="receipt-quick-store-department"
              value={quickMasterForm.department_id ?? ""}
              options={departmentOptions}
              placeholder="Search department"
              onChange={(value) => setQuickMasterField("department_id", value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <FieldLabel required>Store Type</FieldLabel>
            <SearchableSelect
              id="receipt-quick-store-type"
              value={quickMasterForm.store_type ?? ""}
              options={storeTypeOptions}
              placeholder="Search type"
              onChange={(value) => setQuickMasterField("store_type", value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="receipt-quick-store-status"
              value={quickMasterForm.status ?? "active"}
              options={quickItemStatusOptions}
              placeholder="Search status"
              onChange={(value) => setQuickMasterField("status", value)}
            />
          </div>
        </>
      );
    }

    if (quickMasterResource === "suppliers") {
      return (
        <>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. Scientific Supplies"
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">NTN</label>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.ntn ?? ""}
              onChange={(event) => setQuickMasterField("ntn", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Contact Person</label>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.contact_person ?? ""}
              onChange={(event) => setQuickMasterField("contact_person", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Phone</label>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.phone ?? ""}
              onChange={(event) => setQuickMasterField("phone", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Email</label>
            <input
              className="form-control form-control-sm"
              type="email"
              value={quickMasterForm.email ?? ""}
              onChange={(event) => setQuickMasterField("email", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-8">
            <label className="form-label small">Address</label>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.address ?? ""}
              onChange={(event) => setQuickMasterField("address", event.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="receipt-quick-supplier-status"
              value={quickMasterForm.status ?? "active"}
              options={quickItemStatusOptions}
              placeholder="Search status"
              onChange={(value) => setQuickMasterField("status", value)}
            />
          </div>
        </>
      );
    }

    if (quickMasterResource === "funding-sources") {
      return (
        <>
          <div className="col-12 col-md-4">
            <FieldLabel required>Code</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.code ?? ""}
              onChange={(event) => setQuickMasterField("code", event.target.value)}
              placeholder="e.g. ENV-GRANT"
              required
            />
          </div>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. Environmental Sciences Grant"
              required
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Sponsor Type</label>
            <SearchableSelect
              id="receipt-quick-funding-source-sponsor-type"
              value={quickMasterForm.sponsor_type ?? "university"}
              options={sponsorTypeOptions}
              placeholder="Search sponsor type"
              onChange={(value) => setQuickMasterField("sponsor_type", value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="receipt-quick-funding-source-status"
              value={quickMasterForm.status ?? "active"}
              options={quickItemStatusOptions}
              placeholder="Search status"
              onChange={(value) => setQuickMasterField("status", value)}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="col-12 col-md-4">
          <FieldLabel required>Project Code</FieldLabel>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.project_code ?? ""}
            onChange={(event) => setQuickMasterField("project_code", event.target.value)}
            placeholder="e.g. ENV-2026-01"
            required
          />
        </div>
        <div className="col-12 col-md-8">
          <FieldLabel required>Project Title</FieldLabel>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.title ?? ""}
            onChange={(event) => setQuickMasterField("title", event.target.value)}
            placeholder="e.g. Environmental Lab Procurement"
            required
          />
        </div>
        <div className="col-12 col-md-4">
          <FieldLabel required>Category</FieldLabel>
          <SearchableSelect
            id="receipt-quick-project-category"
            value={quickMasterForm.project_category ?? ""}
            options={projectCategoryOptions}
            placeholder="Search category"
            onChange={(value) => setQuickMasterField("project_category", value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Department</label>
          <SearchableSelect
            id="receipt-quick-project-department"
            value={quickMasterForm.department_id ?? ""}
            options={departmentOptions}
            placeholder="Search department"
            onChange={(value) => setQuickMasterField("department_id", value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Funding Source</label>
          <SearchableSelect
            id="receipt-quick-project-funding-source"
            value={quickMasterForm.funding_source_id ?? ""}
            options={fundingSourceOptions}
            placeholder="Search funding source"
            onChange={(value) => setQuickMasterField("funding_source_id", value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Sponsor</label>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.sponsor ?? ""}
            onChange={(event) => setQuickMasterField("sponsor", event.target.value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Cost Center</label>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.cost_center_code ?? ""}
            onChange={(event) => setQuickMasterField("cost_center_code", event.target.value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Status</label>
          <SearchableSelect
            id="receipt-quick-project-status"
            value={quickMasterForm.status ?? "active"}
            options={projectStatusOptions}
            placeholder="Search status"
            onChange={(value) => setQuickMasterField("status", value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small">Start Date</label>
          <input
            className="form-control form-control-sm"
            type="date"
            value={quickMasterForm.start_date ?? ""}
            onChange={(event) => setQuickMasterField("start_date", event.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small">End Date</label>
          <input
            className="form-control form-control-sm"
            type="date"
            value={quickMasterForm.end_date ?? ""}
            onChange={(event) => setQuickMasterField("end_date", event.target.value)}
          />
        </div>
      </>
    );
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [currentPage, pageSize, rows]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Receipts / GRN"
          subtitle="Create and post goods receipts"
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              Create Receipt
            </button>
          }
        />

        {(message || error) && (
          <div className="mb-4">
            {message && <div className="alert alert-success py-2">{message}</div>}
            {error && <div className="alert alert-danger py-2">{error}</div>}
          </div>
        )}

        {dialogOpen ? (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
              <div
                className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                style={{ width: "min(62vw, 980px)", maxWidth: "min(62vw, 980px)" }}
              >
                <form className="modal-content border-0 shadow-lg" onSubmit={saveReceipt}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h2 className="h5 mb-1">Create Receipt</h2>
                      <p className="text-secondary mb-0">Record a GRN, add received items, and optionally post stock.</p>
                    </div>
                    <button
                      className="btn-close"
                      type="button"
                      aria-label="Close"
                      onClick={closeCreateDialog}
                    />
                  </div>
                  <div className="modal-body px-4 py-3">
                    <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small">Receipt No.</label>
                    <input
                      className="form-control form-control-sm bg-light text-muted"
                      value={previewReceiptNo(form.receipt_date)}
                      readOnly
                      aria-readonly="true"
                    />
                    <div className="form-text small">Preview only. The backend assigns the next available GRN number when saved.</div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Receipt Type</label>
                    <SearchableSelect
                      id="receipt-type"
                      value={form.receipt_type}
                      options={receiptTypeOptions}
                      placeholder="Search receipt type"
                      onChange={(value) => setFormValue("receipt_type", value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Receipt Date</label>
                    <input
                      className="form-control form-control-sm"
                      type="date"
                      value={form.receipt_date}
                      onChange={(event) => setFormValue("receipt_date", event.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Status</label>
                    <SearchableSelect
                      id="receipt-status"
                      value={form.status}
                      options={receiptStatusOptions}
                      placeholder="Search status"
                      onChange={(value) => setFormValue("status", value as ReceiptStatus)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Store</label>
                    <SearchableSelect
                      id="receipt-store"
                      value={form.store_id}
                      options={storeOptions}
                      placeholder="Search store"
                      onChange={(value) => setFormValue("store_id", value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Department</label>
                    <SearchableSelect
                      id="receipt-department"
                      value={form.department_id}
                      options={departmentOptions}
                      placeholder="Search department"
                      onChange={(value) => setFormValue("department_id", value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label small">Supplier</label>
                      <button
                        className="btn btn-sm btn-link p-0 mb-1 text-decoration-none"
                        type="button"
                        onClick={() => openQuickMasterDialog("suppliers")}
                      >
                        <i className="bi bi-plus-circle me-1" />
                        New Supplier
                      </button>
                    </div>
                    <SearchableSelect
                      id="receipt-supplier"
                      value={form.supplier_id}
                      options={supplierOptions}
                      placeholder="Search supplier"
                      onChange={(value) => setFormValue("supplier_id", value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label small">Funding Source</label>
                      <button
                        className="btn btn-sm btn-link p-0 mb-1 text-decoration-none"
                        type="button"
                        onClick={() => openQuickMasterDialog("funding-sources")}
                      >
                        <i className="bi bi-plus-circle me-1" />
                        New Funding Source
                      </button>
                    </div>
                    <SearchableSelect
                      id="receipt-funding-source"
                      value={form.funding_source_id}
                      options={fundingSourceOptions}
                      placeholder="Search funding source"
                      onChange={(value) => setFormValue("funding_source_id", value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label small">Project</label>
                      <button
                        className="btn btn-sm btn-link p-0 mb-1 text-decoration-none"
                        type="button"
                        onClick={() => openQuickMasterDialog("research-projects")}
                      >
                        <i className="bi bi-plus-circle me-1" />
                        New Project
                      </button>
                    </div>
                    <SearchableSelect
                      id="receipt-project"
                      value={form.project_id}
                      options={projectOptions}
                      placeholder="Search project"
                      onChange={(value) => setFormValue("project_id", value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">PO Reference</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.po_reference}
                      onChange={(event) => setFormValue("po_reference", event.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Invoice No</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.invoice_no}
                      onChange={(event) => setFormValue("invoice_no", event.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Challan No</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.challan_no}
                      onChange={(event) => setFormValue("challan_no", event.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <ApprovalReferenceFields
                      value={approvalReference}
                      onChange={setApprovalReferenceValue}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small">Remarks</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={form.remarks}
                      onChange={(event) => setFormValue("remarks", event.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center">
                      <h3 className="h6 mb-0">Receipt Items</h3>
                      <button className="btn btn-sm btn-outline-primary" type="button" onClick={addItemRow}>
                        <i className="bi bi-plus-lg me-1" />
                        Add Item
                      </button>
                    </div>
                  </div>

                  {items.map((item, index) => (
                    <div key={index} className="col-12 border rounded p-3 bg-light">
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <div className="d-flex align-items-center justify-content-between">
                            <label className="form-label small">Item</label>
                            <button
                              className="btn btn-sm btn-link p-0 mb-1 text-decoration-none"
                              type="button"
                              onClick={() => openQuickItemDialog(index)}
                            >
                              <i className="bi bi-plus-circle me-1" />
                              New Item
                            </button>
                          </div>
                          <SearchableSelect
                            id={`receipt-item-${index}`}
                            value={item.item_id}
                            options={itemOptions}
                            placeholder="Search item code or name"
                            onChange={(value) => setItemValue(index, "item_id", value)}
                          />
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small">Description</label>
                          <input
                            className="form-control form-control-sm"
                            value={item.description}
                            onChange={(event) => setItemValue(index, "description", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Qty Received</label>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={item.quantity_received}
                            step="0.001"
                            min="0"
                            onChange={(event) => setItemValue(index, "quantity_received", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Qty Accepted</label>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={item.quantity_accepted}
                            step="0.001"
                            min="0"
                            max={item.quantity_received || undefined}
                            onChange={(event) => setItemValue(index, "quantity_accepted", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Qty Rejected</label>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={item.quantity_rejected}
                            step="0.001"
                            min="0"
                            max={formatQuantityInput(
                              Math.max(0, Number(item.quantity_received || 0) - Number(item.quantity_accepted || 0)),
                            ) || undefined}
                            onChange={(event) => setItemValue(index, "quantity_rejected", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Unit Cost ({currency})</label>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={item.unit_cost}
                            step="0.01"
                            min="0"
                            onChange={(event) => setItemValue(index, "unit_cost", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Total Cost ({currency})</label>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={item.total_cost}
                            step="0.01"
                            min="0"
                            onChange={(event) => setItemValue(index, "total_cost", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Batch No</label>
                          <input
                            className="form-control form-control-sm"
                            value={item.batch_no}
                            onChange={(event) => setItemValue(index, "batch_no", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Expiry</label>
                          <input
                            className="form-control form-control-sm"
                            type="date"
                            value={item.expiry_date}
                            onChange={(event) => setItemValue(index, "expiry_date", event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <label className="form-label small">Inspection Status</label>
                          <SearchableSelect
                            id={`receipt-inspection-status-${index}`}
                            value={item.inspection_status}
                            options={inspectionStatusOptions}
                            placeholder="Search inspection status"
                            onChange={(value) => setItemValue(index, "inspection_status", value)}
                          />
                        </div>

                        <div className="col-12">
                          <label className="form-label small">Inspection Remarks</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            value={item.inspection_remarks}
                            onChange={(event) => setItemValue(index, "inspection_remarks", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          type="button"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length === 1}
                        >
                          <i className="bi bi-trash3 me-1" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="col-12">
                    <label className="form-label small">Supporting Documents</label>
                    <div className="mb-2 small text-secondary">
                      Max 10 MB per file, 50 MB total. Required when posting.
                    </div>
                    <div className="d-flex gap-2 align-items-center">
                      <label className="btn btn-sm btn-outline-primary mb-0">
                        <i className="bi bi-paperclip me-1" />
                        Attach file
                        <input
                          type="file"
                          hidden
                          onChange={handleAttachmentChange}
                          multiple
                        />
                      </label>
                      <span className="small text-secondary">
                        Total: {formatBytes(attachmentTotalBytes)} / 50 MB
                      </span>
                    </div>

                    {attachmentFiles.length === 0 ? (
                      <div className="text-secondary small mt-2">No files selected.</div>
                    ) : (
                      <ul className="list-group list-group-flush mt-2">
                        {attachmentFiles.map((attachment, index) => (
                          <li
                            className="list-group-item d-flex justify-content-between align-items-center px-0"
                            key={`${attachment.name}-${index}`}
                          >
                            <div>
                              <i className="bi bi-file-earmark me-2" />
                              {attachment.name}
                              <span className="text-secondary small ms-2">{formatBytes(attachment.size)}</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeAttachment(index)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="col-12 form-check">
                    <input
                      id="post_now"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.post_now}
                      onChange={(event) => setFormValue("post_now", event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="post_now">
                      Post receipt after creation
                    </label>
                  </div>

                    </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button className="btn btn-outline-secondary" type="button" onClick={closeCreateDialog}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={isPostingReceipt}>
                      <i className="bi bi-receipt me-1" />
                      {isPostingReceipt ? "Saving..." : "Save Receipt"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            {quickMasterOpen ? (
              <>
                <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1080 }}>
                  <div
                    className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                    style={{ width: "min(54vw, 860px)", maxWidth: "min(54vw, 860px)" }}
                  >
                    <form className="modal-content border-0 shadow-lg" onSubmit={saveQuickMaster}>
                      <div className="modal-header px-4 py-3">
                        <div>
                          <h3 className="modal-title h5 mb-1">Add {quickMasterResourceMeta[quickMasterResource].title}</h3>
                          <div className="small text-secondary">
                            Create the missing master record here, then continue this GRN.
                          </div>
                        </div>
                        <button className="btn-close" type="button" aria-label="Close" onClick={closeQuickMasterDialog} />
                      </div>

                      <div className="modal-body px-4 py-4">
                        {quickMasterError ? <div className="alert alert-danger py-2">{quickMasterError}</div> : null}
                        <div className="row g-3">{renderQuickMasterFields()}</div>
                      </div>

                      <div className="modal-footer px-4 py-3">
                        <button className="btn btn-outline-secondary" type="button" onClick={closeQuickMasterDialog}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={quickMasterSaving || !authReady}>
                          <i className="bi bi-plus-circle me-1" />
                          {quickMasterSaving ? "Saving..." : `Create & Select ${quickMasterResourceMeta[quickMasterResource].title}`}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="modal-backdrop fade show" style={{ zIndex: 1070 }} />
              </>
            ) : null}
            {quickItemOpen ? (
              <>
                <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1080 }}>
                  <div
                    className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                    style={{ width: "min(58vw, 920px)", maxWidth: "min(58vw, 920px)" }}
                  >
                    <form className="modal-content border-0 shadow-lg" onSubmit={saveQuickItem}>
                      <div className="modal-header px-4 py-3">
                        <div>
                          <h3 className="modal-title h5 mb-1">Add Item to Item Master</h3>
                          <div className="small text-secondary">Create the missing item here, then continue this GRN.</div>
                        </div>
                        <button className="btn-close" type="button" aria-label="Close" onClick={closeQuickItemDialog} />
                      </div>

                      <div className="modal-body px-4 py-4">
                        {quickItemError ? <div className="alert alert-danger py-2">{quickItemError}</div> : null}

                        <div className="row g-3">
                          <div className="col-12 col-md-4">
                            <FieldLabel required>Item Code</FieldLabel>
                            <input
                              className="form-control form-control-sm"
                              value={generatedQuickItemCode}
                              placeholder={quickItemForm.category_id ? "Auto-generating..." : "Select category first"}
                              readOnly
                              required
                            />
                            <div className="form-text">Generated as Category-Subcategory-0001 when saved.</div>
                          </div>

                          <div className="col-12 col-md-8">
                            <FieldLabel required>Item Name</FieldLabel>
                            <input
                              className="form-control form-control-sm"
                              value={quickItemForm.name}
                              onChange={(event) => setQuickItemField("name", event.target.value)}
                              placeholder="e.g. Dell Latitude Laptop"
                              required
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel required>Item Type</FieldLabel>
                            <SearchableSelect
                              id="receipt-quick-item-type"
                              value={quickItemForm.item_type}
                              options={itemTypeOptions}
                              placeholder="Search item type"
                              onChange={(value) => setQuickItemField("item_type", value as ItemType)}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel required>Category</FieldLabel>
                            <SearchableSelect
                              id="receipt-quick-item-category"
                              value={quickItemForm.category_id}
                              options={categoryOptions}
                              placeholder="Search category"
                              onChange={selectQuickItemCategory}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel>Subcategory</FieldLabel>
                            <SearchableSelect
                              id="receipt-quick-item-subcategory"
                              value={quickItemForm.subcategory_id}
                              options={subcategoryOptions}
                              placeholder={!quickItemForm.category_id ? "Choose category first" : "Search subcategory"}
                              emptyLabel="No subcategories configured."
                              disabled={!quickItemForm.category_id || quickItemSubcategories.length === 0}
                              onChange={(value) => setQuickItemField("subcategory_id", value)}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel required>Unit of Measure</FieldLabel>
                            <SearchableSelect
                              id="receipt-quick-item-unit"
                              value={quickItemForm.unit_id}
                              options={unitOptions}
                              placeholder="Search UoM"
                              onChange={(value) => setQuickItemField("unit_id", value)}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label small">Brand</label>
                            <input
                              className="form-control form-control-sm"
                              value={quickItemForm.brand}
                              onChange={(event) => setQuickItemField("brand", event.target.value)}
                              placeholder="e.g. Dell"
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label small">Model</label>
                            <input
                              className="form-control form-control-sm"
                              value={quickItemForm.model}
                              onChange={(event) => setQuickItemField("model", event.target.value)}
                              placeholder="e.g. Latitude 5440"
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label small">Minimum Stock Level</label>
                            <input
                              className="form-control form-control-sm"
                              type="number"
                              min="0"
                              step="0.01"
                              value={quickItemForm.minimum_stock_level}
                              onChange={(event) => setQuickItemField("minimum_stock_level", event.target.value)}
                            />
                          </div>

                          <div className="col-12 col-md-8">
                            <label className="form-label small">Description</label>
                            <input
                              className="form-control form-control-sm"
                              value={quickItemForm.description}
                              onChange={(event) => setQuickItemField("description", event.target.value)}
                              placeholder="Optional item description"
                            />
                          </div>

                          <AttributeFields
                            definitions={lookups["asset-attribute-definitions"]}
                            categoryId={quickItemForm.category_id}
                            subcategoryId={quickItemForm.subcategory_id}
                            appliesTo="item"
                            values={quickItemForm.attributes}
                            onChange={(code, value) =>
                              setQuickItemForm((current) => ({
                                ...current,
                                attributes: { ...current.attributes, [code]: value },
                              }))
                            }
                          />

                          <div className="col-12">
                            <div className="row g-2">
                              {[
                                ["is_capitalizable", "Capitalizable"],
                                ["is_sensitive_controlled", "Sensitive / Controlled"],
                                ["requires_serial_tracking", "Serial Tracking"],
                                ["requires_batch_tracking", "Batch Tracking"],
                                ["requires_expiry_tracking", "Expiry Tracking"],
                              ].map(([key, label]) => (
                                <div className="col-12 col-md-4" key={key}>
                                  <div className="form-check">
                                    <input
                                      id={`receipt-quick-item-${key}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={Boolean(quickItemForm[key as keyof QuickItemForm])}
                                      onChange={(event) =>
                                        setQuickItemField(key as keyof QuickItemForm, event.target.checked as never)
                                      }
                                    />
                                    <label className="form-check-label small" htmlFor={`receipt-quick-item-${key}`}>
                                      {label}
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label small">Status</label>
                            <SearchableSelect
                              id="receipt-quick-item-status"
                              value={quickItemForm.status}
                              options={quickItemStatusOptions}
                              placeholder="Search status"
                              onChange={(value) => setQuickItemField("status", value as QuickItemForm["status"])}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="modal-footer px-4 py-3">
                        <button className="btn btn-outline-secondary" type="button" onClick={closeQuickItemDialog}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={quickItemSaving || !authReady}>
                          <i className="bi bi-plus-circle me-1" />
                          {quickItemSaving ? "Saving..." : "Create & Select Item"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="modal-backdrop fade show" style={{ zIndex: 1070 }} />
              </>
            ) : null}
            <div className="modal-backdrop fade show" />
          </>
        ) : null}

        <section className="col-12">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <FilterBar onReset={resetFilters}>
                <div className="col-12 col-lg-4">
                  <label className="form-label small">Search</label>
                  <input
                    className="form-control form-control-sm"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Receipt no / PO / invoice / challan"
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label small">Status</label>
                  <SearchableSelect
                    id="receipt-filter-status"
                    value={statusFilter}
                    options={filterStatusOptions}
                    placeholder="Search status"
                    onChange={setStatusFilter}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <label className="form-label small">Store</label>
                  <SearchableSelect
                    id="receipt-filter-store"
                    value={storeFilter}
                    options={filterStoreOptions}
                    placeholder="Search store"
                    onChange={setStoreFilter}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <label className="form-label small">Department</label>
                  <SearchableSelect
                    id="receipt-filter-department"
                    value={departmentFilter}
                    options={filterDepartmentOptions}
                    placeholder="Search department"
                    onChange={setDepartmentFilter}
                  />
                </div>
              </FilterBar>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h6 fw-semibold mb-0">Receipt list</h2>
            <span className="small text-secondary">{rows.length} record{rows.length === 1 ? "" : "s"}</span>
          </div>

                {rows.length > 0 ? (
                  <>
                    <DataTable
                      empty="No receipts found. Use the form to create one."
                      columns={[
                        {
                          key: "receipt",
                          header: "Receipt",
                          render: (row: Receipt) => (
                            <div>
                              <div className="fw-medium">{row.receipt_no}</div>
                              <div className="small text-secondary">
                                PO: {row.po_reference ?? "-"} | Invoice: {row.invoice_no ?? "-"} | Challan:{" "}
                                {row.challan_no ?? "-"}
                              </div>
                            </div>
                          ),
                        },
                        { key: "date", header: "Date", render: (row) => <span>{String(row.receipt_date).split("T")[0]}</span> },
                        { key: "type", header: "Type", render: (row) => <span>{row.receipt_type}</span> },
                        { key: "store", header: "Store", render: (row) => <span>{lookupLabel("stores", row.store_id)}</span> },
                        { key: "dept", header: "Dept", render: (row) => <span>{lookupLabel("departments", row.department_id)}</span> },
                        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                        {
                          key: "actions",
                          header: "Actions",
                          className: "text-end",
                          render: (row) => (
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                type="button"
                                onClick={async () => {
                                  if (expandedId === row.id) {
                                    setExpandedId(null);
                                    return;
                                  }
                                  await loadReceiptItems(row.id);
                                }}
                              >
                                {expandedLoading[row.id] ? "Loading" : expandedId === row.id ? "Hide Items" : "Items"}
                              </button>
                              <button className="btn btn-outline-secondary" type="button" onClick={() => printReceipt(row)}>
                                <i className="bi bi-printer me-1" />
                                Print
                              </button>
                              {row.status !== "posted" ? (
                                <>
                                  <label
                                    className={`btn btn-outline-secondary ${uploadingAttachmentId === row.id ? "disabled" : ""}`}
                                    title="Attach supporting document required before posting"
                                  >
                                    <i className="bi bi-paperclip me-1" />
                                    {uploadingAttachmentId === row.id ? "Attaching" : "Attach"}
                                    <input
                                      className="visually-hidden"
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                      disabled={uploadingAttachmentId === row.id}
                                      onChange={(event) => handleSavedReceiptAttachment(row.id, event)}
                                    />
                                  </label>
                                <button
                                  className="btn btn-outline-success"
                                  type="button"
                                  onClick={() => postReceiptAndRefresh(row.id)}
                                >
                                  Post
                                </button>
                                </>
                              ) : null}
                              {(row.status === "draft" || row.status === "cancelled") ? (
                                <button
                                  className="btn btn-outline-danger"
                                  type="button"
                                  onClick={() => deleteReceipt(row.id)}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ),
                        },
                      ]}
                      rows={paginatedRows as never}
                    />
                    <PaginationControls
                      page={currentPage}
                      pageSize={pageSize}
                      totalItems={rows.length}
                      onPageChange={(nextPage) => {
                        setPage(nextPage);
                        setExpandedId(null);
                      }}
                      onPageSizeChange={(nextPageSize) => {
                        setPageSize(nextPageSize);
                        setPage(1);
                        setExpandedId(null);
                      }}
                    />

                    {expandedId && expandedItems[expandedId] ? (
                      <div className="mt-3">
                        <h3 className="h6 mb-2">Items for #{expandedId}</h3>
                        {expandedLoading[expandedId] ? (
                          <div className="text-secondary">Loading items...</div>
                        ) : expandedItems[expandedId].length === 0 ? (
                          <EmptyState
                            icon="bi-box-seam"
                            title="No items on selected receipt"
                            message="Receipt details are not available yet."
                          />
                        ) : (
                          <DataTable columns={expandedItemColumns} rows={expandedItems[expandedId]} empty="No item rows returned by backend." />
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    title="No receipts found"
                    message="No receipts match the selected filters."
                    icon="bi-receipt"
                  />
          )}
        </section>
      </div>
    </main>
  );
}
