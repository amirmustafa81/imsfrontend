import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import ReportsPage from "./page";

type LookupResponse = {
  data: {
    data: Array<{ id: number; code?: string; name?: string; project_code?: string; title?: string; title_code?: string }>;
  };
};

type ReportRow = {
  id: number;
  batch_no: string;
  item_name: string;
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
  stores: [{ id: 11, code: "MAIN", name: "Main Store" }],
  items: [{ id: 21, item_code: "ITM-001", name: "Test Item" }],
  "research-projects": [{ id: 41, project_code: "PRJ-01", title: "AI Lab" }],
  "asset-categories": [{ id: 31, name: "Lab Equipment" }],
  buildings: [{ id: 51, code: "BLD-A", name: "Block A" }],
  rooms: [{ id: 61, code: "R-101", name: "Lab 101" }],
  "funding-sources": [{ id: 71, code: "FS-1", name: "Grant A" }],
  suppliers: [{ id: 81, name: "Supplier One" }],
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

const reportRows = {
  controlled: [{ id: 101, batch_no: "BATCH-001", item_name: "Safety Gloves", status: "active" }] as ReportRow[],
  stock: [{ id: 102, batch_no: "-", item_name: "Screwdriver" }] as ReportRow[],
};

const buildGetResponse = (url: string) => {
  if (url === "/reports/controlled-stationery/batches") {
    return { data: { data: reportRows.controlled } };
  }
  if (url === "/reports/stock-balance") {
    return { data: { data: reportRows.stock } };
  }
  if (url === "/master-data/departments") {
    return { data: { data: lookupPayloads.departments } };
  }
  if (url === "/master-data/stores") {
    return { data: { data: lookupPayloads.stores } };
  }
  if (url === "/master-data/items") {
    return { data: { data: lookupPayloads.items } };
  }
  if (url === "/master-data/research-projects") {
    return { data: { data: lookupPayloads["research-projects"] } };
  }
  if (url === "/master-data/asset-categories") {
    return { data: { data: lookupPayloads["asset-categories"] } };
  }
  if (url === "/master-data/buildings") {
    return { data: { data: lookupPayloads.buildings } };
  }
  if (url === "/master-data/rooms") {
    return { data: { data: lookupPayloads.rooms } };
  }
  if (url === "/master-data/funding-sources") {
    return { data: { data: lookupPayloads["funding-sources"] } };
  }
  if (url === "/master-data/suppliers") {
    return { data: { data: lookupPayloads.suppliers } };
  }

  return { data: { data: [] } };
};

const seedLookupsAndReports = () => {
  mockedApi.get.mockImplementation((url: string) => Promise.resolve(buildGetResponse(url)));
  mockedApi.post.mockResolvedValue({ data: "batch_no,item_name\nBATCH-001,Safety Gloves" });
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
  seedLookupsAndReports();

  window.URL.createObjectURL = vi.fn().mockReturnValue("blob:url");
  window.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  mockedApi.get.mockReset();
  mockedApi.post.mockReset();
  mockedApi.delete.mockReset();
  fakeStorage.clear();
});

const getButtonByName = (name: string | RegExp) =>
  screen.getByRole("button", { name });

const renderPage = async () => {
  const user = userEvent.setup();
  render(<ReportsPage />);

  await waitFor(() => {
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText("Safety Gloves")).toBeInTheDocument();
  });

  return { user };
};

const getControlForLabel = (labelText: RegExp | string) => {
  const matcher =
    typeof labelText === "string"
      ? (value: string) => value.toLowerCase().includes(labelText.toLowerCase())
      : (value: string) => labelText.test(value);

  const label = Array.from(document.querySelectorAll("label")).find((node) =>
    matcher((node.textContent ?? "").trim()),
  );
  if (!label || !label.parentElement) return null;

  return label.parentElement.querySelector("select, input");
};

