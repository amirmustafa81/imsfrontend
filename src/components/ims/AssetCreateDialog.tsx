"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AttributeFields, type AttributeDefinition, type AttributeValues } from "@/components/ims/AttributeFields";

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
                  <label className="form-label small">Item *</label>
                  <select className="form-select form-select-sm" value={form.item_id} onChange={(event) => selectItem(event.target.value)} required>
                    <option value="">Choose item</option>
                    {itemOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {labelFor(item)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small">Category Code *</label>
                  <select className="form-select form-select-sm" value={form.category_code} onChange={(event) => selectCategory(event.target.value)} required>
                    <option value="">Choose category</option>
                    {parentCategories.map((category) => (
                      <option key={category.id} value={String(category.code ?? "")}>
                        {labelFor(category)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small">Subcategory</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.subcategory_code}
                    onChange={(event) => setFormField("subcategory_code", event.target.value)}
                    disabled={!form.category_code || subcategoryOptions.length === 0}
                  >
                    <option value="">
                      {!form.category_code
                        ? "Choose category first"
                        : subcategoryOptions.length === 0
                          ? "No subcategories configured"
                          : "Choose subcategory"}
                    </option>
                    {subcategoryOptions.map((subcategory) => (
                      <option key={subcategory.id} value={String(subcategory.code ?? "")}>
                        {labelFor(subcategory)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small">Department *</label>
                  <select className="form-select form-select-sm" value={form.department_id} onChange={(event) => selectDepartment(event.target.value)} required>
                    <option value="">Choose department</option>
                    {lookups.departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {labelFor(department)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Building</label>
                  <select className="form-select form-select-sm" value={form.building_id} onChange={(event) => selectBuilding(event.target.value)}>
                    <option value="">Choose building</option>
                    {lookups.buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {labelFor(building)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Room</label>
                  <select className="form-select form-select-sm" value={form.room_id} onChange={(event) => selectRoom(event.target.value)}>
                    <option value="">Choose room</option>
                    {lookups.rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {labelFor(room)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small">Store</label>
                  <select className="form-select form-select-sm" value={form.store_id} onChange={(event) => setFormField("store_id", event.target.value)}>
                    <option value="">Choose store</option>
                    {lookups.stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {labelFor(store)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Project</label>
                  <select className="form-select form-select-sm" value={form.project_id} onChange={(event) => setFormField("project_id", event.target.value)}>
                    <option value="">No project</option>
                    {lookups["research-projects"].map((project) => (
                      <option key={project.id} value={project.id}>
                        {labelFor(project)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Funding Source</label>
                  <select className="form-select form-select-sm" value={form.funding_source_id} onChange={(event) => setFormField("funding_source_id", event.target.value)}>
                    <option value="">Choose funding</option>
                    {lookups["funding-sources"].map((source) => (
                      <option key={source.id} value={source.id}>
                        {labelFor(source)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small">Serial Number</label>
                  <input className="form-control form-control-sm" value={form.serial_number} onChange={(event) => setFormField("serial_number", event.target.value)} placeholder="Manufacturer serial" />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Model</label>
                  <input className="form-control form-control-sm" value={form.model} onChange={(event) => setFormField("model", event.target.value)} placeholder="Model / version" />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Employee / Custodian Code</label>
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
                  <label className="form-label small">Purchase Cost</label>
                  <input className="form-control form-control-sm" min="0" step="0.01" type="number" value={form.purchase_cost} onChange={(event) => setFormField("purchase_cost", event.target.value)} />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small">Capitalization Date</label>
                  <input className="form-control form-control-sm" type="date" value={form.capitalization_date} onChange={(event) => setFormField("capitalization_date", event.target.value)} />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small">Useful Life</label>
                  <input className="form-control form-control-sm" min="0" step="0.1" type="number" value={form.useful_life_years} onChange={(event) => setFormField("useful_life_years", event.target.value)} placeholder="Years" />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small">Salvage Value</label>
                  <input className="form-control form-control-sm" min="0" step="0.01" type="number" value={form.salvage_value} onChange={(event) => setFormField("salvage_value", event.target.value)} />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small">Old Tag Reference</label>
                  <input className="form-control form-control-sm" value={form.old_tag_reference} onChange={(event) => setFormField("old_tag_reference", event.target.value)} placeholder="Old/manual tag if any" />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Status</label>
                  <select className="form-select form-select-sm" value={form.status} onChange={(event) => setFormField("status", event.target.value as AssetFormState["status"])}>
                    <option value="in_store">In Store</option>
                    <option value="issued">Issued</option>
                    <option value="in_use">In Use</option>
                    <option value="under_repair">Under Repair</option>
                    <option value="missing_under_investigation">Missing / Under Investigation</option>
                    <option value="damaged">Damaged</option>
                    <option value="obsolete">Obsolete</option>
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small">Condition</label>
                  <select className="form-select form-select-sm" value={form.condition_status} onChange={(event) => setFormField("condition_status", event.target.value as AssetFormState["condition_status"])}>
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="needs_repair">Needs Repair</option>
                    <option value="damaged">Damaged</option>
                    <option value="obsolete">Obsolete</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-check">
                    <input className="form-check-input" type="checkbox" checked={form.is_sensitive_controlled} onChange={(event) => setFormField("is_sensitive_controlled", event.target.checked)} />
                    <span className="form-check-label">Sensitive / Controlled item</span>
                  </label>
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
