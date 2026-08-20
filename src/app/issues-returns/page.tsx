"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { printTransactionDocument } from "@/lib/transaction-print";
import {
  ApprovalReferenceFields,
  DataTable,
  EmptyState,
  FieldLabel,
  FilterBar,
  PageHeader,
  SearchableSelect,
  StatusBadge,
  type SearchableSelectOption,
} from "@/components/ims";

type LookupKey =
  | "departments"
  | "stores"
  | "buildings"
  | "rooms"
  | "items"
  | "asset-categories"
  | "units-of-measure"
  | "funding-sources"
  | "research-projects"
  | "storage-bins"
  | "users";

type TransactionType = "issue" | "return" | "transfer" | "consumption" | "adjustment";

type TransactionStatus = "draft" | "posted" | "cancelled";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

type StockSourceRow = {
  id: number;
  item_id: number;
  department_id: number | null;
  store_id: number | null;
  project_id: number | null;
  funding_source_id: number | null;
  available_quantity: number;
};

type QuickMasterResource = "departments" | "stores" | "funding-sources" | "users";

type QuickMasterForm = Record<string, string>;

type ItemType =
  | "consumable"
  | "fixed_asset"
  | "repairable"
  | "controlled_item"
  | "project_inventory"
  | "sample_prototype"
  | "software_license";

type QuickItemForm = {
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
  status: "active" | "inactive";
};

type Transaction = {
  id: number;
  transaction_no: string;
  transaction_type: TransactionType;
  transaction_date: string;
  status: TransactionStatus;
  from_department_id: number | null;
  to_department_id: number | null;
  from_store_id: number | null;
  to_store_id: number | null;
  from_storage_bin_id: number | null;
  to_storage_bin_id: number | null;
  to_building_id: number | null;
  to_room_id: number | null;
  recipient_user_id: number | null;
  project_id: number | null;
  funding_source_id: number | null;
  manual_approval_ref: string | null;
  manual_approval_date: string | null;
  manual_approved_by: string | null;
  purpose: string | null;
  remarks: string | null;
  posted_at: string | null;
  created_at: string;
};

type TransactionItem = {
  id: number;
  transaction_id: number;
  item_id: number;
  asset_id: number | null;
  quantity: number;
  unit_cost: number | null;
  remarks: string | null;
};

type TransactionItemInput = {
  item_id: string;
  asset_id: string;
  quantity: string;
  unit_cost: string;
  remarks: string;
};

type TransactionForm = {
  transaction_no: string;
  transaction_type: TransactionType;
  adjustment_direction: "increase" | "decrease";
  transaction_date: string;
  from_department_id: string;
  to_department_id: string;
  from_store_id: string;
  to_store_id: string;
  from_storage_bin_id: string;
  to_storage_bin_id: string;
  to_building_id: string;
  to_room_id: string;
  recipient_user_id: string;
  funding_source_id: string;
  project_id: string;
  manual_approval_ref: string;
  manual_approval_date: string;
  manual_approved_by: string;
  purpose: string;
  remarks: string;
  status: TransactionStatus;
  post_now: boolean;
};

const typeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: "issue", label: "Issue" },
  { value: "return", label: "Return" },
  { value: "transfer", label: "Transfer" },
  { value: "consumption", label: "Consumption" },
  { value: "adjustment", label: "Adjustment" },
];

const quickMasterResourceTitles: Record<QuickMasterResource, string> = {
  departments: "Department",
  stores: "Store",
  "funding-sources": "Funding Source",
  users: "Employee",
};

const activeStatusOptions: SearchableSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const userStatusOptions: SearchableSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
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

const transactionNoPrefixes: Record<TransactionType, string> = {
  issue: "ISS",
  return: "RET",
  transfer: "TRF",
  consumption: "CON",
  adjustment: "ADJ",
};

const previewYearFromDate = (date: string): string => {
  const isoYear = date.match(/^(\d{4})-/)?.[1];
  const displayYear = date.match(/(\d{4})$/)?.[1];

  return isoYear ?? displayYear ?? String(new Date().getFullYear());
};

const previewTransactionNo = (type: TransactionType, date: string): string =>
  `${transactionNoPrefixes[type] ?? "TXN"}-${previewYearFromDate(date)}-####`;

const toTransactionTypeLabel = (type: TransactionType) => {
  if (type === "issue") return "Issue";
  if (type === "return") return "Return";
  if (type === "transfer") return "Transfer";
  if (type === "consumption") return "Consumption";
  if (type === "adjustment") return "Adjustment";
  return type;
};

const emptyItem: TransactionItemInput = {
  item_id: "",
  asset_id: "",
  quantity: "",
  unit_cost: "",
  remarks: "",
};

