"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AttributeFields, type AttributeDefinition, type AttributeValues } from "@/components/ims/AttributeFields";
import { FieldLabel } from "@/components/ims/FieldLabel";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ims/SearchableSelect";

type LookupKey =
  | "departments"
  | "stores"
  | "items"
  | "asset-categories"
  | "buildings"
  | "rooms"
  | "research-projects"
  | "funding-sources";

type LookupRow = {
  id: number;
  [key: string]: string | number | boolean | null | undefined;
};

type AssetFormState = {
  item_id: string;
  category_code: string;
  subcategory_code: string;
  department_id: string;
  department_code: string;
  building_id: string;
  building_code: string;
  room_id: string;
  room_code: string;
  store_id: string;
  project_id: string;
  funding_source_id: string;
  employee_code: string;
  serial_number: string;
  model: string;
  purchase_cost: string;
  capitalization_date: string;
  useful_life_years: string;
  salvage_value: string;
  old_tag_reference: string;
  status: "in_store" | "issued" | "in_use" | "under_repair" | "missing_under_investigation" | "damaged" | "obsolete";
  condition_status: "new" | "good" | "needs_repair" | "damaged" | "obsolete";
  is_sensitive_controlled: boolean;
  attributes: AttributeValues;
};

type AssetCreateDefaults = Partial<Pick<AssetFormState, "category_code" | "subcategory_code" | "status" | "condition_status" | "is_sensitive_controlled" | "project_id">>;

const initialLookups: Record<LookupKey, LookupRow[]> = {
  departments: [],
  stores: [],
  items: [],
  "asset-categories": [],
  buildings: [],
  rooms: [],
  "research-projects": [],
  "funding-sources": [],
};

const createInitialForm = (defaults?: AssetCreateDefaults): AssetFormState => ({
  item_id: "",
  category_code: defaults?.category_code ?? "",
  subcategory_code: defaults?.subcategory_code ?? "",
  department_id: "",
  department_code: "",
  building_id: "",
  building_code: "",
  room_id: "",
  room_code: "",
  store_id: "",
  project_id: defaults?.project_id ?? "",
  funding_source_id: "",
  employee_code: "",
  serial_number: "",
  model: "",
  purchase_cost: "0",
  capitalization_date: "",
  useful_life_years: "",
  salvage_value: "0",
  old_tag_reference: "",
  status: defaults?.status ?? "in_store",
  condition_status: defaults?.condition_status ?? "new",
  is_sensitive_controlled: defaults?.is_sensitive_controlled ?? false,
  attributes: {},
});

const labelFor = (row: LookupRow) => String(row.code ?? row.item_code ?? row.project_code ?? row.id) + (row.name || row.title ? ` - ${row.name ?? row.title}` : "");
const isParentCategory = (row: LookupRow) => !row.parent_category_id;
const isChildOfCategory = (row: LookupRow, parentId: number | string | null | undefined) => String(row.parent_category_id ?? "") === String(parentId ?? "");
const toOption = (row: LookupRow, valueKey: "id" | "code" = "id"): SearchableSelectOption => ({
  value: String(row[valueKey] ?? ""),
  label: labelFor(row),
  keywords: Object.values(row).filter((value) => typeof value === "string" || typeof value === "number").join(" "),
});

const assetStatusOptions: SearchableSelectOption[] = [
  { value: "in_store", label: "In Store" },
  { value: "issued", label: "Issued" },
  { value: "in_use", label: "In Use" },
  { value: "under_repair", label: "Under Repair" },
  { value: "missing_under_investigation", label: "Missing / Under Investigation" },
  { value: "damaged", label: "Damaged" },
  { value: "obsolete", label: "Obsolete" },
];

const conditionOptions: SearchableSelectOption[] = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "needs_repair", label: "Needs Repair" },
  { value: "damaged", label: "Damaged" },
  { value: "obsolete", label: "Obsolete" },
];

