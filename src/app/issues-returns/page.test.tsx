import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import IssuesReturnsPage from "./page";

type LookupResponse = {
  data: {
    data: Array<{ id: number; code?: string; name?: string; item_code?: string; title?: string; project_code?: string }>;
  };
};

const mockedApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: mockedApi.get,
    post: mockedApi.post,
    delete: mockedApi.delete,
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const lookupPayloads = {
  departments: [{ id: 2, code: "CSE", name: "Computer Science" }],
  stores: [{ id: 11, code: "STORE-A", name: "Main Store" }],
  items: [{ id: 21, item_code: "ITM-001", name: "Test Item" }],
  "funding-sources": [{ id: 31, code: "FS-01", name: "Gov Fund" }],
  "research-projects": [{ id: 41, project_code: "PRJ-01", title: "AI Lab" }],
};

const fakeStorage = (() => {
  const data = new Map<string, string>();

  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
})();

const buildGetResponse = (url: string): LookupResponse => {
  if (url.startsWith("/master-data/departments")) {
    return { data: { data: lookupPayloads.departments } };
  }
  if (url.startsWith("/master-data/stores")) {
    return { data: { data: lookupPayloads.stores } };
  }
  if (url.startsWith("/master-data/items")) {
    return { data: { data: lookupPayloads.items } };
  }
  if (url.startsWith("/master-data/funding-sources")) {
    return { data: { data: lookupPayloads["funding-sources"] } };
  }
  if (url.startsWith("/master-data/research-projects")) {
    return { data: { data: lookupPayloads["research-projects"] } };
  }

  return { data: { data: [] } };
};

const seedLookupRequests = () => {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === "/inventory-transactions") {
      return Promise.resolve({ data: { data: [] } });
    }

    return Promise.resolve(buildGetResponse(url));
  });

  mockedApi.post.mockResolvedValue({ data: { data: { id: 77 }, transaction: { id: 77 } } });
  mockedApi.delete.mockResolvedValue({});
};

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: fakeStorage,
    configurable: true,
    enumerable: true,
    writable: true,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: fakeStorage,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }

  fakeStorage.clear();
  localStorage.setItem("ims_api_token", "test-token");
  seedLookupRequests();
});

afterEach(() => {
  mockedApi.get.mockReset();
  mockedApi.post.mockReset();
  mockedApi.delete.mockReset();
  fakeStorage.clear();
});

const renderPage = async () => {
  const user = userEvent.setup();
  render(<IssuesReturnsPage />);

  await waitFor(() => {
    expect(screen.getByText(/Issue \/ Return \/ Transfer \/ Adjustment/i)).toBeInTheDocument();
  });

  return { user };
};

const getControlForLabel = (labelText: RegExp | string): Element | null => {
  const matcher =
    typeof labelText === "string"
      ? (value: string) => value.toLowerCase().includes(labelText.toLowerCase())
      : (value: string) => labelText.test(value);

  const label = Array.from(document.querySelectorAll("label")).find((node) =>
    matcher((node.textContent ?? "").trim()),
  );

  if (!label || !label.parentElement) return null;

  return label.parentElement.querySelector("select, input, textarea");
};

const getComboboxByLabel = (labelText: RegExp | string): HTMLSelectElement => {
  const control = getControlForLabel(labelText);
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error(`Control for label "${String(labelText)}" is not a select.`);
  }

  return control;
};

const getInputByLabel = (labelText: RegExp | string): HTMLInputElement => {
  const control = getControlForLabel(labelText);
  if (!(control instanceof HTMLInputElement)) {
    throw new Error(`Control for label "${String(labelText)}" is not an input.`);
  }

  return control;
};

const getItemSelect = () => {
  const itemLabel = screen.getByText(/^Item$/i);
  const itemSelect = itemLabel.parentElement?.querySelector("select");
  if (!itemSelect) throw new Error("Item select not found");
  return itemSelect;
};

const fillRequiredCommonFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(getInputByLabel(/transaction no/i), "INV-01");
  await user.selectOptions(getItemSelect(), "21");

  const quantityInput = getControlForLabel(/quantity/i);
  if (!quantityInput || !(quantityInput instanceof HTMLInputElement)) {
    throw new Error("Quantity input not found");
  }

  await user.clear(quantityInput);
  await user.type(quantityInput, "2");
};

describe("IssuesReturnsPage adjustment flow", () => {
  test("shows destination scope only for adjustment increase", async () => {
    const { user } = await renderPage();

    const voucherTypeSelect = getComboboxByLabel(/voucher type/i);
    await user.selectOptions(voucherTypeSelect, "adjustment");

    expect(getControlForLabel(/from department/i)).not.toBeInTheDocument();
    expect(getControlForLabel(/to department/i)).toBeTruthy();
    expect(getControlForLabel(/to store/i)).toBeTruthy();
  });

  test("toggles adjustment direction from increase to decrease and updates required scope", async () => {
    const { user } = await renderPage();

    const voucherTypeSelect = getComboboxByLabel(/voucher type/i);
    await user.selectOptions(voucherTypeSelect, "adjustment");
    expect(getControlForLabel(/to department/i)).toBeTruthy();

    const decreaseRadio = screen.getByText(/decrease stock/i);
    await user.click(decreaseRadio);

    expect(getControlForLabel(/from department/i)).toBeTruthy();
    expect(getControlForLabel(/to department/i)).not.toBeInTheDocument();
  });

  test("prevents save for adjustment increase when destination scope is missing", async () => {
    const { user } = await renderPage();

    await user.selectOptions(getComboboxByLabel(/voucher type/i), "adjustment");
    await fillRequiredCommonFields(user);

    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => {
      expect(screen.getByText(/please complete to department id for adjustment/i)).toBeInTheDocument();
    });

    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  test("prevents save for adjustment decrease when source scope is missing", async () => {
    const { user } = await renderPage();

    await user.selectOptions(getComboboxByLabel(/voucher type/i), "adjustment");
    await user.click(screen.getByText(/decrease stock/i));
    await fillRequiredCommonFields(user);

    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => {
      expect(screen.getByText(/please complete from department id for adjustment/i)).toBeInTheDocument();
    });

    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  test("submits adjustment increase with destination scope and item row payload", async () => {
    const { user } = await renderPage();

    await user.selectOptions(getComboboxByLabel(/voucher type/i), "adjustment");
    await fillRequiredCommonFields(user);
    await user.selectOptions(getControlForLabel(/to department/i) as HTMLSelectElement, "2");
    await user.selectOptions(getControlForLabel(/to store/i) as HTMLSelectElement, "11");

    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => {
      expect(screen.getByText(/transaction saved with id/i)).toBeInTheDocument();
    });

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, payload] = mockedApi.post.mock.calls[0];
    expect(url).toBe("/inventory-transactions");
    expect(payload).toMatchObject({
      transaction_type: "adjustment",
      to_department_id: 2,
      to_store_id: 11,
      from_department_id: null,
      from_store_id: null,
      items: [
        expect.objectContaining({
          item_id: 21,
          quantity: 2,
        }),
      ],
    });
  });

  test("submits adjustment decrease with source scope and item row payload", async () => {
    const { user } = await renderPage();

    await user.selectOptions(getComboboxByLabel(/voucher type/i), "adjustment");
    await user.click(screen.getByText(/decrease stock/i));
    await fillRequiredCommonFields(user);
    await user.selectOptions(getControlForLabel(/from department/i) as HTMLSelectElement, "2");
    await user.selectOptions(getControlForLabel(/from store/i) as HTMLSelectElement, "11");

    await user.click(screen.getByRole("button", { name: /save transaction/i }));

    await waitFor(() => {
      expect(screen.getByText(/transaction saved with id/i)).toBeInTheDocument();
    });

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [, payload] = mockedApi.post.mock.calls[0];
    expect(payload).toMatchObject({
      transaction_type: "adjustment",
      to_department_id: null,
      to_store_id: null,
      from_department_id: 2,
      from_store_id: 11,
      items: [expect.objectContaining({ item_id: 21, quantity: 2 })],
    });
  });
});
