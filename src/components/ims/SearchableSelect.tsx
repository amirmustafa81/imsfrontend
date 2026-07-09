"use client";

import { useMemo, useState } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Search or select",
  emptyLabel = "No records found.",
  disabled = false,
}: {
  id: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const displayValue = open ? query : selectedLabel;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = displayValue.trim().toLowerCase();
    if (!normalizedQuery) {
      return options.slice(0, 60);
    }

    return options
      .filter((option) => `${option.label} ${option.keywords ?? ""}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 60);
  }, [displayValue, options]);

  return (
    <div className="position-relative">
      <input
        id={id}
        className="form-control form-control-sm"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => {
          setQuery(selectedLabel);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
      />
      {open && !disabled ? (
        <div
          id={`${id}-options`}
          className="dropdown-menu show w-100 shadow-sm"
          role="listbox"
          style={{ maxHeight: "240px", overflowY: "auto", zIndex: 1080 }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`dropdown-item small ${option.value === value ? "active" : ""}`}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setQuery(option.label);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="dropdown-item-text small text-secondary">{emptyLabel}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
