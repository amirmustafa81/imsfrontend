"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ApprovalReferenceFields, DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type LookupKey =
  | "departments"
  | "stores"
  | "suppliers"
  | "funding-sources"
  | "research-projects"
  | "items";

type ReceiptStatus = "draft" | "submitted" | "accepted" | "partially_accepted" | "rejected" | "posted" | "cancelled";

type RowData = {
  id: number;
  [key: string]: string | number | null | undefined;
};

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

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;

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

export default function InventoryReceiptsPage() {
  const { isAuthenticated, loading } = useAuth();
  const [rows, setRows] = useState<Receipt[]>([]);
  const [lookups, setLookups] = useState<Record<LookupKey, RowData[]>>({
    departments: [],
    stores: [],
    suppliers: [],
    "funding-sources": [],
    "research-projects": [],
    items: [],
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
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

  const lookupLabel = (source: LookupKey, value: unknown) => {
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
    ];

    const loadLookups = async () => {
      const updates: Promise<void>[] = [];
      const copy: Record<LookupKey, RowData[]> = {
        departments: [],
        stores: [],
        suppliers: [],
        "funding-sources": [],
        "research-projects": [],
        items: [],
      };

      for (const key of requiredLookups) {
        const request = api.get(`/master-data/${key}`).then((res) => {
          const payload = res.data?.data;
          if (Array.isArray(payload)) {
            copy[key] = payload;
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
    setIsPostingReceipt(false);
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
      receipt_no: form.receipt_no.trim(),
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

    if (!payload.store_id || !payload.department_id || !payload.receipt_no || !payload.receipt_type) {
      setError("Receipt No, Receipt Type, Store and Department are required.");
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

  const loadReceiptItems = async (receiptId: number) => {
    if (expandedItems[receiptId]) {
      setExpandedId((current) => (current === receiptId ? null : receiptId));
      return;
    }

    try {
      setExpandedLoading((current) => ({ ...current, [receiptId]: true }));
      const response = await api.get(`/inventory-receipts/${receiptId}`);
      const itemsData = response.data?.items;
      const normalized = Array.isArray(itemsData) ? itemsData : [];
      setExpandedItems((current) => ({ ...current, [receiptId]: normalized }));
      setExpandedId(receiptId);
      setExpandedLoading((current) => ({ ...current, [receiptId]: false }));
    } catch {
      setExpandedLoading((current) => ({ ...current, [receiptId]: false }));
      setError("Could not load receipt items.");
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
                      className="form-control form-control-sm"
                      value={form.receipt_no}
                      onChange={(event) => setFormValue("receipt_no", event.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Receipt Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.receipt_type}
                      onChange={(event) => setFormValue("receipt_type", event.target.value)}
                    >
                      {receiptTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className="form-select form-select-sm"
                      value={form.status}
                      onChange={(event) => setFormValue("status", event.target.value as ReceiptStatus)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.replace("_", " ").replace(/\b\w/g, (match) => match.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Store</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.store_id}
                      onChange={(event) => setFormValue("store_id", event.target.value)}
                      required
                    >
                      <option value="">Select store</option>
                      {lookups.stores.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.code ?? row.id} - {row.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Department</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.department_id}
                      onChange={(event) => setFormValue("department_id", event.target.value)}
                      required
                    >
                      <option value="">Select department</option>
                      {lookups.departments.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.code ?? row.id} - {row.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Supplier</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.supplier_id}
                      onChange={(event) => setFormValue("supplier_id", event.target.value)}
                    >
                      <option value="">Select supplier</option>
                      {lookups.suppliers.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Funding Source</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.funding_source_id}
                      onChange={(event) => setFormValue("funding_source_id", event.target.value)}
                    >
                      <option value="">Select funding source</option>
                      {lookups["funding-sources"].map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small">Project</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.project_id}
                      onChange={(event) => setFormValue("project_id", event.target.value)}
                    >
                      <option value="">Select project</option>
                      {lookups["research-projects"].map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.project_code} - {row.title}
                        </option>
                      ))}
                    </select>
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
                          <label className="form-label small">Item</label>
                          <select
                            className="form-select form-select-sm"
                            value={item.item_id}
                            onChange={(event) => setItemValue(index, "item_id", event.target.value)}
                            required
                          >
                            <option value="">Select item</option>
                            {lookups.items.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.item_code} - {row.name}
                              </option>
                            ))}
                          </select>
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
                          <select
                            className="form-select form-select-sm"
                            value={item.inspection_status}
                            onChange={(event) => setItemValue(index, "inspection_status", event.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="partially_accepted">Partially Accepted</option>
                            <option value="rejected">Rejected</option>
                          </select>
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
                  <select
                    className="form-select form-select-sm"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="">All</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.replace("_", " ").replace(/\b\w/g, (match) => match.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <label className="form-label small">Store</label>
                  <select
                    className="form-select form-select-sm"
                    value={storeFilter}
                    onChange={(event) => setStoreFilter(event.target.value)}
                  >
                    <option value="">All stores</option>
                    {lookups.stores.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code ?? row.id} - {row.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <label className="form-label small">Department</label>
                  <select
                    className="form-select form-select-sm"
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                  >
                    <option value="">All departments</option>
                    {lookups.departments.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code ?? row.id} - {row.name}
                      </option>
                    ))}
                  </select>
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
                      rows={rows as never}
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