const createQuickItemForm = (): QuickItemForm => ({
  name: "",
  item_type: "fixed_asset",
  category_id: "",
  subcategory_id: "",
  unit_id: "",
  description: "",
  brand: "",
  model: "",
  minimum_stock_level: "0",
  is_capitalizable: true,
  is_sensitive_controlled: false,
  requires_serial_tracking: false,
  requires_batch_tracking: false,
  requires_expiry_tracking: false,
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

const defaultForm: TransactionForm = {
  transaction_no: "",
  transaction_type: "issue",
  adjustment_direction: "increase",
  transaction_date: new Date().toISOString().slice(0, 10),
  from_department_id: "",
  to_department_id: "",
  from_store_id: "",
  to_store_id: "",
  from_storage_bin_id: "",
  to_storage_bin_id: "",
  to_building_id: "",
  to_room_id: "",
  recipient_user_id: "",
  funding_source_id: "",
  project_id: "",
  manual_approval_ref: "",
  manual_approval_date: "",
  manual_approved_by: "",
  purpose: "",
  remarks: "",
  status: "draft",
  post_now: false,
};

const requiredFieldLabels: Partial<Record<keyof TransactionForm, string>> = {
  from_department_id: "From Department",
  to_department_id: "To Department",
  from_store_id: "From Store",
  to_store_id: "To Store",
  recipient_user_id: "Employee",
};

const toPayloadDate = (value: string): string | null => (value.trim() ? value : null);

const toFormDate = (value: string | null | undefined): string => (value ? String(value).slice(0, 10) : "");

const toFormString = (value: string | number | null | undefined): string => (value === null || value === undefined ? "" : String(value));

const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const itemCodeSegment = (value: unknown) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toLookupOption = (row: RowData): SearchableSelectOption => ({
  value: String(row.id),
  label: `${row.code ?? ""}${row.code && row.name ? " - " : ""}${row.name ?? ""}`.trim() || `#${row.id}`,
  keywords: [row.code, row.name].filter(Boolean).join(" "),
});

const extractApiMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

export default function IssuesReturnsPage() {
  return (
    <Suspense fallback={<main className="p-4 text-secondary">Loading transactions...</main>}>
      <IssuesReturnsContent />
    </Suspense>
  );
}

function IssuesReturnsContent() {
  const { isAuthenticated, loading } = useAuth();
  const authReady = useMemo(() => isAuthenticated && !loading, [isAuthenticated, loading]);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({
    departments: [],
    stores: [],
    buildings: [],
    rooms: [],
    items: [],
    "asset-categories": [],
    "units-of-measure": [],
    "funding-sources": [],
    "research-projects": [],
    "storage-bins": [],
    users: [],
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [form, setForm] = useState<TransactionForm>(defaultForm);
  const [items, setItems] = useState<TransactionItemInput[]>([emptyItem]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, TransactionItem[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [quickMasterOpen, setQuickMasterOpen] = useState(false);
  const [quickMasterResource, setQuickMasterResource] = useState<QuickMasterResource>("departments");
  const [quickMasterTargetField, setQuickMasterTargetField] = useState<keyof TransactionForm>("to_department_id");
  const [quickMasterForm, setQuickMasterForm] = useState<QuickMasterForm>({});
  const [quickMasterSaving, setQuickMasterSaving] = useState(false);
  const [quickMasterError, setQuickMasterError] = useState("");
  const [quickItemOpen, setQuickItemOpen] = useState(false);
  const [quickItemRowIndex, setQuickItemRowIndex] = useState<number | null>(null);
  const [quickItemSaving, setQuickItemSaving] = useState(false);
  const [quickItemForm, setQuickItemForm] = useState<QuickItemForm>(createQuickItemForm);
  const [quickItemError, setQuickItemError] = useState("");
  const searchParams = useSearchParams();
  const queryAssetId = useMemo(() => {
    const assetIdFromQuery = searchParams.get("asset_id");
    return assetIdFromQuery && /^\d+$/.test(assetIdFromQuery) ? assetIdFromQuery : "";
  }, [searchParams]);
  const queryEditId = useMemo(() => {
    const editIdFromQuery = searchParams.get("edit");
    return editIdFromQuery && /^\d+$/.test(editIdFromQuery) ? editIdFromQuery : "";
  }, [searchParams]);
  const [assetIdFilter, setAssetIdFilter] = useState(() => queryAssetId);
  const [handledEditId, setHandledEditId] = useState("");

  const showsSourceStockFields =
    form.transaction_type === "issue" ||
    form.transaction_type === "consumption" ||
    form.transaction_type === "transfer" ||
    (form.transaction_type === "adjustment" && form.adjustment_direction === "decrease");
  const showsReturnByDepartment = form.transaction_type === "return";
  const showsToDepartment =
    form.transaction_type === "issue" ||
    form.transaction_type === "return" ||
    form.transaction_type === "transfer" ||
    (form.transaction_type === "adjustment" && form.adjustment_direction === "increase");
  const showsToStore =
    form.transaction_type === "return" ||
    form.transaction_type === "transfer" ||
    (form.transaction_type === "adjustment" && form.adjustment_direction === "increase");
  const showsReceivingLocation = form.transaction_type === "issue" || form.transaction_type === "transfer";
  const recipientDepartmentId =
    form.transaction_type === "return"
      ? form.from_department_id
      : form.transaction_type === "issue" || form.transaction_type === "transfer"
        ? form.to_department_id
        : "";

  const lookupLabel = (source: LookupKey, value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";

    const rows = lookups[source] ?? [];
    const match = rows.find((row) => String(row.id) === String(value));
    if (!match) return String(value);
    if (source === "users") return String(match.name ?? value);

    return `${match.code ?? match.project_code ?? match.id} - ${match.name ?? match.title ?? match.title_code ?? ""}`;
  };

  const loadRows = useCallback(async () => {
    if (!authReady) return;

    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.transaction_type = typeFilter;
    if (departmentFilter) params.department_id = departmentFilter;
    if (storeFilter) params.store_id = storeFilter;
    if (assetIdFilter) params.asset_id = assetIdFilter;

    try {
      const response = await api.get("/inventory-transactions", { params });
      const data = response.data?.data;
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setRows([]);
      setError("Unable to load transactions.");
    }
  }, [authReady, search, statusFilter, typeFilter, departmentFilter, storeFilter, assetIdFilter]);

  useEffect(() => {
    (async () => {
      await loadRows();
    })();
  }, [loadRows]);

  useEffect(() => {
    if (!authReady) return;

    const requiredLookups: LookupKey[] = [
      "departments",
      "stores",
      "buildings",
      "rooms",
      "items",
      "asset-categories",
      "units-of-measure",
      "funding-sources",
      "research-projects",
      "storage-bins",
      "users",
    ];

    const loadLookups = async () => {
      const next = requiredLookups.reduce<Record<LookupKey, RowData[]>>(
        (acc, key) => {
          acc[key] = [];
          return acc;
        },
        {
          departments: [],
          stores: [],
          buildings: [],
          rooms: [],
          items: [],
          "asset-categories": [],
          "units-of-measure": [],
          "funding-sources": [],
          "research-projects": [],
          "storage-bins": [],
          users: [],
        },
      );

      const requests = requiredLookups.map(async (key) => {
        const response = await api.get(key === "users" ? "/users" : `/master-data/${key}`);
        const payload = response.data?.data;
        if (Array.isArray(payload)) {
          next[key] = payload;
        }
      });

      await Promise.all(requests);
      setLookups(next);
    };

    void loadLookups();
  }, [authReady]);

  const setFormValue = (key: keyof TransactionForm, value: string | boolean) => {
    if (key === "transaction_type" && typeof value === "string") {
      setItems([emptyItem]);
      setForm((current) => {
        const next = {
          ...current,
          [key]: value as TransactionType,
        };

        if (value === "return") {
          next.from_store_id = "";
          next.from_storage_bin_id = "";
          next.to_building_id = "";
          next.to_room_id = "";
          next.adjustment_direction = "increase";
        }

        if (value === "issue" || value === "consumption") {
          next.to_store_id = "";
          next.to_storage_bin_id = "";
          next.adjustment_direction = "decrease";
          if (value === "consumption") {
            next.to_department_id = "";
            next.to_building_id = "";
            next.to_room_id = "";
            next.recipient_user_id = "";
          }
        }

        if (value === "adjustment") {
          next.from_department_id = "";
          next.from_store_id = "";
          next.from_storage_bin_id = "";
          next.to_department_id = "";
          next.to_store_id = "";
          next.to_storage_bin_id = "";
          next.to_building_id = "";
          next.to_room_id = "";
          next.recipient_user_id = "";
          next.adjustment_direction = "increase";
        }

        return next;
      });
      return;
    }

    if (key === "adjustment_direction" && typeof value === "string") {
      setForm((current) => {
        if (current.transaction_type !== "adjustment") {
          return current;
        }

        const next: TransactionForm = {
          ...current,
          [key]: value as TransactionForm["adjustment_direction"],
          from_department_id: "",
          from_store_id: "",
          from_storage_bin_id: "",
          to_department_id: "",
          to_store_id: "",
          to_storage_bin_id: "",
          to_building_id: "",
          to_room_id: "",
        };

        return next;
      });
      return;
    }

    if (key === "from_store_id" && typeof value === "string") {
      setForm((current) => {
        const store = value ? lookups.stores.find((candidate) => String(candidate.id) === value) : null;
        const storeDepartmentId = store?.department_id ? String(store.department_id) : "";

        return {
          ...current,
          from_store_id: value,
          from_department_id: storeDepartmentId || current.from_department_id,
          from_storage_bin_id: "",
        };
      });
      return;
    }

    if (key === "to_store_id" && typeof value === "string") {
      setForm((current) => {
        const store = value ? lookups.stores.find((candidate) => String(candidate.id) === value) : null;
        const storeDepartmentId = store?.department_id ? String(store.department_id) : "";

        return {
          ...current,
          to_store_id: value,
          to_department_id: storeDepartmentId || current.to_department_id,
          to_storage_bin_id: "",
        };
      });
      return;
    }

    if (key === "to_building_id" && typeof value === "string") {
      setForm((current) => ({
        ...current,
        to_building_id: value,
        to_room_id: "",
      }));
      return;
    }

    if (key === "to_room_id" && typeof value === "string") {
      setForm((current) => {
        const room = value ? lookups.rooms.find((candidate) => String(candidate.id) === value) : null;
        const roomBuildingId = room?.building_id ? String(room.building_id) : "";

        return {
          ...current,
          to_room_id: value,
          to_building_id: roomBuildingId || current.to_building_id,
        };
      });
      return;
    }

    if ((key === "from_department_id" || key === "to_department_id") && typeof value === "string") {
      setForm((current) => {
        const next = {
          ...current,
          [key]: value,
        };
        const filtersRecipient =
          (current.transaction_type === "return" && key === "from_department_id") ||
          ((current.transaction_type === "issue" || current.transaction_type === "transfer") && key === "to_department_id");

        if (filtersRecipient && current.recipient_user_id && value) {
          const currentRecipient = lookups.users.find((user) => String(user.id) === current.recipient_user_id);

          if (!currentRecipient || String(currentRecipient.department_id ?? "") !== value) {
            next.recipient_user_id = "";
          }
        }

        return next;
      });
      return;
    }

    if (key === "recipient_user_id" && typeof value === "string") {
      setForm((current) => {
        const next: TransactionForm = {
          ...current,
          recipient_user_id: value,
        };
        const recipient = value ? lookups.users.find((user) => String(user.id) === value) : null;
        const recipientDepartmentId = recipient?.department_id ? String(recipient.department_id) : "";

        if (recipientDepartmentId) {
          if (current.transaction_type === "return") {
            next.from_department_id = recipientDepartmentId;
          } else if (current.transaction_type === "issue" || current.transaction_type === "transfer") {
            next.to_department_id = recipientDepartmentId;
          }
        }

        return next;
      });
      return;
    }

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setItemValue = (index: number, key: keyof TransactionItemInput, value: string) => {
    setItems((current) =>
      current.map((row, idx) => {
        if (idx !== index) return row;
        return { ...row, [key]: value };
      }),
    );
  };

  const fillSourceFromStock = async (itemId: string) => {
    if (!itemId || !showsSourceStockFields) return;

    try {
      const response = await api.get<{ data?: StockSourceRow[] }>("/reports/stock-balance", {
        params: { item_id: itemId },
      });
      const stockRows = Array.isArray(response.data?.data) ? response.data.data : [];
      const availableRows = stockRows.filter((row) => Number(row.available_quantity ?? 0) > 0);

      if (availableRows.length !== 1) return;

      const stockSource = availableRows[0];
      setForm((current) => {
        if (
          current.from_department_id &&
          current.from_store_id &&
          String(stockSource.department_id ?? "") === current.from_department_id &&
          String(stockSource.store_id ?? "") === current.from_store_id
        ) {
          return current;
        }

        return {
          ...current,
          from_department_id: stockSource.department_id ? String(stockSource.department_id) : current.from_department_id,
          from_store_id: stockSource.store_id ? String(stockSource.store_id) : current.from_store_id,
          from_storage_bin_id: "",
          project_id: stockSource.project_id ? String(stockSource.project_id) : current.project_id,
          funding_source_id: stockSource.funding_source_id ? String(stockSource.funding_source_id) : current.funding_source_id,
        };
      });
    } catch {
      // Stock source auto-fill is advisory; normal save/post validation remains authoritative.
    }
  };

  const setTransactionItemValue = (index: number, key: keyof TransactionItemInput, value: string) => {
    setItemValue(index, key, value);

    if (key === "item_id") {
      void fillSourceFromStock(value);
    }
  };

  const addItemRow = () => setItems((current) => [...current, { ...emptyItem }]);

  const removeItemRow = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const toTransactionItemInput = (row: TransactionItem): TransactionItemInput => ({
    item_id: toFormString(row.item_id),
    asset_id: toFormString(row.asset_id),
    quantity: toFormString(row.quantity),
    unit_cost: toFormString(row.unit_cost),
    remarks: row.remarks ?? "",
  });

  const inferAdjustmentDirection = (transaction: Transaction): TransactionForm["adjustment_direction"] => {
    if (transaction.transaction_type !== "adjustment") {
      return "increase";
    }

    return transaction.from_department_id || transaction.from_store_id || transaction.from_storage_bin_id ? "decrease" : "increase";
  };

  const resolveProcurementDepartmentId = useCallback(() => {
    const procurementDepartment = lookups.departments.find((department) => {
      const code = String(department.code ?? "").trim().toLowerCase();
      const name = String(department.name ?? "").trim().toLowerCase();

      return code === "dpt-023" || name === "procurement section" || name.includes("procurement");
    });

    return procurementDepartment ? String(procurementDepartment.id) : "";
  }, [lookups.departments]);

  const resolveMainStoreDefaults = () => {
    const mainStore = lookups.stores.find((store) => {
      const haystack = `${store.code ?? ""} ${store.name ?? ""} ${store.store_type ?? ""}`.toLowerCase();
      return haystack.includes("main") || haystack.includes("central");
    });
    const procurementDepartmentId = resolveProcurementDepartmentId();

    return {
      from_store_id: mainStore ? String(mainStore.id) : "",
      from_department_id: procurementDepartmentId || (mainStore?.department_id ? String(mainStore.department_id) : ""),
    };
  };

  const resetForm = () => {
    setForm({
      ...defaultForm,
      ...resolveMainStoreDefaults(),
      transaction_date: new Date().toISOString().slice(0, 10),
    });
    setItems([{ ...emptyItem }]);
  };

  const openCreateDialog = () => {
    setEditingTransactionId(null);
    resetForm();
    setError("");
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen || editingTransactionId !== null || form.transaction_type !== "issue" || form.from_department_id) {
      return;
    }

    const procurementDepartmentId = resolveProcurementDepartmentId();
    if (!procurementDepartmentId) {
      return;
    }

    setForm((current) => {
      if (current.transaction_type !== "issue" || current.from_department_id) {
        return current;
      }

      return {
        ...current,
        from_department_id: procurementDepartmentId,
      };
    });
  }, [dialogOpen, editingTransactionId, form.from_department_id, form.transaction_type, resolveProcurementDepartmentId]);

  const closeCreateDialog = () => {
    setDialogOpen(false);
    setEditingTransactionId(null);
    setQuickMasterOpen(false);
    setQuickItemOpen(false);
    setQuickItemRowIndex(null);
    setQuickItemError("");
  };

  const openEditDialog = async (transaction: Transaction) => {
    if (transaction.status !== "draft") {
      setError("Only draft transactions can be edited.");
      return;
    }

    try {
      const response = await api.get(`/inventory-transactions/${transaction.id}`);
      const detail = (response.data?.data ?? transaction) as Transaction;
      const detailItems = Array.isArray(response.data?.items) ? (response.data.items as TransactionItem[]) : [];

      setEditingTransactionId(transaction.id);
      setForm({
        ...defaultForm,
        transaction_no: detail.transaction_no ?? "",
        transaction_type: detail.transaction_type,
        adjustment_direction: inferAdjustmentDirection(detail),
        transaction_date: toFormDate(detail.transaction_date) || new Date().toISOString().slice(0, 10),
        from_department_id: toFormString(detail.from_department_id),
        to_department_id: toFormString(detail.to_department_id),
        from_store_id: toFormString(detail.from_store_id),
        to_store_id: toFormString(detail.to_store_id),
        from_storage_bin_id: toFormString(detail.from_storage_bin_id),
        to_storage_bin_id: toFormString(detail.to_storage_bin_id),
        to_building_id: toFormString(detail.to_building_id),
        to_room_id: toFormString(detail.to_room_id),
        recipient_user_id: toFormString(detail.recipient_user_id),
        funding_source_id: toFormString(detail.funding_source_id),
        project_id: toFormString(detail.project_id),
        manual_approval_ref: detail.manual_approval_ref ?? "",
        manual_approval_date: toFormDate(detail.manual_approval_date),
        manual_approved_by: detail.manual_approved_by ?? "",
        purpose: detail.purpose ?? "",
        remarks: detail.remarks ?? "",
        status: "draft",
        post_now: false,
      });
      setItems(detailItems.length ? detailItems.map(toTransactionItemInput) : [{ ...emptyItem }]);
      setError("");
      setDialogOpen(true);
    } catch (editError) {
      setError(extractApiMessage(editError, "Could not load the draft voucher for editing."));
    }
  };

  useEffect(() => {
    if (!authReady || !queryEditId || handledEditId === queryEditId) return;

    setHandledEditId(queryEditId);
    void openEditDialog({
      id: Number(queryEditId),
      transaction_no: "",
      transaction_type: "issue",
      transaction_date: new Date().toISOString().slice(0, 10),
      status: "draft",
      from_department_id: null,
      to_department_id: null,
      from_store_id: null,
      to_store_id: null,
      from_storage_bin_id: null,
      to_storage_bin_id: null,
      to_building_id: null,
      to_room_id: null,
      recipient_user_id: null,
      project_id: null,
      funding_source_id: null,
      manual_approval_ref: null,
      manual_approval_date: null,
      manual_approved_by: null,
      purpose: null,
      remarks: null,
      posted_at: null,
      created_at: "",
    });
  }, [authReady, handledEditId, queryEditId]);

  const canSubmitType = (type: TransactionType, adjustmentDirection: TransactionForm["adjustment_direction"]): string[] => {
    if (type === "issue") {
      return ["from_department_id", "from_store_id", "recipient_user_id", "to_department_id"];
    }

    if (type === "consumption") {
      return ["from_department_id", "from_store_id"];
    }

    if (type === "adjustment") {
      return adjustmentDirection === "increase" ? ["to_department_id", "to_store_id"] : ["from_department_id", "from_store_id"];
    }

    if (type === "return") {
      return ["recipient_user_id", "from_department_id", "to_department_id", "to_store_id"];
    }

    return ["from_department_id", "from_store_id", "to_department_id", "to_store_id"];
  };

  const binsForStore = (storeId: string): RowData[] => {
    if (!storeId) return [];

    return lookups["storage-bins"].filter((bin) => String(bin.store_id ?? "") === String(storeId));
  };

  const toSearchOption = (row: RowData, fallbackLabel = "Record"): SearchableSelectOption => ({
    value: String(row.id),
    label: String(row.employee_code ? `${row.employee_code} - ${row.name ?? row.email ?? fallbackLabel}` : row.name ?? row.email ?? fallbackLabel),
    keywords: `${row.email ?? ""} ${row.phone ?? ""} ${row.department_id ?? ""}`,
  });

  const employeeOptions = useMemo(
    () =>
      lookups.users
        .filter((user) => !recipientDepartmentId || String(user.department_id ?? "") === recipientDepartmentId)
        .map((user) => toSearchOption(user, "Employee")),
    [lookups.users, recipientDepartmentId],
  );
  const itemOptions = useMemo(
    () =>
      [...lookups.items]
        .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
        .map((item) => ({
          value: String(item.id),
          label: `${item.item_code ?? item.code ?? item.id} - ${item.name ?? ""}`,
          keywords: `${item.category_code ?? ""} ${item.subcategory_code ?? ""} ${item.type ?? ""}`,
        })),
    [lookups.items],
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

  const departmentOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.departments.map((department) => ({
        value: String(department.id),
        label: `${department.code ?? department.id} - ${department.name ?? ""}`.trim(),
        keywords: [department.code, department.name, department.department_type].filter(Boolean).join(" "),
      })),
    [lookups.departments],
  );

  const storeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.stores.map((store) => ({
        value: String(store.id),
        label: `${store.code ?? store.id} - ${store.name ?? ""}`.trim(),
        keywords: [store.code, store.name, store.store_type, store.department_id].filter(Boolean).join(" "),
      })),
    [lookups.stores],
  );

  const buildingOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.buildings.map((building) => ({
        value: String(building.id),
        label: `${building.code ?? building.building_code ?? building.id} - ${building.name ?? ""}`.trim(),
        keywords: [building.code, building.building_code, building.campus_map_code, building.name, building.nature]
          .filter(Boolean)
          .join(" "),
      })),
    [lookups.buildings],
  );

  const roomOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups.rooms
        .filter((room) => !form.to_building_id || String(room.building_id ?? "") === form.to_building_id)
        .map((room) => ({
          value: String(room.id),
          label: `${room.code ?? room.room_no ?? room.id} - ${room.name ?? room.room_no ?? ""}`.trim(),
          keywords: [room.code, room.room_no, room.name, room.nature, room.floor, room.department_id, room.building_id]
            .filter(Boolean)
            .join(" "),
        })),
    [form.to_building_id, lookups.rooms],
  );

  const fundingSourceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups["funding-sources"].map((source) => ({
        value: String(source.id),
        label: `${source.code ?? source.id} - ${source.name ?? ""}`.trim(),
        keywords: [source.code, source.name, source.sponsor_type].filter(Boolean).join(" "),
      })),
    [lookups],
  );

  const projectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      lookups["research-projects"].map((project) => ({
        value: String(project.id),
        label: `${project.project_code ?? project.code ?? project.id} - ${project.title ?? project.name ?? ""}`.trim(),
        keywords: [project.project_code, project.code, project.title, project.name].filter(Boolean).join(" "),
      })),
    [lookups],
  );

  const reloadLookup = async (resource: QuickMasterResource) => {
    const response = await api.get(resource === "users" ? "/users" : `/master-data/${resource}`);
    const payload = response.data?.data;
    const nextRows = Array.isArray(payload) ? (payload as RowData[]) : [];
    setLookups((current) => ({ ...current, [resource]: nextRows }));
    return nextRows;
  };

  const reloadItemLookup = async () => {
    const response = await api.get("/master-data/items");
    const payload = response.data?.data;
    const nextRows = Array.isArray(payload) ? (payload as RowData[]) : [];
    setLookups((current) => ({ ...current, items: nextRows }));
    return nextRows;
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
    }));
  };

  const saveQuickItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setQuickItemError("Please sign in before creating item records.");
      return;
    }

    if (!generatedQuickItemCode || !quickItemForm.name.trim() || !quickItemForm.category_id || !quickItemForm.unit_id) {
      setQuickItemError("Item Code, Item Name, Category, and Unit of Measure are required.");
      return;
    }

    setQuickItemSaving(true);
    setQuickItemError("");

    try {
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
        setTransactionItemValue(quickItemRowIndex, "item_id", String(createdItem.id));
      }

      setMessage("Item created in Item Master and selected for this voucher.");
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

  const createQuickMasterForm = (resource: QuickMasterResource, targetField: keyof TransactionForm): QuickMasterForm => {
    if (resource === "departments") {
      return { code: "", name: "", erp_department_id: "", department_type: "administrative", status: "active" };
    }

    if (resource === "stores") {
      const departmentId =
        targetField === "to_store_id"
          ? form.to_department_id
          : targetField === "from_store_id"
            ? form.from_department_id
            : "";

      return { code: "", name: "", department_id: departmentId, store_type: "departmental", status: "active" };
    }

    if (resource === "funding-sources") {
      return { code: "", name: "", sponsor_type: "university", status: "active" };
    }

    return {
      name: "",
      email: "",
      password: "",
      employee_code: "",
      phone: "",
      designation: "",
      department_id: recipientDepartmentId,
      access_scope: "department",
      status: "active",
    };
  };

  const openQuickMasterDialog = (resource: QuickMasterResource, targetField: keyof TransactionForm) => {
    setQuickMasterResource(resource);
    setQuickMasterTargetField(targetField);
    setQuickMasterForm(createQuickMasterForm(resource, targetField));
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

    if (quickMasterResource === "funding-sources") {
      return {
        code: quickMasterForm.code?.trim(),
        name: quickMasterForm.name?.trim(),
        sponsor_type: quickMasterForm.sponsor_type,
        status: quickMasterForm.status,
      };
    }

    return {
      name: quickMasterForm.name?.trim(),
      email: quickMasterForm.email?.trim(),
      password: quickMasterForm.password?.trim(),
      employee_code: quickMasterForm.employee_code?.trim() || null,
      phone: quickMasterForm.phone?.trim() || null,
      designation: quickMasterForm.designation?.trim() || null,
      department_id: quickMasterForm.department_id ? Number(quickMasterForm.department_id) : null,
      access_scope: quickMasterForm.access_scope,
      status: quickMasterForm.status,
      role_ids: [],
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

    if (quickMasterResource === "funding-sources") {
      return Boolean(quickMasterForm.code?.trim() && quickMasterForm.name?.trim());
    }

    return Boolean(quickMasterForm.name?.trim() && quickMasterForm.email?.trim() && quickMasterForm.password?.trim());
  };

  const saveQuickMaster = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setQuickMasterError("Please sign in before creating records.");
      return;
    }

    if (!validateQuickMaster()) {
      setQuickMasterError("Please fill the required fields before saving.");
      return;
    }

    setQuickMasterSaving(true);
    setQuickMasterError("");

    try {
      const response = await api.post(quickMasterResource === "users" ? "/users" : `/master-data/${quickMasterResource}`, quickMasterPayload());
      const created = response.data?.data as RowData | undefined;
      const nextRows = await reloadLookup(quickMasterResource);
      const createdRow =
        created?.id
          ? created
          : nextRows.find((row) => {
              if (quickMasterResource === "users") {
                return String(row.email ?? "").toLowerCase() === quickMasterForm.email?.trim().toLowerCase();
              }

              return String(row.code ?? "").toLowerCase() === quickMasterForm.code?.trim().toLowerCase();
            });

      if (createdRow?.id) {
        if (quickMasterResource === "users" && createdRow.department_id) {
          const departmentField =
            form.transaction_type === "return"
              ? "from_department_id"
              : form.transaction_type === "issue" || form.transaction_type === "transfer"
                ? "to_department_id"
                : null;

          if (departmentField) {
            setFormValue(departmentField, String(createdRow.department_id));
          }
        }

        setFormValue(quickMasterTargetField, String(createdRow.id));
      }

      setMessage(`${quickMasterResourceTitles[quickMasterResource]} created and selected for this voucher.`);
      setError("");
      setQuickMasterOpen(false);
    } catch (quickError) {
      setQuickMasterError(extractApiMessage(quickError, "Unable to create record. Verify required fields and duplicates."));
    } finally {
      setQuickMasterSaving(false);
    }
  };

  const renderQuickAction = (label: string, resource: QuickMasterResource, targetField: keyof TransactionForm) => (
    <button
      className="btn btn-sm btn-link p-0 mb-1 text-decoration-none"
      type="button"
      onClick={() => openQuickMasterDialog(resource, targetField)}
    >
      <i className="bi bi-plus-circle me-1" />
      New {label}
    </button>
  );

  const requiredMarker = <span className="text-danger">*</span>;

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Authentication token required.");
      return;
    }

    const required = canSubmitType(form.transaction_type, form.adjustment_direction);
    for (const field of required) {
      if (!String(form[field as keyof TransactionForm] ?? "").trim()) {
        const label = requiredFieldLabels[field as keyof TransactionForm] ?? field.replaceAll("_", " ");
        setError(`Please complete ${label} for ${toTransactionTypeLabel(form.transaction_type)}.`);
        return;
      }
    }

    const rowsToPost = items
      .map((row): TransactionItemInput | null => {
        const itemId = Number(row.item_id);
        const qty = numberOrNull(row.quantity);
        if (!itemId || !qty || qty <= 0) return null;
        return row;
      })
      .filter((r): r is TransactionItemInput => r !== null);

    if (!rowsToPost.length) {
      setError("At least one valid item row with quantity is required.");
      return;
    }

    const payload = {
      transaction_type: form.transaction_type,
      transaction_date: form.transaction_date,
      from_department_id: numberOrNull(form.from_department_id),
      to_department_id: numberOrNull(form.to_department_id),
      from_store_id: numberOrNull(form.from_store_id),
      to_store_id: numberOrNull(form.to_store_id),
      from_storage_bin_id: numberOrNull(form.from_storage_bin_id),
      to_storage_bin_id: numberOrNull(form.to_storage_bin_id),
      to_building_id: numberOrNull(form.to_building_id),
      to_room_id: numberOrNull(form.to_room_id),
      funding_source_id: numberOrNull(form.funding_source_id),
      project_id: numberOrNull(form.project_id),
      recipient_user_id: numberOrNull(form.recipient_user_id),
      manual_approval_ref: form.manual_approval_ref.trim() || null,
      manual_approval_date: toPayloadDate(form.manual_approval_date),
      manual_approved_by: form.manual_approved_by.trim() || null,
      purpose: form.purpose.trim() || null,
      remarks: form.remarks.trim() || null,
      status: form.status,
      post_now: form.post_now,
      items: rowsToPost.map((row) => ({
        item_id: Number(row.item_id),
        asset_id: numberOrNull(row.asset_id),
        quantity: Number(row.quantity),
        unit_cost: numberOrNull(row.unit_cost),
        remarks: row.remarks.trim() || null,
      })),
    };

    try {
      const response =
        editingTransactionId === null
          ? await api.post("/inventory-transactions", payload)
          : await api.put(`/inventory-transactions/${editingTransactionId}`, payload);
      if (response.data?.transaction) {
        setMessage(`Transaction saved with id ${response.data.transaction.id}`);
      } else if (response.data?.data?.id) {
        setMessage(editingTransactionId === null ? "Transaction created." : "Transaction updated.");
      }

      resetForm();
      setDialogOpen(false);
      setEditingTransactionId(null);
      setExpandedItems({});
      await loadRows();
    } catch (error: unknown) {
      const apiErrorMessage =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
          : undefined;

      setError(typeof apiErrorMessage === "string" ? apiErrorMessage : "Failed to save transaction. Check voucher fields and item lines.");
    }
  };

  const loadItems = async (transactionId: number) => {
    if (expandedItems[transactionId]) return;

    setExpandedLoading((prev) => ({ ...prev, [transactionId]: true }));
    try {
      const response = await api.get(`/inventory-transactions/${transactionId}`);

      const itemRows = response.data?.items;
      setExpandedItems((prev) => ({
        ...prev,
        [transactionId]: Array.isArray(itemRows) ? itemRows : [],
      }));
      setError("");
    } catch {
      setExpandedItems((prev) => ({ ...prev, [transactionId]: [] }));
      setError("Could not load transaction items.");
    } finally {
      setExpandedLoading((prev) => ({ ...prev, [transactionId]: false }));
    }
  };

  const fetchTransactionItems = async (transactionId: number): Promise<TransactionItem[]> => {
    const response = await api.get(`/inventory-transactions/${transactionId}`);
    const data = response.data?.data ?? response.data?.transaction;
    const itemRows = response.data?.items ?? data?.items;
    return Array.isArray(itemRows) ? itemRows : [];
  };

  const printTransaction = async (transaction: Transaction) => {
    try {
      const itemRows = expandedItems[transaction.id] ?? (await fetchTransactionItems(transaction.id));
      setExpandedItems((prev) => ({ ...prev, [transaction.id]: itemRows }));

      const printed = printTransactionDocument<TransactionItem>({
        title: `${toTransactionTypeLabel(transaction.transaction_type)} Voucher`,
        subtitle: "Inventory movement voucher for stock issue, return, transfer, consumption, or adjustment.",
        reference: transaction.transaction_no,
        status: transaction.status,
        meta: [
          { label: "Voucher No", value: transaction.transaction_no },
          { label: "Type", value: toTransactionTypeLabel(transaction.transaction_type) },
          { label: "Date", value: transaction.transaction_date },
          { label: "From Department", value: lookupLabel("departments", transaction.from_department_id) },
          { label: "From Store", value: lookupLabel("stores", transaction.from_store_id) },
          { label: "To Department", value: lookupLabel("departments", transaction.to_department_id) },
          { label: "To Store", value: lookupLabel("stores", transaction.to_store_id) },
          { label: "To Building", value: lookupLabel("buildings", transaction.to_building_id) },
          { label: "To Room", value: lookupLabel("rooms", transaction.to_room_id) },
          {
            label: transaction.transaction_type === "return" ? "Returned By Employee" : "Issued To / Recipient",
            value: lookupLabel("users", transaction.recipient_user_id),
          },
          { label: "Funding Source", value: lookupLabel("funding-sources", transaction.funding_source_id) },
          { label: "Research Project", value: lookupLabel("research-projects", transaction.project_id) },
          { label: "Posted At", value: transaction.posted_at },
        ],
        columns: [
          { header: "Item", render: (item) => lookupLabel("items", item.item_id) },
          { header: "Asset", render: (item) => item.asset_id ? `#${item.asset_id}` : "-" },
          { header: "Quantity", render: (item) => item.quantity },
          { header: "Unit Cost", render: (item) => item.unit_cost },
          { header: "Total", render: (item) => item.unit_cost === null ? null : Number(item.quantity) * Number(item.unit_cost) },
          { header: "Remarks", render: (item) => item.remarks },
        ],
        rows: itemRows,
        note: transaction.remarks ?? transaction.purpose,
      });

      if (!printed) {
        setError("Popup blocked. Please allow popups to print this voucher.");
      }
    } catch {
      setError("Could not prepare transaction print view.");
    }
  };

  const toggleExpand = async (transactionId: number) => {
    if (expandedId === transactionId) {
      setExpandedId(null);
      return;
    }

    await loadItems(transactionId);
    setExpandedId(transactionId);
  };

  const postTransaction = async (id: number) => {
    try {
      const response = await api.post(`/inventory-transactions/${id}/post`, {});
      setMessage(response.data?.message ?? "Transaction posted.");
      setError("");
      await loadRows();
    } catch (postError: unknown) {
      setError(extractApiMessage(postError, "Post failed. Verify stock and transaction status."));
    }
  };

  const deleteTransaction = async (id: number) => {
    try {
      await api.delete(`/inventory-transactions/${id}`);
      setMessage("Transaction deleted.");
      setError("");
      await loadRows();
      if (expandedId === id) {
        setExpandedId(null);
      }
    } catch {
      setError("Delete failed. Only draft transactions can be deleted.");
    }
  };

  const renderScopeHint = () => {
    if (form.transaction_type === "issue" || form.transaction_type === "consumption") {
      return form.transaction_type === "issue"
        ? "Issue uses source department/store and records the employee receiving the item."
        : "Consumption uses source department/store only.";
    }
    if (form.transaction_type === "return") {
      return "Return uses destination department/store and records the employee returning the item.";
    }
    if (form.transaction_type === "adjustment") {
      return form.adjustment_direction === "increase" ? "Adjustment increase uses destination department/store only." : "Adjustment decrease uses source department/store only.";
    }
    return "Transfer uses both source and destination.";
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setDepartmentFilter("");
    setStoreFilter("");
    setAssetIdFilter("");
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
              placeholder="e.g. CSE"
              required
            />
          </div>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. Department of Computer Science"
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
              id="transaction-quick-department-type"
              value={quickMasterForm.department_type ?? ""}
              options={departmentTypeOptions}
              placeholder="Search type"
              onChange={(value) => setQuickMasterField("department_type", value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="transaction-quick-department-status"
              value={quickMasterForm.status ?? "active"}
              options={activeStatusOptions}
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
              placeholder="e.g. CSE-STORE"
              required
            />
          </div>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. CSE Store"
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <FieldLabel required>Department</FieldLabel>
            <SearchableSelect
              id="transaction-quick-store-department"
              value={quickMasterForm.department_id ?? ""}
              options={departmentOptions}
              placeholder="Search department"
              onChange={(value) => setQuickMasterField("department_id", value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <FieldLabel required>Store Type</FieldLabel>
            <SearchableSelect
              id="transaction-quick-store-type"
              value={quickMasterForm.store_type ?? ""}
              options={storeTypeOptions}
              placeholder="Search type"
              onChange={(value) => setQuickMasterField("store_type", value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="transaction-quick-store-status"
              value={quickMasterForm.status ?? "active"}
              options={activeStatusOptions}
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
              placeholder="e.g. UOH-REG"
              required
            />
          </div>
          <div className="col-12 col-md-8">
            <FieldLabel required>Name</FieldLabel>
            <input
              className="form-control form-control-sm"
              value={quickMasterForm.name ?? ""}
              onChange={(event) => setQuickMasterField("name", event.target.value)}
              placeholder="e.g. Regular University Budget"
              required
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Sponsor Type</label>
            <SearchableSelect
              id="transaction-quick-funding-source-sponsor-type"
              value={quickMasterForm.sponsor_type ?? "university"}
              options={sponsorTypeOptions}
              placeholder="Search sponsor type"
              onChange={(value) => setQuickMasterField("sponsor_type", value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Status</label>
            <SearchableSelect
              id="transaction-quick-funding-source-status"
              value={quickMasterForm.status ?? "active"}
              options={activeStatusOptions}
              placeholder="Search status"
              onChange={(value) => setQuickMasterField("status", value)}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="col-12 col-md-6">
          <FieldLabel required>Name</FieldLabel>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.name ?? ""}
            onChange={(event) => setQuickMasterField("name", event.target.value)}
            placeholder="e.g. Lab In-charge"
            required
          />
        </div>
        <div className="col-12 col-md-6">
          <FieldLabel required>Email</FieldLabel>
          <input
            className="form-control form-control-sm"
            type="email"
            value={quickMasterForm.email ?? ""}
            onChange={(event) => setQuickMasterField("email", event.target.value)}
            placeholder="name@uoh.edu.pk"
            required
          />
        </div>
        <div className="col-12 col-md-4">
          <FieldLabel required>Temporary Password</FieldLabel>
          <input
            className="form-control form-control-sm"
            type="password"
            value={quickMasterForm.password ?? ""}
            onChange={(event) => setQuickMasterField("password", event.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Employee Code</label>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.employee_code ?? ""}
            onChange={(event) => setQuickMasterField("employee_code", event.target.value)}
            placeholder="e.g. EMP-CSE-001"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Designation</label>
          <input
            className="form-control form-control-sm"
            value={quickMasterForm.designation ?? ""}
            onChange={(event) => setQuickMasterField("designation", event.target.value)}
            placeholder="e.g. Store Officer"
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
          <label className="form-label small">Department</label>
          <SearchableSelect
            id="transaction-quick-user-department"
            value={quickMasterForm.department_id ?? ""}
            options={departmentOptions}
            placeholder="Search department"
            onChange={(value) => setQuickMasterField("department_id", value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Access Scope</label>
          <SearchableSelect
            id="transaction-quick-user-access-scope"
            value={quickMasterForm.access_scope ?? "department"}
            options={[
              { value: "department", label: "Department" },
              { value: "university", label: "University-wide" },
            ]}
            placeholder="Search access scope"
            onChange={(value) => setQuickMasterField("access_scope", value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small">Status</label>
          <SearchableSelect
            id="transaction-quick-user-status"
            value={quickMasterForm.status ?? "active"}
            options={userStatusOptions}
            placeholder="Search status"
            onChange={(value) => setQuickMasterField("status", value)}
          />
        </div>
      </>
    );
  };

  const transactionColumns = [
    {
      key: "voucher",
      header: "Voucher",
      render: (row: Transaction) => (
        <>
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-receipt text-primary" />
            <Link className="fw-semibold" href={`/issues-returns/${row.id}`}>
            {row.transaction_no}
            </Link>
          </div>
          <div className="small text-secondary">{row.purpose ?? "-"}</div>
        </>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row: Transaction) => <StatusBadge status={toTransactionTypeLabel(row.transaction_type)} />,
    },
    { key: "transaction_date", header: "Date", render: (row: Transaction) => row.transaction_date },
    {
      key: "flow",
      header: "From / To",
      render: (row: Transaction) => (
        <div className="small">
          <div>
            <strong>From:</strong> {lookupLabel("departments", row.from_department_id)} / {lookupLabel("stores", row.from_store_id)}
          </div>
          <div>
            <strong>To:</strong> {lookupLabel("departments", row.to_department_id)} / {lookupLabel("stores", row.to_store_id)}
          </div>
          {row.recipient_user_id ? (
            <div>
              <strong>{row.transaction_type === "return" ? "Returned by" : "Employee"}:</strong>{" "}
              {lookupLabel("users", row.recipient_user_id)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: Transaction) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-end",
      render: (row: Transaction) => (
        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleExpand(row.id)} title="View items">
            <i className="bi bi-eye" />
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => printTransaction(row)} title="Print voucher">
            <i className="bi bi-printer" />
          </button>
          {row.status === "draft" && (
            <>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEditDialog(row)} title="Edit draft">
                <i className="bi bi-pencil-square" />
              </button>
              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => postTransaction(row.id)} title="Post">
                <i className="bi bi-upload" />
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteTransaction(row.id)} title="Delete">
                <i className="bi bi-trash" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const expandedItemColumns = [
    { key: "item", header: "Item", render: (item: TransactionItem) => lookupLabel("items", item.item_id) },
    { key: "asset", header: "Asset", render: (item: TransactionItem) => item.asset_id ?? "-" },
    { key: "qty", header: "Qty", render: (item: TransactionItem) => item.quantity },
    { key: "unitCost", header: "Unit Cost", render: (item: TransactionItem) => item.unit_cost ?? "-" },
    { key: "remarks", header: "Remarks", render: (item: TransactionItem) => item.remarks ?? "-" },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Issue / Return / Transfer / Adjustment"
          subtitle="Create stock movement vouchers and post to update balances for issue, return, transfer, adjustment, and consumption."
          actions={
            <button className="btn btn-sm btn-primary px-3" type="button" onClick={openCreateDialog}>
              <i className="bi bi-plus-lg me-1" />
              New Voucher
            </button>
          }
        />

        {(message || error) && (
          <div className="mb-4">
            {message && <div className="alert alert-success py-2">{String(message)}</div>}
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
                <form className="modal-content border-0 shadow-lg" onSubmit={saveTransaction}>
                  <div className="modal-header px-4 py-3">
                    <div>
                      <h2 className="h5 mb-1">{editingTransactionId === null ? "New Voucher" : "Edit Draft Voucher"}</h2>
                      <p className="text-secondary mb-0">
                        {editingTransactionId === null
                          ? "Create an issue, return, transfer, adjustment, or consumption voucher."
                          : "Update the draft voucher before posting stock movement."}
                      </p>
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
                    <div className="col-12">
                      <label className="form-label">Voucher type</label>
                      <select
                        className="form-select form-select-sm"
                        value={form.transaction_type}
                        onChange={(e) => setFormValue("transaction_type", e.target.value as TransactionType)}
                      >
                        {typeOptions.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">{renderScopeHint()}</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Transaction no</label>
                      <input
                        className="form-control form-control-sm bg-light text-muted"
                        value={editingTransactionId === null ? previewTransactionNo(form.transaction_type, form.transaction_date) : form.transaction_no}
                        readOnly
                        aria-readonly="true"
                      />
                      <div className="form-text small">
                        {editingTransactionId === null
                          ? `Preview only. The backend assigns the next available ${transactionNoPrefixes[form.transaction_type]} number when saved.`
                          : "Draft voucher number is retained unless the type or year changes."}
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Transaction date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={form.transaction_date}
                        onChange={(e) => setFormValue("transaction_date", e.target.value)}
                      />
                    </div>

                    {form.transaction_type === "issue" && (
                      <div className="col-12 col-md-6">
                        <label className="form-label">To Department {requiredMarker}</label>
                        <SearchableSelect
                          id="transaction-to-department-issue"
                          value={form.to_department_id}
                          options={departmentOptions}
                          onChange={(value) => setFormValue("to_department_id", value)}
                          placeholder="Search department"
                          emptyLabel="No department found."
                        />
                      </div>
                    )}

                    {(form.transaction_type === "issue" || form.transaction_type === "return" || form.transaction_type === "transfer") && (
                      <div className="col-12 col-md-6">
                        <label className="form-label">
                          {form.transaction_type === "return"
                            ? "By Employee"
                            : form.transaction_type === "transfer"
                            ? "Recipient / Custodian (optional)"
                            : "To Employee"}
                          {form.transaction_type === "issue" || form.transaction_type === "return" ? <> {requiredMarker}</> : ""}
                        </label>
                        <SearchableSelect
                          id="transaction-recipient-user"
                          value={form.recipient_user_id}
                          options={employeeOptions}
                          onChange={(value) => setFormValue("recipient_user_id", value)}
                          placeholder="Search employee by name, code, or email"
                          emptyLabel="No employee found."
                        />
                        <div className="form-text">
                          {form.transaction_type === "return"
                            ? "Select the employee returning the item to store."
                            : "Select the employee who will be accountable for the issued item."}
                        </div>
                      </div>
                    )}

                    {showsReceivingLocation && (
                      <>
                        <div className="col-12 col-md-6">
                          <label className="form-label">To Building</label>
                          <SearchableSelect
                            id="transaction-to-building"
                            value={form.to_building_id}
                            options={buildingOptions}
                            onChange={(value) => setFormValue("to_building_id", value)}
                            placeholder="Optional"
                            emptyLabel="No building found."
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">To Room</label>
                          <SearchableSelect
                            id="transaction-to-room"
                            value={form.to_room_id}
                            options={roomOptions}
                            onChange={(value) => setFormValue("to_room_id", value)}
                            placeholder={form.to_building_id ? "Optional" : "Optional, select building to filter"}
                            emptyLabel={form.to_building_id ? "No room found for selected building." : "No room found."}
                          />
                        </div>
                      </>
                    )}

                    {form.transaction_type === "adjustment" && (
                      <div className="col-12">
                        <label className="form-label mb-1 small">Adjustment direction</label>
                        <div className="btn-group w-100" role="group" aria-label="Adjustment direction">
                          <input
                            type="radio"
                            className="btn-check"
                            id="adjustment-increase"
                            name="adjustment_direction"
                            autoComplete="off"
                            value="increase"
                            checked={form.adjustment_direction === "increase"}
                            onChange={(event) => setFormValue("adjustment_direction", event.target.value)}
                          />
                          <label className="btn btn-outline-success" htmlFor="adjustment-increase">
                            Increase stock
                          </label>
                          <input
                            type="radio"
                            className="btn-check"
                            id="adjustment-decrease"
                            name="adjustment_direction"
                            autoComplete="off"
                            value="decrease"
                            checked={form.adjustment_direction === "decrease"}
                            onChange={(event) => setFormValue("adjustment_direction", event.target.value)}
                          />
                          <label className="btn btn-outline-warning" htmlFor="adjustment-decrease">
                            Decrease stock
                          </label>
                        </div>
                      </div>
                    )}

                    {showsSourceStockFields && (
                      <>
                        <div className="col-12 col-md-6">
                          <label className="form-label">From Department {requiredMarker}</label>
                          <SearchableSelect
                            id="transaction-from-department"
                            value={form.from_department_id}
                            options={departmentOptions}
                            onChange={(value) => setFormValue("from_department_id", value)}
                            placeholder="Search department"
                            emptyLabel="No department found."
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">From Store {requiredMarker}</label>
                          <SearchableSelect
                            id="transaction-from-store"
                            value={form.from_store_id}
                            options={storeOptions}
                            onChange={(value) => setFormValue("from_store_id", value)}
                            placeholder="Search store"
                            emptyLabel="No store found."
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">From Storage Bin (optional)</label>
                          <select
                            className="form-select form-select-sm"
                            value={form.from_storage_bin_id}
                            onChange={(e) => setFormValue("from_storage_bin_id", e.target.value)}
                          >
                            <option value="">Optional</option>
                            {binsForStore(form.from_store_id).map((bin) => (
                              <option key={bin.id} value={bin.id}>
                                {bin.code} - {bin.name ?? ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {showsReturnByDepartment && (
                      <div className="col-12 col-md-6">
                        <label className="form-label">By Department {requiredMarker}</label>
                        <SearchableSelect
                          id="transaction-by-department"
                          value={form.from_department_id}
                          options={departmentOptions}
                          onChange={(value) => setFormValue("from_department_id", value)}
                          placeholder="Search department"
                          emptyLabel="No department found."
                        />
                      </div>
                    )}

                    {showsToDepartment && form.transaction_type !== "issue" && (
                      <>
                        <div className="col-12 col-md-6">
                          <label className="form-label">To Department {requiredMarker}</label>
                          <SearchableSelect
                            id="transaction-to-department"
                            value={form.to_department_id}
                            options={departmentOptions}
                            onChange={(value) => setFormValue("to_department_id", value)}
                            placeholder="Search department"
                            emptyLabel="No department found."
                          />
                        </div>
                        {showsToStore ? (
                          <div className="col-12 col-md-6">
                            <label className="form-label">To Store {requiredMarker}</label>
                            <SearchableSelect
                              id="transaction-to-store"
                              value={form.to_store_id}
                              options={storeOptions}
                              onChange={(value) => setFormValue("to_store_id", value)}
                              placeholder="Search store"
                              emptyLabel="No store found."
                            />
                          </div>
                        ) : null}
                        {showsToStore ? (
                          <div className="col-12 col-md-6">
                            <label className="form-label">To Storage Bin (optional)</label>
                            <select
                              className="form-select form-select-sm"
                              value={form.to_storage_bin_id}
                              onChange={(e) => setFormValue("to_storage_bin_id", e.target.value)}
                            >
                              <option value="">Optional</option>
                              {binsForStore(form.to_store_id).map((bin) => (
                                <option key={bin.id} value={bin.id}>
                                  {bin.code} - {bin.name ?? ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </>
                    )}

                    <div className="col-12 col-md-6">
                      <div className="d-flex align-items-center justify-content-between">
                        <label className="form-label">Funding Source</label>
                        {renderQuickAction("Funding Source", "funding-sources", "funding_source_id")}
                      </div>
                      <SearchableSelect
                        id="transaction-funding-source"
                        value={form.funding_source_id}
                        options={fundingSourceOptions}
                        onChange={(value) => setFormValue("funding_source_id", value)}
                        placeholder="Optional"
                        emptyLabel="No funding source found."
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Research Project</label>
                      <SearchableSelect
                        id="transaction-research-project"
                        value={form.project_id}
                        options={projectOptions}
                        onChange={(value) => setFormValue("project_id", value)}
                        placeholder="Optional"
                        emptyLabel="No project found."
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Purpose</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        value={form.purpose}
                        onChange={(e) => setFormValue("purpose", e.target.value)}
                        placeholder="Issue/return reason"
                      />
                    </div>

                    <div className="col-12">
                      <ApprovalReferenceFields
                        value={{
                          ref: form.manual_approval_ref,
                          authority: form.manual_approved_by,
                          date: form.manual_approval_date,
                          remarks: form.remarks,
                        }}
                        onChange={(value) => {
                          setFormValue("manual_approval_ref", value.ref);
                          setFormValue("manual_approved_by", value.authority);
                          setFormValue("manual_approval_date", value.date);
                          setFormValue("remarks", value.remarks);
                        }}
                      />
                    </div>
                  </div>

                  <hr className="my-4" />

                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="h5 mb-0">Items</h2>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={addItemRow}>
                      <i className="bi bi-plus-lg me-1" />
                      Add item
                    </button>
                  </div>

                  {items.map((item, index) => (
                    <div className="row g-2 align-items-end mb-3" key={`${index}-${item.item_id || "new"}`}>
                      <div className="col-12 col-xl-3">
                        <div className="d-flex align-items-center justify-content-between">
                          <label className="form-label mb-1 small">Item</label>
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
                          id={`transaction-item-${index}`}
                          value={item.item_id}
                          options={itemOptions}
                          onChange={(value) => setTransactionItemValue(index, "item_id", value)}
                          placeholder="Search item by code or name"
                          emptyLabel="No item found."
                        />
                      </div>
                      <div className="col-12 col-xl-3">
                        <label className="form-label mb-1 small">Asset ID (optional)</label>
                        <input
                          className="form-control form-control-sm"
                          value={item.asset_id}
                          onChange={(e) => setItemValue(index, "asset_id", e.target.value)}
                          placeholder="Optional fixed asset ID"
                        />
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Quantity</label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="form-control form-control-sm"
                          value={item.quantity}
                          onChange={(e) => setItemValue(index, "quantity", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-12 col-xl-2">
                        <label className="form-label mb-1 small">Unit Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control form-control-sm"
                          value={item.unit_cost}
                          onChange={(e) => setItemValue(index, "unit_cost", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-12 col-xl-1">
                        <button
                          type="button"
                          className="btn btn-outline-danger w-100"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length === 1}
                          aria-label="Remove row"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                      <div className="col-12">
                        <label className="form-label mb-1 small">Remarks</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={1}
                          value={item.remarks}
                          onChange={(e) => setItemValue(index, "remarks", e.target.value)}
                          placeholder="Serial/location/condition notes"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-check-label d-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={form.post_now}
                          onChange={(e) => setFormValue("post_now", e.target.checked)}
                        />
                        Post immediately after save
                      </label>
                    </div>
                  </div>
                  </div>
                  <div className="modal-footer px-4 py-3">
                    <button type="button" className="btn btn-outline-secondary" onClick={closeCreateDialog}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-save me-2" />
                      {editingTransactionId === null ? "Save Transaction" : "Update Transaction"}
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
                          <h3 className="modal-title h5 mb-1">Add {quickMasterResourceTitles[quickMasterResource]}</h3>
                          <div className="small text-secondary">
                            Create the missing record here, then continue this voucher.
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
                          {quickMasterSaving ? "Saving..." : `Create & Select ${quickMasterResourceTitles[quickMasterResource]}`}
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
                          <div className="small text-secondary">Create the missing item here, then continue this voucher.</div>
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
                              placeholder="e.g. Office Table"
                              required
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel required>Item Type</FieldLabel>
                            <SearchableSelect
                              id="transaction-quick-item-type"
                              value={quickItemForm.item_type}
                              options={itemTypeOptions}
                              placeholder="Search item type"
                              onChange={(value) => setQuickItemField("item_type", value as ItemType)}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel required>Category</FieldLabel>
                            <SearchableSelect
                              id="transaction-quick-item-category"
                              value={quickItemForm.category_id}
                              options={categoryOptions}
                              placeholder="Search category"
                              onChange={selectQuickItemCategory}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <FieldLabel>Subcategory</FieldLabel>
                            <SearchableSelect
                              id="transaction-quick-item-subcategory"
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
                              id="transaction-quick-item-unit"
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
                              placeholder="Optional"
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label small">Model</label>
                            <input
                              className="form-control form-control-sm"
                              value={quickItemForm.model}
                              onChange={(event) => setQuickItemField("model", event.target.value)}
                              placeholder="Optional"
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
                                      id={`transaction-quick-item-${key}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={Boolean(quickItemForm[key as keyof QuickItemForm])}
                                      onChange={(event) =>
                                        setQuickItemField(key as keyof QuickItemForm, event.target.checked as never)
                                      }
                                    />
                                    <label className="form-check-label small" htmlFor={`transaction-quick-item-${key}`}>
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
                              id="transaction-quick-item-status"
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
                <FilterBar onReset={clearFilters}>
                  <div className="col-12 col-md-5">
                    <label className="form-label small mb-1">Search</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="Voucher number / purpose / remarks"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label small mb-1">Asset ID</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="e.g. 12"
                      value={assetIdFilter}
                      inputMode="numeric"
                      onChange={(event) => {
                        setAssetIdFilter(event.target.value.replace(/[^0-9]/g, ""));
                      }}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Status</label>
                    <select className="form-select form-select-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="">All statuses</option>
                      <option value="draft">Draft</option>
                      <option value="posted">Posted</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label small mb-1">Type</label>
                    <select className="form-select form-select-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TransactionType | "")}>
                      <option value="">All types</option>
                      {typeOptions.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Department</label>
                    <select className="form-select form-select-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                      <option value="">All departments</option>
                      {lookups.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small mb-1">Store</label>
                    <select className="form-select form-select-sm" value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                      <option value="">All stores</option>
                      {lookups.stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.code}
                        </option>
                      ))}
                    </select>
                  </div>
              </FilterBar>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h6 fw-semibold mb-0">Transaction list</h2>
            <span className="small text-secondary">{rows.length} record{rows.length === 1 ? "" : "s"}</span>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No transactions found" message="No records match the current filters." icon="bi-receipt" />
          ) : (
            <DataTable columns={transactionColumns} rows={rows} />
          )}

          {expandedId && (
            <div className="mt-3">
              <h3 className="h6">Transaction items for #{expandedId}</h3>
              {expandedLoading[expandedId] ? (
                <div className="text-secondary">Loading items...</div>
              ) : (
                <DataTable columns={expandedItemColumns} rows={expandedItems[expandedId] ?? []} empty="No item rows returned by backend." />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