const assetFieldInfo = {
  item: "Select the item master record this asset belongs to. The item controls category defaults and specifications.",
  category: "Main asset category used for asset ID coding, reporting, and depreciation policy.",
  subcategory: "More specific classification under the category, such as laptop, printer, server, or lab equipment.",
  department: "Owning department responsible for this asset and department-level visibility.",
  building: "Physical building where the asset is located for verification and movement tracking.",
  room: "Room or location inside the selected building.",
  store: "Store or stock location currently holding the asset, if it is not issued to a custodian.",
  project: "Research or cost-center project linked to the asset, when applicable.",
  funding: "Budget or funding source used for reporting and financial traceability.",
  serial: "Manufacturer serial number used to identify the physical equipment.",
  model: "Model, version, or specification printed on the device or purchase record.",
  custodian: "Employee or custodian reference used in the location/responsibility part of the asset tag.",
  cost: "Acquisition cost used for capitalization and depreciation calculations.",
  capitalizationDate: "Date from which the asset is capitalized and depreciation starts, when applicable.",
  usefulLife: "Approved useful life in years used by straight-line depreciation.",
  salvage: "Estimated residual value deducted during depreciation calculation.",
  oldTag: "Previous manual tag or legacy reference, if the asset existed before this system.",
  status: "Current operational state such as in store, issued, in use, repair, missing, damaged, or obsolete.",
  condition: "Physical condition observed for maintenance, verification, and reporting.",
  sensitive: "Enable for controlled or sensitive assets that require stricter tracking regardless of cost.",
};

