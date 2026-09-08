"use client";

import { AttributeFields, type AttributeDefinition, type AttributeValues } from "./AttributeFields";

export type ReceiptAssetUnit = {
  serial_number: string | null;
  brand?: string | null;
  model?: string | null;
  attributes: AttributeValues;
};

export function ReceiptAssetUnits({ units, count, defaults, definitions, categoryId, subcategoryId, serialRequired, onChange }: {
  units: ReceiptAssetUnit[];
  count: number;
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
      attributes: { ...defaults },
    }));
  };
  const copyFirstUnitSpecifications = () => {
    const firstUnit = units[0];
    if (!firstUnit || units.length <= 1) return;
    if (!window.confirm("Copy unit 1 specifications to all unit rows? Serial numbers will be kept.")) return;
    onChange(units.map((row, index) => index === 0 ? row : { ...row, attributes: { ...firstUnit.attributes } }));
  };

  return (
    <div className="border rounded p-2 my-2">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
        <strong>Serial Numbers & Specifications</strong>
        <div className="d-flex flex-wrap gap-2">
          {units.length > 1 ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyFirstUnitSpecifications}>
              Copy unit 1 specs to all rows
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={prepare} disabled={!validCount || count === units.length}>
            Prepare {validCount ? count : ""} unit rows
          </button>
        </div>
      </div>
      <p className="small text-secondary mb-2">Enter one row per accepted base unit. Item Master specifications are optional defaults; the saved values belong to the individual asset.</p>
      {!validCount ? <div className="alert alert-warning">Accepted base quantity must be a whole number, up to 1,000 units per line.</div> : null}
      {units.length !== count ? <div className="text-danger small mb-2">{units.length} unit rows entered; {count} accepted units. Prepare the matching number of rows before posting.</div> : null}
      {units.map((unit, index) => (
        <div className="border-top pt-2 mt-2" key={index}>
          <div className="row g-2 align-items-end mb-2">
            <label className="form-label small mb-0 col-12 col-md-4">
              Unit {index + 1} serial number {serialRequired ? "*" : "(optional)"}
              <input className="form-control form-control-sm mt-1" maxLength={150} value={unit.serial_number ?? ""}
                onChange={(event) => onChange(units.map((row, i) => i === index ? { ...row, serial_number: event.target.value } : row))} />
            </label>
          </div>
          <AttributeFields definitions={definitions} categoryId={categoryId} subcategoryId={subcategoryId} appliesTo="asset"
            values={unit.attributes} enforceRequired={false} title={`Unit ${index + 1} specifications`} compact
            emptyMessage="No asset specification attributes are configured for this item's category/subcategory. Please check the Item Master category/subcategory and active Attribute Definitions."
            onChange={(code, value) => onChange(units.map((row, i) => i === index ? { ...row, attributes: { ...row.attributes, [code]: value } } : row))} />
        </div>
      ))}
    </div>
  );
}
