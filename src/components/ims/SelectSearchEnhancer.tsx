"use client";

import { useEffect } from "react";

type NativeOption = {
  value: string;
  label: string;
  disabled: boolean;
};

const optionRows = (select: HTMLSelectElement): NativeOption[] =>
  Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.textContent?.trim() || option.value,
    disabled: option.disabled,
  }));

const selectedLabel = (select: HTMLSelectElement) => {
  const selected = select.options[select.selectedIndex];
  return selected?.textContent?.trim() ?? "";
};

const dispatchSelectChange = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const shouldSkip = (select: HTMLSelectElement) =>
  select.dataset.searchEnhanced === "true" ||
  select.multiple ||
  select.classList.contains("ims-native-select-hidden") ||
  select.closest("[data-skip-select-enhancer='true']");

const enhanceSelect = (select: HTMLSelectElement) => {
  if (shouldSkip(select)) return;

  select.dataset.searchEnhanced = "true";
  select.classList.add("ims-native-select-hidden");

  const wrapper = document.createElement("div");
  wrapper.className = "ims-search-select position-relative";
  wrapper.dataset.selectEnhancer = "true";

  const input = document.createElement("input");
  input.type = "text";
  input.className = select.classList.contains("form-select-sm") ? "form-control form-control-sm" : "form-control";
  input.placeholder = select.options[0]?.textContent?.trim() || "Search or select";
  input.autocomplete = "off";
  input.role = "combobox";
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.value = selectedLabel(select);
  input.disabled = select.disabled;

  const menu = document.createElement("div");
  menu.className = "dropdown-menu w-100 shadow-sm";
  menu.style.maxHeight = "240px";
  menu.style.overflowY = "auto";

  const closeMenu = () => {
    menu.classList.remove("show");
    input.setAttribute("aria-expanded", "false");
  };

  const renderMenu = (query = "") => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = optionRows(select)
      .filter((option) => !option.disabled)
      .filter((option) => {
        if (!normalizedQuery) return true;
        return `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 80);

    menu.replaceChildren();

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dropdown-item-text small text-secondary";
      empty.textContent = "No records found.";
      menu.appendChild(empty);
      return;
    }

    rows.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dropdown-item small ${option.value === select.value ? "active" : ""}`;
      button.textContent = option.label;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        dispatchSelectChange(select, option.value);
        input.value = selectedLabel(select);
        closeMenu();
      });
      menu.appendChild(button);
    });
  };

  const openMenu = () => {
    if (select.disabled) return;
    input.disabled = select.disabled;
    input.value = selectedLabel(select);
    renderMenu("");
    menu.classList.add("show");
    input.setAttribute("aria-expanded", "true");
  };

  input.addEventListener("focus", openMenu);
  input.addEventListener("click", openMenu);
  input.addEventListener("input", () => {
    renderMenu(input.value);
    menu.classList.add("show");
    input.setAttribute("aria-expanded", "true");
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      input.value = selectedLabel(select);
      closeMenu();
    }, 120);
  });
  select.addEventListener("change", () => {
    input.value = selectedLabel(select);
  });

  wrapper.append(input, menu);
  select.insertAdjacentElement("afterend", wrapper);
};

const enhanceAllSelects = () => {
  document.querySelectorAll<HTMLSelectElement>("select.form-select").forEach(enhanceSelect);
};

export function SelectSearchEnhancer() {
  useEffect(() => {
    enhanceAllSelects();

    const observer = new MutationObserver(() => {
      enhanceAllSelects();
      document.querySelectorAll<HTMLSelectElement>("select.form-select[data-search-enhanced='true']").forEach((select) => {
        const input = select.nextElementSibling?.querySelector<HTMLInputElement>("input[role='combobox']");
        if (input) {
          input.disabled = select.disabled;
          if (document.activeElement !== input) {
            input.value = selectedLabel(select);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