export function AssetCreateDialog({
  open,
  title = "Register Asset",
  subtitle = "Create a fixed asset record and generate the asset/tag identifiers.",
  defaults,
  onClose,
  onCreated,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  defaults?: AssetCreateDefaults;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
}) {
  const { isAuthenticated } = useAuth();
  const authReady = useMemo(() => isAuthenticated, [isAuthenticated]);
  const [lookups, setLookups] = useState<Record<LookupKey, LookupRow[]>>(initialLookups);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [form, setForm] = useState<AssetFormState>(() => createInitialForm(defaults));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setFormField = <K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadLookups = useCallback(async () => {
    if (!authReady || !open) return;

    const next = { ...initialLookups } as Record<LookupKey, LookupRow[]>;
    const loadable = [
      { key: "departments", path: "departments" },
      { key: "stores", path: "stores" },
      { key: "items", path: "items" },
      { key: "asset-categories", path: "asset-categories" },
      { key: "buildings", path: "buildings" },
      { key: "rooms", path: "rooms" },
      { key: "research-projects", path: "research-projects" },
      { key: "funding-sources", path: "funding-sources" },
    ] as const;

    try {
      await Promise.all(
        loadable.map(async ({ key, path }) => {
          const response = await api.get(`/master-data/${path}`);
          const payload = response.data?.data ?? response.data;
          if (Array.isArray(payload)) {
            next[key] = payload;
          }
        }),
      );
      const attributeResponse = await api.get<{ data: AttributeDefinition[] }>("/master-data/asset-attribute-definitions");
      const attributePayload = attributeResponse.data?.data;
      setAttributeDefinitions(Array.isArray(attributePayload) ? attributePayload : []);
      setLookups(next);
    } catch {
      setError("Unable to load asset form lookups. Verify token and backend connectivity.");
    }
  }, [authReady, open]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(createInitialForm(defaults));
    setError("");
    void loadLookups();
  }, [defaults, loadLookups, open]);

  if (!open) {
    return null;
  }

  const selectDepartment = (departmentId: string) => {
    const department = lookups.departments.find((row) => String(row.id) === departmentId);
    setForm((current) => ({
      ...current,
      department_id: departmentId,
      department_code: String(department?.code ?? ""),
    }));
  };

  const selectBuilding = (buildingId: string) => {
    const building = lookups.buildings.find((row) => String(row.id) === buildingId);
    setForm((current) => ({
      ...current,
      building_id: buildingId,
      building_code: String(building?.code ?? ""),
    }));
  };

  const selectRoom = (roomId: string) => {
    const room = lookups.rooms.find((row) => String(row.id) === roomId);
    setForm((current) => ({
      ...current,
      room_id: roomId,
      room_code: String(room?.code ?? ""),
    }));
  };

  const selectCategory = (categoryCode: string) => {
    const category = lookups["asset-categories"].find((row) => String(row.code) === categoryCode);
    setForm((current) => ({
      ...current,
      item_id: "",
      category_code: categoryCode,
      subcategory_code: "",
      useful_life_years: current.useful_life_years || (category?.useful_life_years ? String(category.useful_life_years) : ""),
      is_sensitive_controlled: Boolean(current.is_sensitive_controlled || category?.is_sensitive_controlled === 1 || category?.is_sensitive_controlled === "1"),
      attributes: {},
    }));
  };

  const saveAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authReady) {
      setError("Please sign in before creating asset records.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.post("/assets", {
        item_id: Number(form.item_id),
        category_code: form.category_code.trim(),
        subcategory_code: form.subcategory_code.trim() || null,
        department_id: Number(form.department_id),
        department_code: form.department_code.trim() || null,
        building_id: form.building_id ? Number(form.building_id) : null,
        building_code: form.building_code.trim() || null,
        room_id: form.room_id ? Number(form.room_id) : null,
        room_code: form.room_code.trim() || null,
        store_id: form.store_id ? Number(form.store_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        funding_source_id: form.funding_source_id ? Number(form.funding_source_id) : null,
        employee_code: form.employee_code.trim() || null,
        serial_number: form.serial_number.trim() || null,
        model: form.model.trim() || null,
        purchase_cost: Number(form.purchase_cost || 0),
        capitalization_date: form.capitalization_date || null,
        useful_life_years: form.useful_life_years ? Number(form.useful_life_years) : null,
        salvage_value: Number(form.salvage_value || 0),
        old_tag_reference: form.old_tag_reference.trim() || null,
        status: form.status,
        condition_status: form.condition_status,
        is_sensitive_controlled: form.is_sensitive_controlled,
        attributes: form.attributes,
      });

      await onCreated?.();
      onClose();
    } catch {
      setError("Unable to create asset. Verify required fields, duplicate values, and backend connectivity.");
    } finally {
      setSaving(false);
    }
  };

  const parentCategories = lookups["asset-categories"].filter(isParentCategory);
  const selectedCategory = parentCategories.find((row) => String(row.code) === form.category_code);
  const subcategoryOptions = selectedCategory
    ? lookups["asset-categories"].filter((row) => isChildOfCategory(row, selectedCategory.id))
    : [];
  const selectedSubcategory = subcategoryOptions.find((row) => String(row.code ?? "") === form.subcategory_code);
  const itemOptions = selectedCategory
    ? lookups.items.filter((item) => String(item.category_id ?? "") === String(selectedCategory.id))
    : lookups.items;
  const itemSelectOptions = itemOptions.map((item) => toOption(item));
  const categorySelectOptions = parentCategories.map((category) => toOption(category, "code"));
  const subcategorySelectOptions = subcategoryOptions.map((subcategory) => toOption(subcategory, "code"));
  const departmentSelectOptions = lookups.departments.map((department) => toOption(department));
  const buildingSelectOptions = lookups.buildings.map((building) => toOption(building));
  const roomSelectOptions = lookups.rooms.map((room) => toOption(room));
  const storeSelectOptions = lookups.stores.map((store) => toOption(store));
  const projectSelectOptions = [
    { value: "", label: "No project" },
    ...lookups["research-projects"].map((project) => toOption(project)),
  ];
  const fundingSelectOptions = lookups["funding-sources"].map((source) => toOption(source));

  const selectItem = (itemId: string) => {
    const item = lookups.items.find((row) => String(row.id) === itemId);
    const category = parentCategories.find((row) => String(row.id) === String(item?.category_id ?? ""));
    const subcategory = lookups["asset-categories"].find((row) => String(row.id) === String(item?.subcategory_id ?? ""));

    setForm((current) => ({
      ...current,
      item_id: itemId,
      category_code: category ? String(category.code ?? "") : current.category_code,
      subcategory_code: subcategory ? String(subcategory.code ?? "") : current.subcategory_code,
      useful_life_years: current.useful_life_years || (category?.useful_life_years ? String(category.useful_life_years) : ""),
      is_sensitive_controlled: Boolean(
        current.is_sensitive_controlled ||
        category?.is_sensitive_controlled === 1 ||
        category?.is_sensitive_controlled === "1" ||
        item?.is_sensitive_controlled === 1 ||
        item?.is_sensitive_controlled === "1" ||
        item?.is_sensitive_controlled === true,
      ),
      attributes: (item?.attributes as AttributeValues | undefined) ?? {},
    }));
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ width: "min(58vw, 980px)", maxWidth: "min(58vw, 980px)" }}>
          <form className="modal-content border-0 shadow-lg" onSubmit={saveAsset}>
            <div className="modal-header px-4 py-3">
              <div>
                <h5 className="modal-title mb-1">{title}</h5>
                <div className="text-secondary small">{subtitle}</div>
              </div>
              <button className="btn-close" type="button" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body px-4 py-4">
              {error ? <div className="alert alert-danger py-2">{error}</div> : null}

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <FieldLabel required info={assetFieldInfo.item}>Item</FieldLabel>
                  <SearchableSelect id="asset-item" value={form.item_id} options={itemSelectOptions} onChange={selectItem} placeholder="Search item" />
                </div>
                <div className="col-12 col-md-3">
                  <FieldLabel required info={assetFieldInfo.category}>Category Code</FieldLabel>
                  <SearchableSelect id="asset-category" value={form.category_code} options={categorySelectOptions} onChange={selectCategory} placeholder="Search category" />
                </div>
                <div className="col-12 col-md-3">
                  <FieldLabel info={assetFieldInfo.subcategory}>Subcategory</FieldLabel>
                  <SearchableSelect
                    id="asset-subcategory"
                    value={form.subcategory_code}
                    options={subcategorySelectOptions}
                    onChange={(value) => setFormField("subcategory_code", value)}
                    placeholder={!form.category_code ? "Choose category first" : "Search subcategory"}
                    emptyLabel="No subcategories configured."
                    disabled={!form.category_code || subcategoryOptions.length === 0}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <FieldLabel required info={assetFieldInfo.department}>Department</FieldLabel>
                  <SearchableSelect id="asset-department" value={form.department_id} options={departmentSelectOptions} onChange={selectDepartment} placeholder="Search department" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.building}>Building</FieldLabel>
                  <SearchableSelect id="asset-building" value={form.building_id} options={buildingSelectOptions} onChange={selectBuilding} placeholder="Search building" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.room}>Room</FieldLabel>
                  <SearchableSelect id="asset-room" value={form.room_id} options={roomSelectOptions} onChange={selectRoom} placeholder="Search room" />
                </div>

                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.store}>Store</FieldLabel>
                  <SearchableSelect id="asset-store" value={form.store_id} options={storeSelectOptions} onChange={(value) => setFormField("store_id", value)} placeholder="Search store" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.project}>Project</FieldLabel>
                  <SearchableSelect id="asset-project" value={form.project_id} options={projectSelectOptions} onChange={(value) => setFormField("project_id", value)} placeholder="Search project" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.funding}>Funding Source</FieldLabel>
                  <SearchableSelect id="asset-funding-source" value={form.funding_source_id} options={fundingSelectOptions} onChange={(value) => setFormField("funding_source_id", value)} placeholder="Search funding" />
                </div>

                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.serial}>Serial Number</FieldLabel>
                  <input className="form-control form-control-sm" value={form.serial_number} onChange={(event) => setFormField("serial_number", event.target.value)} placeholder="Manufacturer serial" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.model}>Model</FieldLabel>
                  <input className="form-control form-control-sm" value={form.model} onChange={(event) => setFormField("model", event.target.value)} placeholder="Model / version" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.custodian}>Employee / Custodian Code</FieldLabel>
                  <input className="form-control form-control-sm" value={form.employee_code} onChange={(event) => setFormField("employee_code", event.target.value)} placeholder="Employee ID if applicable" />
                </div>
                <AttributeFields
                  definitions={attributeDefinitions}
                  categoryId={selectedCategory?.id}
                  subcategoryId={selectedSubcategory?.id}
                  appliesTo="asset"
                  values={form.attributes}
                  onChange={(code, value) => setForm((current) => ({
                    ...current,
                    attributes: { ...current.attributes, [code]: value },
                  }))}
                  title="Asset Specifications"
                />

                <div className="col-12 col-md-3">
                  <FieldLabel info={assetFieldInfo.cost}>Purchase Cost</FieldLabel>
                  <input className="form-control form-control-sm" min="0" step="0.01" type="number" value={form.purchase_cost} onChange={(event) => setFormField("purchase_cost", event.target.value)} />
                </div>
                <div className="col-12 col-md-3">
                  <FieldLabel info={assetFieldInfo.capitalizationDate}>Capitalization Date</FieldLabel>
                  <input className="form-control form-control-sm" type="date" value={form.capitalization_date} onChange={(event) => setFormField("capitalization_date", event.target.value)} />
                </div>
                <div className="col-12 col-md-3">
                  <FieldLabel info={assetFieldInfo.usefulLife}>Useful Life</FieldLabel>
                  <input className="form-control form-control-sm" min="0" step="0.1" type="number" value={form.useful_life_years} onChange={(event) => setFormField("useful_life_years", event.target.value)} placeholder="Years" />
                </div>
                <div className="col-12 col-md-3">
                  <FieldLabel info={assetFieldInfo.salvage}>Salvage Value</FieldLabel>
                  <input className="form-control form-control-sm" min="0" step="0.01" type="number" value={form.salvage_value} onChange={(event) => setFormField("salvage_value", event.target.value)} />
                </div>

                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.oldTag}>Old Tag Reference</FieldLabel>
                  <input className="form-control form-control-sm" value={form.old_tag_reference} onChange={(event) => setFormField("old_tag_reference", event.target.value)} placeholder="Old/manual tag if any" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.status}>Status</FieldLabel>
                  <SearchableSelect id="asset-status" value={form.status} options={assetStatusOptions} onChange={(value) => setFormField("status", value as AssetFormState["status"])} placeholder="Search status" />
                </div>
                <div className="col-12 col-md-4">
                  <FieldLabel info={assetFieldInfo.condition}>Condition</FieldLabel>
                  <SearchableSelect id="asset-condition" value={form.condition_status} options={conditionOptions} onChange={(value) => setFormField("condition_status", value as AssetFormState["condition_status"])} placeholder="Search condition" />
                </div>

                <div className="col-12">
                  <div className="form-check">
                    <input id="asset-sensitive-controlled" className="form-check-input" type="checkbox" checked={form.is_sensitive_controlled} onChange={(event) => setFormField("is_sensitive_controlled", event.target.checked)} />
                    <FieldLabel check htmlFor="asset-sensitive-controlled" info={assetFieldInfo.sensitive}>Sensitive / Controlled item</FieldLabel>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer px-4 py-3">
              <button className="btn btn-outline-secondary" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                <i className="bi bi-plus-circle me-1" />
                {saving ? "Saving..." : "Create Asset"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
