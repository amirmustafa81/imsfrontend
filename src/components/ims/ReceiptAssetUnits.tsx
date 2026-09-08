"use client";

import { AttributeFields, type AttributeDefinition, type AttributeValues } from "./AttributeFields";

export type ReceiptAssetUnit = {
  serial_number: string | null;
  brand?: string | null;
  model?: string | null;
  attributes: AttributeValues;
};

export function ReceiptAssetUnits({ units, count, defaultBrand, defaultModel, defaults, definitions, categoryId, subcategoryId, serialRequired, onChange }: {
  units: ReceiptAssetUnit[];
  count: number;
  defaultBrand?: string | null;
  defaultModel?: string | null;
  defaults: AttributeValues;
  definitions: AttributeDefinition[];
  categoryId: string | number | null | undefined;
  subcategoryId: string | number | null | undefined;
  serialRequired: boolean;
  onChange: (units: ReceiptAssetUnit[]) => void;
}) {
  const validCount = Number.isInteger(count) && count >= 0 && count <= 1000;
  const prepare = () => {
    if (units.length > count && !window.confirm("Reducing the unit count will remove the extra serial numbers and specifications. Continue?")) return;
    onChange(Array.from({ length: count }, (_, index) => units[index] ?? {
      serial_number: "",
      brand: defaultBrand ?? "",
      model: defaultModel ?? "",
      attributes: { ...defaults },
    }));
  };

  return (
    <div className="border rounded p-3 my-2">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <strong>Serial Numbers & Specifications</strong>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={prepare} disabled={!validCount || count === units.length}>
          Prepare {validCount ? count : ""} unit rows
        </button>
      </div>
      <p className="small text-secondary">Enter one row per accepted base unit. Item Master brand, model, and specifications are optional defaults; the saved values belong to the individual asset.</p>
      {!validCount ? <div className="alert alert-warning">Accepted base quantity must be a whole number, up to 1,000 units per line.</div> : null}
      {units.length !== count ? <div className="text-danger small mb-2">{units.length} unit rows entered; {count} accepted units. Prepare the matching number of rows before posting.</div> : null}
      {units.map((unit, index) => (
        <div className="border-top pt-3 mt-3" key={index}>
          <div className="row g-2 align-items-end mb-3">
            <label className="form-label small mb-0 col-12 col-md-4">
              Unit {index + 1} serial number {serialRequired ? "*" : "(optional)"}
              <input className="form-control form-control-sm mt-1" maxLength={150} value={unit.serial_number ?? ""}
                onChange={(event) => onChange(units.map((row, i) => i === index ? { ...row, serial_number: event.target.value } : row))} />
            </label>
            <label className="form-label small mb-0 col-12 col-md-4">
              Brand {serialRequired ? "*" : "(optional)"}
              <input className="form-control form-control-sm mt-1" maxLength={150} value={unit.brand ?? ""}
                onChange={(event) => onChange(units.map((row, i) => i === index ? { ...row, brand: event.target.value } : row))} />
            </label>
            <label className="form-label small mb-0 col-12 col-md-4">
              Model / Variant {serialRequired ? "*" : "(optional)"}
              <input className="form-control form-control-sm mt-1" maxLength={150} value={unit.model ?? ""}
                onChange={(event) => onChange(units.map((row, i) => i === index ? { ...row, model: event.target.value } : row))} />
            </label>
            {index === 0 && units.length > 1 ? (
              <div className="col-12">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => {
                if (window.confirm("Replace brand, model, and specifications on all other units with unit 1 values? Serial numbers will be kept.")) {
                  onChange(units.map((row) => ({ ...row, brand: unit.brand, model: unit.model, attributes: { ...unit.attributes } })));
                }
                }}>Copy unit 1 details to all</button>
              </div>
            ) : null}
          </div>
          <AttributeFields definitions={definitions} categoryId={categoryId} subcategoryId={subcategoryId} appliesTo="asset"
            values={unit.attributes} enforceRequired={false} title={`Unit ${index + 1} specifications`}
            emptyMessage="No asset specification attributes are configured for this item's category/subcategory. Please check the Item Master category/subcategory and active Attribute Definitions."
            onChange={(code, value) => onChange(units.map((row, i) => i === index ? { ...row, attributes: { ...row.attributes, [code]: value } } : row))} />
        </div>
      ))}
    </div>
  );
}