describe("ReportsPage export and filter flow", () => {
  test("loads default report rows on mount and includes auth header", async () => {
    await renderPage();

    const reportCall = mockedApi.get.mock.calls.find(([url]) => url === "/reports/controlled-stationery/batches");
    expect(reportCall).toBeTruthy();
    expect(reportCall?.[1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
        params: {},
      }),
    );

    expect(screen.getByText("Batch No")).toBeInTheDocument();
    expect(screen.getByText("Safety Gloves")).toBeInTheDocument();
  });

  test("sends filter payload with report request when query fields are set", async () => {
    await renderPage();
    mockedApi.get.mockClear();

    const user = userEvent.setup();

    const searchInput = getControlForLabel(/search/i) as HTMLInputElement;
    await user.type(searchInput, "Gloves");

    const statusSelect = getControlForLabel(/status/i) as HTMLSelectElement;
    await user.selectOptions(statusSelect, "active");

    const departmentSelect = getControlForLabel(/department/i) as HTMLSelectElement;
    await user.selectOptions(departmentSelect, "2");

    await waitFor(() => {
      const lastReportCall = mockedApi.get.mock.calls.findLast(([url]) => url === "/reports/controlled-stationery/batches");
      expect(lastReportCall).toBeTruthy();
      expect(lastReportCall?.[1]).toEqual(
        expect.objectContaining({
          params: expect.objectContaining({
            search: "Gloves",
            department_id: "2",
            status: "active",
          }),
        }),
      );
    });
  });

  test("exports report as excel with report name, format and payload filters", async () => {
    const { user } = await renderPage();

    const departmentSelect = getControlForLabel(/department/i) as HTMLSelectElement;
    await user.selectOptions(departmentSelect, "2");

    const searchInput = getControlForLabel(/search/i) as HTMLInputElement;
    await user.clear(searchInput);
    await user.type(searchInput, "Lab");

    await user.click(getButtonByName(/export excel/i));

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [payload, requestBody, requestConfig] = mockedApi.post.mock.calls[0];
    expect(payload).toBe("/reports/controlled-stationery/export");
    expect(requestBody).toEqual(
      expect.objectContaining({
        report: "controlled_stationery_batches",
        format: "excel",
        search: "Lab",
        department_id: "2",
      }),
    );
    expect(requestConfig).toEqual(
      expect.objectContaining({
        responseType: "blob",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  test("requires token before exporting excel", async () => {
    fakeStorage.removeItem("ims_api_token");
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.get.mockImplementation(() => Promise.resolve({ data: { data: [] } }));

    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("Load a report to begin.")).toBeInTheDocument();
    });

    await user.click(getButtonByName(/export excel/i));

    await waitFor(() => {
      expect(screen.getByText("Please save your token before exporting.")).toBeInTheDocument();
    });
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  test("switches report endpoint when report type changes", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("Safety Gloves")).toBeInTheDocument();
    });

    const stockBalanceButton = getButtonByName(/stock balance/i);
    await user.click(stockBalanceButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stock balance/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Screwdriver")).toBeInTheDocument();
    });

    const reportCall = mockedApi.get.mock.calls.findLast(([url]) => url === "/reports/stock-balance");
    expect(reportCall).toBeTruthy();
    expect(reportCall?.[1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  test("shows backend error when export export request fails", async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: "Export failed temporarily." } } });
    const { user } = await renderPage();

    const searchInput = getControlForLabel(/search/i) as HTMLInputElement;
    await user.clear(searchInput);
    await user.type(searchInput, "Lab");

    await user.click(getButtonByName(/export excel/i));

    await waitFor(() => {
      expect(screen.getByText("Excel export failed. Try again or reduce filters.")).toBeInTheDocument();
    });
  });
});

test("does not allow PDF export when no rows are loaded", async () => {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === "/reports/controlled-stationery/batches") {
      return Promise.resolve({ data: { data: [] } });
    }

    return Promise.resolve(buildGetResponse(url));
  });

  render(<ReportsPage />);

  await waitFor(() => {
    expect(screen.getByText("No rows found.")).toBeInTheDocument();
  });

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /export pdf/i }));

  await waitFor(() => {
    expect(screen.getByText("No rows to export. Select a report with data.")).toBeInTheDocument();
  });
});
