import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import ItAssetsPage from "./page";

const mockedApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: mockedApi.get,
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
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

const categories = [
  { id: 10, code: "IT", name: "IT Equipment", parent_category_id: null },
  { id: 11, code: "LAP", name: "Laptop / Notebook", parent_category_id: 10 },
  { id: 20, code: "LAB", name: "Lab Equipment", parent_category_id: null },
  { id: 21, code: "MIC", name: "Microscope", parent_category_id: 20 },
];

const itAsset = {
  id: 101,
  asset_id: "IT-LAP-00001",
  printable_tag_id: "TAG-IT-LAP-00001",
  serial_number: "DL5440-UOH-001",
  item_code: "IT-LAP-001",
  item_name: "Dell Latitude Laptop",
  category_id: 10,
  category_code: "IT",
  category_name: "IT Equipment",
  subcategory_code: "LAP",
  model: "Latitude 5440",
  status: "in_use",
  condition_status: "good",
  is_sensitive_controlled: true,
  department_id: 2,
  department_name: "IT Directorate",
  building_id: 4,
  building_name: "Admin Block",
  room_id: 5,
  room_name: "Server Room",
  store_id: 6,
  store_name: "IT Store",
  custodian_id: 7,
  custodian_name: "IT Manager",
};

const labAsset = {
  ...itAsset,
  id: 102,
  asset_id: "LAB-MIC-00001",
  item_name: "Digital Microscope",
  category_id: 20,
  category_code: "LAB",
  category_name: "Lab Equipment",
  subcategory_code: "MIC",
};

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: fakeStorage,
      configurable: true,
      writable: true,
    });
  }

  fakeStorage.clear();
  localStorage.setItem("ims_api_token", "test-token");

  mockedApi.get.mockImplementation((url: string) => {
    if (url === "/master-data/departments") {
      return Promise.resolve({ data: { data: [{ id: 2, code: "ITD", name: "IT Directorate" }] } });
    }

    if (url === "/master-data/asset-categories") {
      return Promise.resolve({ data: { data: categories } });
    }

    if (url === "/master-data/buildings") {
      return Promise.resolve({ data: { data: [{ id: 4, code: "ADM", name: "Admin Block" }] } });
    }

    if (url === "/master-data/rooms") {
      return Promise.resolve({ data: { data: [{ id: 5, code: "SRV", name: "Server Room" }] } });
    }

    if (url === "/users") {
      return Promise.resolve({ data: { data: [{ id: 7, name: "IT Manager" }] } });
    }

    if (url === "/reports/fixed-assets") {
      return Promise.resolve({ data: { data: [itAsset, labAsset] } });
    }

    return Promise.resolve({ data: { data: [] } });
  });
});

afterEach(() => {
  mockedApi.get.mockReset();
  fakeStorage.clear();
});

describe("ItAssetsPage", () => {
  test("loads IT category assets, hides non-IT rows, and renders actions", async () => {
    render(<ItAssetsPage />);

    await waitFor(() => {
      expect(screen.getByText("IT-LAP-00001")).toBeInTheDocument();
    });

    expect(screen.queryByText("LAB-MIC-00001")).not.toBeInTheDocument();
    expect(screen.getByText("Admin Block / Server Room")).toBeInTheDocument();
    expect(screen.getByText("IT Store")).toBeInTheDocument();
    expect(screen.getByText("TAG-IT-LAP-00001")).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: ".fs-4" }).length).toBeGreaterThan(0);

    const row = screen.getByText("IT-LAP-00001").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("LAP - Laptop / Notebook")).toBeInTheDocument();
    expect(within(row as HTMLTableRowElement).getByRole("link", { name: /View/i })).toHaveAttribute("href", "/assets/101");
    expect(within(row as HTMLTableRowElement).getByRole("link", { name: /Print Tag/i })).toHaveAttribute(
      "href",
      "/tag-print-log?asset_id=101&asset_code=IT-LAP-00001&suggested_tag=TAG-IT-LAP-00001",
    );
    expect(within(row as HTMLTableRowElement).getByRole("link", { name: /Movements/i })).toHaveAttribute(
      "href",
      "/assets/101/movements",
    );

    const fixedAssetsCall = mockedApi.get.mock.calls.find(([url]) => url === "/reports/fixed-assets");
    expect(fixedAssetsCall?.[1]).toMatchObject({ params: { category_id: "10" } });
  });

  test("sends report filters and applies local subcategory and condition filters", async () => {
    const user = userEvent.setup();
    render(<ItAssetsPage />);

    await waitFor(() => {
      expect(screen.getByText("IT-LAP-00001")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/Department/i), "2");
    await user.selectOptions(screen.getByLabelText(/Status/i), "in_use");
    await user.selectOptions(screen.getByLabelText(/Building/i), "4");
    await user.selectOptions(screen.getByLabelText(/Room/i), "5");
    await user.selectOptions(screen.getByLabelText(/Custodian/i), "7");

    await waitFor(() => {
      const latestCall = mockedApi.get.mock.calls.filter(([url]) => url === "/reports/fixed-assets").at(-1);
      expect(latestCall?.[1]).toMatchObject({
        params: {
          category_id: "10",
          department_id: "2",
          status: "in_use",
          building_id: "4",
          room_id: "5",
          custodian_id: "7",
        },
      });
    });

    await user.selectOptions(screen.getByLabelText(/Subcategory/i), "LAP");
    await user.selectOptions(screen.getByLabelText(/Condition/i), "damaged");

    expect(screen.queryByText("IT-LAP-00001")).not.toBeInTheDocument();
    expect(screen.getByText("No IT assets found.")).toBeInTheDocument();
  });
});
