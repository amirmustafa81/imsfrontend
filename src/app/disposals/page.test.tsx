import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DisposalsPage from "./page";

type DisposalRow = {
  id: number;
  disposal_no: string;
  disposal_type: "disposed" | "written_off" | "auctioned" | "transferred" | "destroyed";
  status: "draft" | "recommended" | "approved" | "completed" | "cancelled";
  items_count?: number;
};

type ReportAsset = {
  id: number;
  asset_id: string;
  serial_number: string | null;
  item_code: string;
  item_name: string;
  status: string;
  category_name: string;
  department_name?: string | null;
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

const fixedAssetsPayload: ReportAsset[] = [
  {
    id: 101,
    asset_id: "AST-1001",
    serial_number: "SN-01",
    item_code: "ITM-LAP-01",
    item_name: "Dell Laptop",
    status: "in_store",
    category_name: "IT",
    department_name: "IT",
  },
];

const existingDisposals: DisposalRow[] = [
  {
    id: 7,
    disposal_no: "DSP-07",
    disposal_type: "disposed",
    status: "approved",
    items_count: 1,
  },
  {
    id: 8,
    disposal_no: "DSP-08",
    disposal_type: "written_off",
    status: "draft",
    items_count: 1,
  },
];

const seedInitialResponses = () => {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === "/disposals") {
      return Promise.resolve({ data: { data: existingDisposals } });
    }

    if (url === "/reports/fixed-assets") {
      return Promise.resolve({ data: { data: fixedAssetsPayload } });
    }

    return Promise.resolve({ data: { data: [] } });
  });

  mockedApi.post.mockResolvedValue({ data: { data: { id: 11, disposal_no: "DSP-11" } } });
  mockedApi.delete.mockResolvedValue({});
};

const getAssetSelects = (): HTMLSelectElement[] =>
  screen
    .getAllByRole("combobox")
    .filter((node) =>
      Array.from((node as HTMLSelectElement).options).some((option) => option.textContent?.trim() === "Select Asset"),
    ) as HTMLSelectElement[];

const getBookValueInput = (): HTMLInputElement =>
  screen.getAllByPlaceholderText("0").find((node) => (node as HTMLInputElement).type === "number") as HTMLInputElement;

const getReasonInput = (): HTMLInputElement =>
  screen.getByPlaceholderText(/Reason/i) as HTMLInputElement;

const renderPage = async () => {
  const user = userEvent.setup();
  render(<DisposalsPage />);

  await waitFor(() => {
    expect(screen.getByText(/Disposal List/i)).toBeInTheDocument();
  });

  return { user };
};

const postButtonForDisposal = (disposalNo: string): HTMLButtonElement => {
  const row = screen.getByText(disposalNo).closest("tr");
  if (!row) throw new Error(`Row for disposal ${disposalNo} not found`);
  const postButton = row.querySelector<HTMLButtonElement>("button[title='Post']");
  if (!postButton) throw new Error(`Post button for disposal ${disposalNo} not found`);
  return postButton;
};

const deleteButtonForDisposal = (disposalNo: string): HTMLButtonElement => {
  const row = screen.getByText(disposalNo).closest("tr");
  if (!row) throw new Error(`Row for disposal ${disposalNo} not found`);
  const deleteButton = row.querySelector<HTMLButtonElement>("button[title='Delete']");
  if (!deleteButton) throw new Error(`Delete button for disposal ${disposalNo} not found`);
  return deleteButton;
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

    window.confirm = vi.fn(() => true);
  }

  fakeStorage.clear();
  localStorage.setItem("ims_api_token", "test-token");
  seedInitialResponses();
});

afterEach(() => {
  mockedApi.get.mockReset();
  mockedApi.post.mockReset();
  mockedApi.delete.mockReset();
  fakeStorage.clear();
});

describe("DisposalsPage flows", () => {
  test("loads fixed assets and disposals with auth headers", async () => {
    await renderPage();

    const disposalsCall = mockedApi.get.mock.calls.find(([url]) => url === "/disposals");
    const fixedAssetCall = mockedApi.get.mock.calls.find(([url]) => url === "/reports/fixed-assets");

    expect(disposalsCall?.[1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(fixedAssetCall?.[1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );

    expect(screen.getByText(/DSP-07/i)).toBeInTheDocument();
    expect(screen.getByText(/AST-1001/i)).toBeInTheDocument();
  });

  test("prevents duplicate assets in disposal lines and blocks save", async () => {
    const { user } = await renderPage();

    await user.type(screen.getByPlaceholderText("DIS-001"), "DSP-NEW");

    const assetSelects = getAssetSelects();
    expect(assetSelects.length).toBe(1);
    await user.selectOptions(assetSelects[0], "101");

    await user.click(screen.getByRole("button", { name: /add item/i }));

    const updatedAssetSelects = getAssetSelects();
    expect(updatedAssetSelects.length).toBe(2);
    await user.selectOptions(updatedAssetSelects[1], "101");

    await user.click(screen.getByRole("button", { name: /save disposal/i }));

    await waitFor(() => {
      expect(screen.getByText(/Duplicate assets are not allowed in one disposal record\./i)).toBeInTheDocument();
    });

    expect(mockedApi.post).not.toHaveBeenCalledWith("/disposals", expect.anything(), expect.anything());
  });

  test("saves disposal with valid payload when items are valid", async () => {
    const { user } = await renderPage();

    await user.type(screen.getByPlaceholderText("DIS-001"), "DSP-NEW");
    const assetSelects = getAssetSelects();
    await user.selectOptions(assetSelects[0], "101");

    const bookValueInput = getBookValueInput();
    await user.clear(bookValueInput);
    await user.type(bookValueInput, "500");

    const reasonInput = getReasonInput();
    await user.type(reasonInput, "Obsolete");

    await user.click(screen.getByRole("button", { name: /save disposal/i }));

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, payload] = mockedApi.post.mock.calls[0];
    expect(url).toBe("/disposals");
    expect(payload).toMatchObject({
      disposal_no: "DSP-NEW",
      disposal_type: "disposed",
      items: [
        {
          asset_id: 101,
          book_value: 500,
          reason: "Obsolete",
          disposal_value: null,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(/Disposal records loaded/i)).toBeInTheDocument();
    });
  });

  test("posts disposal from row action and shows success", async () => {
    mockedApi.post.mockReset();
    mockedApi.post.mockResolvedValue({
      data: {
        message: "Disposal completed with asset updates.",
        data: existingDisposals[0],
      },
    });

    await renderPage();

    await userEvent.setup().click(postButtonForDisposal("DSP-07"));

    expect(mockedApi.post).toHaveBeenCalledWith("/disposals/7/post", {}, { headers: { Authorization: "Bearer test-token" } });
    await waitFor(() => {
      expect(screen.getByText(/Disposal records loaded/i)).toBeInTheDocument();
    });
  });

  test("can delete draft disposal", async () => {
    const user = userEvent.setup();
    mockedApi.delete.mockResolvedValue({});

    await renderPage();

    await user.click(deleteButtonForDisposal("DSP-08"));

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith("/disposals/8", { headers: { Authorization: "Bearer test-token" } });
    });
  });
});
