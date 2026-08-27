"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? "";
  const [query, setQuery] = useState(selectedLabel);
  const [hasTypedQuery, setHasTypedQuery] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const displayValue = open ? query : selectedLabel;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = hasTypedQuery ? query.trim().toLowerCase() : "";
    if (!normalizedQuery) {
      return options.slice(0, 60);
    }

    return options
      .filter((option) => `${option.label} ${option.keywords ?? ""}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 60);
  }, [hasTypedQuery, options, query]);

  useEffect(() => {
    if (!open || disabled) {
      return;
    }

    const updateMenuPosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const shouldOpenUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(280, shouldOpenUp ? spaceAbove : spaceBelow));

      setMenuStyle({
        left: rect.left,
        maxHeight,
        overflowY: "auto",
        position: "fixed",
        top: shouldOpenUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
        width: rect.width,
        zIndex: 2100,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [disabled, open]);

  const menu =
    open && !disabled && menuStyle ? (
      <div
        id={`${id}-options`}
        className="dropdown-menu show shadow-sm ims-search-select-menu"
        role="listbox"
        style={menuStyle}
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
                setHasTypedQuery(false);
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
    ) : null;

  return (
    <div className="ims-search-select">
      <input
        ref={inputRef}
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
          setHasTypedQuery(false);
          setOpen(true);
        }}
        onClick={() => {
          setQuery(selectedLabel);
          setHasTypedQuery(false);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHasTypedQuery(true);
          onChange("");
          setOpen(true);
        }}
      />
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
