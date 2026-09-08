"use client";

import { useId } from "react";

export type AttributeDefinition = {
  id: number;
  category_id: number | string;
  subcategory_id?: number | string | null;
  code: string;
  label: string;
  field_type: "text" | "number" | "boolean" | "select" | "date";
  options?: string[] | string | null;
  is_required?: boolean | number | string;
  applies_to: "item" | "asset" | "both";
  sort_order?: number | string | null;
  status?: string;
};

export type AttributeValues = Record<string, string | boolean>;

const toBoolean = (value: unknown): boolean => value === true || value === 1 || value === "1" || value === "true";

const optionList = (options: AttributeDefinition["options"]): string[] => {
  if (Array.isArray(options)) {
    return options.filter((option): option is string => typeof option === "string" && option.trim().length > 0);
  }

  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) {
        return parsed.filter((option): option is string => typeof option === "string" && option.trim().length > 0);
      }
    } catch {
      return options.split(",").map((option) => option.trim()).filter(Boolean);
    }
  }

  return [];
};

export const matchingAttributeDefinitions = (
  definitions: AttributeDefinition[],
  categoryId: string | number | null | undefined,
  subcategoryId: string | number | null | undefined,
  appliesTo: "item" | "asset",
) =>
  definitions
    .filter((definition) => {
      if (definition.status && definition.status !== "active") return false;
      if (String(definition.category_id) !== String(categoryId ?? "")) return false;
      if (definition.subcategory_id && String(definition.subcategory_id) !== String(subcategoryId ?? "")) return false;
      return definition.applies_to === appliesTo || definition.applies_to === "both";
    })
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.label.localeCompare(b.label));

export function AttributeFields({
  definitions,
  categoryId,
  subcategoryId,
  appliesTo,
  values,
  onChange,
  title = "Specifications",
  enforceRequired = true,
  emptyMessage,
  compact = false,
}: {
  definitions: AttributeDefinition[];
  categoryId: string | number | null | undefined;
  subcategoryId: string | number | null | undefined;
  appliesTo: "item" | "asset";
  values: AttributeValues;
  onChange: (code: string, value: string | boolean) => void;
  title?: string;
  enforceRequired?: boolean;
  emptyMessage?: string;
  compact?: boolean;
}) {
  const idPrefix = useId();
  const fields = matchingAttributeDefinitions(definitions, categoryId, subcategoryId, appliesTo);

  if (!categoryId || fields.length === 0) {
    if (emptyMessage && categoryId) {
      return (
        <div className="col-12">
          <div className="alert alert-warning small mb-0">{emptyMessage}</div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="col-12">
      <div className={`border rounded-2 bg-light-subtle ${compact ? "p-2" : "p-3"}`}>
        <div className={`fw-semibold small ${compact ? "mb-2" : "mb-3"}`}>{title}</div>
        <div className={`row ${compact ? "g-2" : "g-3"}`}>
          {fields.map((field) => {
            const value = values[field.code] ?? "";
            const required = toBoolean(field.is_required) && !(appliesTo === "item" && field.applies_to === "both");

            if (field.field_type === "boolean") {
              return (
                <div className={compact ? "col-6 col-md-3 d-flex align-items-end" : "col-12 col-md-4 d-flex align-items-end"} key={field.id}>
                  <div className="form-check">
                    <input
                      id={`${idPrefix}-${field.code}`}
                      className="form-check-input"
                      type="checkbox"
                      checked={toBoolean(value)}
                      onChange={(event) => onChange(field.code, event.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor={`${idPrefix}-${field.code}`}>
                      {field.label} {required ? <span className="text-danger">*</span> : null}
                    </label>
                  </div>
                </div>
              );
            }

            if (field.field_type === "select") {
              return (
                <div className={compact ? "col-6 col-lg-3" : "col-12 col-md-4"} key={field.id}>
                  <label className={`form-label small ${compact ? "mb-1" : ""}`} htmlFor={`${idPrefix}-${field.code}`}>
                    {field.label} {required ? <span className="text-danger">*</span> : null}
                  </label>
                  <select
                    id={`${idPrefix}-${field.code}`}
                    className="form-select form-select-sm"
                    value={String(value)}
                    onChange={(event) => onChange(field.code, event.target.value)}
                    required={enforceRequired && required}
                  >
                    <option value="">Choose {field.label.toLowerCase()}</option>
                    {optionList(field.options).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div className={compact ? "col-6 col-lg-3" : "col-12 col-md-4"} key={field.id}>
                <label className={`form-label small ${compact ? "mb-1" : ""}`} htmlFor={`${idPrefix}-${field.code}`}>
                  {field.label} {required ? <span className="text-danger">*</span> : null}
                </label>
                <input
                  id={`${idPrefix}-${field.code}`}
                  className="form-control form-control-sm"
                  type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                  value={String(value)}
                  onChange={(event) => onChange(field.code, event.target.value)}
                  required={enforceRequired && required}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
